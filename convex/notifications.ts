import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireCurrentUser } from "./users";
import { aiNudgesAllowed } from "./entitlements";
import { isValidTimeZone, localTime, zonedTime, type NudgeKind, type SentNudge } from "../src/notifications/nudges";

/**
 * Coach nudges for AI subscribers.
 *
 * The app registers each device's Expo push token with the user's choices
 * (coach, language, time zone, hour). Every 15 minutes a cron (crons.ts)
 * picks up users whose nudge time has come; nudgeAI.ts then decides with
 * the shared rules (src/notifications/nudges.ts) whether there is anything
 * to say today, has the AI write it, and sends it through Expo's push
 * service (FCM on Android).
 *
 * Everyone without the AI subscription gets template nudges scheduled on
 * the phone instead: they never reach this code and never cost an AI call.
 * The subscription is checked here before anything is scheduled, and again
 * in nudgeAI.ts right before the AI call.
 */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const MAX_DEVICES = 10;
const DISPATCH_BATCH = 100;
/** A nudge this late (e.g. after an outage) is skipped: better silent than at 3 a.m. */
const MAX_LATENESS = 2 * 60 * MINUTE;
const LANGUAGES = ["en", "ar", "fr", "es", "hi"];

export const coachChoiceValidator = v.union(v.literal("mix"), v.literal("repai"), v.literal("chad"), v.literal("kevin"));

const PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;

/** Next nudge time: today's slot when it's still ahead (or only just passed), otherwise tomorrow's. */
function nextNudgeAt(now: number, hour: number, timeZone: string): number {
  const today = localTime(now, timeZone).day;
  const slot = zonedTime(today, hour, timeZone);
  return slot >= now - 30 * MINUTE ? slot : zonedTime(today + 1, hour, timeZone);
}

// ── Public API (the app) ─────────────────────────────────

/**
 * Register this device for AI nudges (or refresh it). Called by the app on
 * launch and when the user changes their coach, language or schedule.
 */
export const registerDevice = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("android"), v.literal("ios")),
    coach: coachChoiceValidator,
    language: v.string(),
    timeZone: v.string(),
    hour: v.float64(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireCurrentUser(ctx);
    if (!PUSH_TOKEN.test(args.token)) throw new Error("Invalid push token");
    if (!Number.isInteger(args.hour) || args.hour < 0 || args.hour > 23) throw new Error("Invalid hour");
    const timeZone = args.timeZone.length <= 64 && isValidTimeZone(args.timeZone) ? args.timeZone : "UTC";
    const language = LANGUAGES.includes(args.language) ? args.language : "en";
    const now = Date.now();

    // A token belongs to one device; if someone else signs in on it, it moves to them.
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId: user._id, platform: args.platform, updatedAt: now });
    } else {
      await ctx.db.insert("pushTokens", { userId: user._id, token: args.token, platform: args.platform, updatedAt: now });
      const devices = await ctx.db
        .query("pushTokens")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      const extra = devices.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, Math.max(0, devices.length - MAX_DEVICES));
      for (const d of extra) await ctx.db.delete(d._id);
    }

    const settings = {
      enabled: true,
      coach: args.coach,
      language,
      timeZone,
      hour: args.hour,
      nextAt: nextNudgeAt(now, args.hour, timeZone),
      updatedAt: now,
    };
    const row = await ctx.db
      .query("nudgeSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (row) await ctx.db.patch(row._id, settings);
    else await ctx.db.insert("nudgeSettings", { userId: user._id, ...settings });
  },
});

/** Stop AI nudges on this device (nudges turned off, signing out, subscription ended). */
export const unregisterDevice = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const user = await getCurrentUser(ctx);
    if (!user) return;
    const row = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!row || row.userId !== user._id) return;
    await ctx.db.delete(row._id);

    const left = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!left) {
      const settings = await ctx.db
        .query("nudgeSettings")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();
      if (settings) await ctx.db.patch(settings._id, { enabled: false });
    }
  },
});

// ── Cron ─────────────────────────────────────────────────

/** Every 15 minutes (crons.ts): start a nudge for each subscriber whose nudge time has come. */
export const dispatchDue = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const now = Date.now();
    const due = await ctx.db
      .query("nudgeSettings")
      .withIndex("by_nextAt", (q) => q.lte("nextAt", now))
      .take(DISPATCH_BATCH);

    let queued = 0;
    for (const s of due) {
      const today = localTime(now, s.timeZone).day;
      await ctx.db.patch(s._id, { nextAt: zonedTime(today + 1, s.hour, s.timeZone) });
      if (!s.enabled || now - s.nextAt > MAX_LATENESS) continue;

      // No AI subscription → no AI call. Checked again right before the call.
      const user = await ctx.db.get(s.userId);
      if (!user || !aiNudgesAllowed(user, now)) continue;

      const alreadyToday = await ctx.db
        .query("nudgeLog")
        .withIndex("by_userId_day", (q) => q.eq("userId", s.userId).eq("day", today))
        .first();
      if (alreadyToday) continue;

      // Spread the AI calls out a little.
      await ctx.scheduler.runAfter(queued++ * 500, internal.nudgeAI.sendNudge, { userId: s.userId });
    }

    if (due.length === DISPATCH_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.dispatchDue, {});
    }
  },
});

// ── Internal (used by nudgeAI.ts) ────────────────────────

export interface NudgeContext {
  user: Doc<"users">;
  settings: Doc<"nudgeSettings">;
  tokens: string[];
  sent: SentNudge[];
}

export const nudgeContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<NudgeContext | null> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const settings = await ctx.db
      .query("nudgeSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!settings) return null;
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const today = localTime(Date.now(), settings.timeZone).day;
    const log = await ctx.db
      .query("nudgeLog")
      .withIndex("by_userId_day", (q) => q.eq("userId", args.userId).gte("day", today - 14))
      .collect();
    return {
      user,
      settings,
      tokens: tokens.map((t) => t.token),
      sent: log
        .filter((l) => l.status !== "failed")
        .map((l) => ({ day: l.day, kind: l.kind as NudgeKind, group: l.group })),
    };
  },
});

/** Reserve today's nudge for a user. Null when one was already started today. */
export const claimNudge = internalMutation({
  args: {
    userId: v.id("users"),
    day: v.float64(),
    kind: v.string(),
    group: v.optional(v.string()),
    coach: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"nudgeLog"> | null> => {
    const existing = await ctx.db
      .query("nudgeLog")
      .withIndex("by_userId_day", (q) => q.eq("userId", args.userId).eq("day", args.day))
      .first();
    if (existing) return null;
    return await ctx.db.insert("nudgeLog", { ...args, status: "pending", createdAt: Date.now() });
  },
});

export const finishNudge = internalMutation({
  args: {
    logId: v.id("nudgeLog"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    body: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.logId, { status: args.status, body: args.body });
  },
});

/** Forget tokens Expo reports as no longer registered (app uninstalled, data cleared). */
export const removeTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    for (const token of args.tokens) {
      const row = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
      if (row) await ctx.db.delete(row._id);
    }
  },
});

export const userIdByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim()))
      .first();
    return user?._id ?? null;
  },
});
