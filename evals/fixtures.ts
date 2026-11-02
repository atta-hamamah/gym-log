/**
 * Made-up users for the AI evals: each has a profile, a training history
 * (built the way the app stores it) and what to ask the coach.
 *
 * Set strings use the user's own units:
 *   "80x8"     80 kg (or lb) × 8 reps        "w60x8"  warm-up set
 *   "BWx12"    bodyweight × 12               "80x8@9" with RPE 9
 *   "45s"      timed hold
 * Plans: "3x8-10@120" = 3 sets of 8-10 reps, 120 s rest.
 */
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { CoachData, CoachExercise, CoachSet, CoachWorkout } from "../convex/coachData";
import { est1RM, type Units } from "../convex/coachPrompt";
import type { WorkoutArgs } from "../convex/workoutPlanner";
import type { AIGeneratedWorkout } from "../src/types";
import { EXERCISE_BY_ID } from "../src/constants/exerciseCatalog";

export const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

export interface Check {
  name: string;
  pass: boolean;
  detail?: string;
  /** Soft checks are judgment calls: they warn instead of failing the run. */
  soft?: boolean;
}

export interface Fixture {
  id: string;
  description: string;
  user: Doc<"users">;
  data: CoachData;
  workout?: {
    args: WorkoutArgs;
    checks?: (w: AIGeneratedWorkout) => Check[];
  };
  chat?: {
    question: string;
    /** What a good answer looks like, for the judge model. */
    rubric: string;
    checks?: (answer: string) => Check[];
  };
}

// ── Builders ─────────────────────────────────────────────

/** lb → kg the way the app stores it (UnitsContext.lbsToKg: one decimal). */
const toKg = (value: number, units: Units) => (units === "imperial" ? +(value / 2.20462).toFixed(1) : value);

export function user(p: Partial<Doc<"users">>): Doc<"users"> {
  return {
    _id: "eval_user" as Id<"users">,
    _creationTime: NOW - 400 * DAY,
    clerkId: "eval",
    name: "Eval User",
    email: "eval@example.com",
    createdAt: NOW - 400 * DAY,
    migrationComplete: true,
    unitPreference: "metric",
    ...p,
  } as Doc<"users">;
}

interface Ex {
  id: string;
  sets: string;
  plan?: string;
  /** Measured rest between set taps, in seconds (defaults to the plan's rest). */
  rest?: number;
  notes?: string;
}
export const e = (id: string, sets: string, opts: Omit<Ex, "id" | "sets"> = {}): Ex => ({ id, sets, ...opts });

function parsePlan(plan: string): CoachExercise["target"] {
  const m = plan.match(/^(\d+)x([^@]+)@(\d+)$/);
  if (!m) throw new Error(`Bad plan "${plan}"`);
  return { sets: Number(m[1]), reps: m[2], restSeconds: Number(m[3]) };
}

function parseSet(token: string, units: Units): Omit<CoachSet, "completedAt"> {
  const timed = token.match(/^(\d+)s$/);
  if (timed) return { weight: 0, reps: 0, durationSec: Number(timed[1]), type: "normal", completed: true };
  const m = token.match(/^(w)?(BW|\d+(?:\.\d+)?)x(\d+)(?:@(\d+(?:\.\d+)?))?$/);
  if (!m) throw new Error(`Bad set "${token}"`);
  return {
    weight: m[2] === "BW" ? 0 : toKg(Number(m[2]), units),
    reps: Number(m[3]),
    rpe: m[4] ? Number(m[4]) : undefined,
    type: m[1] ? "warmup" : "normal",
    completed: true,
  };
}

