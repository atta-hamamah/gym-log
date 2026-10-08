import { AnimSpec, ANKLE_Y, GROUND, Pose } from '../rig';
import { bench, both, cableTower, fk, frame, ik, inclineBench, planted, pullupBar, seat } from '../kit';
import { ON_INCLINE, SEATED, lyingOnBench, upright } from './common';

const BICEPS: AnimSpec['hl'] = ['upperArm'];
const TRICEPS: AnimSpec['hl'] = ['upperArm'];
const FOREARMS: AnimSpec['hl'] = ['forearm'];

const DOWN = fk(178, 176);
const UP = fk(168, 22);
const BAR: AnimSpec['gear'] = [{ kind: 'barbell', at: 'hands' }];
const TWO_DB: AnimSpec['gear'] = [{ kind: 'dumbbell', at: 'hF' }, { kind: 'dumbbell', at: 'hN' }];

/** Standing curl, both arms together. */
const curl = (gear: AnimSpec['gear'], extra: Partial<AnimSpec> = {}, x = 100): AnimSpec => ({
  frames: [upright(x, { aN: DOWN }), upright(x, { aN: UP })],
  gear,
  hl: BICEPS,
  thumb: 1,
  ...extra,
});

// Pushdowns: elbows pinned at the sides, the forearms move.
const pushdown = (fore: [number, number]): Pose[] => [
  upright(104, { trunk: 8, aN: fk(172, fore[0]) }),
  upright(104, { trunk: 8, aN: fk(172, fore[1]) }),
];

// One-arm bench support (as in the dumbbell row): far knee and hand on the bench.
const BENCH_SUPPORT = { hip: [80, 100] as [number, number], trunk: 80, head: 90, aF: ik(127, 145, 'back'), lN: ik(66, ANKLE_Y), lF: ik(48, 143, 'down') };
const ROW_BENCH: AnimSpec['scene'] = [
  frame([[48, 150], [48, GROUND]], 3),
  frame([[132, 150], [132, GROUND]], 3),
  { t: 'l', a: [40, 152], b: [140, 152], w: 8, r: 'equip' },
];

// Seated on a bench end, forearms along the thighs (wrist curl).
const wristCurl = (w: number): Pose =>
  both({ hip: [78, 132], trunk: 30, head: 50, aN: ik(126, 125, 'down'), lN: ik(124, ANKLE_Y), wN: w, wF: w } as Pose);

const preacher = (fore: number): Pose =>
  both({ hip: [78, 131], trunk: 14, head: 22, aN: fk(128, fore), lN: ik(118, ANKLE_Y) } as Pose);

const hangPose = (trunk: number, hipX: number): Pose =>
  both({ hip: [hipX, 122], trunk, aN: ik(100, 18, 'fwd'), lN: fk(166, 252) } as Pose);

const benchDip = (hipY: number): Pose =>
  both({ hip: [96, hipY], trunk: 2, aN: ik(84, 136, 'back'), lN: ik(160, 179), fN: 60 } as Pose);

