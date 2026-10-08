/** Shared positions used by several exercise animations. */
import { ANKLE_Y, Limb, Pose, Vec, dir, angleOf } from '../rig';
import { both, ik } from '../kit';

const LEG = 81.6;

/** Lying face-up on a flat bench (top at y=150), head to the left, feet on the floor. */
export const ON_BENCH = { hip: [122, 140] as Vec, trunk: -90, head: -95, lN: ik(152, ANKLE_Y, 'fwd') };

export function lyingOnBench(aN: Limb, over: Partial<Pose> = {}): Pose {
  return both({ ...ON_BENCH, aN, ...over } as Pose);
}

/** Lying face-up on the floor, head to the left. */
export const ON_FLOOR = { hip: [118, 176] as Vec, trunk: -90, head: -92 };

/** Seated on an incline bench (see inclineBench(112, 142, 150, 50)). */
export const ON_INCLINE = { hip: [114, 139] as Vec, trunk: -50, head: -45, lN: ik(152, ANKLE_Y, 'fwd') };

/**
 * Straight body from the ankle towards a point (shoulder line), for planks,
 * push-ups and inverted rows. Returns hip and trunk.
 */
export function plank(ankle: Vec, toward: Vec): { hip: Vec; trunk: number } {
  const trunk = angleOf([toward[0] - ankle[0], toward[1] - ankle[1]]);
  const d = dir(trunk);
  return { hip: [ankle[0] + d[0] * LEG, ankle[1] + d[1] * LEG], trunk };
}

/** Hip position for a given neck position and trunk angle (body pivoting around the shoulders). */
export function hipFromNeck(neck: Vec, trunk: number): Vec {
  const d = dir(trunk);
  return [neck[0] - d[0] * 52, neck[1] - d[1] * 52];
}

/** Seated upright on a box seat (top y=140) facing right. */
export const SEATED = { hip: [95, 130] as Vec, trunk: 0, lN: ik(132, ANKLE_Y, 'fwd') };
