"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";

// ── Exercise catalog (core 42 exercises) ─────────────────
// Compact format to minimize token usage in the AI prompt
const CORE_EXERCISES = [
  { id: "ex-bench-press", name: "Barbell Bench Press", muscle: "Chest" },
  { id: "ex-incline-db", name: "Incline Dumbbell Press", muscle: "Chest" },
  { id: "ex-cable-cross", name: "Cable Crossovers", muscle: "Chest" },
  { id: "ex-chest-dips", name: "Chest Dips", muscle: "Chest" },
  { id: "ex-db-fly", name: "Dumbbell Fly", muscle: "Chest" },
  { id: "ex-decline-bench", name: "Decline Bench Press", muscle: "Chest" },
  { id: "ex-deadlift", name: "Deadlift", muscle: "Back" },
  { id: "ex-pull-ups", name: "Pull Ups", muscle: "Back" },
  { id: "ex-bent-rows", name: "Bent Over Rows", muscle: "Back" },
  { id: "ex-lat-pulldown", name: "Lat Pulldown", muscle: "Back" },
  { id: "ex-seated-row", name: "Seated Cable Row", muscle: "Back" },
  { id: "ex-tbar-row", name: "T-Bar Row", muscle: "Back" },
  { id: "ex-chinups", name: "Chin Ups", muscle: "Back" },
  { id: "ex-squat", name: "Barbell Squat", muscle: "Legs" },
  { id: "ex-leg-press", name: "Leg Press", muscle: "Legs" },
  { id: "ex-lunges", name: "Lunges", muscle: "Legs" },
  { id: "ex-leg-curl", name: "Leg Curl", muscle: "Legs" },
  { id: "ex-leg-ext", name: "Leg Extension", muscle: "Legs" },
  { id: "ex-calf-raise", name: "Calf Raise", muscle: "Legs" },
  { id: "ex-rdl", name: "Romanian Deadlift", muscle: "Legs" },
  { id: "ex-hack-squat", name: "Hack Squat", muscle: "Legs" },
  { id: "ex-bulgarian", name: "Bulgarian Split Squat", muscle: "Legs" },
  { id: "ex-ohp", name: "Overhead Press", muscle: "Shoulders" },
  { id: "ex-lateral-raise", name: "Lateral Raise", muscle: "Shoulders" },
  { id: "ex-face-pull", name: "Face Pull", muscle: "Shoulders" },
  { id: "ex-front-raise", name: "Front Raise", muscle: "Shoulders" },
  { id: "ex-rear-delt-fly", name: "Rear Delt Fly", muscle: "Shoulders" },
  { id: "ex-arnold-press", name: "Arnold Press", muscle: "Shoulders" },
  { id: "ex-bb-curl", name: "Barbell Curl", muscle: "Biceps" },
  { id: "ex-hammer-curl", name: "Hammer Curl", muscle: "Biceps" },
  { id: "ex-preacher-curl", name: "Preacher Curl", muscle: "Biceps" },
  { id: "ex-concentration", name: "Concentration Curl", muscle: "Biceps" },
  { id: "ex-tri-pushdown", name: "Tricep Pushdown", muscle: "Triceps" },
  { id: "ex-skull-crusher", name: "Skull Crushers", muscle: "Triceps" },
  { id: "ex-tri-dips", name: "Tricep Dips", muscle: "Triceps" },
  { id: "ex-overhead-ext", name: "Overhead Tricep Extension", muscle: "Triceps" },
  { id: "ex-plank", name: "Plank", muscle: "Core" },
  { id: "ex-cable-crunch", name: "Cable Crunch", muscle: "Core" },
  { id: "ex-hanging-raise", name: "Hanging Leg Raise", muscle: "Core" },
  { id: "ex-ab-rollout", name: "Ab Rollout", muscle: "Core" },
  { id: "ex-treadmill", name: "Treadmill Run", muscle: "Cardio" },
  { id: "ex-rowing", name: "Rowing Machine", muscle: "Cardio" },
  { id: "ex-cycling", name: "Cycling", muscle: "Cardio" },
  { id: "ex-elliptical", name: "Elliptical", muscle: "Cardio" },
  { id: "ex-stairmaster", name: "Stairmaster", muscle: "Cardio" },
  { id: "ex-jump-rope", name: "Jump Rope", muscle: "Cardio" },
];

