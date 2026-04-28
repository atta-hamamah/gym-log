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
const ENABLE_DYNAMIC_MODEL = true;

// Model definitions
const MODEL_CHEAP = "gpt-4o-mini";   // Fast, cheap — simple Q&A, classification
const MODEL_SMART = "gpt-5.1";        // Powerful — deep analysis & advice

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

// Model for Aura Generation. Change to "gpt-4o" for better reasoning/humor.
const AURA_MODEL = "gpt-5.1";

export const generateWorkoutAura = action({
  args: {
    workoutId: v.id("workouts"),
    language: v.optional(v.string()),
    characterMode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    auraTitle: string;
    auraDescription: string;
    durationMin?: number;
    exerciseCount?: number;
    totalVolume?: number;
    totalSets?: number;
  }> => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const details: any = await ctx.runQuery(api.workouts.getWorkoutDetailsForAura, {
      workoutId: args.workoutId,
    });

    const durationMin: number | null = details.workout.endTime && details.workout.startTime
      ? Math.round((details.workout.endTime - details.workout.startTime) / 60000)
      : null;

    let exerciseSummary = "";
    details.exercises.forEach((ex: any) => {
      exerciseSummary += `- ${ex.name}: ${ex.sets} sets, ${ex.volume}kg total volume\n`;
    });

    // Language instruction for the AI
    const lang = args.language || "en";
    const LANGUAGE_MAP: Record<string, string> = {
      en: "Write your response in English.",
      ar: "Write your response in Egyption",
      fr: "Write your response in French.",
      es: "Write your response in Spanish.",
      hi: "Write your response in English.",
    };
    const languageInstruction = LANGUAGE_MAP[lang] || `Write your response in the language with code: ${lang}.`;

    const characterMode = args.characterMode || "default";

    let personalityAndTask = "";
    if (characterMode === "chad") {
      personalityAndTask = `You are Chad — the ultimate gym alpha who's been lifting since birth. You bench 315 for warm-up and look down on everyone's workout with the energy of Gordon Ramsay in a kitchen. You roast the user mercilessly but in a funny, gym-bro way. You refer to yourself as Chad occasionally. Never be actually cruel — just hilariously brutal.

Your task:
1. Assign them a brutally honest, roast-style "Gym Archetype" title (e.g., "The Warm-Up Warrior", "The Cardio Bunny Who Wandered In", "The Quarter-Rep King").
2. Calculate what pathetically small real-world object their total volume roughly equals. Make the comparison deliberately insulting but funny (e.g., "a baby stroller", "half a shopping cart of excuses").
3. Write a 2-sentence savage roast combining their archetype and the object comparison. Maximum Chad energy. Make it sting but make them laugh.`;
    } else if (characterMode === "kevin") {
      personalityAndTask = `You are Kevin — a lazy, unmotivated guy who genuinely does not understand why anyone would voluntarily go to the gym. You are passive-aggressive, deeply sarcastic, and low-key jealous they're working out while you're eating chips on the couch. You reluctantly analyze their workout while complaining about how exhausting even READING about it is. You refer to yourself as Kevin occasionally.

Your task:
1. Assign them a passive-aggressive "Gym Archetype" title from someone who hates exercise (e.g., "The Unnecessarily Active", "The Person Who Could've Been Napping", "The Voluntary Sufferer").
2. Calculate what real-world object their total volume roughly equals, but frame it as absurdly unnecessary effort (e.g., "congratulations, you could've just NOT lifted 3 refrigerators today").
3. Write a 2-sentence passive-aggressive summary that makes exercise sound pointless but grudgingly acknowledges they showed up. Maximum Kevin energy.`;
    } else {
      personalityAndTask = `You are an analyzer for a fitness app.

Your task:
1. Assign them a funny, slightly sarcastic "Gym Archetype" title based on their behavior (e.g., if they rest a lot, if they rush, if they only did arms).
2. Calculate what real-world object their total volume roughly equals (e.g., a small car, 3 grizzly bears, etc.). Use an absolutely ridiculous but accurate equivalent.
3. Write a 2-sentence summary combining their archetype and the real-world object. Make it witty and optimized for Gen-Z/Millennial humor.`;
    }

    const prompt = `
${personalityAndTask}

Look at this user's workout data from today:
- Duration: ${durationMin ? durationMin + " minutes" : "Unknown"}
- Total Exercises: ${details.exercises.length}
- Total Sets: ${details.totalSets}
- Total Volume Lifted: ${details.totalVolume} kg
Exercises:
${exerciseSummary}

IMPORTANT RULES:
- ${languageInstruction}
- Do NOT use any religious references (no "gods", "divine", "blessed", "آلهة", etc.). Keep it purely gym/fitness themed.

Return ONLY a JSON object with this exact structure:
{
  "auraTitle": "The string title here",
  "auraDescription": "The 2-sentence description here"
}
Do NOT wrap it in markdown block quotes. Just raw JSON.
`;

    try {
      const response = await openai.chat.completions.create({
        model: AURA_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content generated");

      const parsed = JSON.parse(content);
      const auraTitle = parsed.auraTitle || "The Mystery Lifter";
      const auraDescription = parsed.auraDescription || "We couldn't analyze this workout, but we respect the grind.";

      // Update the workout in the DB
      await ctx.runMutation(api.workouts.updateWorkoutAura, {
        workoutId: args.workoutId,
        auraTitle,
        auraDescription,
      });

      return {
        auraTitle,
        auraDescription,
        durationMin: durationMin ?? undefined,
        exerciseCount: details.exercises.length,
        totalVolume: Math.round(details.totalVolume),
        totalSets: details.totalSets,
      };
    } catch (e) {
      console.error("Failed to generate aura:", e);
      return {
        auraTitle: "The Quiet Grinder",
        auraDescription: "You moved weight today. No jokes, just respect.",
      };
    }
  },
});
