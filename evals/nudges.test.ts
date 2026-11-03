/**
 * Deterministic tests for coach nudges (no API key, no device): the shared
 * rules in src/notifications/nudges.ts, time zones, and that every language
 * has every template line with the right placeholders.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COACHES,
  MAX_PER_WEEK,
  NUDGE_KINDS,
  coachFor,
  dateToDay,
  localTime,
  nudgeHourFor,
  planNudges,
  sampleNudge,
  toNudgeWorkouts,
  weekdayOf,
  zonedTime,
  type NudgeInput,
  type NudgeWorkout,
} from "../src/notifications/nudges";

/** Tuesday 2026-11-03 */
const TODAY = dateToDay(new Date(2026, 10, 3));

const w = (day: number, groups: string[] = ["Chest"], hour = 18): NudgeWorkout => ({
  day,
  hour,
  groups,
  sets: 12,
  volumeKg: 5000,
});

const input = (p: Partial<NudgeInput>): NudgeInput => ({ today: TODAY, workouts: [], sent: [], ...p });

// ── Calendar ─────────────────────────────────────────────

test("day numbers and weekdays", () => {
  assert.equal(weekdayOf(TODAY), 2); // Tuesday
  assert.equal(weekdayOf(dateToDay(new Date(2026, 10, 1))), 0); // Sunday
  assert.equal(dateToDay(new Date(1970, 0, 1)), 0);
});

test("local time in a time zone, including half-hour offsets", () => {
  // 2026-11-03 12:30 UTC = 18:00 in India (UTC+5:30)
  const t = Date.UTC(2026, 10, 3, 12, 30);
  assert.deepEqual(localTime(t, "Asia/Kolkata"), { day: TODAY, hour: 18, minute: 0 });
  // Unknown zone falls back to UTC instead of throwing
  assert.equal(localTime(t, "Not/AZone").hour, 12);
});

test("zonedTime is the inverse of localTime (also across DST)", () => {
  for (const zone of ["Asia/Kolkata", "America/New_York", "Europe/Paris", "Africa/Cairo", "UTC"]) {
    for (const day of [TODAY, dateToDay(new Date(2026, 2, 8)), dateToDay(new Date(2026, 9, 25))]) {
      const t = zonedTime(day, 18, zone);
      const lt = localTime(t, zone);
      assert.deepEqual([lt.day, lt.hour, lt.minute], [day, 18, 0], `${zone} day ${day}`);
    }
  }
});

// ── Inputs ───────────────────────────────────────────────

test("workouts: only finished ones, working sets, muscle groups from the catalog", () => {
  const start = new Date(2026, 10, 2, 7, 15).getTime();
  const out = toNudgeWorkouts(
    [
      {
        startTime: start,
        endTime: start + 3600_000,
        exercises: [
          {
            exerciseId: "ex-squat",
            sets: [
              { weight: 60, reps: 10, type: "warmup", completed: true },
              { weight: 100, reps: 5, type: "normal", completed: true },
              { weight: 100, reps: 5, type: "normal", completed: true },
            ],
          },
          { exerciseId: "my-custom", sets: [{ weight: 20, reps: 10, type: "normal", completed: true }] },
          { exerciseId: "ex-bench-press", sets: [] },
        ],
      },
      { startTime: start, exercises: [] }, // still running
    ],
    { "my-custom": "Biceps" },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].day, TODAY - 1);
  assert.equal(out[0].hour, 7);
  assert.equal(out[0].sets, 3);
  assert.equal(out[0].volumeKg, 1200);
  assert.ok(out[0].groups.includes("Legs"));
  assert.ok(out[0].groups.includes("Biceps"));
  assert.ok(!out[0].groups.includes("Chest"), "no working sets of bench → no chest");
});

