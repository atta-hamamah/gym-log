/**
 * Building blocks for authoring exercise animations: scenery (benches, bars,
 * machines) and common limb settings. See rig.ts for the coordinate system.
 */
import { ANKLE_Y, GROUND, Limb, Pose, Shape, Vec } from './rig';

// ── Scenery ──────────────────────────────────────────────

const line = (a: Vec, b: Vec, w: number, r: 'equip' | 'equipLight' = 'equip'): Shape =>
  ({ t: 'l', a, b, w, r });

/** Flat bench with its top at y. */
export function bench(x1: number, x2: number, y = 150): Shape[] {
  return [
    line([x1 + 8, y], [x1 + 8, GROUND], 3, 'equipLight'),
    line([x2 - 8, y], [x2 - 8, GROUND], 3, 'equipLight'),
    line([x1, y + 2], [x2, y + 2], 8, 'equip'),
  ];
}

/** Bench with a seat from x1→x2 at seatY and a back rest rising from x1 at `angle` (deg from vertical). */
export function inclineBench(x1: number, x2: number, seatY: number, angle: number, backLen = 70): Shape[] {
  const rad = (angle * Math.PI) / 180;
  const top: Vec = [x1 - Math.sin(rad) * backLen, seatY - Math.cos(rad) * backLen];
  return [
    line([x1 + 6, seatY], [x1 + 6, GROUND], 3, 'equipLight'),
    line([x2 - 6, seatY], [x2 - 6, GROUND], 3, 'equipLight'),
    line([x1 + 4, seatY], top, 3, 'equipLight'),
    line([x1, seatY + 2], [x2, seatY + 2], 8, 'equip'),
    line([x1 - 2, seatY], [top[0] - 2, top[1] + 2], 8, 'equip'),
  ];
}

/** Plyo box / step. */
export function box(x: number, w: number, h: number): Shape[] {
  return [{ t: 'p', pts: [[x, GROUND], [x + w, GROUND], [x + w, GROUND - h], [x, GROUND - h]], r: 'equipLight' }];
}

/** Pull-up bar seen end-on at (x, y) with its post behind. */
export function pullupBar(x: number, y: number, postX = x + 34): Shape[] {
  return [
    line([postX, y - 6], [postX, GROUND], 5, 'equipLight'),
    line([x, y], [postX, y - 6], 3, 'equipLight'),
    { t: 'c', c: [x, y], rad: 3.5, r: 'equip' },
  ];
}

/** Horizontal bar seen from the front (pull-up bar, front view). */
export function frontBar(y: number, x1 = 30, x2 = 170): Shape[] {
  return [
    line([x1, y], [x1, GROUND], 4, 'equipLight'),
    line([x2, y], [x2, GROUND], 4, 'equipLight'),
    line([x1 - 4, y], [x2 + 4, y], 4, 'equip'),
  ];
}

/** Cable column at x with a pulley at y. */
export function cableTower(x: number, pulleyY: number, topY = 22): Shape[] {
  return [
    line([x, topY], [x, GROUND], 7, 'equipLight'),
    line([x - 6, pulleyY], [x, pulleyY], 3, 'equipLight'),
  ];
}

/** Seat (and optional back rest) for machines. */
export function seat(x1: number, x2: number, y: number, back?: { x: number; top: number; lean?: number }): Shape[] {
  const out: Shape[] = [
    line([(x1 + x2) / 2, y], [(x1 + x2) / 2, GROUND], 4, 'equipLight'),
    line([x1, y + 2], [x2, y + 2], 8, 'equip'),
  ];
  if (back) {
    out.push(line([back.x, y], [back.x - (back.lean ?? 0), back.top], 8, 'equip'));
  }
  return out;
}

/** Generic machine frame line. */
export const frame = (pts: Vec[], w = 4): Shape => ({ t: 'pl', pts, w, r: 'equipLight' });

/** Floor mat. */
export const mat = (x1: number, x2: number): Shape => line([x1, GROUND + 1], [x2, GROUND + 1], 4, 'equipLight');

/** Wall at x. */
export const wall = (x: number): Shape => line([x, 20], [x, GROUND], 6, 'equipLight');

// ── Limbs ────────────────────────────────────────────────

/** Arm or leg by absolute angles. */
export const fk = (upper: number, lower: number = upper): Limb => ({ a: [upper, lower] });

/** Hand / foot target. */
export const ik = (x: number, y: number, h?: 'fwd' | 'back' | 'up' | 'down'): Limb => ({ t: [x, y], h });

/** Hand target relative to the neck in the chest's frame ([forward, up]). */
export const atNeck = (fwd: number, up: number, h?: 'fwd' | 'back' | 'up' | 'down'): Limb => ({ t: [fwd, up], rel: 'neck', h });
export const atHead = (fwd: number, up: number, h?: 'fwd' | 'back' | 'up' | 'down'): Limb => ({ t: [fwd, up], rel: 'head', h });
export const atHip = (fwd: number, up: number, h?: 'fwd' | 'back' | 'up' | 'down'): Limb => ({ t: [fwd, up], rel: 'hip', h });

/** Foot planted on the floor at x. */
export const planted = (x: number, y = ANKLE_Y): Limb => ({ t: [x, y] });

/** Arms hanging at the sides. */
export const hang: Limb = { a: [176, 178] };

/** Standing straight at x, arms down. */
export function standing(x = 100, over: Partial<Pose> = {}): Pose {
  return {
    hip: [x, 100],
    trunk: 0,
    aN: hang,
    aF: { a: [179, 181] },
    lN: planted(x + 1),
    lF: planted(x - 2),
    ...over,
  };
}

/** Same pose with the far limbs mirroring the near ones (both arms doing the same thing). */
export function both(p: Omit<Pose, 'aF' | 'lF'> & { aF?: Limb; lF?: Limb }): Pose {
  const shift = (l: Limb, dx: number): Limb =>
    'a' in l ? l : { ...l, t: l.rel ? l.t : [l.t[0] + dx, l.t[1]] };
  return {
    ...p,
    aF: p.aF ?? shift(p.aN, -1.5),
    lF: p.lF ?? shift(p.lN, -2),
  } as Pose;
}

/** Mirror a front-view limb (screen-left → screen-right) around x = cx. */
export function mirror(l: Limb, cx = 100): Limb {
  if ('a' in l) return { a: [-l.a[0], -l.a[1]] };
  if (l.rel) return { ...l, t: [-l.t[0], l.t[1]], h: l.h === 'fwd' ? 'back' : l.h === 'back' ? 'fwd' : l.h };
  const h = l.h === 'fwd' ? 'back' : l.h === 'back' ? 'fwd' : l.h;
  return { ...l, h, t: [2 * cx - l.t[0], l.t[1]] };
}

/** Front-view pose with symmetric limbs: give the screen-left side. */
export function sym(p: Omit<Pose, 'aF' | 'lF'>, cx = 100): Pose {
  return { ...p, aF: mirror(p.aN, cx), lF: mirror(p.lN, cx) } as Pose;
}
