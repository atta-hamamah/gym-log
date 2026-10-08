import { AnimSpec } from './rig';
import { CALIB } from './library/calib';
import { CHEST } from './library/chest';
import { BACK } from './library/back';

export const ANIMATIONS: Record<string, AnimSpec> = {
  ...CALIB,
  ...CHEST,
  ...BACK,
};

export function getAnimation(exerciseId: string | null | undefined): AnimSpec | undefined {
  return exerciseId ? ANIMATIONS[exerciseId] : undefined;
}