export function session(daysAgo: number, name: string, exs: Ex[], o: { units?: Units; mood?: number; notes?: string } = {}): CoachWorkout {
  const units = o.units ?? "metric";
  const start = NOW - daysAgo * DAY - 2 * 60 * 60 * 1000;
  let t = start + 8 * 60 * 1000; // warm-up
  const exercises: CoachExercise[] = exs.map((x) => {
    const target = x.plan ? parsePlan(x.plan) : undefined;
    const rest = x.rest ?? target?.restSeconds ?? 90;
    const sets = x.sets.split(/\s+/).filter(Boolean).map((token, i) => {
      t += (i === 0 ? 45 : rest) * 1000;
      return { ...parseSet(token, units), completedAt: t };
    });
    t += 2 * 60 * 1000; // set up the next exercise
    const known = EXERCISE_BY_ID[x.id];
    if (!known) throw new Error(`Unknown exercise ${x.id}`);
    return { exerciseId: x.id, name: known.name, target, sets, notes: x.notes };
  });
  return {
    id: `w-${daysAgo}-${name.replace(/\W+/g, "-")}`,
    name,
    startTime: start,
    endTime: t,
    mood: o.mood,
    notes: o.notes,
    source: exs.some((x) => x.plan) ? { type: "ai" } : { type: "manual" },
    exercises,
  };
}

function personalRecords(workouts: CoachWorkout[]): Doc<"personalRecords">[] {
  const best = new Map<string, Doc<"personalRecords">>();
  const put = (key: string, rec: Omit<Doc<"personalRecords">, "_id" | "_creationTime" | "userId">) => {
    const cur = best.get(key);
    if (!cur || rec.value > cur.value) best.set(key, { _id: key as Id<"personalRecords">, _creationTime: rec.date, userId: "eval_user" as Id<"users">, ...rec });
  };
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (s.type === "warmup" || s.weight <= 0 || s.reps <= 0) continue;
        const base = { exerciseId: ex.exerciseId, exerciseName: ex.name, date: w.startTime, workoutLocalId: w.id };
        put(`${ex.exerciseId}|max_weight`, { ...base, type: "max_weight", value: s.weight, reps: s.reps });
        put(`${ex.exerciseId}|est_1rm`, { ...base, type: "est_1rm", value: Math.round(est1RM(s.weight, s.reps) * 10) / 10 });
      }
    }
  }
  return [...best.values()];
}

export function coachData(workouts: CoachWorkout[]): CoachData {
  const sorted = [...workouts].sort((a, b) => b.startTime - a.startTime);
  const durations = sorted.filter((w) => w.endTime).map((w) => (w.endTime! - w.startTime) / 60000);
  const first = sorted.length ? sorted[sorted.length - 1].startTime : null;
  const weeks = first ? Math.max((NOW - first) / (7 * DAY), 1) : 1;
  return {
    workouts: sorted,
    personalRecords: personalRecords(sorted),
    measurements: [],
    customExercises: [],
    yearly: {
      totalWorkouts: sorted.length,
      avgDurationMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      sessionsPerWeek: Math.round((sorted.length / weeks) * 10) / 10,
      firstWorkoutAt: first,
    },
  };
}

// ── Shared check helpers ─────────────────────────────────

const ARABIC = /[؀-ۿ]/;
export const hasArabic = (text: string) => ARABIC.test(text);

const groupOf = (id?: string) => (id ? EXERCISE_BY_ID[id]?.muscleGroup : undefined);
const primaryOf = (id?: string) => (id ? EXERCISE_BY_ID[id]?.primaryMuscles ?? [] : []);
const LOWER = new Set(["quads", "hamstrings", "glutes", "adductors", "abductors", "calves"]);

function setsShare(w: AIGeneratedWorkout, match: (id?: string) => boolean): number {
  const total = w.exercises.reduce((a, x) => a + x.sets, 0);
  const hit = w.exercises.filter((x) => match(x.exerciseId)).reduce((a, x) => a + x.sets, 0);
  return total ? hit / total : 0;
}

const loadOf = (w: AIGeneratedWorkout, id: string) => w.exercises.find((x) => x.exerciseId === id)?.targetWeight;
const lb = (kg: number) => Math.round(+(kg * 2.20462).toFixed(1) * 2) / 2;

// ── Users ────────────────────────────────────────────────

