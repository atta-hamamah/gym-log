import { AnimSpec, ANKLE_Y, GROUND, Pose } from '../rig';
import { atNeck, bench, both, box, cableTower, fk, frame, ik, inclineBench, planted, seat, sym } from '../kit';
import { ON_INCLINE, lyingOnBench, plank } from './common';

const PRESS_HL: AnimSpec['hl'] = ['upperTrunk', 'upperArm'];

const flatPress = (gear: AnimSpec['gear'], extra: Partial<AnimSpec> = {}): AnimSpec => ({
  frames: [lyingOnBench(ik(78, 84, 'down')), lyingOnBench(ik(84, 124, 'down'))],
  scene: bench(42, 138),
  gear,
  hl: PRESS_HL,
  ...extra,
});

const inclinePose = (hand: [number, number]): Pose => both({ ...ON_INCLINE, aN: ik(hand[0], hand[1], 'down') } as Pose);
const inclinePress = (gear: AnimSpec['gear']): AnimSpec => ({
  frames: [inclinePose([82, 52]), inclinePose([93, 98])],
  scene: inclineBench(112, 142, 150, 50),
  gear,
  hl: PRESS_HL,
});

// Decline bench: hips higher than the head, legs hooked over the foot pad.
const declinePose = (hand: [number, number]): Pose =>
  both({ hip: [118, 128], trunk: -105, head: -108, aN: ik(hand[0], hand[1], 'down'), lN: ik(150, 150, 'up') } as Pose);

const pushup = (ankle: [number, number], hand: [number, number], top: [number, number], bottom: [number, number], extra: Partial<AnimSpec> = {}): AnimSpec => ({
  frames: [
    both({ ...plank(ankle, top), aN: ik(hand[0], hand[1], 'up'), lN: ik(ankle[0], ankle[1]), fN: 157 }),
    both({ ...plank(ankle, bottom), aN: ik(hand[0], hand[1], 'up'), lN: ik(ankle[0], ankle[1]), fN: 157 }),
  ],
  hl: PRESS_HL,
  ...extra,
});

