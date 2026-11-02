/**
 * OpenAI models used by the AI features. Shared with the evals (evals/run.ts)
 * so they always test what ships.
 */

/**
 * Chat routing. When true, a tiny classifier sends complex questions to the
 * smart model and simple ones to the cheap model; when false, every chat
 * message uses the cheap model (saves cost).
 */
export const ENABLE_DYNAMIC_MODEL = true;

/** Fast and cheap: simple Q&A and the chat classifier. */
export const MODEL_CHEAP = "gpt-4o-mini";
/** Strong reasoning: deep analysis and advice. */
export const MODEL_SMART = "gpt-5.1";

export const WORKOUT_MODEL = "gpt-5.1";
export const AURA_MODEL = "gpt-5.1";
