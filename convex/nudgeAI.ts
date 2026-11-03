"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { CoachData } from "./coachData";
import type { NudgeContext } from "./notifications";
import { aiNudgesAllowed } from "./entitlements";
import { describeWorkout, fmtWeight, unitsOf, type Units } from "./coachPrompt";
import { AI_MODEL, temperatureFor } from "./aiModels";
import { resolveSession } from "../src/utils/trainingPlan";
import {
  coachFor,
  localTime,
  planDaysFor,
  planNudges,
  sampleNudge,
  toNudgeWorkouts,
  weekdayOf,
  type Coach,
  type Nudge,
  type NudgeWorkout,
} from "../src/notifications/nudges";

/**
 * AI-written coach nudges for AI subscribers (scheduled by notifications.ts).
 *
 * Order matters for cost: subscription → a device to send to → the shared
 * rules find something worth saying today → today's slot is claimed → only
 * then one short AI call (~1k tokens). Most days end before the AI call.
 *
 * Environment (optional): EXPO_ACCESS_TOKEN, if "enhanced push security"
 * is turned on for the project at expo.dev.
 */

const NUDGE_MODEL = AI_MODEL;
const MAX_BODY = 180;

/** Notification title per coach, as the app shows the names (locales: nudges.coachName). */
const COACH_TITLES: Record<string, Record<Coach, string>> = {
  en: { repai: "RepAI Coach", chad: "Chad 🔥", kevin: "Kevin 🛋️" },
  es: { repai: "Coach RepAI", chad: "Chad 🔥", kevin: "Kevin 🛋️" },
  fr: { repai: "Coach RepAI", chad: "Chad 🔥", kevin: "Kevin 🛋️" },
  hi: { repai: "RepAI कोच", chad: "Chad 🔥", kevin: "Kevin 🛋️" },
  ar: { repai: "مدرب RepAI", chad: "تشاد 🔥", kevin: "كيفن 🛋️" },
};

const PERSONAS: Record<Coach, string> = {
  repai:
    "You are RepAI Coach, an elite personal trainer: warm, motivating, specific and data-driven. Never sarcastic.",
  chad:
    "You are Chad, the ultimate gym alpha who has been lifting since birth. You roast people in a funny gym-bro way, like Gordon Ramsay in a gym: brutal about excuses and effort, never actually cruel, and you clearly want them to train.",
  kevin:
    "You are Kevin, a lazy couch potato who doesn't understand why anyone exercises. Passive-aggressive, sarcastic and low-key jealous. You use reverse psychology: you 'support' skipping the gym, which makes people want to go.",
};

const LANGUAGES: Record<string, string> = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", hi: "Hindi" };
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Entry points ─────────────────────────────────────────

/** Today's nudge for one user (from the cron in notifications.ts). */
export const sendNudge = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string> => runNudge(ctx, args.userId, false),
});

/**
 * Send a test nudge now, ignoring the time and the caps (still needs the AI
 * subscription and a registered device). From the dashboard or:
 *   npx convex run nudgeAI:sendTestNudge '{"email":"you@example.com"}'
 */
export const sendTestNudge = internalAction({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const userId = await ctx.runQuery(internal.notifications.userIdByEmail, { email: args.email });
    if (!userId) return "No user with that email";
    return runNudge(ctx, userId, true);
  },
});

/** Expo's delivery receipts, ~15 minutes after sending: forget devices that are gone. */
export const checkReceipts = internalAction({
  args: { tickets: v.array(v.object({ id: v.string(), token: v.string() })) },
  handler: async (ctx, args): Promise<void> => {
    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({ ids: args.tickets.map((t) => t.id) }),
    });
    if (!response.ok) {
      console.warn("[nudges] Receipt check failed:", response.status, await response.text());
      return;
    }
    const json = (await response.json()) as { data?: Record<string, PushResult> };
    const gone: string[] = [];
    for (const t of args.tickets) {
      const receipt = json.data?.[t.id];
      if (receipt?.status !== "error") continue;
      if (receipt.details?.error === "DeviceNotRegistered") gone.push(t.token);
      else console.warn("[nudges] Delivery failed:", receipt.message, receipt.details?.error);
    }
    if (gone.length) await ctx.runMutation(internal.notifications.removeTokens, { tokens: gone });
  },
});

// ── The pipeline ─────────────────────────────────────────

