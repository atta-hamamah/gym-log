"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";

/**
 * AI Chat Action
 * Queries the user's workout data from Convex, builds context,
 * and sends it to OpenAI GPT-4o for a personalized response.
 */
export const chat = action({
  args: {
    userId: v.id("users"),
    message: v.string(),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ── 1. Fetch user profile ──
    const user = await ctx.runQuery(api.users.getUserById, { userId: args.userId });
    if (!user) throw new Error("User not found");

    // ── 2. Fetch recent workouts (last 30) ──
    const workouts = await ctx.runQuery(api.workouts.getWorkoutsByUser, {
      userId: args.userId,
      limit: 30,
    });

    // ── 3. Fetch exercise details for each workout (limit to 15 for context size) ──
    const workoutSummaries = await Promise.all(
      workouts.slice(0, 15).map(async (workout: any) => {
        const exerciseLogs = await ctx.runQuery(api.workouts.getExerciseLogsByWorkout, {
          workoutId: workout._id,
        });

        const exerciseSummaries = await Promise.all(
          exerciseLogs.map(async (log: any) => {
            const sets = await ctx.runQuery(api.workouts.getSetsByExerciseLog, {
              exerciseLogId: log._id,
            });
            const normalSets = sets.filter((s: any) => s.type === "normal");
            const bestSet = normalSets.reduce(
              (best: any, s: any) => (s.weight > (best?.weight || 0) ? s : best),
              normalSets[0]
            );
            return {
              exercise: log.exerciseName,
              sets: normalSets.length,
              bestWeight: bestSet?.weight || 0,
              bestReps: bestSet?.reps || 0,
              totalVolume: normalSets.reduce((sum: number, s: any) => sum + s.weight * s.reps, 0),
            };
          })
        );

        const duration = workout.endTime
          ? Math.round((workout.endTime - workout.startTime) / 60000)
          : null;

        return {
          name: workout.name,
          date: new Date(workout.startTime).toISOString().split("T")[0],
          duration: duration ? `${duration} min` : "unknown",
          mood: workout.mood,
          exercises: exerciseSummaries,
        };
      })
    );

    // ── 4. Fetch personal records ──
    const prs = await ctx.runQuery(api.aiHelpers.getPersonalRecords, { userId: args.userId });

    // ── 5. Fetch body measurements ──
    const measurements = await ctx.runQuery(api.aiHelpers.getBodyMeasurements, { userId: args.userId });

    // ── 6. Build user context ──
    const age = user.dateOfBirth
      ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const userContext = `
USER PROFILE:
- Name: ${user.name}
- Age: ${age ? `${age} years old` : "unknown"}
- Gender: ${user.gender || "unknown"}
- Weight: ${user.weight ? `${user.weight}kg` : "unknown"}
- Height: ${user.height ? `${user.height}cm` : "unknown"}
- Body Fat: ${user.bodyFat ? `${user.bodyFat}%` : "unknown"}
- Total workouts: ${workouts.length}

RECENT WORKOUTS (last 15):
${workoutSummaries.map((w: any) => {
  const exerciseList = w.exercises
    .map((e: any) => `  • ${e.exercise}: ${e.sets} sets, best ${e.bestWeight}kg×${e.bestReps}, volume ${e.totalVolume}kg`)
    .join("\n");
  return `📅 ${w.date} — "${w.name}" (${w.duration}${w.mood ? `, mood ${w.mood}/5` : ""})
${exerciseList}`;
}).join("\n\n")}

PERSONAL RECORDS:
${prs.length > 0
  ? prs.map((pr: any) =>
      `• ${pr.exerciseName}: ${pr.type === "max_weight" ? `${pr.value}kg × ${pr.reps || "?"}reps` : pr.type === "est_1rm" ? `est 1RM ${pr.value}kg` : `volume ${pr.value}kg`}`
    ).join("\n")
  : "No PRs recorded yet."}

BODY MEASUREMENTS (latest):
${measurements.length > 0
  ? (() => {
      const m = measurements[0];
      const parts: string[] = [];
      if (m.chest) parts.push(`Chest: ${m.chest}cm`);
      if (m.waist) parts.push(`Waist: ${m.waist}cm`);
      if (m.biceps) parts.push(`Biceps: ${m.biceps}cm`);
      if (m.thighs) parts.push(`Thighs: ${m.thighs}cm`);
      if (m.neck) parts.push(`Neck: ${m.neck}cm`);
      if (m.hips) parts.push(`Hips: ${m.hips}cm`);
      if (m.calves) parts.push(`Calves: ${m.calves}cm`);
      return parts.length > 0 ? parts.join(", ") : "No measurements recorded.";
    })()
  : "No measurements recorded."}
`.trim();

    // ── 7. Call OpenAI ──
    const systemPrompt = `You are RepAI, an expert personal fitness coach and gym assistant built into the RepAI workout tracking app. You have access to the user's complete workout history, personal records, body measurements, and profile.

Your personality:
- Encouraging but honest. Give real advice, not generic motivation.
- Data-driven. Reference the user's actual numbers, dates, and progress.
- Concise. Keep answers short and actionable (2-4 paragraphs max unless asked for detail).
- Use emojis sparingly to feel friendly but don't overdo it.

Rules:
- Always reference the user's actual data when answering.
- If you don't have enough data to answer accurately, say so.
- Never invent data that doesn't exist.
- When suggesting workouts, consider what muscles they recently trained (avoid overlap).
- Use metric units (kg, cm) by default.
- If asked about nutrition, give general guidance but clarify you're not a nutritionist.

Here is the user's current data:

${userContext}`;

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...args.conversationHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: args.message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      max_tokens: 800,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
  },
});
