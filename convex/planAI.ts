"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUserInAction } from "./users";
import { requireAIAccess } from "./entitlements";
import { consumeAIQuota } from "./aiUsage";
import OpenAI from "openai";
import type { CoachData } from "./coachData";
import { buildCheckInRequest, buildPlanRequest, finalizeCheckIn, finalizePlan, normalizePlanArgs, requestCheckIn, requestPlan } from "./planner";
import type { PlanCheckIn, TrainingPlan } from "../src/types";

/**
 * AI training plan actions: build a plan, and the weekly check-in that
 * reviews last week and tunes the current one. Prompts and validation live
 * in planner.ts (shared with the tests and evals); storage in plans.ts.
 */

export const generate = action({
  args: {
    weeks: v.float64(),
    trainingDays: v.array(v.float64()),
    sessionMinutes: v.float64(),
    /** The user's local date the plan starts, "YYYY-MM-DD". */
    startDate: v.string(),
    goal: v.optional(v.string()),
    focus: v.optional(v.array(v.string())),
    comment: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ planId: Id<"trainingPlans"> }> => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const user = await requireUserInAction(ctx);
    await requireAIAccess(ctx, user);
    normalizePlanArgs(args); // reject bad input before it counts against the limit
    await consumeAIQuota(ctx, user, "plan");

    const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId: user._id, days: 45, maxWorkouts: 30 });
    const request = buildPlanRequest(user, data, args);
    const content = await requestPlan(openai, request);

    let plan;
    try {
      plan = finalizePlan(content, request, data);
    } catch (e) {
      console.error("[Plan] Generation failed:", e, content);
      throw new Error("Failed to build a plan. Please try again.");
    }
    const planId: Id<"trainingPlans"> = await ctx.runMutation(internal.plans.create, { userId: user._id, plan });
    return { planId };
  },
});

export const checkIn = action({
  args: {
    planId: v.id("trainingPlans"),
    week: v.float64(),
    comment: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PlanCheckIn> => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const user = await requireUserInAction(ctx);
    await requireAIAccess(ctx, user);
    const plan: TrainingPlan | null = await ctx.runQuery(internal.plans.getForUser, { planId: args.planId, userId: user._id });
    if (!plan) throw new Error("Plan not found");
    const week = Math.round(args.week);
    if (week < 2 || week > plan.weeks) throw new Error("Check-ins run from week 2");
    await consumeAIQuota(ctx, user, "plan");

    const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId: user._id, days: 28, maxWorkouts: 20 });
    const request = buildCheckInRequest(user, data, plan, week, {
      comment: args.comment?.trim().slice(0, 400) || undefined,
      language: args.language,
    });
    const content = await requestCheckIn(openai, request);

    let result: PlanCheckIn;
    try {
      result = finalizeCheckIn(content, request, data);
    } catch (e) {
      console.error("[Plan] Check-in failed:", e, content);
      throw new Error("Failed to complete the check-in. Please try again.");
    }
    await ctx.runMutation(internal.plans.saveCheckIn, { planId: args.planId, userId: user._id, checkIn: result });
    return result;
  },
});