/**
 * AI Workout Generation Action
 * Analyzes the user's training history and generates a smart next workout.
 */
export const generateWorkout = action({
  args: {
    userId: v.id("users"),
    userComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ── 1. Fetch user profile ──
    const user = await ctx.runQuery(api.users.getUserById, { userId: args.userId });
    if (!user) throw new Error("User not found");

    // ── 2. Fetch recent workouts (last 30 days, capped at 30) ──
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const workouts = await ctx.runQuery(api.workouts.getWorkoutsByUser, {
      userId: args.userId,
      limit: 30,
      sinceTimestamp: thirtyDaysAgo,
    });

    // ── 3. Fetch exercise details for the 15 most recent workouts ──
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
              exerciseId: log.exerciseId,
              muscle: CORE_EXERCISES.find(e => e.id === log.exerciseId)?.muscle || "Other",
              sets: normalSets.length,
              bestWeight: bestSet?.weight || 0,
              bestReps: bestSet?.reps || 0,
            };
          })
        );

        const duration = workout.endTime
          ? Math.round((workout.endTime - workout.startTime) / 60000)
          : null;

        return {
          name: workout.name,
          date: new Date(workout.startTime).toISOString().split("T")[0],
          daysSinceToday: Math.round((Date.now() - workout.startTime) / (24 * 60 * 60 * 1000)),
          duration: duration ? `${duration} min` : "unknown",
          mood: workout.mood,
          exercises: exerciseSummaries,
        };
      })
    );

    // ── 4. Fetch user's custom exercises from Convex ──
    const customExercises = await ctx.runQuery(api.aiHelpers.getCustomExercises, {
      userId: args.userId,
    });

    // ── 5. Fetch yearly stats ──
    const yearlyStats = await ctx.runQuery(api.aiHelpers.getYearlyStats, { userId: args.userId });

    // ── 6. Fetch personal records ──
    const prs = await ctx.runQuery(api.aiHelpers.getPersonalRecords, { userId: args.userId });

    // ── 7. Build the exercise catalog string ──
    const catalogLines = CORE_EXERCISES.map(
      e => `  - ID: ${e.id} | ${e.name} | ${e.muscle}`
    );

    if (customExercises.length > 0) {
      catalogLines.push("  --- User's Custom Exercises ---");
      customExercises.forEach((e: any) => {
        catalogLines.push(`  - ID: ${e.localId} | ${e.name} | ${e.muscleGroup}`);
      });
    }

    // ── 8. Build user context ──
    const age = user.dateOfBirth
      ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const unitSystem = user.unitPreference === "imperial" ? "Imperial (lbs)" : "Metric (kg)";

    const userContext = `
USER PROFILE:
- Name: ${user.name}
- Age: ${age ? `${age} years old` : "unknown"}
- Gender: ${user.gender || "unknown"}
- Weight: ${user.weight ? `${user.weight}kg` : "unknown"}
- Height: ${user.height ? `${user.height}cm` : "unknown"}
- Body Fat: ${user.bodyFat ? `${user.bodyFat}%` : "unknown"}
- Fitness Goal: ${user.goal || "not specified"}
- Unit System: ${unitSystem}

TRAINING FREQUENCY: ${yearlyStats.totalWorkouts > 0 ? `${yearlyStats.sessionsPerWeek} sessions/week` : "No data"}

RECENT WORKOUTS (last 30 days):
${workoutSummaries.length > 0
  ? workoutSummaries.map((w: any) => {
      const muscles = [...new Set(w.exercises.map((e: any) => e.muscle))].join(", ");
      const exerciseList = w.exercises.map((e: any) => `${e.exercise} (${e.bestWeight}kg×${e.bestReps})`).join(", ");
      return `  📅 ${w.date} (${w.daysSinceToday}d ago) — "${w.name}" [${muscles}]: ${exerciseList}`;
    }).join("\n")
  : "  No workouts in the last 30 days."
}

PERSONAL RECORDS:
${prs.length > 0
  ? prs.slice(0, 15).map((pr: any) =>
      `  • ${pr.exerciseName}: ${pr.type === "max_weight" ? `${pr.value}kg × ${pr.reps || "?"}reps` : pr.type === "est_1rm" ? `est 1RM ${pr.value}kg` : `volume ${pr.value}kg`}`
    ).join("\n")
  : "  No PRs recorded yet."
}`.trim();

    // ── 9. Build the user comment section (if provided) ──
    const userCommentSection = args.userComment?.trim()
      ? `\nUSER'S CURRENT MOOD / REQUEST:\n"${args.userComment.trim()}"\nTake this into account when designing the workout. For example, if the user says they are tired, reduce volume/intensity. If they want to focus on a specific area, prioritize that.\n`
      : '';

    // ── 10. Build the system prompt ──
    const systemPrompt = `You are an elite personal fitness coach with deep expertise in exercise programming. Your job is to generate the NEXT optimal workout session for this user based on their training history, recovery status, and goals.

AVAILABLE EXERCISES (you MUST use these):
${catalogLines.join("\n")}

RULES:
1. Analyze what muscle groups were recently trained and when. Avoid training the same major muscle group within 48 hours unless the program calls for it.
2. Consider the user's fitness goal when selecting exercises, rep ranges, and volume.
3. Select 4-7 exercises for the workout. Quality over quantity.
4. You MUST use exercises from the AVAILABLE EXERCISES list above. Use their exact "ID" values. The catalog above covers all major movement patterns — there is almost never a reason to create a new exercise.
5. Creating a new exercise ("isNew": true) is ONLY allowed as an absolute last resort when the user explicitly requests a very specific exercise that has no equivalent in the catalog. In 99% of cases, you should NOT create new exercises.
6. Set realistic sets (2-5), reps (based on goal), and rest times (30-180 seconds).
7. Use the user's preferred unit system for any weight references in notes.
8. Give the workout a short, descriptive name (e.g., "Heavy Pull Day", "Upper Body Hypertrophy").
9. Write a brief "reasoning" (2-3 sentences) explaining WHY you chose this workout today.

${userContext}
${userCommentSection}
Return ONLY a JSON object with this exact structure:
{
  "workoutName": "string",
  "reasoning": "string explaining why this workout was chosen",
  "exercises": [
    {
      "isNew": false,
      "exerciseId": "ex-bench-press",
      "exerciseName": "Barbell Bench Press",
      "sets": 4,
      "reps": "8-10",
      "restSeconds": 120,
      "notes": "optional coaching note"
    }
  ]
}

For NEW exercises (isNew: true), also include:
- "muscleGroup": "Chest" (or Back, Legs, Shoulders, Biceps, Triceps, Core, Cardio)
- "category": "strength" (or "cardio", "flexibility")
- Do NOT include "exerciseId" for new exercises.

Do NOT wrap the response in markdown. Return raw JSON only.`;

    // ── 11. Call OpenAI ──
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate my next workout session based on my training history and goals." },
        ],
        temperature: 0.6,
        max_completion_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content generated");

      const parsed = JSON.parse(content);

      // Validate structure
      if (!parsed.workoutName || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
        throw new Error("Invalid workout structure from AI");
      }

      // Validate exercise IDs for non-new exercises
      const validIds = new Set(CORE_EXERCISES.map(e => e.id));
      const customIds = new Set(customExercises.map((e: any) => e.localId));

      const validatedExercises = parsed.exercises.map((ex: any) => {
        if (!ex.isNew && ex.exerciseId) {
          // Check if exerciseId exists in catalog or custom
          if (!validIds.has(ex.exerciseId) && !customIds.has(ex.exerciseId)) {
            // AI hallucinated an ID — try to find a match by name
            const match = CORE_EXERCISES.find(
              e => e.name.toLowerCase() === ex.exerciseName?.toLowerCase()
            );
            if (match) {
              ex.exerciseId = match.id;
            } else {
              // Convert to a new exercise
              ex.isNew = true;
              ex.muscleGroup = ex.muscleGroup || "Other";
              ex.category = ex.category || "strength";
              delete ex.exerciseId;
            }
          }
        }
        return ex;
      });

      return {
        workoutName: parsed.workoutName,
        reasoning: parsed.reasoning || "Workout generated based on your training history.",
        exercises: validatedExercises,
      };
    } catch (e: any) {
      console.error("[AI Workout] Generation failed:", e);
      throw new Error("Failed to generate workout. Please try again.");
    }
  },
});

