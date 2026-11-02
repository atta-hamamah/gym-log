/**
 * Training plan schedule and progress. Pure functions shared by the app and
 * the Convex AI coach (keep this file free of React Native imports).
 *
 * Weeks are 7-day blocks starting on the plan's start date, so every week
 * holds each training weekday exactly once and the session order is stable:
 * session 1 falls on the first training day of the block, session 2 on the
 * next, and so on. A session counts as done when a finished workout was
 * started from it (source.type 'plan' with its plan, week and session IDs).
 */
import type { PlanCheckIn, PlanExercise, PlanPhase, PlanSession, TrainingPlan } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-02" for a local date. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a "YYYY-MM-DD" key. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Calendar-day arithmetic (DST-safe). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Whole calendar days from a to b. */
export function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / DAY_MS);
}

/** Weekdays in display order (Monday first), as Date.getDay numbers. */
export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Sensible training weekdays for n sessions a week. */
export function defaultTrainingDays(n: number): number[] {
  const presets: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.min(7, Math.max(1, Math.round(n) || 3))];
}

/** The next Monday after `from` (or `from` itself when it's a Monday and `includeToday`). */
export function nextMonday(from: Date, includeToday = false): Date {
  const offset = (8 - from.getDay()) % 7;
  return addDays(from, offset === 0 && !includeToday ? 7 : offset);
}

/** Plan week (1-based) on a given day: 0 before the start, > plan.weeks once it's over. */
export function weekOf(plan: Pick<TrainingPlan, 'startDate'>, day: Date): number {
  const d = daysBetween(fromDateKey(plan.startDate), day);
  return d < 0 ? 0 : Math.floor(d / 7) + 1;
}

/** First and last day of a plan week. */
export function weekRange(plan: Pick<TrainingPlan, 'startDate'>, week: number): { start: Date; end: Date } {
  const start = addDays(fromDateKey(plan.startDate), (week - 1) * 7);
  return { start, end: addDays(start, 6) };
}

export interface ScheduledSession {
  week: number;
  session: PlanSession;
  date: Date;
  dateKey: string;
  /** Position in the week (0-based). */
  index: number;
}

/** The sessions of a week with their dates, in the order they're done. */
export function weekSchedule(plan: TrainingPlan, week: number): ScheduledSession[] {
  const { start } = weekRange(plan, week);
  const out: ScheduledSession[] = [];
  let i = 0;
  for (let d = 0; d < 7 && i < plan.sessions.length; d++) {
    const date = addDays(start, d);
    if (plan.trainingDays.includes(date.getDay())) {
      out.push({ week, session: plan.sessions[i], date, dateKey: dateKey(date), index: i });
      i++;
    }
  }
  // More sessions than training days (shouldn't happen): the rest go on the last day.
  for (; i < plan.sessions.length; i++) {
    const date = addDays(start, 6);
    out.push({ week, session: plan.sessions[i], date, dateKey: dateKey(date), index: i });
  }
  return out;
}

export function phaseOf(plan: TrainingPlan, week: number): PlanPhase | undefined {
  return plan.phases.find(p => week >= p.startWeek && week <= p.endWeek) ?? plan.phases[plan.phases.length - 1];
}

export function checkInFor(plan: TrainingPlan, week: number): PlanCheckIn | undefined {
  return plan.checkIns.find(c => c.week === week);
}

/** Whether week n is waiting for its check-in (from week 2; week 1 uses the plan's starting loads). */
export function needsCheckIn(plan: TrainingPlan, week: number): boolean {
  return week >= 2 && week <= plan.weeks && !checkInFor(plan, week);
}

export interface ResolvedExercise extends PlanExercise {
  /** Load for this week in kg (week 1: the plan's start load; later: the week's check-in). */
  targetWeight?: number;
  /** The check-in changed this exercise for this week. */
  changed: boolean;
  /** The exercise it replaced this week (check-in swap). */
  replacedId?: string;
  replacedName?: string;
}

export interface ResolvedSession {
  week: number;
  session: PlanSession;
  exercises: ResolvedExercise[];
  phase?: PlanPhase;
  deload: boolean;
  checkIn?: PlanCheckIn;
}

/** Deload weeks keep ~60% of the sets unless the check-in says otherwise. */
const deloadSets = (sets: number) => Math.max(1, Math.round(sets * 0.6));