/** Push/pull/legs lifter: bench stalled with short rests, squat ready to progress. */
const omarHistory = (() => {
  const push = (d: number, bench: string, incline: string, lateral: string, rope: string, o: { mood?: number; notes?: string } = {}) =>
    session(d, "Push", [
      e("ex-bench-press", bench, { plan: "3x8-10@120", rest: 85 }),
      e("ex-incline-db", incline, { plan: "3x8-12@90" }),
      e("ex-lateral-raise", lateral, { plan: "3x12-15@60" }),
      e("ex-rope-pushdown", rope, { plan: "3x10-12@60" }),
    ], o);
  const pull = (d: number, pulldown: string, row: string, curl: string, face: string) =>
    session(d, "Pull", [
      e("ex-lat-pulldown", pulldown, { plan: "3x8-12@90" }),
      e("ex-seated-row", row, { plan: "3x8-12@90" }),
      e("ex-db-curl", curl, { plan: "3x10-12@60" }),
      e("ex-face-pull", face, { plan: "3x12-15@60" }),
    ]);
  const legs = (d: number, squat: string, rdl: string, press: string, curl: string) =>
    session(d, "Legs", [
      e("ex-squat", squat, { plan: "3x8-10@150", rest: 160 }),
      e("ex-rdl", rdl, { plan: "3x8-10@120" }),
      e("ex-leg-press", press, { plan: "3x10-12@90" }),
      e("ex-leg-curl", curl, { plan: "3x10-12@60" }),
    ]);
  return [
    push(1, "w60x8 80x8 80x8 80x7", "28x10 28x9 28x8", "10x15 10x15 10x15", "30x12 30x12 30x11", { mood: 3, notes: "Bench felt heavy again" }),
    pull(2, "65x12 65x11 65x10", "60x12 60x12 60x11", "14x12 14x11 14x10", "25x15 25x15 25x14"),
    legs(4, "w60x8 100x10 100x10 100x10", "90x10 90x10 90x9", "180x12 180x12 180x12", "45x12 45x12 45x11"),
    push(8, "w60x8 80x8 80x7 80x7", "28x10 28x9 28x9", "10x14 10x13 10x12", "30x12 30x11 30x10"),
    pull(9, "65x11 65x10 65x10", "57.5x12 57.5x12 57.5x12", "14x11 14x10 14x10", "25x15 25x14 25x13"),
    legs(11, "w60x8 100x9 100x9 100x8", "90x9 90x9 90x8", "170x12 170x12 170x12", "45x11 45x11 45x10"),
    push(15, "w60x8 80x9 80x8 80x8", "26x12 26x11 26x10", "8x15 8x15 8x15", "27.5x12 27.5x12 27.5x12"),
    pull(16, "62.5x12 62.5x12 62.5x11", "57.5x11 57.5x11 57.5x10", "12x12 12x12 12x12", "22.5x15 22.5x15 22.5x15"),
    legs(18, "w60x8 97.5x10 97.5x10 97.5x10", "85x10 85x10 85x10", "170x11 170x11 170x10", "42.5x12 42.5x12 42.5x12"),
    push(22, "w60x8 77.5x10 77.5x10 77.5x9", "26x10 26x10 26x9", "8x14 8x13 8x12", "27.5x12 27.5x11 27.5x10"),
    pull(23, "62.5x11 62.5x11 62.5x10", "55x12 55x12 55x11", "12x12 12x11 12x10", "22.5x15 22.5x14 22.5x14"),
    legs(25, "w60x8 97.5x9 97.5x9 97.5x8", "85x9 85x9 85x8", "160x12 160x12 160x12", "42.5x11 42.5x11 42.5x10"),
  ];
})();

const omar = user({
  name: "Omar", gender: "male", dateOfBirth: "1994-09-03", weight: 82, height: 178,
  goal: "Build muscle", experience: "intermediate", trainingDays: 5, sessionMinutes: 60,
});

