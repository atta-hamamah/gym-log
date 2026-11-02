/**
 * OpenAI model used by every AI feature: coach chat, workout generation and
 * the post-workout summary. Shared with the evals (evals/run.ts) so they
 * always test what ships. Before switching models, compare them with
 *   npm run eval -- --model=<candidate>
 *
 * GPT-6.1 Terra beat GPT-5.1 on the evals (Nov 2026): better chat answers,
 * ~45% cheaper per user and about twice as fast in chat.
 */
export const AI_MODEL = "gpt-6.1-terra";

export const CHAT_MODEL = AI_MODEL;
export const WORKOUT_MODEL = AI_MODEL;
export const AURA_MODEL = AI_MODEL;

/** Models known to accept a custom temperature. Newer ones (e.g. the GPT-6 family) reject it with a 400. */
const CUSTOM_TEMPERATURE = new Set(["gpt-4o-mini", "gpt-5.1"]);

/** `temperature` for models that support it; other models get their default (sending it would fail the call). */
export function temperatureFor(model: string, value: number): { temperature?: number } {
  return CUSTOM_TEMPERATURE.has(model) ? { temperature: value } : {};
}