async function runNudge(ctx: ActionCtx, userId: Id<"users">, test: boolean): Promise<string> {
  const info: NudgeContext | null = await ctx.runQuery(internal.notifications.nudgeContext, { userId });
  if (!info) return "No nudge settings (the app hasn't registered a device)";
  const { user, settings, tokens } = info;

  // 1. Paying for AI? Checked before anything else costs money.
  if (!aiNudgesAllowed(user)) return "No active AI subscription";
  if (tokens.length === 0) return "No device to send to";
  if (!settings.enabled && !test) return "Nudges are off";

  // 2. Anything worth saying today? (Same rules as the app's template nudges.)
  const now = Date.now();
  const today = localTime(now, settings.timeZone).day;
  const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId, days: 60, maxWorkouts: 40 });
  const customGroups = Object.fromEntries(data.customExercises.map((c) => [c.id, c.muscleGroup]));
  const workouts = toNudgeWorkouts(data.workouts, customGroups, settings.timeZone);
  const planDays = data.plan ? planDaysFor(data.plan, data.workouts, today, today) : undefined;
  const picked = planNudges({ today, workouts, planDays, sent: test ? [] : info.sent }, today, today)[0]
    ?? (test ? sampleNudge(today, workouts) : null);
  if (!picked) return "Nothing to say today";
  const nudge: Nudge = picked;

  // 3. One nudge a day: claim today's slot before spending anything.
  const coach = coachFor(settings.coach, today);
  let logId: Id<"nudgeLog"> | null = null;
  if (!test) {
    logId = await ctx.runMutation(internal.notifications.claimNudge, {
      userId,
      day: today,
      kind: nudge.kind,
      group: nudge.group,
      coach,
    });
    if (!logId) return "Already nudged today";
  }

  // 4. The AI writes it.
  let body: string | null = null;
  try {
    body = await writeNudge({ user, data, nudge, workouts, coach, language: settings.language, now });
  } catch (e) {
    console.error("[nudges] AI failed:", e);
  }
  if (!body) {
    if (logId) await ctx.runMutation(internal.notifications.finishNudge, { logId, status: "failed" });
    return "AI failed";
  }

  // 5. Send it to every device of the account.
  const messages = tokens.map((to) => ({
    to,
    title: (COACH_TITLES[settings.language] ?? COACH_TITLES.en)[coach],
    body,
    sound: "default" as const,
    channelId: "coach",
    data: { type: "nudge", kind: nudge.kind, coach },
  }));
  let results: PushResult[] = [];
  try {
    results = await sendPush(messages);
  } catch (e) {
    console.error("[nudges] Push failed:", e);
    if (logId) await ctx.runMutation(internal.notifications.finishNudge, { logId, status: "failed", body });
    return "Push failed";
  }
  if (logId) await ctx.runMutation(internal.notifications.finishNudge, { logId, status: "sent", body });

  const gone = results
    .map((r, i) => (r.status === "error" && r.details?.error === "DeviceNotRegistered" ? tokens[i] : null))
    .filter((t): t is string => !!t);
  if (gone.length) await ctx.runMutation(internal.notifications.removeTokens, { tokens: gone });
  const tickets = results
    .map((r, i) => (r.status === "ok" && r.id ? { id: r.id, token: tokens[i] } : null))
    .filter((t): t is { id: string; token: string } => !!t);
  if (tickets.length) await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nudgeAI.checkReceipts, { tickets });

  return `Sent (${nudge.kind}, ${coach}): ${body}`;
}

// ── Writing ──────────────────────────────────────────────

