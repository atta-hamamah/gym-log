import { AnimSpec, GROUND, Limb, Pose, Vec } from '../rig';
import { atHead, atNeck, both, cableTower, fk, frame, ik, planted, seat, sym } from '../kit';
import { upright } from './common';

const DELTS: AnimSpec['hl'] = ['delts', 'upperArm'];

const RACK = atNeck(9, -1, 'down');
const LOCKOUT = atNeck(1, 50, 'back');

// Seated front view on an upright bench (dumbbell and Arnold presses).
const seatedFront = (aN: Limb, over: Partial<Pose> = {}): Pose =>
  sym({ hip: [100, 128], trunk: 0, aN, lN: ik(82, 181), qN: 0.45, ...over });
const UPRIGHT_BENCH: AnimSpec['scene'] = [
  { t: 'p', pts: [[80, 50], [120, 50], [120, 132], [80, 132]], r: 'equipLight' },
  frame([[100, 140], [100, GROUND]], 5),
  { t: 'l', a: [74, 140], b: [126, 140], w: 8, r: 'equip' },
];
const TWO_DB: AnimSpec['gear'] = [{ kind: 'dumbbell', at: 'hN' }, { kind: 'dumbbell', at: 'hF' }];

const standFront = (aN: Limb, over: Partial<Pose> = {}): Pose =>
  sym({ hip: [100, 100], trunk: 0, aN, lN: planted(92), ...over });

// Landmine: the bar end moves on a circle around the floor pivot.
const LM_PIVOT: Vec = [188, GROUND];
const lmEnd = (elev: number): Limb => {
  const r = (elev * Math.PI) / 180;
  return ik(LM_PIVOT[0] - 150 * Math.cos(r), LM_PIVOT[1] - 150 * Math.sin(r), 'down');
};

// Bent-over hinge used by the rear delt fly.
const bentOver = (aN: Limb, k: number): Pose =>
  both({ hip: [84, 104], trunk: 72, head: 84, aN, lN: planted(100), kN: k, kF: k } as Pose);

