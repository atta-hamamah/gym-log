"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserInAction } from "./users";
import { requireAIAccess } from "./entitlements";
import OpenAI from "openai";
import { workoutValidator } from "./validators";
import type { CoachData } from "./coachData";
import { analyzeRecovery, buildCoachContext, describeWorkout, fmtWeight, fromClientWorkout, unitsOf } from "./coachPrompt";

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
      max_completion_tokens: 3,
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
 * Loads the user's training data in one query, builds the coach context
 * (every set, plan vs. actual, rest times, recovery, trends, the workout in
 * progress) and answers with dynamic model routing.
 */
export const chat = action({
  args: {
    message: v.string(),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    /** The workout the user is doing right now (only stored on the device until finished). */
    activeWorkout: v.optional(workoutValidator),
  },
  handler: async (ctx, args) => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const user = await requireUserInAction(ctx);
    await requireAIAccess(ctx, user);

    const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId: user._id });
    const context = buildCoachContext(user, data, {
      activeWorkout: args.activeWorkout ? fromClientWorkout(args.activeWorkout) : null,
    });

    const systemPrompt = `You are RepAI, an expert strength & conditioning coach built into the RepAI workout tracking app. You can see the user's profile, every logged set (weights, reps, RPE, set type), what their plan prescribed vs. what they actually did, measured rest times between sets, session durations, energy ratings, notes, muscle recovery, weekly volume per muscle group, strength trends and PRs — and the workout they are doing right now, if any.

Personality:
- Encouraging but honest. Give real, specific advice, not generic motivation.
- Data-driven: reference their actual numbers, dates, rest times and trends.
- Concise: 2-4 short paragraphs or a tight list, unless they ask for detail.
- Use emojis sparingly.

How to coach:
- Compare plan vs. actual: missed sets, reps below the target range, rests much longer/shorter than planned, sessions longer than their preferred length.
- Judge rest times by goal: ~2-5 min for heavy compound strength work, ~60-120s for hypertrophy, 30-60s for isolation/conditioning. Rest is measured between set-log taps, so a single very long gap may just be a late tap.
- Use recovery and weekly volume to spot imbalances, overtraining (lots of sets, dropping performance, low energy) or undertraining.
- Progression: if they hit the top of the rep range at RPE ≤ 8, suggest adding load (≈2.5-5% upper body, 5-10% lower body); if reps dropped across sessions, suggest a deload or more rest.
- If a workout is in progress, help with the next set: load, reps, rest, or swapping an exercise.
- Respect injuries/limitations and available equipment.
- Answer in the language the user writes in. Use their unit system.
- Never invent data. If something isn't logged, say so.
- For nutrition, give general guidance and say you're not a nutritionist; for pain or injury, advise seeing a professional.

The app has a "Generate Workout" button that builds a full session from this data — mention it when they ask for a workout plan for today.

USER DATA:
${context}`;

    const selectedModel = await classifyIntent(openai, args.message);

    const history = args.conversationHistory.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 4000),
    }));

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: args.message.slice(0, 2000) },
    ];

    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages: chatMessages,
      max_completion_tokens: selectedModel === MODEL_SMART ? 1500 : 900,
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

    const owner = await requireUserInAction(ctx);
    await requireAIAccess(ctx, owner);
    const details: any = await ctx.runQuery(internal.workouts.getWorkoutDetailsForAura, {
      workoutId: args.workoutId,
    });
    if (details.workout.userId !== owner._id) throw new Error("Workout not found");

    const durationMin: number | null = details.workout.endTime && details.workout.startTime
      ? Math.round((details.workout.endTime - details.workout.startTime) / 60000)
      : null;

    // Full set-by-set view of this session (plan vs. actual, rest times, notes).
    const units = unitsOf(owner);
    const full = await ctx.runQuery(internal.coachData.getWorkoutForCoach, { workoutId: args.workoutId });
    const exerciseSummary = full ? describeWorkout(full.workout, units, Date.now(), "full") : "";

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
    let recentWorkoutsContext = "";
    let userGoalContext = "";

    // For the default (coach) mode, fetch recent workout history & user profile
    if (characterMode === "default") {
      try {
        const user = owner;
        const userId = owner._id;
        if (userId) {
          // Include the user's fitness goal from their profile
          if (user?.goal) {
            userGoalContext = `\nUser's Fitness Goal: ${user.goal}`;
          }
          if (user?.name) {
            userGoalContext += `\nUser's Name: ${user.name}`;
          }

          // Recent history for comparison (same exercises last time, weekly volume)
          const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId, days: 21, maxWorkouts: 12 });
          const past = data.workouts.filter((w) => w.id !== args.workoutId);
          if (past.length > 0) {
            const now = Date.now();
            const pastSummaries = past.slice(0, 6).map((w) => describeWorkout(w, units, now, "brief"));
            const weekly = analyzeRecovery(data.workouts, data.customExercises, now)
              .filter((r) => r.sets7d > 0)
              .map((r) => `${r.group} ${Math.round(r.sets7d)}`)
              .join(", ");
            recentWorkoutsContext = `\n\nRECENT WORKOUTS (for comparison, newest first):\n${pastSummaries.join("\n")}\n\nHard sets per muscle group in the last 7 days (including today): ${weekly || "n/a"}`;
          } else {
            recentWorkoutsContext = "\n\nNo other workouts in the past 3 weeks — this is their first session in a while.";
          }
        }
      } catch (e) {
        console.warn("[Aura] Could not fetch recent workouts for coach mode:", e);
      }
    }

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
      personalityAndTask = `You are an elite personal fitness coach — the kind that top athletes pay thousands for. You genuinely care about this person's progress and want to see them succeed. You analyze their workout with expert-level insight, compare it against their recent training history and goals, and deliver a verdict that is encouraging, specific, and actionable.

You are NOT sarcastic or funny in this mode. You are warm, motivating, and data-driven — like the best coach they've ever had.${userGoalContext}

Your task:
1. Assign them a powerful, motivating "Session Title" that captures the essence of today's workout (e.g., "Volume PR Crusher", "The Comeback Session", "Consistency King", "Foundation Builder"). Make it feel earned and personal.
2. Write a 3-4 sentence coaching analysis that:
   - Highlights what they did well today (specific exercises, volume, effort, plan completion)
   - Points out one thing to fix if the data shows it: rests far from what the plan or goal needs, missed planned sets, reps below the target range
   - Compares with their recent week if data is available (e.g., "Your volume is up 15% from last session" or "Great to see you hitting legs after focusing on upper body all week")
   - Connects their effort to their fitness goal if known (e.g., "This kind of progressive overload is exactly how you build the muscle you're after")
   - Ends with one specific, actionable tip or encouragement for their next session
   Keep it personal, not generic. Reference their ACTUAL numbers.`;
    }

    const prompt = `
${personalityAndTask}

Today's workout data:
- Duration: ${durationMin ? durationMin + " minutes" : "Unknown"}
- Total Exercises: ${details.exercises.length}
- Total Sets: ${details.totalSets}
- Total Volume Lifted: ${fmtWeight(details.totalVolume, units)}
Session detail (weight×reps; "plan" = what was prescribed; rest = measured time between logged sets):
${exerciseSummary}${recentWorkoutsContext}

IMPORTANT RULES:
- ${languageInstruction}
- Do NOT use any religious references (no "gods", "divine", "blessed", "آلهة", etc.). Keep it purely gym/fitness themed.

Return ONLY a JSON object with this exact structure:
{
  "auraTitle": "The string title here",
  "auraDescription": "The coaching analysis here"
}
Do NOT wrap it in markdown block quotes. Just raw JSON.
`;

    try {
      const response = await openai.chat.completions.create({
        model: AURA_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: characterMode === "default" ? 0.6 : 0.8,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content generated");

      const parsed = JSON.parse(content);
      const auraTitle = parsed.auraTitle || "The Mystery Lifter";
      const auraDescription = parsed.auraDescription || "We couldn't analyze this workout, but we respect the grind.";

      // Update the workout in the DB
      await ctx.runMutation(internal.workouts.updateWorkoutAura, {
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
