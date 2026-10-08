import { AnimSpec, ANKLE_Y, GROUND, Pose } from '../rig';
import { atNeck, both, cableTower, fk, frame, ik, planted, pullupBar, seat, sym } from '../kit';
import { plank } from './common';

const BACK_HL: AnimSpec['hl'] = ['upperTrunk', 'upperArm'];

const pullup = (top: Pose['hip'], topTrunk: number, extra: Partial<Pose> = {}): Pose[] => [
  both({ hip: [99, 122], trunk: -2, aN: ik(100, 18, 'fwd'), lN: fk(165, 255), ...extra } as Pose),
  both({ hip: top, trunk: topTrunk, head: 0, aN: ik(100, 18, 'fwd'), lN: fk(160, 250), ...extra } as Pose),
];

const hingeRow = (gear: AnimSpec['gear']): AnimSpec => ({
  frames: [
    both({ hip: [88, 108], trunk: 70, head: 80, aN: ik(131, 147, 'back'), lN: planted(100) } as Pose),
    both({ hip: [88, 108], trunk: 70, head: 80, aN: ik(114, 114, 'up'), lN: planted(100) } as Pose),
  ],
  gear,
  hl: BACK_HL,
});

const pulldown = (bottom: [number, number], bottomTrunk: number): AnimSpec => ({
  frames: [
    both({ hip: [95, 130], trunk: -5, aN: ik(95, 25, 'fwd'), lN: ik(130, ANKLE_Y, 'fwd') } as Pose),
    both({ hip: [95, 130], trunk: bottomTrunk, aN: ik(bottom[0], bottom[1], 'down'), lN: ik(130, ANKLE_Y, 'fwd') } as Pose),
  ],
  scene: [...seat(78, 110, 140), frame([[60, 10], [60, GROUND]], 6), frame([[60, 10], [100, 8]], 4), { t: 'c', c: [123, 114], rad: 5, r: 'equip' }],
  gear: [{ kind: 'cable', at: 'hands', from: [98, 8] }],
  hl: BACK_HL,
});

const deadlift = (ankleX: number, bottomHip: [number, number], bottomTrunk: number, gear: AnimSpec['gear'], extra: Partial<AnimSpec> = {}): AnimSpec => ({
  frames: [
    both({ hip: bottomHip, trunk: bottomTrunk, head: bottomTrunk + 10, aN: fk(180, 180), lN: planted(ankleX) } as Pose),
    both({ hip: [ankleX - 1, 100], trunk: 0, aN: fk(180, 180), lN: planted(ankleX) } as Pose),
  ],
  gear,
  hl: ['lowerTrunk', 'glutes', 'thigh'],
  ...extra,
});

const shrugPose = (sh: number, arm: Pose['aN']) => sym({ hip: [100, 100], trunk: 0, aN: arm, lN: planted(92), sh });

