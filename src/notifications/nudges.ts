/**
 * Coach nudges: when a coach sends a notification, and what it's about.
 *
 * Pure functions shared by the app and Convex (keep this file free of React
 * Native imports), so both follow the same rules:
 *   - without the AI subscription, the app turns nudges into template
 *     notifications and schedules them on the phone (no server, no AI cost);
 *   - for AI subscribers, the server picks today's nudge with the same rules
 *     and has the AI write it (convex/nudgeAI.ts).
 *
 * The rules work on local calendar days ("day numbers": days since
 * 1970-01-01 in the user's time zone), so the phone and the server agree.
 */
import { EXERCISE_BY_ID, GROUP_MUSCLES } from '../constants/exerciseCatalog';
import type { TrainingPlan } from '../types';
import { dateKey, planCompletions, sessionKey, weekOf, weekSchedule } from '../utils/trainingPlan';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const COACHES = ['repai', 'chad', 'kevin'] as const;
export type Coach = (typeof COACHES)[number];
/** The user's pick in Settings: one coach, or a different one each day. */
export type CoachChoice = Coach | 'mix';
export const COACH_CHOICES: CoachChoice[] = ['mix', 'repai', 'chad', 'kevin'];

/** The coach who speaks on a given day. */
export function coachFor(choice: CoachChoice, day: number): Coach {
  return choice === 'mix' ? COACHES[((day % 3) + 3) % 3] : choice;
}

export const NUDGE_KINDS = ['planDay', 'comeback', 'usualDay', 'welcome', 'weeklyRecap', 'muscleGap'] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export interface Nudge {
  kind: NudgeKind;
  /** Local day number the nudge is for. */
  day: number;
  /** comeback: days since the last workout · muscleGap: days since the group was trained. */
  days?: number;
  /** muscleGap: the neglected muscle group ("Legs"). */
  group?: string;
  /** planDay: today's plan session (name, and where it is in the plan). */
  session?: string;
  planWeek?: number;
  planSessionId?: string;
  /** weeklyRecap: totals of the last 7 days. */
  workouts?: number;
  sets?: number;
  volumeKg?: number;
}

/** A finished workout, reduced to what the rules need. */
export interface NudgeWorkout {
  day: number;
  /** Local hour it started. */
  hour: number;
  /** Muscle groups trained directly (with working sets). */
  groups: string[];
  sets: number;
  volumeKg: number;
}

/** A nudge that was already delivered (spacing and weekly cap). */
export interface SentNudge {
  day: number;
  kind: NudgeKind;
  group?: string;
}

export interface PlanDay {
  week: number;
  sessionId: string;
  session: string;
  done: boolean;
}

export interface NudgeInput {
  /** Today's local day number. */
  today: number;
  workouts: NudgeWorkout[];
  /** Training plan sessions by day number (AI subscribers), from `planDaysFor`. */
  planDays?: Record<number, PlanDay>;
  /** Day the app was first opened, for welcome nudges before the first workout. */
  firstSeenDay?: number;
  sent: SentNudge[];
}

// ── Tunables ─────────────────────────────────────────────

/** At most this many nudges in any 7 days. */
export const MAX_PER_WEEK = 4;
/** Hour used until the user has a few workouts to learn from. */
export const DEFAULT_NUDGE_HOUR = 18;
/** Muscle groups worth a "you skipped X" nudge. */
const MAJOR_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders'];
/** Days after install (with no workout yet) that get a welcome nudge. */
const WELCOME_DAYS = [1, 3, 6];
/** Comeback nudges: days after the threshold (then the coaches go quiet). */
const COMEBACK_STEPS = [0, 3, 7, 14];
/** Plan reminders stop after this long without training (comeback nudges take over). */
const PLAN_DAY_MAX_GAP = 10;
/** Muscle group gap that triggers a nudge, in days. */
const MUSCLE_GAP_DAYS = 9;
/** Minimum days between two nudges of the same kind (0 = no limit). */
const KIND_SPACING: Record<NudgeKind, number> = {
  planDay: 0,
  comeback: 0,
  usualDay: 0,
  welcome: 0,
  weeklyRecap: 6,
  muscleGap: 4,
};
/** Same muscle group again only after this many days. */
const SAME_GROUP_SPACING = 14;

