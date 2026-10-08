/**
 * Vector exercise animation rig.
 *
 * Every exercise animation is a short loop of keyframe poses for a simple
 * mannequin. Poses describe the pelvis position, trunk angles and each limb
 * either by joint angles (FK) or by where the hand/foot should be (IK), so a
 * planted foot stays planted while the hips move. Frames are interpolated and
 * turned into flat drawing primitives that any renderer can draw (react-native-svg
 * in the app, a tiny rasterizer for previews).
 *
 * Pure TypeScript: no React Native imports, so it also runs in Node.
 *
 * Coordinates: 200×200 box, y down, the figure faces right (+x) in side view.
 * Angles are in degrees: 0 = up, 90 = forward (+x), 180 = down, -90 = back.
 */

export type Vec = [number, number];

export type Hint = 'fwd' | 'back' | 'up' | 'down';

/** Limb by end position (wrist / ankle), solved with two-bone IK. */
export interface LimbIK {
  t: Vec;
  /** Which way the elbow / knee points. */
  h?: Hint;
  /** Target is an offset in the chest's frame ([forward, up]) from this body point. */
  rel?: 'neck' | 'hip' | 'head';
}

/** Limb by absolute angles of the upper and lower segment. */
export interface LimbFK {
  a: [number, number];
}

export type Limb = LimbIK | LimbFK;

export interface Pose {
  /** Pelvis position. */
  hip: Vec;
  /** Lower trunk angle (pelvis → mid back). */
  trunk: number;
  /** Upper trunk angle (mid back → neck). Defaults to `trunk`. */
  chest?: number;
  /** Head direction. Defaults to `chest`. */
  head?: number;
  /** Near / far arm in side view; screen-left / screen-right in front view. */
  aN: Limb;
  aF: Limb;
  lN: Limb;
  lF: Limb;
  /** Foot angles (side view). Default 100 = flat on the floor. */
  fN?: number;
  fF?: number;
  /** Hand angle relative to the forearm. */
  wN?: number;
  wF?: number;
  /** Shoulder elevation 0..1 (shrugs). */
  sh?: number;
  /**
   * Segment length scales to fake foreshortening (1 = full length, negative
   * flips the segment, for limbs swinging through the camera axis).
   * k = upper arm, j = forearm (defaults to k), q = thigh.
   */
  kN?: number;
  kF?: number;
  jN?: number;
  jF?: number;
  qN?: number;
  qF?: number;
  /** Phase in degrees for animated gear (jump rope). */
  phase?: number;
}

export type Role =
  | 'body' | 'far' | 'hl' | 'hlFar'
  | 'equip' | 'equipLight' | 'plate' | 'hub' | 'cable' | 'band' | 'ground';

export type Prim =
  | { t: 'l'; a: Vec; b: Vec; w: number; r: Role }
  | { t: 'c'; c: Vec; rad: number; r: Role; ring?: number }
  | { t: 'p'; pts: Vec[]; r: Role }
  | { t: 'pl'; pts: Vec[]; w: number; r: Role };

/** Static scenery shape (benches, bars, machines). */
export type Shape = Prim;

export type AttachPoint =
  | 'hN' | 'hF' | 'hands' | 'wristN' | 'wristF' | 'eN' | 'eF'
  | 'kN' | 'kF' | 'aN' | 'aF' | 'toeN' | 'toeF' | 'feet'
  | 'hip' | 'mid' | 'neck' | 'nape' | 'clav' | 'head' | 'sN' | 'sF';

export interface Gear {
  kind:
    | 'barbell' | 'dumbbell' | 'kettlebell' | 'plate' | 'ball' | 'handle' | 'wheel'
    | 'cable' | 'band' | 'rope' | 'pad' | 'platform' | 'landmine' | 'stick'
    | 'lever' | 'span' | 'barbellFront' | 'jumprope';
  at: AttachPoint;
  /** Second attach point for 'span' (a band or bar between two body points). */
  to?: AttachPoint;
  /** Offset from the attach point, in world axes. */
  off?: Vec;
  /** Fixed anchor for cables, bands, ropes, levers and the landmine pivot. */
  from?: Vec;
  /** Size override (radius or length; landmine: plate distance past the hands, negative = towards the pivot). */
  size?: number;
  /** Platform / pad / stick angle in degrees. */
  ang?: number;
  /** Draw above the figure (default: near-side gear above, far-side below). */
  layer?: 'back' | 'front';
}

