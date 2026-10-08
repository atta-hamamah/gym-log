import { AnimSpec, ANKLE_Y } from '../rig';
import { atNeck, bench, both, fk, ik, planted, pullupBar, standing, sym } from '../kit';

export const CALIB: Record<string, AnimSpec> = {
  'ex-squat': {
    frames: [
      both(standing(100, { aN: atNeck(-5, 1, 'down') }) as any),
      both({ hip: [79, 146], trunk: 42, aN: atNeck(-5, 1, 'down'), lN: planted(101) }),
    ],
    gear: [{ kind: 'barbell', at: 'nape' }],
    hl: ['thigh', 'glutes'],
    thumb: 1,
  },
  'ex-bench-press': {
    frames: [
      both({ hip: [122, 140], trunk: -90, head: -95, aN: ik(78, 84, 'down'), lN: ik(152, ANKLE_Y, 'fwd') }),
      both({ hip: [122, 140], trunk: -90, head: -95, aN: ik(84, 124, 'down'), lN: ik(152, ANKLE_Y, 'fwd') }),
    ],
    scene: bench(42, 138),
    gear: [{ kind: 'barbell', at: 'hands' }],
    hl: ['upperTrunk', 'upperArm'],
  },
  'ex-pull-ups': {
    frames: [
      both({ hip: [99, 122], trunk: -2, aN: ik(100, 18, 'fwd'), lN: fk(165, 255) }),
      both({ hip: [104, 82], trunk: -10, head: 0, aN: ik(100, 18, 'fwd'), lN: fk(160, 250) }),
    ],
    scene: pullupBar(100, 14),
    hl: ['upperTrunk', 'upperArm'],
    noGround: true,
  },
  'ex-pushup': {
    frames: [
      both({ hip: [106.7, 140], trunk: 67, head: 75, aN: ik(150, 180, 'up'), lN: ik(31, 172), fN: 157 }),
      both({ hip: [113, 162], trunk: 87, head: 92, aN: ik(150, 180, 'up'), lN: ik(31, 172), fN: 157 }),
    ],
    hl: ['upperTrunk', 'upperArm'],
  },
  'ex-lateral-raise': {
    view: 'front',
    frames: [
      sym({ hip: [100, 100], trunk: 0, aN: fk(186, 184), lN: planted(92) }),
      sym({ hip: [100, 100], trunk: 0, aN: fk(268, 274), lN: planted(92) }),
    ],
    gear: [{ kind: 'dumbbell', at: 'hN' }, { kind: 'dumbbell', at: 'hF' }],
    hl: ['delts'],
    thumb: 1,
  },
  'ex-bb-curl': {
    frames: [
      both(standing(100, { aN: fk(178, 176) }) as any),
      both(standing(100, { aN: fk(168, 22) }) as any),
    ],
    gear: [{ kind: 'barbell', at: 'hands' }],
    hl: ['upperArm'],
    thumb: 1,
  },
  'ex-outdoor-run': {
    mode: 'loop',
    dur: 230,
    hold: 0,
    frames: [
      { hip: [100, 97], trunk: 10, aN: fk(212, 125), aF: fk(150, 60), lN: fk(148, 172), lF: fk(208, 255) },
      { hip: [100, 101], trunk: 10, aN: fk(185, 100), aF: fk(178, 95), lN: fk(176, 184), lF: fk(170, 245) },
      { hip: [100, 97], trunk: 10, aF: fk(212, 125), aN: fk(150, 60), lF: fk(148, 172), lN: fk(208, 255) },
      { hip: [100, 101], trunk: 10, aF: fk(185, 100), aN: fk(178, 95), lF: fk(176, 184), lN: fk(170, 245) },
    ],
  },
};
