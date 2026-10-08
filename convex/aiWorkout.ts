"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireUserInAction } from "./users";
import { requireAIAccess } from "./entitlements";
import OpenAI from "openai";
import type { CoachData } from "./coachData";
import { analyzeRecovery, buildCoachContext, lastPerformanceBlock, unitsOf } from "./coachPrompt";
import { EXERCISE_CATALOG, exercisesForEquipment } from "../src/constants/exerciseCatalog";
import type { Equipment, Exercise } from "../src/types";

const WORKOUT_MODEL = "gpt-5.1";
const NEW_EXERCISE = "NEW";

const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Glutes", "Shoulders", "Biceps", "Triceps", "Forearms", "Core", "Full Body", "Cardio", "Mobility"];

interface CatalogEntry {
  id: string;
  name: string;
  muscleGroup: string;
  category: string;
  tracking: string;
  line: string;
}

/** Exercises the user can do with the equipment they have, plus their own custom exercises. */
function buildCatalog(available: Equipment[] | undefined, customs: CoachData["customExercises"]): CatalogEntry[] {
  const list: CatalogEntry[] = exercisesForEquipment(available, EXERCISE_CATALOG).map((e: Exercise) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    category: e.category,
    tracking: e.tracking ?? "weight_reps",
    line: `${e.id} | ${e.name} | ${(e.primaryMuscles ?? []).join("+")} | ${e.equipment?.length ? e.equipment.join("+") : "no equipment"} | ${e.level}${e.mechanic === "compound" ? ", compound" : ""} | log: ${e.tracking}`,
  }));
  for (const c of customs.slice(0, 60)) {
    list.push({
      id: c.id,
      name: c.name,
      muscleGroup: c.muscleGroup,
      category: c.category,
      tracking: c.category === "cardio" ? "cardio" : "weight_reps",
      line: `${c.id} | ${c.name} | ${c.muscleGroup} | user's custom exercise`,
    });
  }
  return list;
}

function catalogText(catalog: CatalogEntry[]): string {
  const byGroup = new Map<string, string[]>();
  for (const e of catalog) {
    const rows = byGroup.get(e.muscleGroup) ?? [];
    rows.push(`  ${e.line}`);
    byGroup.set(e.muscleGroup, rows);
  }
  return [...byGroup.entries()].map(([g, rows]) => `${g.toUpperCase()}:\n${rows.join("\n")}`).join("\n");
}

/** Strict JSON schema: exercise IDs are limited to the catalog (or "NEW"). */
function responseSchema(ids: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["workoutName", "reasoning", "estimatedMinutes", "warmup", "exercises"],
    properties: {
      workoutName: { type: "string" },
      reasoning: { type: "string" },
      estimatedMinutes: { type: "number" },
      warmup: { type: "string" },
      exercises: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["exerciseId", "newExercise", "sets", "reps", "restSeconds", "targetWeightKg", "supersetGroup", "notes"],
          properties: {
            exerciseId: { type: "string", enum: [...ids, NEW_EXERCISE] },
            newExercise: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "muscleGroup", "category"],
                  properties: {
                    name: { type: "string" },
                    muscleGroup: { type: "string", enum: MUSCLE_GROUPS },
                    category: { type: "string", enum: ["strength", "cardio", "flexibility"] },
                  },
                },
              ],
            },
            sets: { type: "integer" },
            reps: { type: "string" },
            restSeconds: { type: "integer" },
            targetWeightKg: { anyOf: [{ type: "number" }, { type: "null" }] },
            supersetGroup: { anyOf: [{ type: "string" }, { type: "null" }] },
            notes: { type: "string" },
          },
        },
      },
    },
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function equipmentFor(user: Doc<"users">, override?: string[]): Equipment[] | undefined {
  const list = override ?? user.equipment;
  return list ? (list as Equipment[]) : undefined;
}