/** 5×5 lifter who logs in pounds; alternates A (squat/bench/row) and B (squat/OHP/deadlift). */
const jakeHistory = (() => {
  const u = { units: "imperial" as const };
  const fives = (w: number, n = 5) => Array(n).fill(`${w}x5`).join(" ");
  const a = (d: number, squat: number, bench: string, row: number) =>
    session(d, "Workout A", [
      e("ex-squat", `w135x5 ${fives(squat)}`, { plan: "5x5@180" }),
      e("ex-bench-press", bench, { plan: "5x5@180" }),
      e("ex-bent-rows", fives(row), { plan: "5x5@120" }),
    ], u);
  const b = (d: number, squat: number, ohp: string, dl: number) =>
    session(d, "Workout B", [
      e("ex-squat", `w135x5 ${fives(squat)}`, { plan: "5x5@180" }),
      e("ex-ohp", ohp, { plan: "5x5@150" }),
      e("ex-deadlift", `w225x5 ${dl}x5`, { plan: "1x5@180" }),
    ], u);
  return [
    a(2, 225, "185x5 185x5 185x4 185x4 185x4", 155),
    b(4, 220, "115x5 115x5 115x5 115x4 115x4", 315),
    a(7, 215, "185x5 185x5 185x5 185x4 185x4", 150),
    b(9, 210, fives(110), 305),
    a(11, 205, fives(180), 145),
    b(14, 200, fives(105), 295),
  ];
})();

/** Upper/lower split with a shoulder that flares up on overhead work. */
const linaHistory = [
  session(1, "Lower", [
    e("ex-squat", "60x10 60x10 60x9", { plan: "3x8-10@120" }),
    e("ex-hip-thrust", "80x12 80x12 80x11", { plan: "3x10-12@90" }),
    e("ex-leg-curl", "35x12 35x11 35x10", { plan: "3x10-12@60" }),
    e("ex-plank", "45s 45s 45s", { plan: "3x45s@45" }),
  ]),
  session(3, "Upper", [
    e("ex-incline-db", "14x10 14x10 14x9", { plan: "3x8-12@90", notes: "right shoulder a bit cranky at the bottom" }),
    e("ex-lat-pulldown", "45x12 45x11 45x10", { plan: "3x10-12@90" }),
    e("ex-seated-row", "40x12 40x12 40x11", { plan: "3x10-12@90" }),
    e("ex-face-pull", "15x15 15x15 15x14", { plan: "3x12-15@60" }),
  ]),
  session(6, "Lower", [
    e("ex-squat", "57.5x10 57.5x10 57.5x10", { plan: "3x8-10@120" }),
    e("ex-hip-thrust", "75x12 75x12 75x12", { plan: "3x10-12@90" }),
    e("ex-leg-curl", "32.5x12 32.5x12 32.5x11", { plan: "3x10-12@60" }),
  ]),
  session(8, "Upper", [
    e("ex-incline-db", "14x9 14x9 14x8", { plan: "3x8-12@90" }),
    e("ex-lat-pulldown", "45x11 45x10 45x10", { plan: "3x10-12@90" }),
    e("ex-seated-row", "40x12 40x11 40x11", { plan: "3x10-12@90" }),
    e("ex-face-pull", "15x15 15x14 15x13", { plan: "3x12-15@60" }),
  ]),
];

const SHOULDER_UNSAFE = [
  "ex-ohp", "ex-push-press", "ex-db-shoulder-press", "ex-arnold-press", "ex-machine-shoulder-press",
  "ex-pike-pushup", "ex-chest-dips", "ex-tri-dips", "ex-bench-dips", "ex-upright-row",
];

const youssefHistory = [
  session(2, "Full body", [
    e("ex-squat", "80x10 80x9 80x9", { plan: "3x8-10@120" }),
    e("ex-db-bench", "24x12 24x11 24x10", { plan: "3x8-12@90" }),
    e("ex-lat-pulldown", "55x12 55x12 55x11", { plan: "3x10-12@90" }),
    e("ex-lateral-raise", "8x15 8x14 8x13", { plan: "3x12-15@60" }),
  ]),
  session(5, "Full body", [
    e("ex-rdl", "70x10 70x10 70x10", { plan: "3x8-10@120" }),
    e("ex-incline-db", "20x12 20x11 20x10", { plan: "3x8-12@90" }),
    e("ex-seated-row", "50x12 50x12 50x12", { plan: "3x10-12@90" }),
    e("ex-db-curl", "12x12 12x11 12x10", { plan: "3x10-12@60" }),
  ]),
];