export type Seg = 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'lowerTrunk' | 'upperTrunk' | 'glutes' | 'delts';

export interface AnimSpec {
  view?: 'side' | 'front';
  frames: Pose[];
  /** Transition time(s) between keyframes in ms. */
  dur?: number | number[];
  /** Pause at each keyframe in ms. */
  hold?: number | number[];
  /** pingpong: 0→n→0, loop: 0→n then back to 0 in one transition. */
  mode?: 'pingpong' | 'loop';
  /** Linear timing instead of ease-in-out (continuous motions like cycling). */
  linear?: boolean;
  /** Scenery drawn behind the figure. */
  scene?: Shape[];
  /** Scenery drawn in front of the figure. */
  fg?: Shape[];
  gear?: Gear[];
  hl?: Seg[];
  /** Keyframe used for still thumbnails. */
  thumb?: number;
  /** Hide the floor line (e.g. hanging, swimming). */
  noGround?: boolean;
  /** Scale the whole scene around the floor center, for poses that need more room. */
  zoom?: number;
  /** Shift the whole scene after zooming (e.g. move hanging poses up). */
  pan?: Vec;
}

// ── Body dimensions ───────────────────────────────────────

export const GROUND = 184;
export const ANKLE_Y = GROUND - 3;

export const L = {
  thigh: 42,
  shin: 40,
  foot: 14,
  lumbar: 24,
  thoracic: 28,
  neck: 6,
  headR: 10,
  upperArm: 30,
  forearm: 27,
  hand: 7,
  shoulderDrop: 5,
  shoulderHalf: 15, // front view
  hipHalf: 9,       // front view
};

const W = {
  lowerTrunk: 13,
  upperTrunk: 14,
  neck: 6,
  thigh: 10.5,
  shin: 8.5,
  foot: 5.5,
  upperArm: 8,
  forearm: 7,
  hand: 5,
};

// ── Vector helpers ────────────────────────────────────────

const RAD = Math.PI / 180;
export const dir = (deg: number): Vec => [Math.sin(deg * RAD), -Math.cos(deg * RAD)];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const len = (a: Vec) => Math.hypot(a[0], a[1]);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpV = (a: Vec, b: Vec, k: number): Vec => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
export const angleOf = (v: Vec) => Math.atan2(v[0], -v[1]) / RAD;
const along = (p: Vec, deg: number, d: number) => add(p, mul(dir(deg), d));

/** Angle interpolation along the shortest arc (so rotations can loop). */
function lerpAngle(a: number, b: number, k: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * k;
}

const HINTS: Record<Hint, Vec> = { fwd: [1, 0], back: [-1, 0], up: [0, -1], down: [0, 1] };

/** Two-bone IK. Returns the middle joint and the (reach-clamped) end. */
function solveIK(root: Vec, target: Vec, l1: number, l2: number, hint: Hint): [Vec, Vec] {
  const toT = sub(target, root);
  let d = len(toT);
  const u: Vec = d > 1e-6 ? mul(toT, 1 / d) : [0, 1];
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.001);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = add(root, mul(u, a));
  const perp: Vec = [-u[1], u[0]];
  const j1 = add(p, mul(perp, h));
  const j2 = add(p, mul(perp, -h));
  const hv = HINTS[hint];
  const s1 = (j1[0] - p[0]) * hv[0] + (j1[1] - p[1]) * hv[1];
  const s2 = (j2[0] - p[0]) * hv[0] + (j2[1] - p[1]) * hv[1];
  return [s1 >= s2 ? j1 : j2, add(root, mul(u, d))];
}

// ── Pose interpolation ───────────────────────────────────

const isIK = (l: Limb): l is LimbIK => (l as LimbIK).t !== undefined;

function lerpLimb(a: Limb, b: Limb, k: number): Limb {
  if (isIK(a) && isIK(b)) {
    return { t: lerpV(a.t, b.t, k), h: k < 0.5 ? a.h : b.h, rel: a.rel };
  }
  if (!isIK(a) && !isIK(b)) {
    return { a: [lerpAngle(a.a[0], b.a[0], k), lerpAngle(a.a[1], b.a[1], k)] };
  }
  // Mixed modes: snap at the midpoint (authoring should avoid this).
  return k < 0.5 ? a : b;
}