test("nudge hour: an hour before they usually train, within 8:00-20:00", () => {
  assert.equal(nudgeHourFor([]), 18);
  assert.equal(nudgeHourFor([w(1, [], 19), w(2, [], 19), w(3, [], 20)]), 18);
  assert.equal(nudgeHourFor([w(1, [], 6), w(2, [], 6), w(3, [], 7)]), 8);
  assert.equal(nudgeHourFor([w(1, [], 23), w(2, [], 23), w(3, [], 23)]), 20);
});

test("mix rotates the coaches", () => {
  assert.deepEqual([0, 1, 2, 3].map(d => coachFor("mix", d)), ["repai", "chad", "kevin", "repai"]);
  assert.equal(coachFor("kevin", 5), "kevin");
});

// ── Rules ────────────────────────────────────────────────

test("comeback nudges follow the user's rhythm, then stop", () => {
  // Trained every 2 days, last time 3 days before today.
  const last = TODAY - 3;
  const workouts = [0, 2, 4, 6, 8, 10].map(i => w(last - i));
  const nudges = planNudges(input({ workouts }), TODAY, TODAY + 30).filter(n => n.kind === "comeback");
  // Typical gap 2 → first nudge after 4 days off, then +3, +7, +14.
  assert.deepEqual(nudges.map(n => n.days), [4, 7, 11, 18]);
});

test("at most one nudge a day and MAX_PER_WEEK in any 7 days", () => {
  const workouts = Array.from({ length: 20 }, (_, i) => w(TODAY - 1 - i * 2, ["Chest", "Back"]));
  const nudges = planNudges(input({ workouts }), TODAY, TODAY + 60);
  const days = nudges.map(n => n.day);
  assert.equal(new Set(days).size, days.length);
  for (const d of days) {
    assert.ok(days.filter(x => x > d - 7 && x <= d).length <= MAX_PER_WEEK);
  }
});

test("already-sent nudges count towards the weekly cap", () => {
  const sent = [1, 2, 3, 4].map(i => ({ day: TODAY - i, kind: "usualDay" as const }));
  const workouts = [w(TODAY - 10)];
  assert.deepEqual(planNudges(input({ workouts, sent }), TODAY, TODAY + 2), []);
});

test("usual training day, after a day off", () => {
  // Mondays and Wednesdays for 4 weeks; today is Tuesday → nothing; Wednesday → nudge.
  const mondays = [1, 2, 3, 4].map(k => TODAY - 1 - 7 * (k - 1));
  const wednesdays = [1, 2, 3].map(k => TODAY - 6 - 7 * (k - 1));
  const workouts = [...mondays, ...wednesdays].map(d => w(d));
  const [first] = planNudges(input({ workouts }), TODAY, TODAY + 1);
  assert.equal(first?.kind, "usualDay");
  assert.equal(first?.day, TODAY + 1);
  assert.equal(weekdayOf(first!.day), 3);
});

test("no 'train today' nudge once they trained today", () => {
  const workouts = [w(TODAY), w(TODAY - 7), w(TODAY - 14), w(TODAY - 21)];
  const today = planNudges(input({ workouts }), TODAY, TODAY);
  assert.ok(!today.some(n => n.kind === "usualDay" || n.kind === "comeback"));
});

test("plan day: reminds about today's session until it's done", () => {
  const planDays = { [TODAY]: { week: 2, sessionId: "s1", session: "Push A", done: false } };
  const [n] = planNudges(input({ workouts: [w(TODAY - 2)], planDays }), TODAY, TODAY);
  assert.equal(n.kind, "planDay");
  assert.equal(n.session, "Push A");
  assert.equal(n.planSessionId, "s1");

  const done = { [TODAY]: { ...planDays[TODAY], done: true } };
  assert.ok(!planNudges(input({ workouts: [w(TODAY - 2)], planDays: done }), TODAY, TODAY).some(x => x.kind === "planDay"));

  // Gone for too long: comeback nudges instead of plan reminders.
  assert.ok(!planNudges(input({ workouts: [w(TODAY - 15)], planDays }), TODAY, TODAY).some(x => x.kind === "planDay"));
});

