import { AnimSpec, Pose, Vec } from '../rig';
import { atHead, atNeck, both, cableTower, fk, ik, planted, pullupBar, sym } from '../kit';
import { SHIN_BACK, allFours, kneelHip, plank, supine } from './common';

const ABS: AnimSpec['hl'] = ['lowerTrunk'];
const ABS_HIPS: AnimSpec['hl'] = ['lowerTrunk', 'thigh'];

// Forearm plank: elbows under the shoulders, the body in one line from the ankles.
const forearmPlank = (shoulderY: number): Pose =>
  both({ ...plank([28, 177], [153.5, shoulderY]), head: 100, aN: ik(180.5, 179, 'down'), lN: ik(28, 177), fN: 157 } as Pose);

// Side plank seen from the front: the bottom (screen-right) forearm and leg carry the body.
const sidePlank = (hip: Vec, trunk: number): Pose => ({
  hip, trunk, head: trunk - 10,
  aN: fk(2, 2), aF: ik(159, 175, 'fwd'), jF: 0.25,
  lN: ik(40, 168), lF: ik(36, 178),
});

// Hanging from the bar (scene is zoomed and panned up so straight legs fit).
const hanging = (legs: [number, number], trunk = -2, fN = 160): Pose =>
  both({ hip: [99, 122], trunk, aN: ik(100, 18, 'fwd'), lN: fk(legs[0], legs[1]), fN } as Pose);

// High plank on the hands (mountain climbers).
const HIGH_PLANK = plank([31, 172], [150, 125]);
const climber = (near: [number, number], far: [number, number]): Pose => ({
  ...HIGH_PLANK, head: 80,
  aN: ik(150, 180, 'up'), aF: ik(148, 180, 'up'),
  lN: ik(near[0], near[1]), lF: ik(far[0], far[1]),
  fN: near[0] > 60 ? 120 : 157, fF: far[0] > 60 ? 120 : 157,
});

// Russian twist from the front: seated, feet up, hands to one side.
const twist = (side: 1 | -1): Pose => ({
  hip: [100, 158], trunk: -14 * side, head: -6 * side,
  aN: ik(100 - 44 * side, 146), aF: ik(100 - 38 * side, 142),
  lN: fk(-22, 158), lF: fk(22, -158), qN: 0.6, qF: 0.6,
});

// Ab wheel: knees on the floor at x=45, feet raised behind.
const rollout = (thigh: number, trunk: number, wheel: Vec): Pose =>
  both({ hip: kneelHip(45, thigh), trunk, head: trunk + 14, aN: ik(wheel[0], wheel[1], 'down'), lN: ik(10.4, 157, 'down'), fN: 300 } as Pose);

const cableCrunch = (thigh: number, trunk: number, chest: number, head: number): Pose =>
  both({ hip: kneelHip(96, thigh), trunk, chest, head, aN: atHead(3, -7, 'down'), lN: SHIN_BACK(96), fN: 210 } as Pose);

const pallof = (aN: Pose['aN'], k: number, j: number): Pose =>
  sym({ hip: [100, 100], trunk: 0, aN, kN: k, jN: j, lN: planted(86) });