/**
 * AI Workout Generation Action
 * Builds the user's next session from their profile, equipment, recovery,
 * recent performance and today's request.
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

    const data: CoachData = await ctx.runQuery(internal.coachData.getCoachData, { userId: user._id, days: 45, maxWorkouts: 30 });
    const units = unitsOf(user);
    const now = Date.now();

    const equipment = equipmentFor(user, args.equipment?.slice(0, 40));
    const catalog = buildCatalog(equipment, data.customExercises);
    const byId = new Map(catalog.map((e) => [e.id, e]));

    const minutes = clamp(Math.round(args.sessionMinutes ?? user.sessionMinutes ?? 60), 15, 180);
    const context = buildCoachContext(user, data, { detailed: 6 });
    const recovery = analyzeRecovery(data.workouts, data.customExercises, now);
    const fresh = recovery
      .filter((r) => !r.lastTrained || now - r.lastTrained > 48 * 3600000)
      .map((r) => r.group);

    const todaySection = [
      `- Time available: ${minutes} minutes (including warm-up)`,
      args.equipment ? `- Equipment today: ${args.equipment.length ? args.equipment.join(", ") : "none (bodyweight only)"}` : null,
      args.focus?.length ? `- Requested focus: ${args.focus.slice(0, 6).join(", ")}` : null,
      args.userComment?.trim() ? `- User says: "${args.userComment.trim().slice(0, 300)}"` : null,
      `- Muscle groups rested 48h+: ${fresh.length ? fresh.join(", ") : "none — everything was trained in the last 2 days"}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are an elite strength & conditioning coach. Design the user's NEXT training session.

AVAILABLE EXERCISES (id | name | primary muscles | equipment | level | how it's logged). Only these fit the user's equipment:
${catalogText(catalog)}

HOW TO DESIGN THE SESSION:
1. Pick the focus: honor an explicit request first. Otherwise choose muscle groups that are recovered (48h+ since trained) and furthest below a sensible weekly volume, keeping the week balanced (push/pull/legs or upper/lower patterns). Use their history to continue the split they're following.
2. Fit the time: about 8-12 min per compound exercise with 3-4 sets, 5-7 min per isolation exercise, include the warm-up. Typically 4-7 exercises for 45-75 min; fewer for short sessions. Report a realistic estimatedMinutes ≤ the time available.
3. Order: big compound lifts first, then accessories, core/conditioning last.
4. Match the goal and experience:
   - strength: 3-6 reps, 2-4 min rest on main lifts
   - hypertrophy / muscle: 6-12 reps (12-20 for small muscles), 60-120s rest
   - fat loss / conditioning / general fitness: 10-15 reps, 30-75s rest, supersets or circuits welcome
   - beginners: simple, stable movements, 2-3 sets, technique notes; avoid advanced lifts
5. Loads: use "LAST PERFORMANCE" to set targetWeightKg (always in KILOGRAMS, even if the user uses pounds). Apply progressive overload: if they hit the top of the rep range last time, add ~2.5-5% (upper) or ~5-10% (lower); if they missed reps, keep or reduce. Use null for bodyweight, timed and cardio exercises, or when there's no history.
6. Reps format: a range like "8-10", a number like "5", "AMRAP", or seconds like "45s" for timed holds, or minutes like "20min" for cardio — match the exercise's "log" type.
7. Respect injuries/limitations: skip or substitute anything that could aggravate them, and say so in a note.
8. supersetGroup: give two or three non-competing exercises the same letter ("A", "B") to pair them when it saves time; otherwise null.
9. Use catalog IDs exactly. Use "${NEW_EXERCISE}" with newExercise filled in ONLY if the user explicitly asks for a specific exercise that isn't in the list; otherwise newExercise is null.
10. warmup: one short sentence (e.g. "5 min easy bike, then 2 light sets of the first lift").
11. reasoning: 2-3 sentences referencing their data (what they trained recently, recovery, progress) and today's request.
12. notes: one short cue per exercise (form tip or load guidance); write workoutName, reasoning, warmup and notes in the language the user wrote their request in, or English if none.

USER DATA:
${context}

LAST PERFORMANCE PER EXERCISE (newest first):
${lastPerformanceBlock(data.workouts, units, now)}

TODAY:
${todaySection}`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate my next workout session." },
    ];

    let content: string | null | undefined;
    try {
      const response = await openai.chat.completions.create({
        model: WORKOUT_MODEL,
        messages,
        temperature: 0.5,
        max_completion_tokens: 2500,
        response_format: {
          type: "json_schema",
          json_schema: { name: "workout", strict: true, schema: responseSchema(catalog.map((e) => e.id)) },
        },
      });
      content = response.choices[0]?.message?.content;
    } catch (e) {
      // Some models / accounts reject large strict schemas: fall back to plain JSON mode.
      console.warn("[AI Workout] Structured output failed, retrying with JSON mode:", e);
      const response = await openai.chat.completions.create({
        model: WORKOUT_MODEL,
        messages: [
          ...messages,
          {
            role: "system",
            content: `Return ONLY a JSON object: {"workoutName": string, "reasoning": string, "estimatedMinutes": number, "warmup": string, "exercises": [{"exerciseId": string, "newExercise": null | {"name": string, "muscleGroup": string, "category": "strength"|"cardio"|"flexibility"}, "sets": number, "reps": string, "restSeconds": number, "targetWeightKg": number|null, "supersetGroup": string|null, "notes": string}]}`,
          },
        ],
        temperature: 0.5,
        max_completion_tokens: 2500,
        response_format: { type: "json_object" },
      });
      content = response.choices[0]?.message?.content;
    }

    try {
      if (!content) throw new Error("No content generated");
      const parsed = JSON.parse(content);
      if (!parsed.workoutName || !Array.isArray(parsed.exercises)) throw new Error("Invalid workout structure from AI");

      const seen = new Set<string>();
      const nameIndex = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));
      const exercises = [];
      for (const raw of parsed.exercises.slice(0, 12)) {
        let entry = byId.get(String(raw.exerciseId));
        // Tolerate a hallucinated ID when the name matches a catalog exercise.
        if (!entry && raw.exerciseId !== NEW_EXERCISE) {
          entry = nameIndex.get(String(raw.exerciseName ?? raw.newExercise?.name ?? "").toLowerCase());
        }
        const sets = clamp(Math.round(Number(raw.sets) || 3), 1, 8);
        const restSeconds = clamp(Math.round(Number(raw.restSeconds) || 90), 15, 300);
        const reps = String(raw.reps ?? "8-12").slice(0, 12) || "8-12";
        const weight = Number(raw.targetWeightKg);
        const targetWeight = Number.isFinite(weight) && weight > 0 && weight < 600 ? Math.round(weight * 2) / 2 : undefined;
        const supersetGroup = typeof raw.supersetGroup === "string" && raw.supersetGroup.trim() ? raw.supersetGroup.trim().slice(0, 3) : undefined;
        const notes = typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim().slice(0, 200) : undefined;

        if (entry) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          exercises.push({
            isNew: false,
            exerciseId: entry.id,
            exerciseName: entry.name,
            muscleGroup: entry.muscleGroup,
            category: entry.category,
            sets, reps, restSeconds, targetWeight, supersetGroup, notes,
          });
        } else if (raw.newExercise?.name) {
          const name = String(raw.newExercise.name).trim().slice(0, 60);
          if (!name || seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          exercises.push({
            isNew: true,
            exerciseName: name,
            muscleGroup: MUSCLE_GROUPS.includes(raw.newExercise.muscleGroup) ? raw.newExercise.muscleGroup : "Full Body",
            category: ["strength", "cardio", "flexibility"].includes(raw.newExercise.category) ? raw.newExercise.category : "strength",
            sets, reps, restSeconds, targetWeight, supersetGroup, notes,
          });
        }
      }
      if (exercises.length === 0) throw new Error("No valid exercises in AI workout");

      const estimated = Number(parsed.estimatedMinutes);
      return {
        workoutName: String(parsed.workoutName).slice(0, 60),
        reasoning: String(parsed.reasoning || "Workout generated from your training history.").slice(0, 600),
        estimatedMinutes: Number.isFinite(estimated) && estimated > 0 ? Math.round(estimated) : undefined,
        warmup: typeof parsed.warmup === "string" && parsed.warmup.trim() ? parsed.warmup.trim().slice(0, 300) : undefined,
        exercises,
      };
    } catch (e: any) {
      console.error("[AI Workout] Generation failed:", e, content);
      throw new Error("Failed to generate workout. Please try again.");
    }
  },
});
