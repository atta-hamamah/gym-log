import { AnimSpec, ANKLE_Y, GROUND, Limb, Pose } from '../rig';
import { atNeck, bench, both, box, fk, frame, ik, planted, seat, sym, wall } from '../kit';
import { SHIN_BACK, kneelHip, upright } from './common';

const QUADS: AnimSpec['hl'] = ['thigh', 'glutes'];
const HAMS: AnimSpec['hl'] = ['thigh', 'glutes'];

const BACK_BAR = atNeck(-5, 1, 'down');

/** Squat from standing to the bottom position, feet planted at x=101. */
const squat = (arms: Limb, bottom: { hip: [number, number]; trunk: number; head?: number }, extra: Partial<AnimSpec> = {}, armsBottom: Limb = arms): AnimSpec => ({
  frames: [upright(100, { aN: arms }), both({ ...bottom, aN: armsBottom, lN: planted(101) } as Pose)],
  hl: QUADS,
  thumb: 1,
  ...extra,
});

const hinge = (gear: AnimSpec['gear'], arms: Limb = fk(180, 180), bottomArms: Limb = fk(170, 170)): AnimSpec => ({
  frames: [
    upright(98, { aN: arms, lN: planted(96) }),
    both({ hip: [68, 106], trunk: 72, head: 82, aN: bottomArms, lN: planted(96) } as Pose),
  ],
  gear,
  hl: HAMS,
  thumb: 1,
});

// Split stance used by the lunges: front (near) foot forward, back (far) foot on its toes.
const lungeBottom = (hipX: number, front: number, back: number, over: Partial<Pose> = {}): Pose =>
  both({ hip: [hipX, 138], trunk: 2, aN: fk(180, 180), lN: planted(front), lF: ik(back, 175), fF: 128, ...over } as Pose);

// Seated machine: seat pan at y=140 from 66→120 with a back rest.
const MACHINE_SEAT = seat(64, 120, 140, { x: 68, top: 70, lean: 6 });