export const BACK: Record<string, AnimSpec> = {
  'ex-deadlift': deadlift(114, [82, 132], 60, [{ kind: 'barbell', at: 'hands', size: 12 }]),
  'ex-trap-bar-deadlift': deadlift(104, [84, 138], 45, [{ kind: 'barbell', at: 'hands', size: 12 }]),
  'ex-rack-pull': deadlift(112, [92, 112], 35, [{ kind: 'barbell', at: 'hands', size: 12 }], {
    scene: [frame([[146, 40], [146, GROUND]], 5), frame([[118, 142], [146, 142]], 3)],
  }),
  'ex-sumo-deadlift': {
    view: 'front',
    frames: [
      sym({ hip: [100, 148], trunk: 0, aN: fk(182, 180), lN: planted(64) }),
      sym({ hip: [100, 104], trunk: 0, aN: fk(182, 180), lN: planted(64) }),
    ],
    gear: [{ kind: 'barbellFront', at: 'hands', size: 80 }],
    hl: ['thigh', 'glutes'],
  },
  'ex-pull-ups': {
    frames: pullup([104, 82], -10),
    scene: pullupBar(100, 14),
    hl: BACK_HL,
    noGround: true,
  },
  'ex-chinups': {
    frames: pullup([102, 82], -4),
    scene: pullupBar(100, 14),
    hl: ['upperArm', 'upperTrunk'],
    noGround: true,
  },
  'ex-assisted-pullup': {
    frames: [
      both({ hip: [99, 122], trunk: -2, aN: ik(100, 18, 'fwd'), lN: fk(180, 270) } as Pose),
      both({ hip: [104, 84], trunk: -8, head: 0, aN: ik(100, 18, 'fwd'), lN: fk(180, 270) } as Pose),
    ],
    scene: [...pullupBar(100, 14), frame([[150, 8], [150, GROUND]], 6)],
    gear: [{ kind: 'platform', at: 'kN', off: [-14, 7], ang: 90, size: 40 }],
    hl: BACK_HL,
  },
  'ex-lat-pulldown': pulldown([101, 84], -15),
  'ex-close-grip-pulldown': pulldown([104, 92], -20),
  'ex-straight-arm-pulldown': {
    frames: [
      both({ hip: [92, 100], trunk: 25, aN: fk(40, 40), lN: planted(100) } as Pose),
      both({ hip: [92, 100], trunk: 25, aN: fk(172, 172), lN: planted(100) } as Pose),
    ],
    scene: cableTower(180, 28),
    gear: [{ kind: 'cable', at: 'hands', from: [174, 28] }],
    hl: ['upperTrunk'],
  },
  'ex-bent-rows': hingeRow([{ kind: 'barbell', at: 'hands' }]),
  'ex-tbar-row': hingeRow([{ kind: 'landmine', at: 'hands', from: [12, GROUND] }]),
  'ex-db-row': {
    frames: [
      { hip: [80, 100], trunk: 80, head: 90, aN: ik(126, 152, 'back'), aF: ik(127, 145, 'back'), lN: ik(66, ANKLE_Y), lF: ik(48, 143, 'down') },
      { hip: [80, 100], trunk: 80, head: 90, aN: ik(108, 108, 'up'), aF: ik(127, 145, 'back'), lN: ik(66, ANKLE_Y), lF: ik(48, 143, 'down') },
    ],
    scene: [
      frame([[48, 150], [48, GROUND]], 3),
      frame([[132, 150], [132, GROUND]], 3),
      { t: 'l', a: [40, 152], b: [140, 152], w: 8, r: 'equip' },
    ],
    gear: [{ kind: 'dumbbell', at: 'hN' }],
    hl: BACK_HL,
  },
  'ex-chest-supported-row': {
    frames: [
      both({ hip: [84, 132], trunk: 55, head: 70, aN: ik(122, 160, 'back'), lN: ik(30, 178), fN: 150 } as Pose),
      both({ hip: [84, 132], trunk: 55, head: 70, aN: ik(110, 128, 'up'), lN: ik(30, 178), fN: 150 } as Pose),
    ],
    scene: [
      frame([[100, 136], [100, GROUND]], 3),
      frame([[130, 112], [150, GROUND]], 3),
      { t: 'l', a: [78, 148], b: [138, 106], w: 8, r: 'equip' },
    ],
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: BACK_HL,
  },
  'ex-seated-row': {
    frames: [
      both({ hip: [80, 154], trunk: 20, aN: ik(148, 120, 'down'), lN: ik(142, 158, 'up'), fN: 10 } as Pose),
      both({ hip: [80, 154], trunk: -5, aN: ik(98, 126, 'back'), lN: ik(142, 158, 'up'), fN: 10 } as Pose),
    ],
    scene: [
      frame([[56, 164], [106, 164]], 7),
      frame([[80, 164], [80, GROUND]], 4),
      frame([[149, 134], [149, 168]], 5),
      ...cableTower(184, 140, 90),
    ],
    gear: [{ kind: 'cable', at: 'hands', from: [178, 140] }],
    hl: BACK_HL,
  },
  'ex-machine-row': {
    frames: [
      both({ hip: [85, 130], trunk: 0, aN: ik(140, 100, 'down'), lN: ik(122, ANKLE_Y) } as Pose),
      both({ hip: [85, 130], trunk: -3, aN: ik(104, 104, 'back'), lN: ik(122, ANKLE_Y) } as Pose),
    ],
    scene: [...seat(68, 100, 140), { t: 'l', a: [104, 78], b: [104, 112], w: 8, r: 'equip' }, frame([[104, 112], [104, 140]], 4)],
    gear: [{ kind: 'lever', at: 'hN', from: [158, 168] }],
    hl: BACK_HL,
  },
  'ex-band-row': {
    frames: [
      both({ hip: [70, 176], trunk: 12, aN: ik(126, 142, 'down'), lN: ik(150, 178) } as Pose),
      both({ hip: [70, 176], trunk: -4, aN: ik(90, 146, 'back'), lN: ik(150, 178) } as Pose),
    ],
    gear: [{ kind: 'band', at: 'hands', from: [163, 174] }],
    hl: BACK_HL,
  },
  'ex-inverted-row': {
    frames: [
      both({ ...plank([8, 176], [140, 147]), aN: ik(140, 96, 'down'), lN: ik(8, 176), fN: 30 } as Pose),
      both({ ...plank([8, 176], [138, 104]), aN: ik(140, 96, 'down'), lN: ik(8, 176), fN: 30 } as Pose),
    ],
    scene: [frame([[164, 40], [164, GROUND]], 6), frame([[140, 92], [164, 92]], 3), { t: 'c', c: [140, 92], rad: 3.5, r: 'equip' }],
    hl: BACK_HL,
    zoom: 0.85,
  },
  'ex-shrug': {
    view: 'front',
    frames: [shrugPose(0, fk(184, 180)), shrugPose(1, fk(184, 180))],
    gear: [{ kind: 'barbellFront', at: 'hands', size: 60 }],
    hl: ['delts'],
  },
  'ex-db-shrug': {
    view: 'front',
    frames: [shrugPose(0, fk(186, 182)), shrugPose(1, fk(186, 182))],
    gear: [{ kind: 'dumbbell', at: 'hN' }, { kind: 'dumbbell', at: 'hF' }],
    hl: ['delts'],
  },
  'ex-back-extension': {
    frames: [
      both({ hip: [100, 118], trunk: 135, head: 150, aN: atNeck(6, -14, 'down'), lN: ik(42, 176) } as Pose),
      both({ hip: [100, 118], trunk: 45, head: 55, aN: atNeck(6, -14, 'down'), lN: ik(42, 176) } as Pose),
    ],
    scene: [
      frame([[34, GROUND], [44, 182], [98, 130]], 5),
      { t: 'c', c: [40, 172], rad: 5, r: 'equip' },
      { t: 'c', c: [108, 126], rad: 7, r: 'equip' },
      frame([[108, 126], [120, GROUND]], 4),
    ],
    hl: ['lowerTrunk', 'glutes'],
  },
  'ex-superman': {
    frames: [
      { hip: [95, 177], trunk: 90, head: 90, aN: fk(90, 90), aF: fk(91, 91), lN: fk(270, 270), lF: fk(269, 269), fN: 180, fF: 180 },
      { hip: [95, 177], trunk: 78, chest: 64, head: 58, aN: fk(62, 62), aF: fk(63, 63), lN: fk(254, 254), lF: fk(253, 253), fN: 170, fF: 170 },
    ],
    hl: ['lowerTrunk', 'glutes'],
    zoom: 0.8,
  },
};