// ── Calendar days ────────────────────────────────────────

export interface LocalTime {
  day: number;
  hour: number;
  minute: number;
}

/** Day number of a calendar date (its local year / month / day). */
export function dateToDay(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Local midnight of a day number, as a Date whose local getters give that calendar date. */
export function dayToDate(day: number): Date {
  const u = new Date(day * DAY_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
}

/** Weekday of a day number (Date.getDay: 0 = Sunday). 1970-01-01 was a Thursday. */
export function weekdayOf(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * Local day / hour of a timestamp: in `timeZone` (IANA name, on the server)
 * or in the device's time zone when it's omitted (in the app).
 */
export function localTime(t: number, timeZone?: string): LocalTime {
  if (!timeZone) {
    const d = new Date(t);
    return { day: dateToDay(d), hour: d.getHours(), minute: d.getMinutes() };
  }
  try {
    let fmt = zoneFormats.get(timeZone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      zoneFormats.set(timeZone, fmt);
    }
    const parts: Record<string, number> = {};
    for (const p of fmt.formatToParts(new Date(t))) {
      if (p.type !== 'literal') parts[p.type] = Number(p.value);
    }
    const day = Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
    return { day, hour: parts.hour % 24, minute: parts.minute };
  } catch {
    // Unknown time zone: fall back to UTC.
    const d = new Date(t);
    return { day: Math.floor(t / DAY_MS), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
}

/** Timestamp of `hour`:00 local time on a day number, in `timeZone` (device time zone when omitted). */
export function zonedTime(day: number, hour: number, timeZone?: string): number {
  if (!timeZone) {
    const d = dayToDate(day);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  }
  // Start from the wall-clock time read as UTC, then correct by the zone's offset (twice for DST edges).
  const wall = day * DAY_MS + hour * HOUR_MS;
  let t = wall;
  for (let i = 0; i < 3; i++) {
    const lt = localTime(t, timeZone);
    const diff = lt.day * DAY_MS + lt.hour * HOUR_MS + lt.minute * 60_000 - wall;
    if (diff === 0) break;
    t -= diff;
  }
  return t;
}

/** Whether the runtime knows an IANA time zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// ── Inputs from workouts and plans ───────────────────────

/** The workout shape shared by the app (WorkoutSession) and the server (CoachWorkout). */
export interface WorkoutLike {
  startTime: number;
  endTime?: number;
  exercises: {
    exerciseId: string;
    sets: { weight: number; reps: number; type: string; completed: boolean }[];
  }[];
}

const MUSCLE_TO_GROUP: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_MUSCLES).flatMap(([group, muscles]) => muscles.map(m => [m, group])),
);

/** Muscle groups an exercise trains directly. `customGroups`: custom exercise ID → its muscle group. */
function groupsOf(exerciseId: string, customGroups: Record<string, string>): string[] {
  const known = EXERCISE_BY_ID[exerciseId];
  if (known) {
    if (known.category !== 'strength') return [];
    const groups = (known.primaryMuscles ?? []).map(m => MUSCLE_TO_GROUP[m]).filter(Boolean);
    if (groups.length) return [...new Set(groups)];
    return GROUP_MUSCLES[known.muscleGroup] ? [known.muscleGroup] : [];
  }
  const group = customGroups[exerciseId];
  return group && GROUP_MUSCLES[group] ? [group] : [];
}

/** Finished workouts in the shape the rules use. */
export function toNudgeWorkouts(
  workouts: WorkoutLike[],
  customGroups: Record<string, string> = {},
  timeZone?: string,
): NudgeWorkout[] {
  const out: NudgeWorkout[] = [];
  for (const w of workouts) {
    if (!w.endTime) continue;
    const { day, hour } = localTime(w.startTime, timeZone);
    const groups = new Set<string>();
    let sets = 0;
    let volumeKg = 0;
    for (const ex of w.exercises) {
      const working = ex.sets.filter(s => s.completed !== false && s.type !== 'warmup');
      if (working.length === 0) continue;
      sets += working.length;
      for (const s of working) volumeKg += (s.weight || 0) * (s.reps || 0);
      for (const g of groupsOf(ex.exerciseId, customGroups)) groups.add(g);
    }
    out.push({ day, hour, groups: [...groups], sets, volumeKg });
  }
  return out;
}

interface PlanWorkoutLike {
  endTime?: number;
  source?: { type?: string; planId?: string; planWeek?: number; planSessionId?: string } | null;
}

/** Plan sessions scheduled from `fromDay` to `toDay`, and whether each is done. */
export function planDaysFor(
  plan: TrainingPlan,
  workouts: PlanWorkoutLike[],
  fromDay: number,
  toDay: number,
): Record<number, PlanDay> {
  const done = planCompletions(plan, workouts.filter(w => !!w.endTime));
  const out: Record<number, PlanDay> = {};
  for (let day = fromDay; day <= toDay; day++) {
    const date = dayToDate(day);
    const week = weekOf(plan, date);
    if (week < 1 || week > plan.weeks) continue;
    const key = dateKey(date);
    const s = weekSchedule(plan, week).find(x => x.dateKey === key);
    if (s) {
      out[day] = { week, sessionId: s.session.id, session: s.session.name, done: done.has(sessionKey(week, s.session.id)) };
    }
  }
  return out;
}

/** When to nudge: an hour before the user usually starts training (8:00–20:00). */
export function nudgeHourFor(workouts: NudgeWorkout[]): number {
  const hours = [...workouts]
    .sort((a, b) => b.day - a.day)
    .slice(0, 10)
    .map(w => w.hour)
    .sort((a, b) => a - b);
  if (hours.length < 3) return DEFAULT_NUDGE_HOUR;
  const median = hours[Math.floor(hours.length / 2)];
  return Math.min(20, Math.max(8, median - 1));
}

// ── Rules ────────────────────────────────────────────────

/** Days between consecutive training days the user usually takes (median, last 60 days). */
function typicalGap(days: number[], today: number): number {
  const recent = [...new Set(days.filter(d => d > today - 60 && d <= today))].sort((a, b) => a - b);
  if (recent.length < 3) return 2;
  const gaps = recent.slice(1).map((d, i) => d - recent[i]).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** Weekdays the user trained on at least twice in the 4 weeks before today. */
function usualWeekdays(days: number[], today: number): Set<number> {
  const recent = [...new Set(days.filter(d => d >= today - 28 && d < today))];
  if (recent.length < 4) return new Set();
  const counts = new Map<number, number>();
  for (const d of recent) counts.set(weekdayOf(d), (counts.get(weekdayOf(d)) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n >= 2).map(([wd]) => wd));
}

function allowed(kind: NudgeKind, day: number, history: SentNudge[], group?: string): boolean {
  const spacing = KIND_SPACING[kind];
  if (spacing > 0 && history.some(s => s.kind === kind && day - s.day < spacing && day >= s.day)) return false;
  if (group && history.some(s => s.group === group && day - s.day < SAME_GROUP_SPACING && day >= s.day)) return false;
  return true;
}

/**
 * The nudge for one day, given what was already sent, assuming the user
 * doesn't train between now and then (the app reschedules after every
 * workout, and the server checks on the day itself).
 */
function nudgeForDay(input: NudgeInput, day: number, history: SentNudge[]): Nudge | null {
  const workouts = input.workouts.filter(w => w.day <= day);
  const trainedToday = workouts.some(w => w.day === day);
  const lastDay = workouts.length ? Math.max(...workouts.map(w => w.day)) : null;
  const daysSince = lastDay === null ? null : day - lastDay;
  const allDays = workouts.map(w => w.day);

  // 1. Training plan session today
  const plan = input.planDays?.[day];
  if (plan && !plan.done && !trainedToday && (daysSince === null || daysSince <= PLAN_DAY_MAX_GAP)) {
    if (allowed('planDay', day, history)) {
      return { kind: 'planDay', day, session: plan.session, planWeek: plan.week, planSessionId: plan.sessionId };
    }
  }

  // 2. Coming back after a break (threshold follows the user's own rhythm)
  if (daysSince !== null && !trainedToday) {
    const threshold = Math.min(7, Math.max(3, typicalGap(allDays, input.today) + 2));
    if (COMEBACK_STEPS.some(step => daysSince === threshold + step) && allowed('comeback', day, history)) {
      return { kind: 'comeback', day, days: daysSince };
    }
  }

  // 3. One of their usual training weekdays (no plan), after at least a day off
  if (!input.planDays && daysSince !== null && daysSince >= 2 && !trainedToday) {
    if (usualWeekdays(allDays, input.today).has(weekdayOf(day)) && allowed('usualDay', day, history)) {
      return { kind: 'usualDay', day };
    }
  }

  // 4. Installed, but no workout yet
  if (workouts.length === 0 && input.firstSeenDay !== undefined) {
    if (WELCOME_DAYS.includes(day - input.firstSeenDay) && allowed('welcome', day, history)) {
      return { kind: 'welcome', day };
    }
  }

  // 5. Sunday recap of the last 7 days
  if (weekdayOf(day) === 0) {
    const week = workouts.filter(w => w.day > day - 7);
    if (week.length > 0 && allowed('weeklyRecap', day, history)) {
      return {
        kind: 'weeklyRecap',
        day,
        workouts: week.length,
        sets: week.reduce((n, w) => n + w.sets, 0),
        volumeKg: Math.round(week.reduce((n, w) => n + w.volumeKg, 0)),
      };
    }
  }

  // 6. Training regularly but skipping a major muscle group
  if (daysSince !== null && daysSince <= 3) {
    let best: { group: string; gap: number } | null = null;
    for (const group of MAJOR_GROUPS) {
      const hits = workouts.filter(w => w.groups.includes(group));
      if (hits.filter(w => w.day > input.today - 42).length < 2) continue;
      const gap = day - Math.max(...hits.map(w => w.day));
      if (gap >= MUSCLE_GAP_DAYS && (!best || gap > best.gap) && allowed('muscleGap', day, history, group)) {
        best = { group, gap };
      }
    }
    if (best) return { kind: 'muscleGap', day, group: best.group, days: best.gap };
  }

  return null;
}

/** A nudge that always has something to say (previews and test sends): a recap, a comeback or a welcome. */
export function sampleNudge(today: number, workouts: NudgeWorkout[]): Nudge {
  const past = workouts.filter(w => w.day <= today);
  if (past.length === 0) return { kind: 'welcome', day: today };
  const week = past.filter(w => w.day > today - 7);
  if (week.length === 0) {
    return { kind: 'comeback', day: today, days: today - Math.max(...past.map(w => w.day)) };
  }
  return {
    kind: 'weeklyRecap',
    day: today,
    workouts: week.length,
    sets: week.reduce((n, w) => n + w.sets, 0),
    volumeKg: Math.round(week.reduce((n, w) => n + w.volumeKg, 0)),
  };
}

/**
 * Nudges from `fromDay` to `toDay` (inclusive): at most one a day,
 * `MAX_PER_WEEK` in any 7 days, spaced by kind.
 */
export function planNudges(input: NudgeInput, fromDay: number, toDay: number): Nudge[] {
  const history = [...input.sent];
  const out: Nudge[] = [];
  for (let day = fromDay; day <= toDay; day++) {
    if (history.some(s => s.day === day)) continue;
    if (history.filter(s => s.day > day - 7 && s.day <= day).length >= MAX_PER_WEEK) continue;
    const nudge = nudgeForDay(input, day, history);
    if (nudge) {
      out.push(nudge);
      history.push({ day, kind: nudge.kind, group: nudge.group });
    }
  }
  return out;
}
