import { AnimSpec, GROUND, Limb, Pose, Shape, Vec } from '../rig';
import { atNeck, both, fk, frame, ik, planted, sym } from '../kit';
import { walkCycle } from './common';

const LEGS: AnimSpec['hl'] = ['thigh', 'shin'];

/** Four-frame running cycle in place (loop mode). */
export const RUN_FRAMES: Pose[] = [
  { hip: [100, 97], trunk: 10, aN: fk(212, 125), aF: fk(150, 60), lN: fk(148, 172), lF: fk(208, 255) },
  { hip: [100, 101], trunk: 10, aN: fk(185, 100), aF: fk(178, 95), lN: fk(176, 184), lF: fk(170, 245) },
  { hip: [100, 97], trunk: 10, aF: fk(212, 125), aN: fk(150, 60), lF: fk(148, 172), lN: fk(208, 255) },
  { hip: [100, 101], trunk: 10, aF: fk(185, 100), aN: fk(178, 95), lF: fk(176, 184), lN: fk(170, 245) },
];
const RUN: Partial<AnimSpec> = { mode: 'loop', dur: 230, hold: 0, frames: RUN_FRAMES, hl: LEGS };

const RAD = Math.PI / 180;
const onCircle = (c: Vec, rx: number, ry: number, deg: number): Vec =>
  [c[0] + rx * Math.cos(deg * RAD), c[1] + ry * Math.sin(deg * RAD)];

/**
 * Pedalling: the feet follow a circle (or ellipse) around a crank, 180° apart.
 * `pose` builds the rest of the body for each step (k = 0..1 around the circle).
 */
function pedalFrames(crank: Vec, rx: number, ry: number, steps: number, pose: (near: Vec, far: Vec, k: number) => Pose): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < steps; i++) {
    const deg = (360 * i) / steps;
    out.push(pose(onCircle(crank, rx, ry, deg), onCircle(crank, rx, ry, deg + 180), i / steps));
  }
  return out;
}

// Stationary bike: saddle under the hip, crank at (112, 156).
const CRANK: Vec = [112, 156];
const PEDAL_OFF: Vec = [4, 5];
const bikeLegs = (near: Vec, far: Vec) => ({
  lN: ik(near[0] - PEDAL_OFF[0], near[1] - PEDAL_OFF[1]),
  lF: ik(far[0] - PEDAL_OFF[0], far[1] - PEDAL_OFF[1]),
  fN: 110, fF: 110,
});
const BIKE: Shape[] = [
  frame([[70, 102], [96, 102]], 6),
  frame([[84, 104], [96, 150], [112, 156], [138, 120], [144, 82]], 5),
  frame([[136, 80], [154, 80]], 5),
  { t: 'c', c: [150, 160], rad: 18, r: 'equipLight' },
  frame([[60, GROUND], [160, GROUND]], 6),
  frame([[96, 150], [86, GROUND]], 4),
  frame([[150, 160], [150, GROUND]], 4),
];
const CRANKS: AnimSpec['gear'] = [
  { kind: 'lever', at: 'aF', off: PEDAL_OFF, from: CRANK, size: 3 },
  { kind: 'lever', at: 'aN', off: PEDAL_OFF, from: CRANK, size: 3 },
];

// Rowing machine: feet on the stretcher, the seat slides on the rail.
const FEET: Limb = ik(163, 166, 'up');
const row = (hipX: number, trunk: number, hand: Vec, h: 'down' | 'back' = 'down'): Pose =>
  both({ hip: [hipX, 160], trunk, head: trunk + 6, aN: ik(hand[0], hand[1], h), lN: FEET, fN: 40 } as Pose);

// Elliptical: the feet ride on an ellipse, the hands on swinging handles.
const ELLIPSE: Vec = [100, 166];

// Stair climber steps.
const STEPS: Shape[] = [
  { t: 'p', pts: [[70, GROUND], [150, GROUND], [150, 175], [70, 175]], r: 'equipLight' },
  { t: 'p', pts: [[104, 175], [150, 175], [150, 153], [104, 153]], r: 'equipLight' },
  frame([[150, GROUND], [150, 60], [124, 60]], 5),
];
const stair = (near: Vec, far: Vec, hipY: number): Pose => ({
  hip: [100, hipY], trunk: 8, aN: ik(124, 100, 'back'), aF: ik(122, 101, 'back'),
  lN: ik(near[0], near[1]), lF: ik(far[0], far[1]),
});