test("skipped muscle group while training regularly", () => {
  const workouts = [
    w(TODAY - 1, ["Chest", "Shoulders"]),
    w(TODAY - 3, ["Back"]),
    w(TODAY - 5, ["Chest", "Shoulders"]),
    w(TODAY - 7, ["Back"]),
    w(TODAY - 12, ["Legs"]),
    w(TODAY - 19, ["Legs"]),
  ];
  const n = planNudges(input({ workouts }), TODAY, TODAY).find(x => x.kind === "muscleGap");
  assert.equal(n?.group, "Legs");
  assert.equal(n?.days, 12);
});

test("weekly recap on Sunday with the last 7 days", () => {
  const sunday = TODAY + 5;
  assert.equal(weekdayOf(sunday), 0);
  const workouts = [w(TODAY - 1), w(TODAY - 3), w(TODAY - 9)];
  const recap = planNudges(input({ workouts }), sunday, sunday).find(n => n.kind === "weeklyRecap");
  assert.equal(recap?.workouts, 1, "only TODAY-1 is within the 7 days before Sunday");
  assert.equal(recap?.volumeKg, 5000);
});

test("welcome nudges before the first workout", () => {
  const nudges = planNudges(input({ firstSeenDay: TODAY - 1 }), TODAY, TODAY + 10);
  assert.deepEqual(nudges.map(n => [n.kind, n.day - (TODAY - 1)]), [["welcome", 1], ["welcome", 3], ["welcome", 6]]);
});

test("sample nudge always has something to say", () => {
  assert.equal(sampleNudge(TODAY, []).kind, "welcome");
  assert.equal(sampleNudge(TODAY, [w(TODAY - 20)]).kind, "comeback");
  assert.equal(sampleNudge(TODAY, [w(TODAY - 2)]).kind, "weeklyRecap");
});

// ── Template lines ───────────────────────────────────────

const LOCALES = ["en", "es", "fr", "hi", "ar"];
const load = (lang: string) => JSON.parse(readFileSync(join(__dirname, "../src/i18n/locales", `${lang}.json`), "utf8"));
const placeholders = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map(m => m[1]).sort();

/** The fact each kind of line has to mention (one of these placeholders). */
const KEY_FACTS: Record<string, string[]> = {
  planDay: ["session"],
  comeback: ["days"],
  muscleGap: ["group"],
  weeklyRecap: ["volume", "workouts"],
  usualDay: [],
  welcome: [],
};
const KNOWN = ["session", "group", "days", "workouts", "sets", "volume"];

test("every language has every nudge line, with known placeholders and the key fact", () => {
  for (const lang of LOCALES) {
    const nudges = load(lang).nudges;
    assert.ok(nudges, `${lang}: missing "nudges"`);
    assert.ok(nudges.channelName, `${lang}: channelName`);
    for (const coach of COACHES) assert.ok(nudges.coachName?.[coach], `${lang}: coachName.${coach}`);
    for (const key of ["daysCount", "workoutsCount", "setsCount"]) {
      assert.ok(nudges[`${key}_other`], `${lang}: ${key}_other`);
    }
    for (const kind of NUDGE_KINDS) {
      for (const coach of COACHES) {
        for (const variant of ["1", "2"]) {
          const line = nudges[kind]?.[coach]?.[variant];
          const where = `${lang}: ${kind}.${coach}.${variant}`;
          assert.ok(line, where);
          const used = placeholders(line);
          for (const p of used) assert.ok(KNOWN.includes(p), `${where} uses unknown {{${p}}}`);
          const facts = KEY_FACTS[kind];
          if (facts.length) assert.ok(facts.some(f => used.includes(f)), `${where} should mention {{${facts.join("}} or {{")}}}`);
        }
      }
    }
  }
});
