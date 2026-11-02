/**
 * Safety net for AI-suggested loads.
 *
 * The model chooses each weight, in the user's own units. This module then:
 *   1. caps jumps that are unrealistic compared with the user's last session
 *      for that exercise (allowing heavier loads when the rep range drops), and
 *   2. rounds weights that can't be loaded (61.3 kg on a barbell, 231 lb) to
 *      the nearest loadable one, leaving sensible choices untouched.
 * Every change is reported, so the evals can measure how often it was needed.
 *
 * Pure functions (no Convex runtime APIs).
 */
import type { CoachWorkout } from "./coachData";
import { est1RM, type Units } from "./coachPrompt";
import { EXERCISE_BY_ID } from "../src/constants/exerciseCatalog";

const DAY = 24 * 60 * 60 * 1000;
/** Same factor as the app (src/context/UnitsContext.tsx). */
const KG_TO_LB = 2.20462;
const MAX_KG = 600;
/** After this long without the exercise, don't allow any increase. */
const BREAK_DAYS = 21;

export const toDisplay = (kg: number, units: Units) => (units === "imperial" ? kg * KG_TO_LB : kg);
export const fromDisplay = (value: number, units: Units) => (units === "imperial" ? value / KG_TO_LB : value);
/** Weights are stored in kg with one decimal, so lb values come back slightly off (135 lb → 134.92). */
const clean = (value: number) => Math.round(value * 4) / 4;

/** Lowest rep count of a prescription: "8-10" → 8, "5" → 5, "AMRAP" / "45s" → null. */
export function lowestReps(reps: string): number | null {
  const m = String(reps).trim().match(/^(\d+)(?:\s*[-–]\s*\d+)?$/);
  const n = m ? Number(m[1]) : 0;
  return n > 0 ? n : null;
}

export interface LastTop {
  /** Heaviest working weight, in display units. */
  weight: number;
  reps: number;
  /** Best estimated 1RM of that session, in display units. */
  e1rm: number;
  daysAgo: number;
}

/** Heaviest working set of the most recent session that included the exercise. */
export function lastTopSet(workouts: CoachWorkout[], exerciseId: string, units: Units, now: number): LastTop | null {
  const newestFirst = [...workouts].sort((a, b) => b.startTime - a.startTime);
  for (const w of newestFirst) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const working = ex.sets.filter((s) => s.completed !== false && s.type !== "warmup" && s.weight > 0 && s.reps > 0);
      if (!working.length) continue;
      const top = working.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b));
      const e1rm = Math.max(...working.map((s) => est1RM(s.weight, s.reps)));
      return {
        weight: clean(toDisplay(top.weight, units)),
        reps: top.reps,
        e1rm: toDisplay(e1rm, units),
        daysAgo: (now - w.startTime) / DAY,
      };
    }
  }
  return null;
}

const PLATE_LOADED = new Set(["barbell", "ez_bar", "trap_bar", "smith", "plate"]);

/**
 * The loads the user can actually pick for this exercise, in display units,
 * as grid steps: a load is loadable when it's a multiple of any of them.
 * Plate-loaded bars go up in 2.5 kg / 5 lb. Dumbbells, cables and machines
 * come in whole kg or 2.5 kg steps (10, 12, 12.5…, never 10.5), or 2.5 lb.
 * Users with microplates log finer jumps, so their history can make the grid
 * finer, never coarser: how much they usually add is a coaching choice.
 */
export function loadGrid(workouts: CoachWorkout[], exerciseId: string, units: Units): number[] {
  const plateLoaded = (EXERCISE_BY_ID[exerciseId]?.equipment ?? []).some((e) => PLATE_LOADED.has(e));
  const standard = units === "imperial" ? (plateLoaded ? [5] : [2.5]) : plateLoaded ? [2.5] : [1, 2.5];
  const weights = new Set<number>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) if (s.weight > 0) weights.add(clean(toDisplay(s.weight, units)));
    }
  }
  const sorted = [...weights].sort((a, b) => a - b);
  let smallest = Infinity;
  for (let i = 1; i < sorted.length; i++) smallest = Math.min(smallest, sorted[i] - sorted[i - 1]);
  return smallest >= 0.25 && smallest < Math.min(...standard) ? [smallest] : standard;
}