export const CORE: Record<string, AnimSpec> = {
  'ex-plank': {
    frames: [forearmPlank(149), forearmPlank(147.5)],
    dur: 1500,
    hl: ABS,
  },
  'ex-side-plank': {
    view: 'front',
    frames: [sidePlank([110, 141.5], 70), sidePlank([110, 145], 68)],
    dur: 1500,
    hl: ['lowerTrunk', 'upperTrunk'],
  },
  'ex-hollow-hold': {
    frames: [
      both({ hip: [106, 176], trunk: -72, head: -66, aN: fk(-74, -74), lN: fk(76, 76), fN: 76 } as Pose),
      both({ hip: [106, 176], trunk: -69, head: -63, aN: fk(-71, -71), lN: fk(73, 73), fN: 73 } as Pose),
    ],
    dur: 1400,
    hl: ABS_HIPS,
    zoom: 0.85,
  },
  'ex-crunch': {
    frames: [
      supine(118, { aN: atNeck(8, -16, 'up'), lN: planted(150) }),
      supine(118, { trunk: -80, chest: -52, head: -40, aN: atNeck(8, -16, 'up'), lN: planted(150) }),
    ],
    hl: ABS,
    thumb: 1,
  },
  'ex-situp': {
    frames: [
      supine(118, { aN: atNeck(8, -16, 'up'), lN: planted(146) }),
      supine(118, { trunk: -10, chest: -4, head: 4, aN: atNeck(8, -16, 'fwd'), lN: planted(146) }),
    ],
    hl: ABS_HIPS,
    thumb: 1,
  },
  'ex-bicycle-crunch': {
    frames: [
      { hip: [100, 176], trunk: -74, chest: -60, head: -48, aN: atHead(-6, -2, 'up'), aF: atHead(-6, -2, 'up'), lN: fk(24, 112), lF: fk(72, 74), fN: 110, fF: 74 },
      { hip: [100, 176], trunk: -74, chest: -60, head: -48, aN: atHead(-6, -2, 'up'), aF: atHead(-6, -2, 'up'), lN: fk(72, 74), lF: fk(24, 112), fN: 74, fF: 110 },
    ],
    dur: 480,
    hold: 60,
    hl: ['lowerTrunk', 'upperTrunk'],
  },
  'ex-russian-twist': {
    view: 'front',
    frames: [twist(1), twist(-1)],
    dur: 650,
    hl: ['lowerTrunk', 'upperTrunk'],
  },
  'ex-leg-raise': {
    frames: [
      supine(100, { lN: fk(84, 84), fN: 84 }),
      supine(100, { lN: fk(4, 4), fN: 4 }),
    ],
    hl: ABS_HIPS,
    thumb: 1,
  },
  'ex-flutter-kicks': {
    frames: [
      { hip: [100, 176], trunk: -84, head: -70, aN: fk(98, 94), aF: fk(98, 94), lN: fk(74, 74), lF: fk(86, 86), fN: 74, fF: 86 },
      { hip: [100, 176], trunk: -84, head: -70, aN: fk(98, 94), aF: fk(98, 94), lN: fk(86, 86), lF: fk(74, 74), fN: 86, fF: 74 },
    ],
    dur: 260,
    hold: 0,
    hl: ABS_HIPS,
  },
  'ex-dead-bug': {
    mode: 'loop',
    frames: [
      supine(110, { aN: fk(0, 0), lN: fk(0, 90), fN: 10 }),
      { ...supine(110, { aN: fk(0, 0), lN: fk(84, 86), fN: 86 }), aF: fk(-84, -84), lF: fk(0, 90) },
      supine(110, { aN: fk(0, 0), lN: fk(0, 90), fN: 10 }),
      { ...supine(110, { aN: fk(-84, -84), lN: fk(0, 90), fN: 10 }), aF: fk(0, 0), lF: fk(84, 86), fF: 86 },
    ],
    dur: 650,
    hl: ABS,
    zoom: 0.85,
    thumb: 1,
  },
  'ex-bird-dog': {
    mode: 'loop',
    frames: [
      allFours(88),
      allFours(88, { aN: fk(84, 84), lF: fk(272, 272), fF: 270 }),
      allFours(88),
      allFours(88, { aF: fk(84, 84), lN: fk(272, 272), fN: 270 }),
    ],
    dur: 650,
    hl: ['lowerTrunk', 'glutes'],
    zoom: 0.85,
    thumb: 1,
  },
  'ex-mountain-climber': {
    frames: [climber([102, 168], [31, 172]), climber([31, 172], [102, 168])],
    dur: 300,
    hold: 0,
    hl: ['lowerTrunk', 'thigh'],
  },
  'ex-hanging-knee-raise': {
    frames: [hanging([174, 182]), hanging([86, 178], -6, 150)],
    scene: pullupBar(100, 14),
    hl: ABS_HIPS,
    noGround: true,
    zoom: 0.85,
    pan: [0, -14],
    thumb: 1,
  },
  'ex-hanging-raise': {
    frames: [hanging([174, 178]), hanging([84, 86], -8, 86)],
    scene: pullupBar(100, 14),
    hl: ABS_HIPS,
    noGround: true,
    zoom: 0.85,
    pan: [0, -14],
    thumb: 1,
  },
  'ex-ab-rollout': {
    frames: [rollout(15, 70, [102, 170]), rollout(62, 84, [183, 170])],
    gear: [{ kind: 'wheel', at: 'hands' }],
    hl: ABS,
    zoom: 0.9,
    thumb: 1,
  },
  'ex-cable-crunch': {
    frames: [cableCrunch(-4, 0, 0, 0), cableCrunch(6, 36, 82, 112)],
    scene: cableTower(184, 26),
    gear: [{ kind: 'cable', at: 'hands', from: [178, 26] }],
    hl: ABS,
    thumb: 1,
  },
  'ex-pallof-press': {
    view: 'front',
    frames: [pallof(fk(170, 60), 0.9, 0.4), pallof(fk(131, 131), 0.35, 0.35)],
    scene: cableTower(10, 70),
    gear: [{ kind: 'cable', at: 'hands', from: [16, 70] }],
    hl: ['lowerTrunk', 'upperTrunk'],
    thumb: 1,
  },
  'ex-woodchopper': {
    view: 'front',
    frames: [
      { hip: [100, 102], trunk: -8, head: -4, aN: ik(40, 36), aF: ik(44, 38), lN: planted(80), lF: planted(120) },
      { hip: [100, 102], trunk: 12, head: 6, aN: ik(150, 138), aF: ik(154, 136), lN: planted(80), lF: planted(120) },
    ],
    scene: cableTower(10, 26),
    gear: [{ kind: 'cable', at: 'hands', from: [16, 26] }],
    hl: ['lowerTrunk', 'upperTrunk'],
  },
};