export const CHEST: Record<string, AnimSpec> = {
  'ex-bench-press': flatPress([{ kind: 'barbell', at: 'hands' }]),
  'ex-close-grip-bench': flatPress([{ kind: 'barbell', at: 'hands' }], { hl: ['upperArm'] }),
  'ex-db-bench': flatPress([{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }]),
  'ex-smith-bench': flatPress([{ kind: 'barbell', at: 'hands' }], {
    scene: [frame([[81, 18], [81, GROUND]], 4), ...bench(42, 138)],
  }),
  'ex-incline-bench': inclinePress([{ kind: 'barbell', at: 'hands' }]),
  'ex-incline-db': inclinePress([{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }]),
  'ex-decline-bench': {
    frames: [declinePose([77, 82]), declinePose([84, 122])],
    scene: [
      frame([[52, 156], [52, GROUND]], 3),
      frame([[122, 140], [122, GROUND]], 3),
      { t: 'l', a: [40, 160], b: [132, 136], w: 8, r: 'equip' },
      { t: 'c', c: [152, 156], rad: 5, r: 'equip' },
      frame([[152, 156], [140, GROUND]], 3),
    ],
    gear: [{ kind: 'barbell', at: 'hands' }],
    hl: PRESS_HL,
  },
  'ex-floor-press': {
    frames: [
      both({ hip: [122, 176], trunk: -90, head: -92, aN: ik(78, 120, 'down'), lN: ik(150, ANKLE_Y, 'up') } as Pose),
      both({ hip: [122, 176], trunk: -90, head: -92, aN: ik(84, 150, 'fwd'), lN: ik(150, ANKLE_Y, 'up') } as Pose),
    ],
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: PRESS_HL,
  },
  'ex-machine-chest-press': {
    frames: [
      both({ hip: [95, 131], trunk: -6, aN: atNeck(14, -12, 'down'), lN: ik(132, ANKLE_Y) } as Pose),
      both({ hip: [95, 131], trunk: -6, aN: atNeck(55, -10, 'down'), lN: ik(132, ANKLE_Y) } as Pose),
    ],
    scene: seat(80, 112, 140, { x: 82, top: 58, lean: 6 }),
    gear: [{ kind: 'lever', at: 'hN', from: [118, 24] }],
    hl: PRESS_HL,
  },
  // Flyes seen from the side: the arms swing towards the camera, so they shorten and flip below the shoulder.
  'ex-db-fly': {
    frames: [lyingOnBench(fk(2, 6), { kN: 1, kF: 1 }), lyingOnBench(fk(2, 10), { kN: -0.2, kF: -0.2, jN: -0.5, jF: -0.5 })],
    scene: bench(42, 138),
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: ['upperTrunk'],
  },
  'ex-incline-db-fly': {
    frames: [
      both({ ...ON_INCLINE, aN: fk(4, 8), kN: 1, kF: 1 } as Pose),
      both({ ...ON_INCLINE, aN: fk(4, 12), kN: 0.05, kF: 0.05, jN: -0.3, jF: -0.3 } as Pose),
    ],
    scene: inclineBench(112, 142, 150, 50),
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: ['upperTrunk'],
  },
  'ex-cable-cross': {
    view: 'front',
    frames: [
      sym({ hip: [100, 100], trunk: 0, aN: fk(-58, -50), lN: planted(91) }),
      sym({ hip: [100, 100], trunk: 0, aN: fk(158, 172), kN: 0.95, lN: planted(91) }),
    ],
    scene: [...cableTower(10, 36), ...cableTower(190, 36)],
    gear: [{ kind: 'cable', at: 'hN', from: [16, 36] }, { kind: 'cable', at: 'hF', from: [184, 36] }],
    hl: ['upperTrunk'],
  },
  'ex-low-cable-fly': {
    view: 'front',
    frames: [
      sym({ hip: [100, 100], trunk: 0, aN: fk(-140, -145), lN: planted(91) }),
      sym({ hip: [100, 100], trunk: 0, aN: fk(150, 155), kN: 0.55, lN: planted(91) }),
    ],
    scene: [...cableTower(10, 172), ...cableTower(190, 172)],
    gear: [{ kind: 'cable', at: 'hN', from: [16, 172] }, { kind: 'cable', at: 'hF', from: [184, 172] }],
    hl: ['upperTrunk'],
  },
  'ex-pec-deck': {
    view: 'front',
    frames: [
      sym({ hip: [100, 128], trunk: 0, aN: fk(-90, 0), jN: 1, kN: 1, lN: ik(84, ANKLE_Y), qN: 0.45 }),
      sym({ hip: [100, 128], trunk: 0, aN: fk(-90, 0), jN: 1, kN: -0.2, lN: ik(84, ANKLE_Y), qN: 0.45 }),
    ],
    scene: [
      { t: 'p', pts: [[78, 40], [122, 40], [122, 132], [78, 132]], r: 'equipLight' },
      frame([[100, 140], [100, GROUND]], 5),
      { t: 'l', a: [74, 140], b: [126, 140], w: 8, r: 'equip' },
    ],
    gear: [{ kind: 'pad', at: 'eN', size: 6 }, { kind: 'pad', at: 'eF', size: 6 }],
    hl: ['upperTrunk'],
  },
  'ex-chest-dips': {
    frames: [
      both({ hip: [84, 78], trunk: 20, aN: ik(100, 88, 'back'), lN: fk(172, 245) } as Pose),
      both({ hip: [81, 116], trunk: 30, aN: ik(100, 88, 'back'), lN: fk(175, 250) } as Pose),
    ],
    scene: [frame([[100, 92], [124, 92], [124, GROUND]], 4), { t: 'c', c: [100, 92], rad: 3.5, r: 'equip' }],
    hl: PRESS_HL,
  },
  'ex-pushup': pushup([31, 172], [150, 180], [150, 125], [160, 165]),
  'ex-diamond-pushup': { ...pushup([35, 172], [142, 180], [143, 125], [152, 165]), hl: ['upperArm'] },
  'ex-incline-pushup': pushup([50, 176], [152, 140], [141, 85], [158, 106], { scene: box(130, 55, 34) }),
  'ex-decline-pushup': pushup([30, 126], [150, 180], [150, 122], [158, 160], { scene: box(8, 45, 55) }),
  'ex-db-pullover': {
    frames: [lyingOnBench(fk(6, 12)), lyingOnBench(fk(-112, -100))],
    scene: bench(42, 138),
    gear: [{ kind: 'dumbbell', at: 'hands', size: 8 }],
    hl: ['upperTrunk', 'upperArm'],
  },
};