const opt = (a: number | undefined, b: number | undefined, dflt: number, k: number) =>
  lerp(a ?? dflt, b ?? dflt, k);

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, k),
    trunk: lerp(a.trunk, b.trunk, k),
    chest: lerp(a.chest ?? a.trunk, b.chest ?? b.trunk, k),
    head: lerp(a.head ?? a.chest ?? a.trunk, b.head ?? b.chest ?? b.trunk, k),
    aN: lerpLimb(a.aN, b.aN, k),
    aF: lerpLimb(a.aF, b.aF, k),
    lN: lerpLimb(a.lN, b.lN, k),
    lF: lerpLimb(a.lF, b.lF, k),
    fN: opt(a.fN, b.fN, 100, k),
    fF: opt(a.fF, b.fF, 100, k),
    wN: opt(a.wN, b.wN, 0, k),
    wF: opt(a.wF, b.wF, 0, k),
    sh: opt(a.sh, b.sh, 0, k),
    kN: opt(a.kN, b.kN, 1, k),
    kF: opt(a.kF, b.kF, 1, k),
    jN: opt(a.jN ?? a.kN, b.jN ?? b.kN, 1, k),
    jF: opt(a.jF ?? a.kF, b.jF ?? b.kF, 1, k),
    qN: opt(a.qN, b.qN, 1, k),
    qF: opt(a.qF, b.qF, 1, k),
    phase: lerpAngle(a.phase ?? 0, b.phase ?? 0, k),
  };
}

// ── Skeleton ─────────────────────────────────────────────

export interface Skeleton {
  hip: Vec; mid: Vec; neck: Vec; head: Vec;
  hipN: Vec; hipF: Vec;
  sN: Vec; sF: Vec;
  eN: Vec; eF: Vec; wristN: Vec; wristF: Vec; hN: Vec; hF: Vec; handEndN: Vec; handEndF: Vec;
  kN: Vec; kF: Vec; aN: Vec; aF: Vec; toeN: Vec; toeF: Vec;
  /** Forearm angles, used to orient held equipment. */
  foreN: number; foreF: number;
  trunk: number; chest: number;
  phase: number;
}

function limbPoints(
  root: Vec,
  limb: Limb,
  l1: number,
  l2: number,
  dfltHint: Hint,
  frame: { neck: Vec; hip: Vec; head: Vec; chest: number },
): [Vec, Vec] {
  if (isIK(limb)) {
    let target = limb.t;
    if (limb.rel) {
      const base = limb.rel === 'neck' ? frame.neck : limb.rel === 'hip' ? frame.hip : frame.head;
      // [forward, up] in the chest's frame
      target = add(add(base, mul(dir(frame.chest + 90), limb.t[0])), mul(dir(frame.chest), limb.t[1]));
    }
    return solveIK(root, target, Math.abs(l1), Math.abs(l2), limb.h ?? dfltHint);
  }
  const j = along(root, limb.a[0], l1);
  return [j, along(j, limb.a[1], l2)];
}

