"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserInAction } from "./users";
import { requireAIAccess } from "./entitlements";
import { consumeAIQuota } from "./aiUsage";
import OpenAI from "openai";
import type { CoachData } from "./coachData";
import { buildWorkoutRequest, finalizeWorkout, requestWorkout } from "./workoutPlanner";

/**
 * AI Workout Generation Action
 * Builds the user's next session from their profile, equipment, recovery,
 * recent performance and today's request (prompt and validation live in
 * workoutPlanner.ts, shared with the evals).
 */
export const generateWorkout = action({
  args: {
    userComment: v.optional(v.string()),
    /** Minutes available today (overrides the profile's session length). */
    sessionMinutes: v.optional(v.float64()),
    /** Equipment available today (overrides the profile, e.g. training at home). */
    equipment: v.optional(v.array(v.string())),
    /** Muscle groups to focus on today. */
    focus: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const user = await requireUserInAction(ctx);
    await requireAIAccess(ctx, user);
    await consumeAIQuota(ctx, user, "workout");

    const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId: user._id, days: 45, maxWorkouts: 30 });
    const request = buildWorkoutRequest(user, data, args);
    const content = await requestWorkout(openai, request);

    try {
      const { workout, loadChanges, dropped } = finalizeWorkout(content, request, data);
      if (loadChanges.length) console.log("[AI Workout] Load safety net:", JSON.stringify(loadChanges));
      if (dropped.length) console.log("[AI Workout] Dropped exercises:", dropped.join(", "));
      return workout;
    } catch (e: any) {
      console.error("[AI Workout] Generation failed:", e, content);
      throw new Error("Failed to generate workout. Please try again.");
    }
  },
});