function nudgeFacts(nudge: Nudge, data: CoachData, workouts: NudgeWorkout[], units: Units): string {
  const lastDay = workouts.length ? Math.max(...workouts.map((w) => w.day)) : null;
  const sinceLast = lastDay === null ? "They haven't logged a workout yet." : `Days since their last workout: ${nudge.day - lastDay}.`;
  switch (nudge.kind) {
    case "planDay": {
      let detail = "";
      if (data.plan && nudge.planWeek && nudge.planSessionId) {
        const resolved = resolveSession(data.plan, nudge.planWeek, nudge.planSessionId);
        if (resolved) {
          detail = "\nToday's exercises: " + resolved.exercises
            .slice(0, 5)
            .map((e) => `${e.exerciseName} ${e.sets}×${e.reps}${e.targetWeight ? ` @ ${fmtWeight(e.targetWeight, units)}` : ""}`)
            .join("; ");
          if (resolved.deload) detail += "\nIt's a deload week (lighter on purpose).";
        }
      }
      return `Their training plan has "${nudge.session}" today (week ${nudge.planWeek}) and they haven't trained yet today. ${sinceLast}${detail}\nGoal: get them to do today's session.`;
    }
    case "comeback":
      return `It's been ${nudge.days} days since their last workout, longer than their usual rhythm.\nGoal: get them back with one easy session.`;
    case "usualDay":
      return `Today is ${WEEKDAYS[weekdayOf(nudge.day)]}, a day they usually train, and they haven't trained yet. ${sinceLast}\nGoal: keep their routine going today.`;
    case "welcome":
      return "They installed the app but haven't logged a workout yet.\nGoal: get them to do and log their first workout.";
    case "muscleGap":
      return `They train regularly but haven't trained ${nudge.group} directly in ${nudge.days} days.\nGoal: get them to include ${nudge.group} in their next session.`;
    case "weeklyRecap": {
      const prev = workouts.filter((w) => w.day <= nudge.day - 7 && w.day > nudge.day - 14);
      const prevVolume = prev.reduce((n, w) => n + w.volumeKg, 0);
      const prevText = prev.length
        ? `The week before: ${prev.length} workouts, ${fmtWeight(prevVolume, units)}.`
        : "They didn't train the week before.";
      return `Their last 7 days: ${nudge.workouts} workouts, ${nudge.sets} working sets, ${fmtWeight(nudge.volumeKg ?? 0, units)} lifted in total. ${prevText}\nGoal: a short weekly recap that makes them want to keep going next week.`;
    }
  }
}

async function writeNudge(opts: {
  user: Doc<"users">;
  data: CoachData;
  nudge: Nudge;
  workouts: NudgeWorkout[];
  coach: Coach;
  language: string;
  now: number;
}): Promise<string | null> {
  const { user, data, nudge, workouts, coach, language, now } = opts;
  const units = unitsOf(user);
  const recent = data.workouts
    .slice(0, 3)
    .map((w) => describeWorkout(w, units, now, "brief"))
    .join("\n");
  const profile = [
    user.name ? `Name: ${user.name.split(" ")[0]}` : null,
    user.goal ? `Goal: ${user.goal.slice(0, 200)}` : null,
    user.limitations ? `Injuries / limitations (never joke about these): ${user.limitations.slice(0, 200)}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `${PERSONAS[coach]}

Write ONE push notification from you to this user.

WHY YOU'RE MESSAGING:
${nudgeFacts(nudge, data, workouts, units)}

ABOUT THEM:
${profile || "(no profile)"}
${recent ? `Recent workouts (newest first):\n${recent}` : "No recent workouts."}

RULES:
- Write it in ${LANGUAGES[language] ?? "English"}.
- 1-2 short sentences, at most ${MAX_BODY - 40} characters. It's a phone notification.
- Be specific: use their real numbers, exercises or session name from above. Never invent numbers.
- Stay in character, but only ever roast effort and excuses: never their body, weight, looks, age, gender, injuries or limitations.
- No religious references, no hashtags, at most one emoji. Don't start with your own name (it's already the title).

Return JSON: {"body": "the notification text"}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: NUDGE_MODEL,
    messages: [{ role: "user", content: prompt }],
    ...temperatureFor(NUDGE_MODEL, 0.9),
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "nudge",
        strict: true,
        schema: {
          type: "object",
          properties: { body: { type: "string" } },
          required: ["body"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return cleanBody(JSON.parse(content).body);
}

/** Trim, unquote and cap the length (cut at a word boundary). */
export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let body = raw.trim().replace(/^["“«]+|["”»]+$/g, "").trim();
  if (!body) return null;
  if (body.length > MAX_BODY) {
    const cut = body.slice(0, MAX_BODY - 1);
    const space = cut.lastIndexOf(" ");
    body = (space > MAX_BODY / 2 ? cut.slice(0, space) : cut).trimEnd() + "…";
  }
  return body;
}

// ── Expo push service ────────────────────────────────────

interface PushResult {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function expoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  return headers;
}

/** Send up to 100 messages; returns one ticket per message, in order. */
async function sendPush(messages: Record<string, unknown>[]): Promise<PushResult[]> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: expoHeaders(),
    body: JSON.stringify(messages.slice(0, 100)),
  });
  if (!response.ok) throw new Error(`Expo push ${response.status}: ${await response.text()}`);
  const json = (await response.json()) as { data?: PushResult[] };
  return json.data ?? [];
}