export function buildSkeleton(p: Pose, view: 'side' | 'front'): Skeleton {
  const chest = p.chest ?? p.trunk;
  const headDir = p.head ?? chest;
  const hip = p.hip;
  const mid = along(hip, p.trunk, L.lumbar);
  const neck = along(mid, chest, L.thoracic);
  const head = along(neck, headDir, L.neck + L.headR);
  const shoulderBase = along(neck, chest, -L.shoulderDrop + (p.sh ?? 0) * 6);

  let sN: Vec, sF: Vec, hipN: Vec, hipF: Vec;
  if (view === 'front') {
    const side = dir(chest + 90);
    const hipSide = dir(p.trunk + 90);
    sN = add(shoulderBase, mul(side, -L.shoulderHalf));
    sF = add(shoulderBase, mul(side, L.shoulderHalf));
    hipN = add(hip, mul(hipSide, -L.hipHalf));
    hipF = add(hip, mul(hipSide, L.hipHalf));
  } else {
    sN = shoulderBase;
    sF = add(shoulderBase, [-1.5, -0.5]);
    hipN = hip;
    hipF = add(hip, [-1, -0.5]);
  }

  const frame = { neck, hip, head, chest };
  const kN = p.kN ?? 1;
  const kF = p.kF ?? 1;
  const jN = p.jN ?? kN;
  const jF = p.jF ?? kF;
  const armHint: Hint = view === 'front' ? 'down' : 'back';
  const [eN, wristN] = limbPoints(sN, p.aN, L.upperArm * kN, L.forearm * jN, armHint, frame);
  const [eF, wristF] = limbPoints(sF, p.aF, L.upperArm * kF, L.forearm * jF, armHint, frame);
  // Knees point forward in side view and outward in front view.
  const [kneeN, ankleN] = limbPoints(hipN, p.lN, L.thigh * (p.qN ?? 1), L.shin, view === 'front' ? 'back' : 'fwd', frame);
  const [kneeF, ankleF] = limbPoints(hipF, p.lF, L.thigh * (p.qF ?? 1), L.shin, 'fwd', frame);

  const foreN = angleOf(sub(wristN, eN));
  const foreF = angleOf(sub(wristF, eF));
  const handEndN = along(wristN, foreN + (p.wN ?? 0), L.hand);
  const handEndF = along(wristF, foreF + (p.wF ?? 0), L.hand);

  let toeN: Vec, toeF: Vec;
  if (view === 'front') {
    toeN = add(ankleN, [-6, 2.5]);
    toeF = add(ankleF, [6, 2.5]);
  } else {
    toeN = along(ankleN, p.fN ?? 100, L.foot);
    toeF = along(ankleF, p.fF ?? 100, L.foot);
  }

  return {
    hip, mid, neck, head, hipN, hipF, sN, sF,
    eN, eF, wristN, wristF,
    hN: lerpV(wristN, handEndN, 0.55), hF: lerpV(wristF, handEndF, 0.55),
    handEndN, handEndF,
    kN: kneeN, kF: kneeF, aN: ankleN, aF: ankleF, toeN, toeF,
    foreN, foreF,
    trunk: p.trunk, chest,
    phase: p.phase ?? 0,
  };
}

function attachPoint(s: Skeleton, at: AttachPoint): Vec {
  switch (at) {
    case 'hands': return lerpV(s.hN, s.hF, 0.5);
    case 'feet': return lerpV(s.aN, s.aF, 0.5);
    case 'nape': return add(along(s.neck, s.chest, -3), mul(dir(s.chest + 90), -6));
    case 'clav': return add(along(s.neck, s.chest, -5), mul(dir(s.chest + 90), 9));
    default: return s[at];
  }
}

// ── Gear drawing ─────────────────────────────────────────

