import { ConvexError, v } from "convex/values";
import { internalMutation, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { isAllowlisted } from "./entitlements";

/**
 * Fair-use limits for the AI features, so one user can't run up an
 * unbounded OpenAI bill. Counted per user in UTC days and calendar months.
 *
 * Sized on GPT-6.1 Terra's measured costs (evals, Nov 2026: ~$0.004-0.006
 * per chat answer, ~$0.0075 per workout, ~$0.004 per summary): a user who
 * maxes out everything costs about $4/month, while a heavy real user
 * (~200 chat messages a month) never gets near a limit. Change the numbers
 * here; nothing else needs to change.
 */
export const AI_LIMITS = {
  chat: { day: 50, month: 500 },
  workout: { day: 10, month: 60 },
  /** Post-workout summaries; switching character (Coach / Chad / Kevin) is another call. */
  aura: { day: 30, month: 200 },
} as const;

export type AIFeature = keyof typeof AI_LIMITS;

export const AI_LIMIT_REACHED = "AI_LIMIT_REACHED";

/** Which limit (if any) blocks one more use. */
export function quotaDecision(used: { day: number; month: number }, limit: { day: number; month: number }): "ok" | "day" | "month" {
  if (used.month >= limit.month) return "month";
  if (used.day >= limit.day) return "day";
  return "ok";
}

/** UTC day key, e.g. "2026-11-02". */
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Count one use, unless it would go over a limit (atomic: mutations are transactions). */
export const consume = internalMutation({
  args: {
    userId: v.id("users"),
    feature: v.union(v.literal("chat"), v.literal("workout"), v.literal("aura")),
  },
  handler: async (ctx, { userId, feature }): Promise<{ ok: true } | { ok: false; period: "day" | "month"; limit: number }> => {
    const today = dayKey(Date.now());
    const monthStart = `${today.slice(0, 8)}01`;
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_userId_feature_day", (q) => q.eq("userId", userId).eq("feature", feature).gte("day", monthStart))
      .collect();
    const todayRow = rows.find((r) => r.day === today);
    const used = { day: todayRow?.count ?? 0, month: rows.reduce((sum, r) => sum + r.count, 0) };

    const limit = AI_LIMITS[feature];
    const decision = quotaDecision(used, limit);
    if (decision !== "ok") return { ok: false, period: decision, limit: limit[decision] };

    if (todayRow) await ctx.db.patch(todayRow._id, { count: todayRow.count + 1 });
    else await ctx.db.insert("aiUsage", { userId, feature, day: today, count: 1 });
    return { ok: true };
  },
});

/**
 * For AI actions, after requireAIAccess: counts one use, or throws
 * AI_LIMIT_REACHED (with the period and limit) when the user is over.
 * Test / admin accounts (AI_ACCESS_EMAILS) are never limited.
 */
export async function consumeAIQuota(ctx: ActionCtx, user: Doc<"users">, feature: AIFeature): Promise<void> {
  if (isAllowlisted(user.email)) return;
  const result = await ctx.runMutation(internal.aiUsage.consume, { userId: user._id, feature });
  if (!result.ok) {
    console.warn(`[aiUsage] ${feature} ${result.period} limit (${result.limit}) reached for user ${user._id}`);
    throw new ConvexError({ code: AI_LIMIT_REACHED, feature, period: result.period, limit: result.limit });
  }
}