// Freestyle swimming: the arms turn full circles half a turn apart.
const swim = (a: number, kick: number): Pose => ({
  hip: [92, 112], trunk: 92, head: 104,
  aN: fk(a, a + 8), aF: fk(a + 180, a + 188),
  lN: fk(270 + kick, 272 + kick), lF: fk(270 - kick, 272 - kick), fN: 270, fF: 270,
});

const jump = (phase: number, hipY: number): Pose =>
  sym({ hip: [100, hipY], trunk: 0, aN: ik(70, 112), lN: ik(94, hipY + 81), phase });

const jack = (open: boolean): Pose =>
  open
    ? sym({ hip: [100, 96], trunk: 0, aN: fk(-28, -14), lN: ik(68, 176) })
    : sym({ hip: [100, 100], trunk: 0, aN: fk(186, 184), lN: planted(94) });

const knees = (swap: boolean): Pose => {
  const up = ik(140, 136, 'fwd');
  const down = ik(99, 176);
  const fwd = fk(150, 50);
  const back = fk(205, 120);
  return {
    hip: [100, 96], trunk: 2,
    aN: swap ? fwd : back, aF: swap ? back : fwd,
    lN: swap ? down : up, lF: swap ? up : down,
    fN: swap ? 135 : 110, fF: swap ? 110 : 135,
  };
};

// Boxing stance: lead (near) foot forward, rear heel up.
const GUARD_N = atNeck(16, 6, 'down');
const GUARD_F = atNeck(12, 3, 'down');
const PUNCH = atNeck(58, 4, 'down');
const boxer = (aN: Limb, aF: Limb, trunk = 8): Pose => ({
  hip: [96, 102], trunk, head: trunk - 6, aN, aF,
  lN: planted(118), lF: ik(78, 177), fF: 130,
});

const ropes = (nearUp: boolean): Pose => ({
  hip: [88, 126], trunk: 18,
  aN: ik(132, nearUp ? 84 : 122, 'down'), aF: ik(130, nearUp ? 122 : 84, 'down'),
  lN: planted(104), lF: planted(84),
});