function drawGear(g: Gear, s: Skeleton, time: number, out: Prim[]) {
  const p = add(attachPoint(s, g.at), g.off ?? [0, 0]);
  const fore = g.at === 'hF' || g.at === 'wristF' ? s.foreF : s.foreN;
  switch (g.kind) {
    case 'barbell': {
      const r = g.size ?? 13;
      out.push({ t: 'c', c: p, rad: r, r: 'plate' });
      out.push({ t: 'c', c: p, rad: r * 0.62, r: 'hub', ring: 1.4 });
      out.push({ t: 'c', c: p, rad: 2.6, r: 'hub' });
      break;
    }
    case 'barbellFront': {
      // Barbell seen from the front: bar with plates seen edge-on.
      const half = g.size ?? 66;
      const a: Vec = [p[0] - half, p[1]];
      const b: Vec = [p[0] + half, p[1]];
      out.push({ t: 'l', a, b, w: 3, r: 'equip' });
      for (const end of [a, b]) {
        const inward = end === a ? 5 : -5;
        out.push({ t: 'l', a: [end[0] + inward, p[1] - 13], b: [end[0] + inward, p[1] + 13], w: 6, r: 'plate' });
      }
      break;
    }
    case 'plate': {
      const r = g.size ?? 9;
      out.push({ t: 'c', c: p, rad: r, r: 'plate' });
      out.push({ t: 'c', c: p, rad: 2.2, r: 'hub' });
      break;
    }
    case 'dumbbell': {
      const r = g.size ?? 6.5;
      out.push({ t: 'c', c: p, rad: r, r: 'plate' });
      out.push({ t: 'c', c: p, rad: 2, r: 'hub' });
      break;
    }
    case 'kettlebell': {
      const r = g.size ?? 7.5;
      const c = along(p, fore, r + 2);
      out.push({ t: 'l', a: p, b: c, w: 3, r: 'plate' });
      out.push({ t: 'c', c, rad: r, r: 'plate' });
      break;
    }
    case 'ball': {
      out.push({ t: 'c', c: p, rad: g.size ?? 10, r: 'plate' });
      out.push({ t: 'c', c: p, rad: (g.size ?? 10) * 0.55, r: 'hub', ring: 1.2 });
      break;
    }
    case 'wheel': {
      const r = g.size ?? 8;
      out.push({ t: 'c', c: p, rad: r, r: 'plate' });
      out.push({ t: 'c', c: p, rad: 2.2, r: 'hub' });
      break;
    }
    case 'handle': {
      out.push({ t: 'c', c: p, rad: g.size ?? 3, r: 'hub' });
      break;
    }
    case 'cable':
    case 'band': {
      const from = g.from ?? p;
      out.push({ t: 'l', a: from, b: p, w: g.kind === 'cable' ? 1.6 : 3, r: g.kind === 'cable' ? 'cable' : 'band' });
      if (g.kind === 'cable') {
        out.push({ t: 'c', c: from, rad: 3.5, r: 'equip' });
        out.push({ t: 'c', c: p, rad: 2.6, r: 'hub' });
      }
      break;
    }
    case 'span': {
      const q = attachPoint(s, g.to ?? 'hF');
      out.push({ t: 'l', a: p, b: q, w: g.size ?? 3, r: 'band' });
      break;
    }
    case 'lever': {
      // Rigid machine arm from a fixed pivot to the body point.
      const from = g.from ?? p;
      out.push({ t: 'l', a: from, b: p, w: 4, r: 'equip' });
      out.push({ t: 'c', c: from, rad: 4, r: 'equip' });
      out.push({ t: 'c', c: p, rad: g.size ?? 3.5, r: 'hub' });
      break;
    }
    case 'rope': {
      const from = g.from ?? p;
      const pts: Vec[] = [];
      const n = 18;
      const span = sub(p, from);
      const L0 = len(span) || 1;
      const nrm: Vec = [-span[1] / L0, span[0] / L0];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const amp = 6 * Math.sin(k * Math.PI) * (0.4 + 0.6 * k);
        const wave = Math.sin(k * 3 * Math.PI * 2 - time / 90);
        pts.push(add(lerpV(from, p, k), mul(nrm, amp * wave)));
      }
      out.push({ t: 'pl', pts, w: 2.6, r: 'band' });
      break;
    }
    case 'jumprope': {
      // Front view: rope loop from hand to hand, swinging over the head and under the feet.
      const a = s.hN;
      const b = s.hF;
      const midHands = lerpV(a, b, 0.5);
      const top = s.head[1] - 22;
      const bottom = GROUND + 1;
      const c = Math.cos(s.phase * RAD);
      // phase 0 = overhead, 180 = under the feet
      const ctrlY = c >= 0 ? lerp(midHands[1], top, c) : lerp(midHands[1], bottom, -c);
      const pts: Vec[] = [];
      for (let i = 0; i <= 16; i++) {
        const k = i / 16;
        const x = lerp(a[0], b[0], k);
        const yLine = lerp(a[1], b[1], k);
        const bulge = 4 * k * (1 - k);
        pts.push([x + (k - 0.5) * 18 * bulge * Math.abs(c), yLine + (ctrlY - midHands[1]) * bulge * 1.3]);
      }
      out.push({ t: 'pl', pts, w: 2, r: 'band' });
      break;
    }
    case 'pad': {
      out.push({ t: 'c', c: p, rad: g.size ?? 5, r: 'equip' });
      break;
    }
    case 'platform': {
      const half = (g.size ?? 30) / 2;
      const a = g.ang ?? 0;
      out.push({ t: 'l', a: along(p, a, -half), b: along(p, a, half), w: 5, r: 'equip' });
      break;
    }
    case 'stick': {
      // Straight bar (pulldown bars, ab wheel handles, front-view bars).
      const half = (g.size ?? 70) / 2;
      const a = g.ang ?? 90;
      out.push({ t: 'l', a: along(p, a, -half), b: along(p, a, half), w: 3.5, r: 'equip' });
      break;
    }
    case 'landmine': {
      const from = g.from ?? [20, GROUND];
      const u = sub(p, from);
      const tip = add(p, mul(u, Math.max(g.size ?? 12, 6) / (len(u) || 1)));
      const end = add(p, mul(u, (g.size ?? 12) / (len(u) || 1)));
      out.push({ t: 'l', a: from, b: tip, w: 3.5, r: 'equip' });
      out.push({ t: 'c', c: end, rad: 10, r: 'plate' });
      out.push({ t: 'c', c: end, rad: 2.2, r: 'hub' });
      break;
    }
  }
}