export const LEGS: Record<string, AnimSpec> = {
  'ex-squat': squat(BACK_BAR, { hip: [79, 146], trunk: 42 }, { gear: [{ kind: 'barbell', at: 'nape' }] }),
  'ex-front-squat': squat(atNeck(3.1, -4.6, 'up'), { hip: [84, 150], trunk: 24 }, { gear: [{ kind: 'barbell', at: 'clav', size: 12 }] }),
  'ex-goblet-squat': squat(atNeck(15, -12, 'down'), { hip: [83, 150], trunk: 28 }, { gear: [{ kind: 'dumbbell', at: 'hands', size: 7.5 }] }),
  'ex-bw-squat': squat(fk(150, 150), { hip: [80, 148], trunk: 38 }, {}, fk(88, 88)),
  'ex-smith-squat': {
    frames: [
      upright(100, { aN: BACK_BAR, lN: planted(108) }),
      both({ hip: [76, 146], trunk: 30, aN: BACK_BAR, lN: planted(108) } as Pose),
    ],
    scene: [frame([[93, 12], [93, GROUND]], 3), frame([[60, 12], [130, 12]], 4)],
    gear: [{ kind: 'barbell', at: 'nape' }],
    hl: QUADS,
    thumb: 1,
  },
  'ex-hack-squat': {
    frames: [
      both({ hip: [92, 102], trunk: -20, aN: atNeck(6, -6, 'down'), lN: ik(138, 170), fN: 80 } as Pose),
      both({ hip: [107, 143], trunk: -20, aN: atNeck(6, -6, 'down'), lN: ik(138, 170), fN: 80 } as Pose),
    ],
    scene: [
      frame([[58, 14], [126, 196]], 5),
      { t: 'l', a: [128, 182], b: [160, 158], w: 5, r: 'equip' },
    ],
    gear: [{ kind: 'platform', at: 'mid', off: [-9, 3], ang: -20, size: 64, layer: 'back' }],
    hl: QUADS,
    thumb: 1,
  },
  'ex-leg-press': {
    frames: [
      both({ hip: [78, 150], trunk: -62, head: -40, aN: ik(96, 160, 'down'), lN: ik(132, 96, 'up'), fN: -40 } as Pose),
      both({ hip: [78, 150], trunk: -62, head: -40, aN: ik(96, 160, 'down'), lN: ik(106, 124, 'up'), fN: -40 } as Pose),
    ],
    scene: [
      frame([[36, 112], [70, 162], [102, 162]], 8),
      frame([[84, 162], [84, GROUND]], 4),
      frame([[104, 150], [182, 72]], 3),
      frame([[150, 104], [150, GROUND]], 4),
    ],
    gear: [{ kind: 'platform', at: 'feet', off: [3, -3], ang: 135, size: 40 }],
    hl: QUADS,
    thumb: 1,
  },
  'ex-lunges': {
    frames: [
      upright(72, { lN: planted(73) }),
      both({ hip: [84, 99], trunk: 2, aN: fk(180, 180), lN: ik(106, 160, 'fwd'), lF: planted(70), fN: 110 } as Pose),
      lungeBottom(98, 128, 66),
    ],
    hl: QUADS,
    thumb: 2,
  },
  'ex-walking-lunge': {
    frames: [
      lungeBottom(88, 118, 56),
      both({ hip: [114, 100], trunk: 4, aN: fk(180, 180), lN: planted(118), lF: ik(84, 174), fF: 145 } as Pose),
      both({ hip: [118, 98], trunk: 2, aN: fk(180, 180), lN: planted(118), lF: ik(130, 150, 'fwd'), fF: 120 } as Pose),
    ],
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: QUADS,
  },
  'ex-reverse-lunge': {
    frames: [
      upright(112, { lN: planted(113) }),
      both({ hip: [110, 100], trunk: 4, aN: fk(180, 180), lN: planted(113), lF: ik(90, 162), fF: 140 } as Pose),
      lungeBottom(100, 113, 54, { trunk: 6 }),
    ],
    hl: QUADS,
    thumb: 2,
  },
  'ex-bulgarian': {
    frames: [
      both({ hip: [96, 100], trunk: 4, aN: fk(180, 180), lN: planted(120), lF: ik(48, 131), fF: 262 } as Pose),
      both({ hip: [92, 138], trunk: 10, aN: fk(180, 180), lN: planted(120), lF: ik(48, 131), fF: 262 } as Pose),
    ],
    scene: bench(10, 62, 138),
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: QUADS,
    thumb: 1,
  },
  'ex-step-up': {
    frames: [
      both({ hip: [88, 100], trunk: 6, aN: fk(180, 180), lN: ik(124, 141), lF: planted(86) } as Pose),
      both({ hip: [110, 80], trunk: 10, aN: fk(180, 180), lN: ik(126, 141), lF: ik(98, 174), fF: 145 } as Pose),
      both({ hip: [128, 60], trunk: 2, aN: fk(180, 180), lN: ik(128, 141), lF: ik(124, 141) } as Pose),
    ],
    scene: box(112, 60, 40),
    hl: QUADS,
    zoom: 0.8,
  },
  'ex-pistol-squat': {
    frames: [
      both({ hip: [98, 100], trunk: 4, aN: fk(95, 95), lN: planted(100), lF: fk(155, 155) } as Pose),
      both({ hip: [82, 152], trunk: 42, aN: fk(82, 82), lN: planted(100), lF: fk(86, 86) } as Pose),
    ],
    hl: QUADS,
    thumb: 1,
  },
  'ex-jump-squat': {
    frames: [
      both({ hip: [82, 142], trunk: 40, aN: fk(215, 205), lN: planted(100) } as Pose),
      both({ hip: [100, 84], trunk: 4, aN: fk(20, 10), lN: ik(101, 166), fN: 155 } as Pose),
    ],
    dur: [380, 520],
    hl: QUADS,
    zoom: 0.85,
    thumb: 0,
  },
  'ex-box-jump': {
    frames: [
      both({ hip: [54, 140], trunk: 40, aN: fk(215, 205), lN: planted(72) } as Pose),
      both({ hip: [92, 62], trunk: 18, aN: fk(70, 60), lN: ik(104, 118), fN: 150 } as Pose),
      both({ hip: [128, 94], trunk: 30, aN: fk(140, 140), lN: ik(140, 136) } as Pose),
    ],
    scene: box(112, 58, 45),
    hl: QUADS,
    zoom: 0.8,
    thumb: 1,
  },
  'ex-wall-sit': {
    frames: [
      both({ hip: [72, 140], trunk: 0, aN: ik(104, 134, 'back'), lN: planted(113) } as Pose),
      both({ hip: [72, 141.5], trunk: 0, aN: ik(104, 135.5, 'back'), lN: planted(113) } as Pose),
    ],
    dur: 1400,
    scene: [wall(60)],
    hl: QUADS,
  },
  'ex-rdl': hinge([{ kind: 'barbell', at: 'hands', size: 12 }]),
  'ex-db-rdl': hinge([{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }]),
  'ex-single-leg-rdl': {
    frames: [
      both({ hip: [100, 100], trunk: 2, aN: fk(180, 180), lN: planted(101), lF: fk(188, 190), fF: 150 } as Pose),
      both({ hip: [94, 102], trunk: 86, head: 92, aN: fk(180, 180), lN: planted(101), lF: fk(270, 272), fF: 190 } as Pose),
    ],
    gear: [{ kind: 'dumbbell', at: 'hN' }],
    hl: HAMS,
    thumb: 1,
  },
  'ex-good-morning': {
    frames: [
      upright(98, { aN: BACK_BAR, lN: planted(98) }),
      both({ hip: [74, 104], trunk: 78, head: 88, aN: BACK_BAR, lN: planted(98) } as Pose),
    ],
    gear: [{ kind: 'barbell', at: 'nape' }],
    hl: HAMS,
    thumb: 1,
  },
  'ex-leg-curl': {
    frames: [
      both({ hip: [100, 135], trunk: 90, head: 96, aN: ik(162, 154, 'down'), lN: fk(270, 270), fN: 0 } as Pose),
      both({ hip: [100, 135], trunk: 90, head: 96, aN: ik(162, 154, 'down'), lN: fk(270, 20), fN: 110 } as Pose),
    ],
    scene: [...bench(50, 150, 143), frame([[164, 150], [164, GROUND]], 3)],
    gear: [{ kind: 'lever', at: 'aN', from: [56, 156], size: 5 }],
    hl: ['thigh'],
    thumb: 1,
  },
  'ex-seated-leg-curl': {
    frames: [
      both({ hip: [86, 130], trunk: -10, aN: ik(108, 138, 'back'), lN: fk(92, 92), fN: 0 } as Pose),
      both({ hip: [86, 130], trunk: -10, aN: ik(108, 138, 'back'), lN: fk(92, 200), fN: 110 } as Pose),
    ],
    scene: [...MACHINE_SEAT, frame([[124, 116], [140, 116], [140, GROUND]], 4)],
    gear: [{ kind: 'pad', at: 'kN', off: [-8, -8], size: 6 }, { kind: 'lever', at: 'aN', from: [130, 148], size: 5 }],
    hl: ['thigh'],
    thumb: 1,
  },
  'ex-nordic-curl': {
    frames: [
      both({ hip: kneelHip(62, 0), trunk: 0, aN: atNeck(10, -18, 'down'), lN: SHIN_BACK(62), fN: 210 } as Pose),
      both({ hip: kneelHip(62, 62), trunk: 62, head: 70, aN: atNeck(48, 4, 'down'), lN: SHIN_BACK(62), fN: 210 } as Pose),
    ],
    scene: [frame([[14, 170], [14, GROUND]], 4)],
    gear: [{ kind: 'pad', at: 'aN', off: [-1, -7], size: 6 }],
    hl: HAMS,
    thumb: 1,
  },
  'ex-leg-ext': {
    frames: [
      both({ hip: [84, 130], trunk: -8, aN: ik(96, 142, 'back'), lN: fk(92, 180), fN: 100 } as Pose),
      both({ hip: [84, 130], trunk: -8, aN: ik(96, 142, 'back'), lN: fk(92, 96), fN: 15 } as Pose),
    ],
    scene: [...MACHINE_SEAT, frame([[124, 140], [128, GROUND]], 4)],
    gear: [{ kind: 'lever', at: 'aN', from: [128, 136], size: 5 }],
    hl: ['thigh'],
    thumb: 1,
  },
  'ex-hip-adduction': {
    view: 'front',
    frames: [
      sym({ hip: [100, 128], trunk: 0, aN: fk(196, 176), lN: ik(58, 170), qN: 0.5 }),
      sym({ hip: [100, 128], trunk: 0, aN: fk(196, 176), lN: ik(86, 176), qN: 0.5 }),
    ],
    scene: [
      { t: 'p', pts: [[78, 46], [122, 46], [122, 132], [78, 132]], r: 'equipLight' },
      frame([[100, 140], [100, GROUND]], 5),
      { t: 'l', a: [72, 140], b: [128, 140], w: 8, r: 'equip' },
    ],
    gear: [{ kind: 'pad', at: 'kN', off: [6, 0], size: 5 }, { kind: 'pad', at: 'kF', off: [-6, 0], size: 5 }],
    hl: ['thigh'],
  },
  'ex-calf-raise': {
    frames: [
      upright(100),
      both({ hip: [101, 90], trunk: 0, aN: fk(180, 180), lN: ik(102, 171), fN: 145 } as Pose),
    ],
    hl: ['shin'],
    thumb: 1,
  },
  'ex-seated-calf-raise': {
    frames: [
      both({ hip: [86, 131], trunk: 4, aN: ik(118, 128, 'back'), lN: ik(128, 170), fN: 100 } as Pose),
      both({ hip: [86, 131], trunk: 4, aN: ik(118, 121, 'back'), lN: ik(128, 162), fN: 145 } as Pose),
    ],
    scene: [...seat(66, 110, 140), ...box(124, 30, 9)],
    gear: [{ kind: 'lever', at: 'kN', off: [0, -7], from: [170, 142], size: 5 }],
    hl: ['shin'],
    thumb: 1,
  },
};