/** Strong lifter coming back after a month off. */
const chrisHistory = [
  session(30, "Upper", [
    e("ex-bench-press", "w60x5 100x5 100x5 100x5", { plan: "3x5@180" }),
    e("ex-bent-rows", "80x8 80x8 80x8", { plan: "3x8@120" }),
  ]),
  session(32, "Lower", [
    e("ex-squat", "w60x5 140x5 140x5 140x5", { plan: "3x5@180" }),
    e("ex-rdl", "110x8 110x8 110x8", { plan: "3x8@120" }),
  ]),
  session(35, "Upper", [
    e("ex-bench-press", "w60x5 97.5x5 97.5x5 97.5x5", { plan: "3x5@180" }),
    e("ex-bent-rows", "77.5x8 77.5x8 77.5x8", { plan: "3x8@120" }),
  ]),
];

// ── Fixtures ─────────────────────────────────────────────

export const FIXTURES: Fixture[] = [
  {
    id: "new-beginner",
    description: "No history yet, home dumbbells, beginner, fat loss",
    user: user({
      name: "Maya", gender: "female", dateOfBirth: "1998-04-12", weight: 68, height: 165,
      goal: "Lose fat and get fitter", experience: "beginner", trainingDays: 3, sessionMinutes: 45,
      equipment: ["dumbbell", "bench", "band", "pullup_bar"],
    }),
    data: coachData([]),
    workout: {
      args: {},
      checks: (w) => [
        {
          name: "no advanced exercises for a beginner",
          pass: w.exercises.every((x) => EXERCISE_BY_ID[x.exerciseId ?? ""]?.level !== "advanced"),
          detail: w.exercises.filter((x) => EXERCISE_BY_ID[x.exerciseId ?? ""]?.level === "advanced").map((x) => x.exerciseName).join(", "),
        },
        {
          name: "no invented loads (no history)",
          pass: w.exercises.every((x) => x.targetWeight === undefined),
          detail: w.exercises.filter((x) => x.targetWeight !== undefined).map((x) => `${x.exerciseName} ${x.targetWeight}kg`).join(", "),
          soft: true,
        },
      ],
    },
    chat: {
      question: "How is my bench press progressing?",
      rubric: "The user has NO logged workouts. A good answer says plainly that there is no bench data yet, does not invent any numbers or trends, and helps them get started (e.g. log a few sessions, a sensible starting approach for a beginner with dumbbells at home).",
    },
  },
  {
    id: "ppl-stalled-bench",
    description: "Intermediate PPL lifter, bench stalled with short rests, legs due",
    user: omar,
    data: coachData(omarHistory),
    workout: {
      args: {},
      checks: (w) => {
        const legsShare = setsShare(w, (id) => ["Legs", "Glutes"].includes(groupOf(id) ?? "") || primaryOf(id).some((m) => LOWER.has(m)));
        const squat = loadOf(w, "ex-squat");
        return [
          {
            name: "trains legs (push was yesterday, pull 2 days ago, legs 4 days ago)",
            pass: legsShare >= 0.5,
            detail: `${Math.round(legsShare * 100)}% of sets are legs/glutes`,
          },
          {
            name: "squat load progresses after 100kg×10,10,10 (expect 102.5-105kg)",
            pass: squat === undefined || (squat > 100 && squat <= 105),
            detail: squat === undefined ? "squat not in plan" : `${squat}kg`,
            soft: true,
          },
        ];
      },
    },
    chat: {
      question: "Why is my bench stuck and what should I change?",
      rubric: "Facts in the data: bench has been 80kg for 3 sessions with 7-9 reps (plan 3×8-10), after 77.5kg×10,10,9 before that; measured rest on bench is ~85s although the plan says 120s; the last note says 'Bench felt heavy again'; energy 3/5. A good answer cites these actual numbers, spots the stall, and gives concrete fixes (rest the planned 2+ minutes, microload or a small deload, check chest volume/recovery). Bonus for noticing the short rests. Any invented number is a serious error.",
    },
  },
  {
    id: "imperial-5x5",
    description: "Strength lifter logging in pounds; next is workout B",
    user: user({
      name: "Jake", gender: "male", dateOfBirth: "1990-02-20", weight: 90, height: 183,
      goal: "Get stronger at squat, bench and deadlift", experience: "intermediate", trainingDays: 3, sessionMinutes: 75,
      equipment: ["barbell", "rack", "bench", "plate", "pullup_bar"], unitPreference: "imperial",
    }),
    data: coachData(jakeHistory),
    workout: {
      args: {},
      checks: (w) => {
        const loaded = w.exercises.filter((x) => x.targetWeight !== undefined);
        const odd = loaded.filter((x) => lb(x.targetWeight!) % 2.5 !== 0);
        const squat = loadOf(w, "ex-squat");
        const ids = w.exercises.map((x) => x.exerciseId);
        const missingB = ["ex-squat", "ex-ohp", "ex-deadlift"].filter((id) => !ids.includes(id));
        return [
          {
            name: "follows the A/B rotation (Workout B = squat, OHP, deadlift)",
            pass: missingB.length === 0,
            detail: missingB.length ? `missing ${missingB.join(", ")}` : undefined,
          },
          {
            name: "loads are loadable in pounds",
            pass: odd.length === 0,
            detail: odd.length ? odd.map((x) => `${x.exerciseName} ${lb(x.targetWeight!)} lb`).join(", ") : loaded.map((x) => `${x.exerciseName} ${lb(x.targetWeight!)} lb`).join(", "),
          },
          {
            name: "squat progresses from 225 lb 5×5 (expect 230-235 lb)",
            pass: squat === undefined || (lb(squat) >= 230 && lb(squat) <= 235),
            detail: squat === undefined ? "squat not in plan" : `${lb(squat)} lb`,
            soft: true,
          },
        ];
      },
    },
    chat: {
      question: "What should I squat next session?",
      rubric: "Facts: squat went 200→205→210→215→220→225 lb for 5×5, all reps completed every time; the user uses pounds. A good answer recommends about 230 lb (230-235) for 5×5, in pounds, and references the steady +5 lb trend. Answering in kg or inventing numbers is an error.",
      checks: (answer) => [
        {
          // The first weight mentioned is the recommendation ("keep 225 … then 230 later" fails).
          name: "recommends 230-235 lb, not 225 again",
          pass: /\b23[05]\b/.test(answer.match(/\b\d{3}\s*(?:lb|lbs|pounds)\b/i)?.[0] ?? ""),
          detail: `first weight mentioned: ${answer.match(/\b\d{3}\s*(?:lb|lbs|pounds)\b/i)?.[0] ?? "none in lb"}`,
          soft: true,
        },
        { name: "uses pounds", pass: /\blb|lbs|pound/i.test(answer) },
      ],
    },
  },
  {
    id: "shoulder-limitation",
    description: "Shoulder impingement, asks for chest and shoulders",
    user: user({
      name: "Lina", gender: "female", dateOfBirth: "1992-11-05", weight: 63, height: 168,
      goal: "Get toned and stronger", experience: "intermediate", trainingDays: 4, sessionMinutes: 60,
      limitations: "Right shoulder impingement: overhead pressing and dips hurt",
    }),
    data: coachData(linaHistory),
    workout: {
      args: { focus: ["Shoulders", "Chest"], userComment: "Upper body today please, shoulders and chest" },
      checks: (w) => {
        const unsafe = w.exercises.filter((x) => SHOULDER_UNSAFE.includes(x.exerciseId ?? ""));
        return [
          {
            name: "no overhead pressing or dips",
            pass: unsafe.length === 0,
            detail: unsafe.map((x) => x.exerciseName).join(", "),
          },
          {
            name: "honors the requested focus",
            pass: setsShare(w, (id) => ["Shoulders", "Chest"].includes(groupOf(id) ?? "")) >= 0.5,
            detail: `${Math.round(setsShare(w, (id) => ["Shoulders", "Chest"].includes(groupOf(id) ?? "")) * 100)}% of sets are chest/shoulders`,
          },
        ];
      },
    },
    chat: {
      question: "My shoulder hurts a bit when I bench. Should I just push through it?",
      rubric: "The profile lists right shoulder impingement (overhead pressing and dips hurt) and a recent note says the shoulder was 'a bit cranky' on incline dumbbell press. A good answer says not to push through pain, recommends seeing a physio/doctor, does not diagnose definitively, and gives concrete modifications (lighter load, reduced range, neutral grip/dumbbells, floor press, skip painful lifts), referencing their limitation.",
    },
  },
  {
    id: "arabic-30-min",
    description: "Egyptian Arabic request with only 30 minutes",
    user: user({
      name: "Youssef", gender: "male", dateOfBirth: "1999-07-14", weight: 75, height: 175,
      goal: "بناء عضلات", experience: "intermediate", trainingDays: 4, sessionMinutes: 60,
    }),
    data: coachData(youssefHistory),
    workout: {
      args: { sessionMinutes: 30, userComment: "عندي نص ساعة بس النهارده، عايز تمرين للجسم كله" },
      checks: (w) => [
        // Supersets can fit a 6th exercise; the shared time checks are the real test.
        { name: "at most 5 exercises in 30 min", pass: w.exercises.length <= 5, detail: `${w.exercises.length} exercises`, soft: true },
        { name: "reasoning in Arabic", pass: hasArabic(w.reasoning) },
        { name: "workout name in Arabic", pass: hasArabic(w.workoutName), detail: w.workoutName, soft: true },
      ],
    },
    chat: {
      question: "إزاي أكبّر عضلة الصدر أسرع؟",
      rubric: "The question is in Egyptian Arabic, so the answer must be in Arabic. Facts: chest work in the last week is dumbbell bench 24kg×12,11,10 and incline dumbbell press 20kg×12,11,10 (about 6 hard sets). A good answer is in Arabic, references this volume, and gives practical advice (more weekly chest sets, progressive overload, protein/sleep briefly).",
      checks: (answer) => [{ name: "answers in Arabic", pass: hasArabic(answer) }],
    },
  },
  {
    id: "hotel-bodyweight",
    description: "Gym lifter travelling with no equipment today",
    user: omar,
    data: coachData(omarHistory),
    workout: {
      args: { equipment: [], sessionMinutes: 40, userComment: "Hotel room this week, no equipment at all" },
      checks: (w) => [
        {
          name: "no loads on bodyweight exercises",
          pass: w.exercises.every((x) => x.targetWeight === undefined),
          detail: w.exercises.filter((x) => x.targetWeight !== undefined).map((x) => x.exerciseName).join(", "),
          soft: true,
        },
      ],
    },
  },
  {
    id: "back-after-break",
    description: "Benched 100kg×5 a month ago, back after 30 days off",
    user: user({
      name: "Chris", gender: "male", dateOfBirth: "1988-05-30", weight: 95, height: 185,
      goal: "Get back in shape and rebuild strength", experience: "advanced", trainingDays: 4, sessionMinutes: 60,
    }),
    data: coachData(chrisHistory),
    workout: {
      args: { focus: ["Chest", "Back"] },
      checks: (w) => {
        const bench = loadOf(w, "ex-bench-press");
        return [{
          name: "bench starts lighter than 100kg after a month off",
          pass: bench === undefined || bench < 100,
          detail: bench === undefined ? "bench not in plan" : `${bench}kg`,
          soft: true,
        }];
      },
    },
    chat: {
      question: "I'm back after a month off. What should I bench this week?",
      rubric: "Facts: last bench 100kg×5,5,5 thirty days ago (97.5kg×5 before that); nothing logged since. A good answer starts lighter (roughly 80-90kg for 5s), explains ramping back over 2-3 weeks, and references the 100kg×5 from a month ago. Recommending 100kg+ straight away is an error.",
    },
  },
];
