import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireCurrentUser } from "./users";
import { planCheckInValidator, planFields } from "./validators";
import type { TrainingPlan } from "../src/types";

/**
 * AI training plans: storage and the app's read / end API. Building a plan
 * and the weekly check-in are actions in planAI.ts; their prompts live in
 * planner.ts. Each user has at most one active plan; a new one ends the old.
 */

/** The shape the app and the coach use (see src/types TrainingPlan). */
export function planFromDoc(doc: Doc<"trainingPlans">): TrainingPlan {
  return {
    id: doc._id,
    name: doc.name,
    goal: doc.goal,
    overview: doc.overview,
    progression: doc.progression,
    startDate: doc.startDate,
    weeks: doc.weeks,
    trainingDays: doc.trainingDays,
    sessionMinutes: doc.sessionMinutes,
    phases: doc.phases,
    sessions: doc.sessions,
    checkIns: doc.checkIns,
    createdAt: doc.createdAt,
  };
}

export async function activePlanDoc(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"trainingPlans"> | null> {
  return await ctx.db
    .query("trainingPlans")
    .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .order("desc")
    .first();
}

// ── App API ──────────────────────────────────────────────

/** The signed-in user's active plan, or null. */
export const active = query({
  args: {},
  handler: async (ctx): Promise<TrainingPlan | null> => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const doc = await activePlanDoc(ctx, user._id);
    return doc ? planFromDoc(doc) : null;
  },
});

/** Stop following a plan (its workouts stay in the history). */
export const end = mutation({
  args: { planId: v.id("trainingPlans") },
  handler: async (ctx, { planId }) => {
    const user = await requireCurrentUser(ctx);
    const doc = await ctx.db.get(planId);
    if (!doc || doc.userId !== user._id) throw new Error("Plan not found");
    await ctx.db.patch(planId, { status: "ended", updatedAt: Date.now() });
  },
});

// ── Internal (used by planAI.ts) ─────────────────────────

export const getForUser = internalQuery({
  args: { planId: v.id("trainingPlans"), userId: v.id("users") },
  handler: async (ctx, { planId, userId }): Promise<TrainingPlan | null> => {
    const doc = await ctx.db.get(planId);
    return doc && doc.userId === userId && doc.status === "active" ? planFromDoc(doc) : null;
  },
});

/** Save a new plan as the user's active one, ending any previous plan. */
export const create = internalMutation({
  args: { userId: v.id("users"), plan: v.object(planFields) },
  handler: async (ctx, { userId, plan }): Promise<Id<"trainingPlans">> => {
    const now = Date.now();
    const previous = await ctx.db
      .query("trainingPlans")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    for (const p of previous) await ctx.db.patch(p._id, { status: "ended", updatedAt: now });
    return await ctx.db.insert("trainingPlans", { userId, status: "active", ...plan, createdAt: now, updatedAt: now });
  },
});

/** Store a week's check-in (replacing an earlier one for the same week). */
export const saveCheckIn = internalMutation({
  args: { planId: v.id("trainingPlans"), userId: v.id("users"), checkIn: planCheckInValidator },
  handler: async (ctx, { planId, userId, checkIn }) => {
    const doc = await ctx.db.get(planId);
    if (!doc || doc.userId !== userId) throw new Error("Plan not found");
    const checkIns = [...doc.checkIns.filter((c) => c.week !== checkIn.week), checkIn].sort((a, b) => a.week - b.week);
    await ctx.db.patch(planId, { checkIns, updatedAt: Date.now() });
  },
});
