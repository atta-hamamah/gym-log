import { AnimSpec, GROUND, Limb, Pose, Vec } from '../rig';
import { atHip, bench, both, cableTower, fk, ik, planted, sym } from '../kit';
import { allFours, hipFromNeck } from './common';

const GLUTES: AnimSpec['hl'] = ['glutes', 'thigh'];

// Hip thrust: upper back on the bench edge, the body pivots around the shoulders.
const THRUST_NECK: Vec = [68, 131];
const thrust = (trunk: number): Pose =>
  both({ hip: hipFromNeck(THRUST_NECK, trunk), trunk, head: trunk + 32, aN: atHip(13, 6, 'down'), lN: planted(146) } as Pose);

// Glute bridge: shoulders stay on the floor.
const BRIDGE_NECK: Vec = [54, 176];
const bridge = (trunk: number, lF?: Limb): Pose =>
  both({ hip: hipFromNeck(BRIDGE_NECK, trunk), trunk, head: -92, aN: fk(94, 92), lN: planted(138, 181), ...(lF ? { lF } : {}) } as Pose);


const seatedFront = (knee: Limb): Pose =>
  sym({ hip: [100, 128], trunk: 0, aN: fk(196, 176), lN: knee, qN: 0.5 });

const MACHINE_FRONT: AnimSpec['scene'] = [
  { t: 'p', pts: [[78, 46], [122, 46], [122, 132], [78, 132]], r: 'equipLight' },
  { t: 'l', a: [100, 140], b: [100, GROUND], w: 5, r: 'equipLight' },
  { t: 'l', a: [72, 140], b: [128, 140], w: 8, r: 'equip' },
];

export const GLUTE_ANIMS: Record<string, AnimSpec> = {
  'ex-hip-thrust': {
    frames: [thrust(-48), thrust(-88)],
    scene: bench(14, 74, 136),
    gear: [{ kind: 'barbell', at: 'hands', size: 12 }],
    hl: GLUTES,
    thumb: 1,
  },
  'ex-glute-bridge': {
    frames: [bridge(-90), bridge(-112)],
    hl: GLUTES,
    thumb: 1,
  },
  'ex-single-leg-bridge': {
    frames: [bridge(-90, fk(40, 42)), bridge(-112, fk(52, 54))],
    hl: GLUTES,
    thumb: 1,
  },
  'ex-cable-pull-through': {
    frames: [
      both({ hip: [72, 106], trunk: 70, head: 82, aN: fk(200, 200), lN: planted(98) } as Pose),
      both({ hip: [96, 100], trunk: -2, aN: fk(168, 168), lN: planted(98) } as Pose),
    ],
    scene: cableTower(12, 170),
    gear: [{ kind: 'cable', at: 'hands', from: [18, 170] }],
    hl: GLUTES,
  },
  'ex-cable-kickback': {
    frames: [
      { hip: [106, 100], trunk: 22, aN: ik(168, 74, 'down'), aF: ik(167, 76, 'down'), lN: fk(176, 182), lF: planted(108) },
      { hip: [106, 100], trunk: 26, aN: ik(168, 74, 'down'), aF: ik(167, 76, 'down'), lN: fk(214, 228), lF: planted(108), fN: 150 },
    ],
    scene: cableTower(184, 176),
    gear: [{ kind: 'cable', at: 'aN', from: [178, 176] }],
    hl: ['glutes'],
    thumb: 1,
  },
  'ex-donkey-kick': {
    frames: [
      allFours(80),
      allFours(80, { lN: fk(282, 12), fN: 100 }),
    ],
    hl: ['glutes'],
    thumb: 1,
  },
  'ex-hip-abduction': {
    view: 'front',
    frames: [seatedFront(ik(86, 176)), seatedFront(ik(58, 170))],
    scene: MACHINE_FRONT,
    gear: [{ kind: 'pad', at: 'kN', off: [-6, 0], size: 5 }, { kind: 'pad', at: 'kF', off: [6, 0], size: 5 }],
    hl: ['glutes', 'thigh'],
    thumb: 1,
  },
};
