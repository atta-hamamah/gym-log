import { AnimSpec } from './rig';
import { CHEST } from './library/chest';
import { BACK } from './library/back';
import { LEGS } from './library/legs';
import { GLUTE_ANIMS } from './library/glutes';
import { SHOULDERS } from './library/shoulders';
import { ARMS } from './library/arms';
import { CORE } from './library/core';
import { FULL_BODY } from './library/fullbody';
import { CARDIO } from './library/cardio';
import { MOBILITY } from './library/mobility';

export type { AnimSpec } from './rig';

/** Vector animation for every built-in exercise, keyed by exercise id. */
export const ANIMATIONS: Record<string, AnimSpec> = {
  ...CHEST,
  ...BACK,
  ...LEGS,
  ...GLUTE_ANIMS,
  ...SHOULDERS,
  ...ARMS,
  ...CORE,
  ...FULL_BODY,
  ...CARDIO,
  ...MOBILITY,
};

export function getAnimation(exerciseId: string | null | undefined): AnimSpec | undefined {
  return exerciseId ? ANIMATIONS[exerciseId] : undefined;
}