// ── Scene building ───────────────────────────────────────

const seg = (a: Vec, b: Vec, w: number, r: Role): Prim => ({ t: 'l', a, b, w, r });

function bodyRole(hl: Set<Seg>, part: Seg, far: boolean): Role {
  if (hl.has(part)) return far ? 'hlFar' : 'hl';
  return far ? 'far' : 'body';
}

function pushArm(out: Prim[], s: Skeleton, near: boolean, hl: Set<Seg>, far: boolean) {
  const sh = near ? s.sN : s.sF;
  const el = near ? s.eN : s.eF;
  const wr = near ? s.wristN : s.wristF;
  const he = near ? s.handEndN : s.handEndF;
  out.push(seg(sh, el, W.upperArm, bodyRole(hl, 'upperArm', far)));
  out.push(seg(el, wr, W.forearm, bodyRole(hl, 'forearm', far)));
  out.push(seg(wr, he, W.hand, far ? 'far' : 'body'));
  if (hl.has('delts')) out.push({ t: 'c', c: sh, rad: 5.5, r: far ? 'hlFar' : 'hl' });
}

function pushLeg(out: Prim[], s: Skeleton, near: boolean, hl: Set<Seg>, far: boolean) {
  const hp = near ? s.hipN : s.hipF;
  const kn = near ? s.kN : s.kF;
  const an = near ? s.aN : s.aF;
  const toe = near ? s.toeN : s.toeF;
  out.push(seg(hp, kn, W.thigh, bodyRole(hl, 'thigh', far)));
  out.push(seg(kn, an, W.shin, bodyRole(hl, 'shin', far)));
  out.push(seg(an, toe, W.foot, far ? 'far' : 'body'));
}

function pushTrunk(out: Prim[], s: Skeleton, hl: Set<Seg>, view: 'side' | 'front') {
  if (view === 'front') {
    out.push({ t: 'p', pts: [s.sN, s.sF, s.hipF, s.hipN], r: 'body' });
    out.push({ t: 'pl', pts: [s.sN, s.sF, s.hipF, s.hipN, s.sN], w: 6, r: 'body' });
    if (hl.has('upperTrunk')) {
      out.push({ t: 'p', pts: [s.sN, s.sF, lerpV(s.sF, s.hipF, 0.45), lerpV(s.sN, s.hipN, 0.45)], r: 'hl' });
    }
    if (hl.has('lowerTrunk')) {
      out.push({ t: 'p', pts: [lerpV(s.sN, s.hipN, 0.5), lerpV(s.sF, s.hipF, 0.5), s.hipF, s.hipN], r: 'hl' });
    }
  } else {
    out.push(seg(s.hip, s.mid, W.lowerTrunk, bodyRole(hl, 'lowerTrunk', false)));
    out.push(seg(s.mid, s.neck, W.upperTrunk, bodyRole(hl, 'upperTrunk', false)));
  }
  if (hl.has('glutes')) {
    const c = view === 'front' ? s.hip : add(s.hip, mul(dir(s.trunk - 90), 3));
    out.push({ t: 'c', c, rad: 7, r: 'hl' });
  }
  out.push(seg(s.neck, along(s.neck, angleOf(sub(s.head, s.neck)), L.neck), W.neck, 'body'));
  out.push({ t: 'c', c: s.head, rad: L.headR, r: 'body' });
}

const FAR_GEAR = new Set<AttachPoint>(['hF', 'wristF', 'eF', 'kF', 'aF', 'toeF', 'sF']);