/** A session as it should be done in a given week: check-in changes applied, lighter in deload weeks. */
export function resolveSession(plan: TrainingPlan, week: number, sessionId: string): ResolvedSession | null {
  const session = plan.sessions.find(s => s.id === sessionId);
  if (!session) return null;
  const phase = phaseOf(plan, week);
  const deload = !!phase?.deload;
  const checkIn = checkInFor(plan, week);
  const exercises = session.exercises.map((ex): ResolvedExercise => {
    const adj = checkIn?.adjustments.find(a => a.sessionId === sessionId && a.exerciseId === ex.exerciseId);
    const replaced = !!adj?.replaceWith && adj.replaceWith !== ex.exerciseId;
    return {
      ...ex,
      exerciseId: replaced ? adj!.replaceWith! : ex.exerciseId,
      exerciseName: replaced ? adj!.replaceName ?? ex.exerciseName : ex.exerciseName,
      replacedId: replaced ? ex.exerciseId : undefined,
      replacedName: replaced ? ex.exerciseName : undefined,
      sets: adj?.sets ?? (deload ? deloadSets(ex.sets) : ex.sets),
      reps: adj?.reps ?? ex.reps,
      // A cue written for the original exercise doesn't fit its replacement.
      notes: replaced ? undefined : ex.notes,
      targetWeight: adj?.targetWeight ?? (week === 1 ? ex.startWeight : undefined),
      changed: !!adj && (replaced || adj.sets !== undefined || adj.reps !== undefined),
    };
  });
  return { week, session, exercises, phase, deload, checkIn };
}

/** Minimal workout shape, so the app's and the server's workout types both fit. */
interface PlanWorkoutLike {
  source?: { type?: string; planId?: string; planWeek?: number; planSessionId?: string } | null;
}

export const sessionKey = (week: number, sessionId: string) => `${week}:${sessionId}`;

/** Finished workouts started from this plan, by `sessionKey(week, sessionId)`. */
export function planCompletions<T extends PlanWorkoutLike>(plan: Pick<TrainingPlan, 'id'>, workouts: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const w of workouts) {
    const s = w.source;
    if (s?.type !== 'plan' || s.planId !== plan.id || !s.planWeek || !s.planSessionId) continue;
    const key = sessionKey(s.planWeek, s.planSessionId);
    if (!map.has(key)) map.set(key, w);
  }
  return map;
}

export type SessionStatus = 'done' | 'today' | 'missed' | 'upcoming';

export function sessionStatus(s: ScheduledSession, completions: Map<string, unknown>, today: Date): SessionStatus {
  if (completions.has(sessionKey(s.week, s.session.id))) return 'done';
  const diff = daysBetween(today, s.date);
  return diff === 0 ? 'today' : diff < 0 ? 'missed' : 'upcoming';
}

export interface WeekProgress {
  week: number;
  done: number;
  total: number;
}

export interface PlanProgress<T extends PlanWorkoutLike = PlanWorkoutLike> {
  /** Week to show (1…weeks): the current one, clamped. */
  currentWeek: number;
  started: boolean;
  finished: boolean;
  done: number;
  total: number;
  /** Sessions scheduled up to today. */
  due: number;
  /** Share of due sessions that were done (null before anything was due). */
  adherence: number | null;
  /** First session not done yet, from the current week on (missed ones this week come first). */
  next: ScheduledSession | null;
  weeks: WeekProgress[];
  completions: Map<string, T>;
}

export function planProgress<T extends PlanWorkoutLike>(plan: TrainingPlan, workouts: T[], today: Date = new Date()): PlanProgress<T> {
  const completions = planCompletions(plan, workouts);
  const w = weekOf(plan, today);
  const finished = w > plan.weeks;
  const currentWeek = Math.min(plan.weeks, Math.max(1, w));
  let done = 0;
  let total = 0;
  let due = 0;
  let dueDone = 0;
  let next: ScheduledSession | null = null;
  const weeks: WeekProgress[] = [];
  for (let week = 1; week <= plan.weeks; week++) {
    const schedule = weekSchedule(plan, week);
    let weekDone = 0;
    for (const s of schedule) {
      total++;
      const isDone = completions.has(sessionKey(week, s.session.id));
      if (isDone) {
        done++;
        weekDone++;
      }
      if (daysBetween(s.date, today) >= 0) {
        due++;
        if (isDone) dueDone++;
      }
      if (!isDone && !next && week >= currentWeek) next = s;
    }
    weeks.push({ week, done: weekDone, total: schedule.length });
  }
  return {
    currentWeek,
    started: w >= 1,
    finished,
    done,
    total,
    due,
    adherence: due > 0 ? dueDone / due : null,
    next: finished ? null : next,
    weeks,
    completions,
  };
}