export const CARDIO: Record<string, AnimSpec> = {
  'ex-outdoor-run': { ...RUN } as AnimSpec,
  'ex-walking': {
    mode: 'loop',
    linear: true,
    frames: walkCycle(),
    dur: 300,
    hold: 0,
    hl: LEGS,
  },
  'ex-treadmill': {
    ...RUN,
    scene: [
      frame([[22, 186], [164, 186]], 5),
      frame([[164, 186], [156, 104], [136, 98]], 5),
      frame([[150, 100], [166, 92]], 6),
    ],
    noGround: true,
  } as AnimSpec,
  'ex-cycling': {
    mode: 'loop',
    linear: true,
    frames: pedalFrames(CRANK, 16, 16, 8, (n, f) =>
      both({ hip: [84, 98], trunk: 30, head: 55, aN: ik(146, 78, 'down'), ...bikeLegs(n, f) } as Pose)),
    dur: 120,
    hold: 0,
    scene: BIKE,
    gear: CRANKS,
    hl: LEGS,
    noGround: true,
  },
  'ex-air-bike': {
    mode: 'loop',
    linear: true,
    frames: pedalFrames(CRANK, 16, 16, 8, (n, f, k) => {
      const swing = 14 * Math.cos(2 * Math.PI * k);
      return {
        hip: [84, 98], trunk: 22, head: 40,
        aN: ik(140 + swing, 80, 'down'), aF: ik(140 - swing, 80, 'down'),
        ...bikeLegs(n, f),
      };
    }),
    dur: 130,
    hold: 0,
    scene: BIKE.filter((_, i) => i !== 2),
    gear: [
      ...(CRANKS ?? []),
      { kind: 'lever', at: 'hF', from: [140, 150], size: 3 },
      { kind: 'lever', at: 'hN', from: [140, 150], size: 3 },
    ],
    hl: ['thigh', 'upperArm'],
    noGround: true,
  },
  'ex-rowing': {
    mode: 'loop',
    frames: [
      row(118, 26, [176, 134]),
      row(86, 14, [150, 126]),
      row(84, -24, [98, 132], 'back'),
      row(86, -2, [140, 128]),
    ],
    dur: [420, 300, 380, 520],
    hold: [80, 0, 120, 0],
    scene: [
      frame([[26, 172], [176, 172]], 4),
      frame([[30, 172], [30, GROUND]], 4),
      { t: 'c', c: [180, 150], rad: 14, r: 'equipLight' },
      frame([[180, 164], [180, GROUND]], 5),
      frame([[158, 174], [170, 150]], 5),
    ],
    gear: [
      { kind: 'platform', at: 'hip', off: [0, 8], ang: 90, size: 24, layer: 'back' },
      { kind: 'cable', at: 'hands', from: [172, 148] },
    ],
    hl: ['thigh', 'upperTrunk', 'upperArm'],
    thumb: 2,
  },
  'ex-ski-erg': {
    frames: [
      both({ hip: [98, 100], trunk: 4, aN: ik(140, 30, 'down'), lN: planted(100) } as Pose),
      both({ hip: [80, 126], trunk: 48, head: 60, aN: ik(106, 150, 'back'), lN: planted(100) } as Pose),
    ],
    dur: [450, 600],
    scene: [frame([[166, 10], [166, GROUND]], 8), frame([[150, 12], [166, 12]], 4)],
    gear: [{ kind: 'cable', at: 'hands', from: [152, 14] }],
    hl: ['upperTrunk', 'upperArm'],
  },
  'ex-elliptical': {
    mode: 'loop',
    linear: true,
    frames: pedalFrames(ELLIPSE, 20, 7, 8, (n, f, k) => {
      const swing = 12 * Math.cos(2 * Math.PI * k);
      return {
        hip: [92, 92], trunk: 6,
        aN: ik(130 - swing, 86, 'down'), aF: ik(130 + swing, 86, 'down'),
        lN: ik(n[0], n[1]), lF: ik(f[0], f[1]), fN: 100, fF: 100,
      };
    }),
    dur: 160,
    hold: 0,
    scene: [frame([[60, GROUND], [164, GROUND], [164, 120], [150, 66]], 5)],
    gear: [
      { kind: 'platform', at: 'aF', off: [5, 5], ang: 90, size: 22 },
      { kind: 'platform', at: 'aN', off: [5, 5], ang: 90, size: 22 },
      { kind: 'lever', at: 'hF', from: [144, 150], size: 3 },
      { kind: 'lever', at: 'hN', from: [144, 150], size: 3 },
    ],
    hl: LEGS,
    noGround: true,
  },
  'ex-stairmaster': {
    mode: 'loop',
    linear: true,
    frames: [
      stair([120, 150], [98, 172], 92),
      stair([110, 160], [112, 140], 94),
      stair([98, 172], [120, 150], 92),
      stair([112, 140], [110, 160], 94),
    ],
    dur: 330,
    hold: 0,
    scene: STEPS,
    hl: ['thigh', 'glutes'],
  },
  'ex-swimming': {
    mode: 'loop',
    linear: true,
    frames: [swim(90, 6), swim(180, -6), swim(270, 6), swim(360, -6)],
    dur: 330,
    hold: 0,
    scene: [frame([[0, 104], [200, 104]], 2)],
    hl: ['upperTrunk', 'upperArm'],
    noGround: true,
    zoom: 0.85,
    thumb: 1,
  },
  'ex-jump-rope': {
    view: 'front',
    mode: 'loop',
    linear: true,
    frames: [jump(0, 100), jump(90, 96), jump(180, 91), jump(270, 96)],
    dur: 150,
    hold: 0,
    gear: [{ kind: 'jumprope', at: 'hands' }],
    hl: ['shin'],
  },
  'ex-jumping-jacks': {
    view: 'front',
    frames: [jack(false), jack(true)],
    dur: 300,
    hold: 40,
    hl: ['delts', 'thigh'],
    zoom: 0.85,
    thumb: 1,
  },
  'ex-high-knees': {
    frames: [knees(false), knees(true)],
    dur: 220,
    hold: 20,
    hl: ['thigh'],
  },
  'ex-shadow-boxing': {
    mode: 'loop',
    frames: [
      boxer(GUARD_N, GUARD_F),
      boxer(PUNCH, GUARD_F, 6),
      boxer(GUARD_N, GUARD_F),
      boxer(GUARD_N, PUNCH, 16),
    ],
    dur: [160, 240, 160, 240],
    hold: [160, 60, 160, 60],
    hl: ['delts', 'upperArm'],
    thumb: 1,
  },
  'ex-battle-ropes': {
    frames: [ropes(true), ropes(false)],
    dur: 240,
    hold: 0,
    gear: [
      { kind: 'rope', at: 'hF', from: [192, 180] },
      { kind: 'rope', at: 'hN', from: [192, 180] },
    ],
    hl: ['delts', 'upperArm'],
  },
};
