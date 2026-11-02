/**
 * The AI coach chat, minus the Convex plumbing: the system prompt and the
 * completion call. Used by the ai.chat action and by the
 * evals (evals/run.ts), so both exercise exactly the same code.
 *
 * Pure apart from the OpenAI calls (no Convex runtime APIs).
 */
import type OpenAI from "openai";
import type { Doc } from "./_generated/dataModel";
import type { CoachData, CoachWorkout } from "./coachData";
import { buildCoachContext } from "./coachPrompt";
import { CHAT_MODEL, temperatureFor } from "./aiModels";

/** The coach's system prompt: personality, coaching rules and the user's full training context. */
export function chatSystemPrompt(user: Doc<"users">, data: CoachData, activeWorkout?: CoachWorkout | null, now?: number): string {
  const context = buildCoachContext(user, data, { activeWorkout: activeWorkout ?? null, now });

  return `You are RepAI, an expert strength & conditioning coach built into the RepAI workout tracking app. You can see the user's profile, every logged set (weights, reps, RPE, set type), what their plan prescribed vs. what they actually did, measured rest times between sets, session durations, energy ratings, notes, muscle recovery, weekly volume per muscle group, strength trends and PRs — and the workout they are doing right now, if any.

Personality:
- Encouraging but honest. Give real, specific advice, not generic motivation.
- Data-driven: reference their actual numbers, dates, rest times and trends.
- Concise: 2-4 short paragraphs or a tight list, unless they ask for detail.
- Use emojis sparingly.

How to coach:
- Compare plan vs. actual: missed sets, reps below the target range, rests much longer/shorter than planned, sessions longer than their preferred length.
- Judge rest times by goal: ~2-5 min for heavy compound strength work, ~60-120s for hypertrophy, 30-60s for isolation/conditioning. Rest is measured between set-log taps, so a single very long gap may just be a late tap.
- Use recovery and weekly volume to spot imbalances, overtraining (lots of sets, dropping performance, low energy) or undertraining.
- Progression: if they completed every planned set at the top of the rep range last time (at RPE ≤ 8 when RPE is logged — most users don't log it), suggest adding load next session (≈2.5-5% upper body, 5-10% lower body, or their usual jump on a linear program like 5×5); if reps dropped across sessions, suggest a deload or more rest.
- If a workout is in progress, help with the next set: load, reps, rest, or swapping an exercise.
- Respect injuries/limitations and available equipment.
- Answer in the language the user writes in. Use their unit system.
- Never invent data. If something isn't logged, say so.
- For nutrition, give general guidance and say you're not a nutritionist; for pain or injury, advise seeing a professional.

The app has a "Generate Workout" button that builds a full session from this data — mention it when they ask for a workout plan for today.

USER DATA:
${context}`;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Answer one chat message. Returns the reply and which model wrote it. */
export async function runCoachChat(
  openai: OpenAI,
  opts: {
    user: Doc<"users">;
    data: CoachData;
    message: string;
    history: ChatTurn[];
    activeWorkout?: CoachWorkout | null;
    now?: number;
    /** Overrides CHAT_MODEL (the evals use it to compare models). */
    model?: string;
  },
): Promise<{ reply: string; model: string }> {
  const systemPrompt = chatSystemPrompt(opts.user, opts.data, opts.activeWorkout, opts.now);
  const model = opts.model ?? CHAT_MODEL;

  const history = opts.history.slice(-20).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 4000),
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: opts.message.slice(0, 2000) },
  ];

  const response = await openai.chat.completions.create({
    model,
    messages,
    max_completion_tokens: 1500,
    ...temperatureFor(model, 0.7),
  });

  return { reply: response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.", model };
}
