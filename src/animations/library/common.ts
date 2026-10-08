/** Shared positions used by several exercise animations. */
import { ANKLE_Y, Limb, Pose, Vec, dir, angleOf } from '../rig';
import { both, hang, ik, planted } from '../kit';

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

/** Standing upright at x with the far limbs following the near ones (aN sets both arms). */
export function upright(x = 100, over: Partial<Pose> = {}): Pose {
  return both({ hip: [x, 100], trunk: 0, aN: hang, lN: planted(x + 1), ...over } as Pose);
}

/** Hip position for a kneeling pose: knee on the floor at x, thigh at `deg` from vertical. */
export function kneelHip(kneeX: number, deg: number): Vec {
  const d = dir(deg);
  return [kneeX + d[0] * 42, 177 + d[1] * 42];
}

/** Ankle target for a shin lying on the floor behind a knee at x. */
export const SHIN_BACK = (kneeX: number): Limb => ik(kneeX - 40, 178, 'down');

/** On all fours (hands under the shoulders, knees under the hips), hip at x. */
export function allFours(x = 80, over: Partial<Pose> = {}): Pose {
  return {
    hip: [x, 134], trunk: 78, head: 96,
    aN: ik(x + 46, 178), aF: ik(x + 44, 178),
    lN: { a: [178, 268] }, lF: { a: [180, 270] }, fN: 300, fF: 300,
    ...over,
  };
}

/** Lying face-up on the floor with the neck at x (head to the left). */
export const supine = (hipX: number, over: Partial<Pose> = {}): Pose =>
  both({ hip: [hipX, 176], trunk: -90, head: -92, aN: { a: [94, 92] }, lN: planted(hipX + 30), ...over } as Pose);

/** Four-frame walking cycle in place (loop mode). Pass arms to override the arm swing. */
export function walkCycle(arms?: Limb): Pose[] {
  const fk = (a: number, b: number): Limb => ({ a: [a, b] });
  const contact = (swap: boolean): Pose => {
    const front = { l: fk(156, 164), f: 85, a: arms ?? fk(196, 194) };
    const back = { l: fk(204, 206), f: 125, a: arms ?? fk(164, 160) };
    const [n, f] = swap ? [back, front] : [front, back];
    return { hip: [100, 102], trunk: 2, aN: n.a, aF: f.a, lN: n.l, lF: f.l, fN: n.f, fF: f.f };
  };
  const passing = (swap: boolean): Pose => {
    const stance = { l: fk(178, 180), f: 100 };
    const swing = { l: fk(170, 222), f: 130 };
    const [n, f] = swap ? [swing, stance] : [stance, swing];
    const a = arms ?? fk(180, 178);
    return { hip: [100, 99], trunk: 2, aN: a, aF: a, lN: n.l, lF: f.l, fN: n.f, fF: f.f };
  };
  return [contact(false), passing(false), contact(true), passing(true)];
}