function transitionOrder(spec: AnimSpec): number[] {
  const order: number[] = spec.frames.map((_, i) => i);
  if ((spec.mode ?? 'pingpong') === 'pingpong') {
    for (let i = spec.frames.length - 2; i >= 1; i--) order.push(i);
  }
  return order;
}

const durOf = (spec: AnimSpec, i: number) =>
  Array.isArray(spec.dur) ? spec.dur[i % spec.dur.length] : spec.dur ?? 850;
const holdOf = (spec: AnimSpec, frame: number) =>
  Array.isArray(spec.hold) ? spec.hold[frame] ?? 150 : spec.hold ?? 150;

/** Total loop length in ms. */
export function cycleLength(spec: AnimSpec): number {
  if (spec.frames.length <= 1) return 1000;
  const order = transitionOrder(spec);
  return order.reduce((sum, frame, i) => sum + holdOf(spec, frame) + durOf(spec, i), 0);
}

/** Pose at time t (ms) for an animation. */
export function poseAt(spec: AnimSpec, time: number): Pose {
  const frames = spec.frames;
  if (frames.length === 1) return frames[0];
  const order = transitionOrder(spec);
  const total = cycleLength(spec);
  let t = ((time % total) + total) % total;
  for (let i = 0; i < order.length; i++) {
    const from = order[i];
    const to = order[(i + 1) % order.length];
    const hold = holdOf(spec, from);
    if (t < hold) return frames[from];
    t -= hold;
    const d = durOf(spec, i);
    if (t < d) {
      const k = t / d;
      return lerpPose(frames[from], frames[to], spec.linear ? k : 0.5 - 0.5 * Math.cos(Math.PI * k));
    }
    t -= d;
  }
  return frames[0];
}

function zoomPrim(p: Prim, z: number, pan: Vec = [0, 0]): Prim {
  const f = (v: Vec): Vec => [100 + (v[0] - 100) * z + pan[0], GROUND + (v[1] - GROUND) * z + pan[1]];
  switch (p.t) {
    case 'l': return { ...p, a: f(p.a), b: f(p.b), w: p.w * z };
    case 'c': return { ...p, c: f(p.c), rad: p.rad * z, ring: p.ring && p.ring * z };
    case 'p': return { ...p, pts: p.pts.map(f) };
    case 'pl': return { ...p, pts: p.pts.map(f), w: p.w * z };
  }
}

/** Drawing primitives for an animation at time t (ms), back to front. */
export function renderScene(spec: AnimSpec, time: number, pose?: Pose): Prim[] {
  const view = spec.view ?? 'side';
  const p = pose ?? poseAt(spec, time);
  const s = buildSkeleton(p, view);
  const hl = new Set(spec.hl ?? []);
  const out: Prim[] = [];

  if (spec.scene) out.push(...spec.scene);

  const gears = spec.gear ?? [];
  const backGear = gears.filter(g => g.layer === 'back' || (!g.layer && FAR_GEAR.has(g.at)));
  const frontGear = gears.filter(g => !backGear.includes(g));

  if (view === 'front') {
    pushLeg(out, s, true, hl, false);
    pushLeg(out, s, false, hl, false);
    backGear.forEach(g => drawGear(g, s, time, out));
    pushTrunk(out, s, hl, view);
    pushArm(out, s, true, hl, false);
    pushArm(out, s, false, hl, false);
  } else {
    pushArm(out, s, false, hl, true);
    pushLeg(out, s, false, hl, true);
    backGear.forEach(g => drawGear(g, s, time, out));
    pushTrunk(out, s, hl, view);
    pushLeg(out, s, true, hl, false);
    pushArm(out, s, true, hl, false);
  }
  frontGear.forEach(g => drawGear(g, s, time, out));
  if (spec.fg) out.push(...spec.fg);

  const z = spec.zoom ?? 1;
  const pan = spec.pan ?? [0, 0];
  const scaled = z !== 1 || spec.pan ? out.map(prim => zoomPrim(prim, z, pan)) : out;
  if (spec.noGround) return scaled;
  return [seg([8, GROUND + 3 + pan[1]], [192, GROUND + 3 + pan[1]], 2, 'ground'), ...scaled];
}