const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

/** Nearest loadable weight on the grid; exact ties go down (237.5 lb on a 5 lb grid → 235), the safer side. */
function nearestOnGrid(value: number, grid: number[]): number {
  let best = NaN;
  for (const step of grid) {
    const candidate = tidy(Math.ceil(value / step - 0.5) * step);
    const d = Math.abs(candidate - value);
    const bestD = Math.abs(best - value);
    if (Number.isNaN(best) || d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && candidate < best)) best = candidate;
  }
  return best;
}

/** Heaviest loadable weight not above `value`. */
const floorOnGrid = (value: number, grid: number[]) => Math.max(...grid.map((step) => tidy(Math.floor(value / step + 1e-9) * step)));

export interface LoadChange {
  kind: "rounded" | "capped" | "dropped" | "low";
  /** What the model suggested, in display units. */
  from: number;
  /** What the app will show, in display units. */
  to?: number;
  detail: string;
}

export interface LoadDecision {
  /** Final load in kg (what the app stores), or undefined for no target. */
  kg?: number;
  changes: LoadChange[];
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Check one AI-suggested load (in display units) against the user's history.
 * `reps` is the prescription for this exercise ("8-10", "5", "AMRAP", ...).
 */
export function guardLoad(opts: {
  suggested: unknown;
  exerciseId: string;
  reps: string;
  workouts: CoachWorkout[];
  units: Units;
  now: number;
}): LoadDecision {
  const { exerciseId, reps, workouts, units, now } = opts;
  if (opts.suggested === null || opts.suggested === undefined) return { changes: [] };
  const value = Number(opts.suggested);
  if (!Number.isFinite(value) || value <= 0) return { changes: [] };
  const unit = units === "imperial" ? "lb" : "kg";
  if (value >= toDisplay(MAX_KG, units)) {
    return { changes: [{ kind: "dropped", from: value, detail: `implausible load ${fmt(value)}${unit}` }] };
  }

  const changes: LoadChange[] = [];
  const grid = loadGrid(workouts, exerciseId, units);
  /** The smallest jump that changes the weight on every grid (e.g. 2.5 kg for dumbbells). */
  const step = Math.max(...grid);
  const last = lastTopSet(workouts, exerciseId, units, now);
  let target = value;
  let snapped = nearestOnGrid(target, grid) || Math.min(...grid);

  if (last) {
    const afterBreak = last.daysAgo > BREAK_DAYS;
    const progressionCap = afterBreak ? last.weight : last.weight + Math.max(step, last.weight * 0.1);
    // A lower rep range legitimately allows more weight: up to a true rep max at the bottom of the range.
    const low = lowestReps(reps);
    const repCap = low && !afterBreak ? last.e1rm / (1 + low / 30) : 0;
    const cap = Math.max(progressionCap, repCap);
    if (target > cap) {
      changes.push({
        kind: "capped",
        from: value,
        detail: afterBreak
          ? `${fmt(value)}${unit} after ${Math.round(last.daysAgo)} days off; last top set ${fmt(last.weight)}${unit}×${last.reps}`
          : `${fmt(value)}${unit} is too big a jump from last top set ${fmt(last.weight)}${unit}×${last.reps}`,
      });
      target = cap;
    }
    snapped = nearestOnGrid(target, grid);
    if (snapped > cap + 1e-9) snapped = floorOnGrid(cap, grid);
    if (snapped <= 0) snapped = Math.min(...grid);
    if (snapped < last.weight * 0.6 && !afterBreak) {
      changes.push({ kind: "low", from: value, detail: `${fmt(snapped)}${unit} is far below last top set ${fmt(last.weight)}${unit}×${last.reps}` });
    }
  }

  if (Math.abs(snapped - value) > 1e-6) {
    const capped = changes.find((c) => c.kind === "capped");
    if (capped) capped.to = snapped;
    else changes.push({ kind: "rounded", from: value, to: snapped, detail: `${fmt(value)} → ${fmt(snapped)}${unit} (steps of ${grid.map(fmt).join(" or ")}${unit})` });
  }

  const kg = fromDisplay(snapped, units);
  return { kg: units === "imperial" ? Math.round(kg * 1000) / 1000 : Math.round(kg * 100) / 100, changes };
}