export const SHOULDERS: Record<string, AnimSpec> = {
  'ex-ohp': {
    frames: [upright(100, { aN: RACK }), upright(100, { aN: LOCKOUT })],
    gear: [{ kind: 'barbell', at: 'hands', size: 12 }],
    hl: DELTS,
    zoom: 0.85,
    thumb: 1,
  },
  'ex-push-press': {
    mode: 'loop',
    frames: [
      upright(100, { aN: RACK }),
      both({ hip: [100, 112], trunk: 0, aN: RACK, lN: planted(101) } as Pose),
      upright(100, { aN: LOCKOUT }),
    ],
    dur: [550, 300, 750],
    gear: [{ kind: 'barbell', at: 'hands', size: 12 }],
    hl: DELTS,
    zoom: 0.85,
    thumb: 2,
  },
  'ex-db-shoulder-press': {
    view: 'front',
    frames: [seatedFront(fk(272, 0)), seatedFront(fk(-14, 6))],
    scene: UPRIGHT_BENCH,
    gear: TWO_DB,
    hl: ['delts'],
  },
  'ex-arnold-press': {
    view: 'front',
    frames: [
      seatedFront(fk(150, 0), { kN: 0.3, jN: 1 }),
      seatedFront(fk(272, 0)),
      seatedFront(fk(-14, 6)),
    ],
    scene: UPRIGHT_BENCH,
    gear: TWO_DB,
    hl: ['delts'],
  },
  'ex-machine-shoulder-press': {
    frames: [
      both({ hip: [92, 130], trunk: -4, aN: atNeck(8, -2, 'down'), lN: ik(128, 181) } as Pose),
      both({ hip: [92, 130], trunk: -4, aN: atNeck(3, 48, 'back'), lN: ik(128, 181) } as Pose),
    ],
    scene: [...seat(72, 110, 140, { x: 76, top: 40, lean: 6 }), frame([[62, 20], [62, GROUND]], 6)],
    gear: [{ kind: 'lever', at: 'hN', from: [62, 66], size: 4, layer: 'back' }],
    hl: DELTS,
  },
  'ex-landmine-press': {
    frames: [
      both({ hip: [88, 100], trunk: 8, aN: lmEnd(54), lN: planted(104), lF: ik(70, 177), fF: 135 } as Pose),
      both({ hip: [90, 100], trunk: 10, aN: lmEnd(72), lN: planted(104), lF: ik(70, 177), fF: 135 } as Pose),
    ],
    gear: [{ kind: 'landmine', at: 'hands', from: LM_PIVOT, size: -18 }],
    hl: ['delts', 'upperTrunk'],
  },
  'ex-pike-pushup': {
    frames: [
      both({ hip: [88, 104], trunk: 132, head: 160, aN: ik(146, 180, 'back'), lN: ik(46, 178), fN: 125 } as Pose),
      both({ hip: [92, 106], trunk: 160, head: 182, aN: ik(146, 180, 'back'), lN: ik(46, 178), fN: 125 } as Pose),
    ],
    hl: DELTS,
  },
  'ex-lateral-raise': {
    view: 'front',
    frames: [standFront(fk(186, 184)), standFront(fk(268, 274))],
    gear: TWO_DB,
    hl: ['delts'],
    thumb: 1,
  },
  'ex-cable-lateral-raise': {
    view: 'front',
    frames: [
      { ...standFront(fk(162, 164)), aF: fk(172, 176) },
      { ...standFront(fk(266, 272)), aF: fk(172, 176) },
    ],
    scene: cableTower(186, 176),
    gear: [{ kind: 'cable', at: 'hN', from: [180, 176] }],
    hl: ['delts'],
    thumb: 1,
  },
  'ex-front-raise': {
    frames: [upright(100, { aN: fk(170, 172) }), upright(100, { aN: fk(88, 90) })],
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: ['delts'],
    thumb: 1,
  },
  'ex-upright-row': {
    view: 'front',
    frames: [standFront(fk(170, 175)), standFront(fk(282, 100))],
    gear: [{ kind: 'barbellFront', at: 'hands', size: 48 }],
    hl: ['delts'],
    thumb: 1,
  },
  'ex-rear-delt-fly': {
    frames: [bentOver(fk(180, 182), 1), bentOver(fk(186, 190), 0.2)],
    gear: [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }],
    hl: ['delts'],
  },
  'ex-reverse-pec-deck': {
    view: 'front',
    frames: [
      sym({ hip: [100, 128], trunk: 0, aN: fk(270, 270), kN: -0.24, lN: ik(82, 181), qN: 0.45 }),
      sym({ hip: [100, 128], trunk: 0, aN: fk(270, 272), kN: 1, lN: ik(82, 181), qN: 0.45 }),
    ],
    scene: UPRIGHT_BENCH,
    gear: [{ kind: 'handle', at: 'hN', size: 3.5 }, { kind: 'handle', at: 'hF', size: 3.5 }],
    hl: ['delts', 'upperTrunk'],
    thumb: 1,
  },
  'ex-face-pull': {
    frames: [
      both({ hip: [92, 100], trunk: -6, aN: ik(146, 52, 'down'), lN: planted(96) } as Pose),
      both({ hip: [92, 100], trunk: -8, aN: atHead(6, -2, 'back'), lN: planted(96), kN: 0.6, kF: 0.6 } as Pose),
    ],
    scene: cableTower(182, 46),
    gear: [{ kind: 'cable', at: 'hands', from: [176, 46] }],
    hl: ['delts', 'upperTrunk'],
    thumb: 1,
  },
  'ex-band-pull-apart': {
    view: 'front',
    frames: [standFront(fk(270, 270), { kN: -0.22 }), standFront(fk(270, 270))],
    gear: [{ kind: 'span', at: 'hN', to: 'hF', size: 3 }],
    hl: ['delts', 'upperTrunk'],
    thumb: 1,
  },
};
