"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";

// ══════════════════════════════════════════════════════════
// DYNAMIC MODEL ROUTING
// Set to true to enable smart model for complex queries.
// When false, ALL queries use the cheap model (saves cost).
// ══════════════════════════════════════════════════════════
const ENABLE_DYNAMIC_MODEL = false;

// Model definitions
const MODEL_CHEAP = "gpt-4o-mini";   // Fast, cheap — simple Q&A, classification
const MODEL_SMART = "gpt-4.1";        // Powerful — deep analysis & advice

/**
 * Use a tiny, cheap AI call to classify whether the user's message
 * requires the smart model or the cheap one.
 *
 * Cost: ~30 input tokens + 1 output token ≈ $0.00002 per classification.
 * This is far more accurate than keyword matching — it understands intent,
 * slang, misspellings, and works across all languages.
 */
async function classifyIntent(openai: OpenAI, message: string): Promise<string> {
  if (!ENABLE_DYNAMIC_MODEL) return MODEL_CHEAP;

  try {
    const classification = await openai.chat.completions.create({
      model: MODEL_CHEAP,
      messages: [
        {
          role: "system",
          content: `You are a message classifier for a gym tracking app AI assistant. Your job is to decide if a user's message is SIMPLE or COMPLEX.

SIMPLE = quick factual questions, greetings, short answers, definitions, basic tips.
Examples: "How many sets for chest?", "What is RPE?", "Hi", "Thanks!", "How much protein per day?"

COMPLEX = needs deep analysis of the user's workout data, creating plans, analyzing progress/plateaus, body composition advice, programming recommendations, injury assessment, or any request requiring reasoning over their training history.
Examples: "Analyze my squat progress", "Why am I not getting stronger?", "Create a PPL routine for me", "Should I bulk or cut?", "Compare my bench to my deadlift ratio", "I have pain in my shoulder when pressing"

Reply with ONLY the single word: SIMPLE or COMPLEX`,
        },
        { role: "user", content: message },
      ],
      max_tokens: 3,
      temperature: 0,
    });

    const result = classification.choices[0]?.message?.content?.trim().toUpperCase();
    return result === "COMPLEX" ? MODEL_SMART : MODEL_CHEAP;
  } catch {
    // If classification fails, fall back to cheap model
    return MODEL_CHEAP;
  }
}

/**
 * AI Chat Action
 * Queries the user's workout data from Convex, builds context,
 * and sends it to OpenAI with dynamic model routing.
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

    // ── 2. Fetch recent workouts (last 1 year, capped at 100) ──
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const workouts = await ctx.runQuery(api.workouts.getWorkoutsByUser, {
      userId: args.userId,
      limit: 100,
      sinceTimestamp: oneYearAgo,
    });

    // ── 3. Fetch exercise details for the 20 most recent workouts ──
    const workoutSummaries = await Promise.all(
      workouts.slice(0, 20).map(async (workout: any) => {
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

    // ── 4. Fetch yearly aggregate stats (computed server-side) ──
    const yearlyStats = await ctx.runQuery(api.aiHelpers.getYearlyStats, { userId: args.userId });

    // ── 5. Fetch personal records ──
    const prs = await ctx.runQuery(api.aiHelpers.getPersonalRecords, { userId: args.userId });

    // ── 6. Fetch body measurements ──
    const measurements = await ctx.runQuery(api.aiHelpers.getBodyMeasurements, { userId: args.userId });

    // ── 7. Build user context ──
    const age = user.dateOfBirth
      ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const yearlyStatsBlock = yearlyStats.totalWorkouts > 0
      ? `YEARLY TRAINING STATS (last 365 days):
- Total workouts: ${yearlyStats.totalWorkouts}
- Average workout duration: ${yearlyStats.avgDurationMin} min
- Training frequency: ${yearlyStats.sessionsPerWeek} sessions/week
- Most trained exercises: ${yearlyStats.topExercises.map((e: any) => `${e.name} (${e.count} sessions)`).join(", ")}`
      : "YEARLY TRAINING STATS: No workouts in the last year.";

    const userContext = `
USER PROFILE:
- Name: ${user.name}
- Age: ${age ? `${age} years old` : "unknown"}
- Gender: ${user.gender || "unknown"}
- Weight: ${user.weight ? `${user.weight}kg` : "unknown"}
- Height: ${user.height ? `${user.height}cm` : "unknown"}
- Body Fat: ${user.bodyFat ? `${user.bodyFat}%` : "unknown"}
- Fitness Goal: ${user.goal || "not specified"}

${yearlyStatsBlock}

RECENT WORKOUTS (last 20):
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

    // ── 8. Classify intent & select model ──
    const selectedModel = await classifyIntent(openai, args.message);

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...args.conversationHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: args.message },
    ];

    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages: chatMessages,
      max_tokens: selectedModel === MODEL_SMART ? 1200 : 800,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
  },
});
