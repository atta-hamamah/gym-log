import { AnimSpec, Pose } from '../rig';
import { atHip, both, fk, frame, ik, planted } from '../kit';
import { SHIN_BACK, allFours, kneelHip, upright } from './common';

const circle = (a: number): Pose => upright(100, { aN: fk(a, a) });

// Child's pose: sitting back on the heels, chest down, arms long.
const childsPose = (hipX: number, trunk: number): Pose =>
  both({ hip: [hipX, 150], trunk, head: trunk + 28, aN: ik(182, 178, 'up'), lN: ik(68, 178, 'fwd'), fN: 265 } as Pose);

const downDog = (hip: [number, number], trunk: number): Pose =>
  both({ hip, trunk, head: trunk + 18, aN: ik(162, 180, 'up'), lN: ik(58, 181) } as Pose);

const cobra = (trunk: number, chest: number, head: number): Pose =>
  both({ hip: [100, 177], trunk, chest, head, aN: ik(138, 180, 'back'), lN: fk(270, 270), fN: 270 } as Pose);

// Half-kneeling hip flexor stretch: back (far) knee on the floor at x=80.
const halfKneel = (thigh: number, trunk: number): Pose => ({
  hip: kneelHip(80, thigh), trunk, aN: atHip(4, 8, 'back'), aF: atHip(3, 8, 'back'),
  lN: planted(134), lF: SHIN_BACK(80), fF: 268,
});

const quadStretch = (thigh: number): Pose => ({
  hip: [100, 100], trunk: 2, aN: ik(85, 106, 'back'), aF: fk(110, 100),
  lN: fk(thigh, 345), lF: planted(99), fN: 300,
});

// Pigeon: front (near) shin folded under the body, back leg long behind.
const pigeon = (trunk: number, hand: [number, number]): Pose => ({
  hip: [104, 160], trunk, head: trunk + 10,
  aN: ik(hand[0], hand[1], 'back'), aF: ik(hand[0] - 2, hand[1], 'back'),
  lN: fk(110, 262), lF: fk(254, 260), fN: 262, fF: 270,
});

export const MOBILITY: Record<string, AnimSpec> = {
  'ex-arm-circles': {
    mode: 'loop',
    linear: true,
    frames: [circle(180), circle(270), circle(0), circle(90)],
    dur: 260,
    hold: 0,
    hl: ['delts'],
    zoom: 0.85,
    thumb: 3,
  },
  'ex-leg-swings': {
    frames: [
      both({ hip: [98, 100], trunk: -4, aN: ik(150, 74, 'down'), lN: fk(136, 146), lF: planted(97), fN: 70 } as Pose),
      both({ hip: [98, 100], trunk: 6, aN: ik(150, 74, 'down'), lN: fk(214, 218), lF: planted(97), fN: 140 } as Pose),
    ],
    dur: 600,
    hold: 40,
    scene: [frame([[156, 60], [156, 184]], 6)],
    hl: ['thigh'],
  },
  'ex-cat-cow': {
    frames: [
      allFours(80, { trunk: 60, chest: 104, head: 150 }),
      allFours(80, { trunk: 96, chest: 66, head: 40 }),
    ],
    dur: 1100,
    hold: 300,
    hl: ['lowerTrunk', 'upperTrunk'],
  },
  'ex-childs-pose': {
    frames: [childsPose(78, 108), childsPose(74, 112)],
    dur: 1600,
    hl: ['lowerTrunk', 'upperTrunk'],
  },
  'ex-downward-dog': {
    frames: [downDog([90, 108], 135), downDog([86, 106], 138)],
    dur: 1400,
    hl: ['thigh', 'shin'],
  },
  'ex-cobra': {
    frames: [cobra(90, 90, 96), cobra(62, 26, 12)],
    dur: 1100,
    hold: 300,
    hl: ['lowerTrunk'],
    thumb: 1,
  },
  'ex-hip-flexor-stretch': {
    frames: [halfKneel(0, 0), halfKneel(22, -6)],
    dur: 1200,
    hold: 300,
    hl: ['thigh'],
    thumb: 1,
  },
  'ex-hamstring-stretch': {
    frames: [
      both({ hip: [92, 100], trunk: 0, aN: ik(93, 110, 'back'), lN: planted(100) } as Pose),
      both({ hip: [90, 100], trunk: 138, head: 165, aN: ik(110, 176, 'back'), lN: planted(100) } as Pose),
    ],
    dur: 1200,
    hold: 400,
    hl: ['thigh'],
    thumb: 1,
  },
  'ex-quad-stretch': {
    frames: [quadStretch(182), quadStretch(192)],
    dur: 1300,
    hl: ['thigh'],
  },
  'ex-pigeon-stretch': {
    frames: [pigeon(20, [132, 174]), pigeon(76, [186, 178])],
    dur: 1300,
    hold: 300,
    hl: ['glutes'],
    thumb: 1,
  },
};