export const ARMS: Record<string, AnimSpec> = {
  // ── Biceps ──────────────────────────────────────────────
  'ex-bb-curl': curl(BAR),
  'ex-ez-curl': curl([{ kind: 'barbell', at: 'hands', size: 11 }]),
  'ex-db-curl': curl(TWO_DB),
  'ex-hammer-curl': {
    mode: 'loop',
    frames: [
      upright(100, { aN: DOWN }),
      { ...upright(100, { aN: DOWN }), aN: UP },
      upright(100, { aN: DOWN }),
      { ...upright(100, { aN: DOWN }), aF: UP },
    ],
    gear: TWO_DB,
    hl: ['upperArm', 'forearm'],
    thumb: 1,
  },
  'ex-incline-db-curl': {
    frames: [
      both({ ...ON_INCLINE, aN: fk(182, 182) } as Pose),
      both({ ...ON_INCLINE, aN: fk(180, 40) } as Pose),
    ],
    scene: inclineBench(112, 142, 150, 50),
    gear: TWO_DB,
    hl: BICEPS,
    thumb: 1,
  },
  'ex-preacher-curl': {
    frames: [preacher(146), preacher(30)],
    scene: [...seat(58, 96, 140), frame([[116, 114], [116, GROUND]], 4), { t: 'l', a: [96, 98], b: [124, 120], w: 7, r: 'equip' }],
    gear: [{ kind: 'barbell', at: 'hands', size: 11 }],
    hl: BICEPS,
    thumb: 1,
  },
  'ex-concentration': {
    frames: [
      { hip: [76, 134], trunk: 40, head: 60, aN: fk(172, 176), aF: ik(124, 136, 'back'), lN: ik(130, ANKLE_Y), lF: ik(122, ANKLE_Y) },
      { hip: [76, 134], trunk: 40, head: 60, aN: fk(172, 30), aF: ik(124, 136, 'back'), lN: ik(130, ANKLE_Y), lF: ik(122, ANKLE_Y) },
    ],
    scene: bench(30, 96, 142),
    gear: [{ kind: 'dumbbell', at: 'hN' }],
    hl: BICEPS,
    thumb: 1,
  },
  'ex-cable-curl': curl([{ kind: 'cable', at: 'hands', from: [172, 176] }, { kind: 'handle', at: 'hands', size: 3.5 }], {
    scene: cableTower(178, 176),
  }, 96),
  'ex-band-curl': curl([{ kind: 'band', at: 'hands', from: [106, 183] }]),

  // ── Triceps ─────────────────────────────────────────────
  'ex-tri-pushdown': {
    frames: pushdown([42, 174]),
    scene: cableTower(184, 26),
    gear: [{ kind: 'cable', at: 'hands', from: [178, 26] }, { kind: 'handle', at: 'hands', size: 3.5 }],
    hl: TRICEPS,
    thumb: 1,
  },
  'ex-rope-pushdown': {
    view: 'front',
    frames: [
      { hip: [100, 100], trunk: 0, aN: fk(178, 150), aF: fk(182, 210), lN: planted(92), lF: planted(108), jN: 0.45, jF: 0.45 },
      { hip: [100, 100], trunk: 0, aN: fk(178, 196), aF: fk(182, 164), lN: planted(92), lF: planted(108) },
    ],
    gear: [{ kind: 'cable', at: 'hands', from: [100, 8] }, { kind: 'span', at: 'hN', to: 'hF', size: 3.5 }],
    hl: TRICEPS,
    thumb: 1,
  },
  'ex-skull-crusher': {
    frames: [lyingOnBench(fk(-10, -6)), lyingOnBench(fk(-20, -140))],
    scene: bench(42, 138),
    gear: [{ kind: 'barbell', at: 'hands', size: 11 }],
    hl: TRICEPS,
  },
  'ex-overhead-ext': {
    frames: [
      both({ ...SEATED, aN: fk(-6, -4) } as Pose),
      both({ ...SEATED, aN: fk(-10, -164) } as Pose),
    ],
    scene: seat(78, 112, 140),
    gear: [{ kind: 'dumbbell', at: 'hands', size: 8 }],
    hl: TRICEPS,
  },
  'ex-cable-overhead-ext': {
    frames: [
      { hip: [96, 100], trunk: 28, head: 40, aN: fk(30, 212), aF: fk(31, 212), lN: planted(124), lF: ik(70, 177), fF: 140 },
      { hip: [96, 100], trunk: 28, head: 40, aN: fk(34, 40), aF: fk(35, 41), lN: planted(124), lF: ik(70, 177), fF: 140 },
    ],
    scene: cableTower(14, 64),
    gear: [{ kind: 'cable', at: 'hands', from: [20, 64] }],
    hl: TRICEPS,
    thumb: 1,
  },
  'ex-db-kickback': {
    frames: [
      { ...BENCH_SUPPORT, aN: fk(256, 176) },
      { ...BENCH_SUPPORT, aN: fk(256, 260) },
    ],
    scene: ROW_BENCH,
    gear: [{ kind: 'dumbbell', at: 'hN' }],
    hl: TRICEPS,
    thumb: 1,
  },
  'ex-tri-dips': {
    frames: [
      both({ hip: [96, 84], trunk: 2, aN: ik(101, 92, 'back'), lN: fk(172, 236) } as Pose),
      both({ hip: [93, 114], trunk: 6, aN: ik(101, 92, 'back'), lN: fk(172, 236) } as Pose),
    ],
    scene: [frame([[101, 96], [126, 96], [126, GROUND]], 4), { t: 'c', c: [101, 96], rad: 3.5, r: 'equip' }],
    hl: TRICEPS,
  },
  'ex-bench-dips': {
    frames: [benchDip(128), benchDip(156)],
    scene: bench(22, 88, 140),
    hl: TRICEPS,
  },

  // ── Forearms ────────────────────────────────────────────
  'ex-wrist-curl': {
    frames: [wristCurl(55), wristCurl(-40)],
    scene: bench(30, 96, 142),
    gear: [{ kind: 'dumbbell', at: 'hN' }],
    hl: FOREARMS,
    thumb: 1,
  },
  'ex-reverse-curl': curl(BAR, { hl: FOREARMS }),
  'ex-dead-hang': {
    frames: [hangPose(-3, 99), hangPose(2, 101)],
    dur: 1600,
    scene: pullupBar(100, 14),
    hl: FOREARMS,
    noGround: true,
  },
};
