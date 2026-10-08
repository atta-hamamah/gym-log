import { AnimSpec, GROUND, Pose } from '../rig';
import { atNeck, both, fk, frame, ik, planted, wall } from '../kit';
import { plank, upright, walkCycle } from './common';

const RACK = atNeck(3.1, -4.6, 'up');
const OVERHEAD = atNeck(2, 50, 'back');

// Burpee: hands land at x=150, the feet jump back to x=31 (same plank as the push-up).
const burpeeSquat: Pose = both({ hip: [106, 148], trunk: 60, head: 75, aN: ik(150, 180, 'up'), lN: planted(120) } as Pose);

// Sled: handles at x≈172, the legs drive in place.
const sled = (near: [number, number], far: [number, number], fN: number, fF: number): Pose => ({
  hip: [86, 118], trunk: 60, head: 70,
  aN: ik(170, 102, 'down'), aF: ik(168, 104, 'down'),
  lN: ik(near[0], near[1]), lF: ik(far[0], far[1]), fN, fF,
});

export const FULL_BODY: Record<string, AnimSpec> = {
  'ex-burpee': {
    mode: 'loop',
    frames: [
      both({ hip: [120, 100], trunk: 0, aN: ik(121, 110, 'back'), lN: planted(121) } as Pose),
      burpeeSquat,
      both({ ...plank([31, 172], [150, 125]), head: 80, aN: ik(150, 180, 'up'), lN: ik(31, 172), fN: 157 } as Pose),
      burpeeSquat,
      both({ hip: [120, 86], trunk: 0, head: 0, aN: ik(124, -6, 'back'), lN: ik(121, 167), fN: 150 } as Pose),
    ],
    dur: [380, 300, 300, 380, 420],
    hold: [120, 60, 150, 60, 60],
    hl: ['thigh', 'upperTrunk', 'upperArm'],
    zoom: 0.85,
    thumb: 2,
  },
  'ex-kb-swing': {
    frames: [
      both({ hip: [80, 108], trunk: 62, head: 76, aN: fk(206, 206), lN: planted(100) } as Pose),
      both({ hip: [100, 100], trunk: -4, aN: fk(88, 90), lN: planted(101) } as Pose),
    ],
    dur: 520,
    hold: 80,
    gear: [{ kind: 'kettlebell', at: 'hands' }],
    hl: ['glutes', 'thigh'],
    thumb: 1,
  },
  'ex-thruster': {
    frames: [
      both({ hip: [84, 150], trunk: 24, aN: RACK, lN: planted(101) } as Pose),
      upright(100, { aN: OVERHEAD }),
    ],
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: ['thigh', 'delts'],
    zoom: 0.85,
  },
  'ex-wall-ball': {
    frames: [
      both({ hip: [80, 150], trunk: 26, aN: atNeck(16, -10, 'down'), lN: planted(97) } as Pose),
      upright(100, { aN: atNeck(8, 50, 'back') }),
    ],
    scene: [wall(188), frame([[172, 26], [185, 26]], 3)],
    gear: [{ kind: 'ball', at: 'hands', size: 11 }],
    hl: ['thigh', 'delts'],
    zoom: 0.85,
  },
  'ex-power-clean': {
    mode: 'loop',
    frames: [
      both({ hip: [82, 132], trunk: 60, head: 70, aN: ik(123, 165, 'back'), lN: planted(114) } as Pose),
      both({ hip: [112, 94], trunk: -6, aN: ik(108, 100, 'back'), lN: ik(115, 172), fN: 140, sh: 1 } as Pose),
      both({ hip: [98, 118], trunk: 14, aN: ik(112.4, 72.8, 'up'), lN: planted(112) } as Pose),
    ],
    dur: [420, 260, 700],
    hold: [150, 40, 250],
    gear: [{ kind: 'barbell', at: 'hands', size: 12 }],
    hl: ['glutes', 'thigh', 'delts'],
    thumb: 2,
  },
  'ex-farmer-walk': {
    mode: 'loop',
    linear: true,
    frames: walkCycle(fk(180, 180)),
    dur: 300,
    hold: 0,
    gear: [{ kind: 'dumbbell', at: 'hF', size: 7.5 }, { kind: 'dumbbell', at: 'hN', size: 7.5 }],
    hl: ['forearm', 'delts'],
  },
  'ex-sled-push': {
    mode: 'loop',
    frames: [
      sled([112, 179], [44, 176], 100, 135),
      sled([80, 179], [88, 158], 100, 120),
      sled([44, 176], [112, 179], 135, 100),
      sled([88, 158], [80, 179], 120, 100),
    ],
    dur: 300,
    hold: 0,
    linear: true,
    scene: [
      { t: 'p', pts: [[150, GROUND], [196, GROUND], [196, 160], [150, 160]], r: 'equipLight' },
      frame([[172, 160], [172, 98]], 5),
      frame([[180, 160], [180, 104]], 5),
    ],
    hl: ['thigh', 'glutes'],
  },
};
