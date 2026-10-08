/**
 * Built-in exercise library — the single source of truth shared by the app
 * and the Convex AI functions (keep this file free of React Native imports).
 *
 * `equipment` lists what is required; an empty list means it can be done
 * with no equipment. Optional extras (e.g. holding dumbbells for lunges)
 * are not listed, so bodyweight-only users still get those exercises.
 */
import type { Equipment, Exercise, ExperienceLevel, Muscle, TrackingType } from '../types';

type Opts = {
  sec?: Muscle[];
  lvl?: ExperienceLevel;
  mech?: 'compound' | 'isolation';
  track?: TrackingType;
  cat?: Exercise['category'];
};

function ex(
  id: string,
  name: string,
  muscleGroup: string,
  equipment: Equipment[],
  primary: Muscle[],
  o: Opts = {},
): Exercise {
  const cardio = muscleGroup === 'Cardio';
  const mobility = muscleGroup === 'Mobility';
  return {
    id,
    name,
    category: o.cat ?? (cardio ? 'cardio' : mobility ? 'flexibility' : 'strength'),
    muscleGroup,
    isCustom: false,
    equipment,
    primaryMuscles: primary,
    secondaryMuscles: o.sec ?? [],
    level: o.lvl ?? 'beginner',
    mechanic: o.mech ?? (cardio || mobility ? 'compound' : 'isolation'),
    tracking: o.track ?? (cardio ? 'cardio' : mobility ? 'time' : 'weight_reps'),
  };
}

const C = 'compound' as const;
const I = 'intermediate' as const;
const A = 'advanced' as const;

export const EXERCISE_CATALOG: Exercise[] = [
  // ── CHEST ─────────────────────────────────────────────
  ex('ex-bench-press', 'Barbell Bench Press', 'Chest', ['barbell', 'bench', 'rack'], ['chest'], { sec: ['front_delts', 'triceps'], mech: C, lvl: I }),
  ex('ex-incline-bench', 'Incline Barbell Bench Press', 'Chest', ['barbell', 'bench', 'rack'], ['upper_chest'], { sec: ['front_delts', 'triceps'], mech: C, lvl: I }),
  ex('ex-decline-bench', 'Decline Bench Press', 'Chest', ['barbell', 'bench', 'rack'], ['chest'], { sec: ['triceps', 'front_delts'], mech: C, lvl: I }),
  ex('ex-db-bench', 'Dumbbell Bench Press', 'Chest', ['dumbbell', 'bench'], ['chest'], { sec: ['front_delts', 'triceps'], mech: C }),
  ex('ex-incline-db', 'Incline Dumbbell Press', 'Chest', ['dumbbell', 'bench'], ['upper_chest'], { sec: ['front_delts', 'triceps'], mech: C }),
  ex('ex-smith-bench', 'Smith Machine Bench Press', 'Chest', ['smith', 'bench'], ['chest'], { sec: ['front_delts', 'triceps'], mech: C }),
  ex('ex-machine-chest-press', 'Machine Chest Press', 'Chest', ['machine'], ['chest'], { sec: ['front_delts', 'triceps'], mech: C }),
  ex('ex-floor-press', 'Dumbbell Floor Press', 'Chest', ['dumbbell'], ['chest'], { sec: ['triceps', 'front_delts'], mech: C }),
  ex('ex-db-fly', 'Dumbbell Fly', 'Chest', ['dumbbell', 'bench'], ['chest'], { sec: ['front_delts'] }),
  ex('ex-incline-db-fly', 'Incline Dumbbell Fly', 'Chest', ['dumbbell', 'bench'], ['upper_chest'], { sec: ['front_delts'], lvl: I }),
  ex('ex-cable-cross', 'Cable Crossovers', 'Chest', ['cable'], ['chest'], { sec: ['front_delts'], lvl: I }),
  ex('ex-low-cable-fly', 'Low-to-High Cable Fly', 'Chest', ['cable'], ['upper_chest'], { sec: ['front_delts'], lvl: I }),
  ex('ex-pec-deck', 'Pec Deck Fly', 'Chest', ['machine'], ['chest'], { sec: ['front_delts'] }),
  ex('ex-chest-dips', 'Chest Dips', 'Chest', ['dip_bars'], ['chest'], { sec: ['triceps', 'front_delts'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-pushup', 'Push-Up', 'Chest', [], ['chest'], { sec: ['triceps', 'front_delts', 'abs'], mech: C, track: 'reps' }),
  ex('ex-incline-pushup', 'Incline Push-Up', 'Chest', ['bench'], ['chest'], { sec: ['triceps', 'front_delts'], mech: C, track: 'reps' }),
  ex('ex-decline-pushup', 'Decline Push-Up', 'Chest', ['bench'], ['upper_chest'], { sec: ['triceps', 'front_delts'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-db-pullover', 'Dumbbell Pullover', 'Chest', ['dumbbell', 'bench'], ['chest', 'lats'], { sec: ['triceps'], lvl: I }),

  // ── BACK ──────────────────────────────────────────────
  ex('ex-deadlift', 'Deadlift', 'Back', ['barbell'], ['lower_back', 'glutes', 'hamstrings'], { sec: ['traps', 'quads', 'forearms', 'lats'], mech: C, lvl: I }),
  ex('ex-sumo-deadlift', 'Sumo Deadlift', 'Back', ['barbell'], ['glutes', 'adductors', 'lower_back'], { sec: ['quads', 'hamstrings', 'traps', 'forearms'], mech: C, lvl: I }),
  ex('ex-trap-bar-deadlift', 'Trap Bar Deadlift', 'Back', ['trap_bar'], ['quads', 'glutes'], { sec: ['hamstrings', 'lower_back', 'traps', 'forearms'], mech: C }),
  ex('ex-rack-pull', 'Rack Pull', 'Back', ['barbell', 'rack'], ['lower_back', 'traps'], { sec: ['glutes', 'hamstrings', 'upper_back', 'forearms'], mech: C, lvl: I }),
  ex('ex-pull-ups', 'Pull Ups', 'Back', ['pullup_bar'], ['lats'], { sec: ['biceps', 'upper_back', 'forearms'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-chinups', 'Chin Ups', 'Back', ['pullup_bar'], ['lats', 'biceps'], { sec: ['upper_back', 'forearms'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-assisted-pullup', 'Assisted Pull-Up', 'Back', ['machine'], ['lats'], { sec: ['biceps', 'upper_back'], mech: C }),
  ex('ex-lat-pulldown', 'Lat Pulldown', 'Back', ['machine'], ['lats'], { sec: ['biceps', 'upper_back'], mech: C }),
  ex('ex-close-grip-pulldown', 'Close-Grip Lat Pulldown', 'Back', ['machine'], ['lats'], { sec: ['biceps', 'upper_back'], mech: C }),
  ex('ex-straight-arm-pulldown', 'Straight-Arm Pulldown', 'Back', ['cable'], ['lats'], { sec: ['triceps', 'abs'], lvl: I }),
  ex('ex-bent-rows', 'Bent Over Rows', 'Back', ['barbell'], ['lats', 'upper_back'], { sec: ['biceps', 'lower_back', 'rear_delts'], mech: C, lvl: I }),
  ex('ex-tbar-row', 'T-Bar Row', 'Back', ['barbell'], ['upper_back', 'lats'], { sec: ['biceps', 'lower_back', 'rear_delts'], mech: C, lvl: I }),
  ex('ex-db-row', 'One-Arm Dumbbell Row', 'Back', ['dumbbell', 'bench'], ['lats'], { sec: ['upper_back', 'biceps', 'rear_delts'], mech: C }),
  ex('ex-chest-supported-row', 'Chest-Supported Dumbbell Row', 'Back', ['dumbbell', 'bench'], ['upper_back'], { sec: ['lats', 'rear_delts', 'biceps'], mech: C }),
  ex('ex-seated-row', 'Seated Cable Row', 'Back', ['cable'], ['upper_back', 'lats'], { sec: ['biceps', 'rear_delts'], mech: C }),
  ex('ex-machine-row', 'Machine Row', 'Back', ['machine'], ['upper_back'], { sec: ['lats', 'biceps', 'rear_delts'], mech: C }),
  ex('ex-band-row', 'Resistance Band Row', 'Back', ['band'], ['upper_back'], { sec: ['lats', 'biceps', 'rear_delts'], mech: C, track: 'reps' }),
  ex('ex-inverted-row', 'Inverted Row', 'Back', ['barbell', 'rack'], ['upper_back'], { sec: ['lats', 'biceps', 'rear_delts', 'abs'], mech: C, track: 'reps' }),
  ex('ex-shrug', 'Barbell Shrug', 'Back', ['barbell'], ['traps'], { sec: ['forearms'] }),
  ex('ex-db-shrug', 'Dumbbell Shrug', 'Back', ['dumbbell'], ['traps'], { sec: ['forearms'] }),
  ex('ex-back-extension', 'Back Extension', 'Back', ['machine'], ['lower_back'], { sec: ['glutes', 'hamstrings'], track: 'reps' }),
  ex('ex-superman', 'Superman', 'Back', [], ['lower_back'], { sec: ['glutes', 'upper_back'], track: 'reps' }),

  // ── LEGS ──────────────────────────────────────────────
  ex('ex-squat', 'Barbell Squat', 'Legs', ['barbell', 'rack'], ['quads', 'glutes'], { sec: ['hamstrings', 'adductors', 'lower_back'], mech: C, lvl: I }),
  ex('ex-front-squat', 'Front Squat', 'Legs', ['barbell', 'rack'], ['quads'], { sec: ['glutes', 'abs', 'upper_back'], mech: C, lvl: A }),
  ex('ex-goblet-squat', 'Goblet Squat', 'Legs', ['dumbbell'], ['quads'], { sec: ['glutes', 'adductors', 'abs'], mech: C }),
  ex('ex-bw-squat', 'Bodyweight Squat', 'Legs', [], ['quads'], { sec: ['glutes'], mech: C, track: 'reps' }),
  ex('ex-smith-squat', 'Smith Machine Squat', 'Legs', ['smith'], ['quads'], { sec: ['glutes', 'hamstrings'], mech: C }),
  ex('ex-hack-squat', 'Hack Squat', 'Legs', ['machine'], ['quads'], { sec: ['glutes'], mech: C }),
  ex('ex-leg-press', 'Leg Press', 'Legs', ['machine'], ['quads'], { sec: ['glutes', 'hamstrings'], mech: C }),
  ex('ex-lunges', 'Lunges', 'Legs', [], ['quads', 'glutes'], { sec: ['hamstrings', 'adductors'], mech: C }),
  ex('ex-walking-lunge', 'Walking Lunge', 'Legs', ['dumbbell'], ['quads', 'glutes'], { sec: ['hamstrings', 'adductors'], mech: C, lvl: I }),
  ex('ex-reverse-lunge', 'Reverse Lunge', 'Legs', [], ['glutes', 'quads'], { sec: ['hamstrings'], mech: C }),
  ex('ex-bulgarian', 'Bulgarian Split Squat', 'Legs', ['bench'], ['quads', 'glutes'], { sec: ['hamstrings', 'adductors'], mech: C, lvl: I }),
  ex('ex-step-up', 'Step-Up', 'Legs', ['box'], ['quads', 'glutes'], { sec: ['hamstrings'], mech: C }),
  ex('ex-pistol-squat', 'Pistol Squat', 'Legs', [], ['quads'], { sec: ['glutes', 'abs'], mech: C, lvl: A, track: 'reps' }),
  ex('ex-jump-squat', 'Jump Squat', 'Legs', [], ['quads'], { sec: ['glutes', 'calves'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-box-jump', 'Box Jump', 'Legs', ['box'], ['quads'], { sec: ['glutes', 'calves'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-wall-sit', 'Wall Sit', 'Legs', [], ['quads'], { sec: ['glutes'], track: 'time' }),
  ex('ex-rdl', 'Romanian Deadlift', 'Legs', ['barbell'], ['hamstrings', 'glutes'], { sec: ['lower_back'], mech: C, lvl: I }),
  ex('ex-db-rdl', 'Dumbbell Romanian Deadlift', 'Legs', ['dumbbell'], ['hamstrings', 'glutes'], { sec: ['lower_back'], mech: C }),
  ex('ex-single-leg-rdl', 'Single-Leg Romanian Deadlift', 'Legs', ['dumbbell'], ['hamstrings', 'glutes'], { sec: ['lower_back', 'abs'], mech: C, lvl: I }),
  ex('ex-good-morning', 'Good Morning', 'Legs', ['barbell', 'rack'], ['hamstrings'], { sec: ['lower_back', 'glutes'], mech: C, lvl: I }),
  ex('ex-leg-curl', 'Leg Curl', 'Legs', ['machine'], ['hamstrings']),
  ex('ex-seated-leg-curl', 'Seated Leg Curl', 'Legs', ['machine'], ['hamstrings']),
  ex('ex-nordic-curl', 'Nordic Hamstring Curl', 'Legs', [], ['hamstrings'], { sec: ['glutes'], lvl: A, track: 'reps' }),
  ex('ex-leg-ext', 'Leg Extension', 'Legs', ['machine'], ['quads']),
  ex('ex-hip-adduction', 'Hip Adduction Machine', 'Legs', ['machine'], ['adductors']),
  ex('ex-calf-raise', 'Calf Raise', 'Legs', [], ['calves']),
  ex('ex-seated-calf-raise', 'Seated Calf Raise', 'Legs', ['machine'], ['calves']),

  // ── GLUTES ────────────────────────────────────────────
  ex('ex-hip-thrust', 'Barbell Hip Thrust', 'Glutes', ['barbell', 'bench'], ['glutes'], { sec: ['hamstrings', 'quads'], mech: C, lvl: I }),
  ex('ex-glute-bridge', 'Glute Bridge', 'Glutes', [], ['glutes'], { sec: ['hamstrings'], track: 'reps' }),
  ex('ex-single-leg-bridge', 'Single-Leg Glute Bridge', 'Glutes', [], ['glutes'], { sec: ['hamstrings', 'abs'], track: 'reps' }),
  ex('ex-cable-pull-through', 'Cable Pull-Through', 'Glutes', ['cable'], ['glutes'], { sec: ['hamstrings', 'lower_back'], mech: C }),
  ex('ex-cable-kickback', 'Cable Glute Kickback', 'Glutes', ['cable'], ['glutes'], { sec: ['hamstrings'] }),
  ex('ex-donkey-kick', 'Donkey Kick', 'Glutes', [], ['glutes'], { sec: ['hamstrings'], track: 'reps' }),
  ex('ex-hip-abduction', 'Hip Abduction Machine', 'Glutes', ['machine'], ['abductors', 'glutes']),

  // ── SHOULDERS ─────────────────────────────────────────
  ex('ex-ohp', 'Overhead Press', 'Shoulders', ['barbell'], ['front_delts'], { sec: ['side_delts', 'triceps', 'upper_chest'], mech: C, lvl: I }),
  ex('ex-push-press', 'Push Press', 'Shoulders', ['barbell'], ['front_delts'], { sec: ['triceps', 'side_delts', 'quads'], mech: C, lvl: A }),
  ex('ex-db-shoulder-press', 'Seated Dumbbell Shoulder Press', 'Shoulders', ['dumbbell', 'bench'], ['front_delts'], { sec: ['side_delts', 'triceps'], mech: C }),
  ex('ex-arnold-press', 'Arnold Press', 'Shoulders', ['dumbbell'], ['front_delts', 'side_delts'], { sec: ['triceps'], mech: C, lvl: I }),
  ex('ex-machine-shoulder-press', 'Machine Shoulder Press', 'Shoulders', ['machine'], ['front_delts'], { sec: ['side_delts', 'triceps'], mech: C }),
  ex('ex-landmine-press', 'Landmine Press', 'Shoulders', ['barbell'], ['front_delts', 'upper_chest'], { sec: ['triceps', 'abs'], mech: C, lvl: I }),
  ex('ex-pike-pushup', 'Pike Push-Up', 'Shoulders', [], ['front_delts'], { sec: ['triceps', 'upper_chest'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-lateral-raise', 'Lateral Raise', 'Shoulders', ['dumbbell'], ['side_delts']),
  ex('ex-cable-lateral-raise', 'Cable Lateral Raise', 'Shoulders', ['cable'], ['side_delts'], { lvl: I }),
  ex('ex-front-raise', 'Front Raise', 'Shoulders', ['dumbbell'], ['front_delts']),
  ex('ex-upright-row', 'Upright Row', 'Shoulders', ['barbell'], ['side_delts', 'traps'], { sec: ['front_delts', 'biceps'], mech: C, lvl: I }),
  ex('ex-rear-delt-fly', 'Rear Delt Fly', 'Shoulders', ['dumbbell'], ['rear_delts'], { sec: ['upper_back'] }),
  ex('ex-reverse-pec-deck', 'Reverse Pec Deck', 'Shoulders', ['machine'], ['rear_delts'], { sec: ['upper_back'] }),
  ex('ex-face-pull', 'Face Pull', 'Shoulders', ['cable'], ['rear_delts'], { sec: ['upper_back', 'traps'] }),
  ex('ex-band-pull-apart', 'Band Pull-Apart', 'Shoulders', ['band'], ['rear_delts'], { sec: ['upper_back', 'traps'], track: 'reps' }),

  // ── BICEPS ────────────────────────────────────────────
  ex('ex-bb-curl', 'Barbell Curl', 'Biceps', ['barbell'], ['biceps'], { sec: ['forearms'] }),
  ex('ex-ez-curl', 'EZ-Bar Curl', 'Biceps', ['ez_bar'], ['biceps'], { sec: ['forearms'] }),
  ex('ex-db-curl', 'Dumbbell Curl', 'Biceps', ['dumbbell'], ['biceps'], { sec: ['forearms'] }),
  ex('ex-hammer-curl', 'Hammer Curl', 'Biceps', ['dumbbell'], ['biceps', 'forearms']),
  ex('ex-incline-db-curl', 'Incline Dumbbell Curl', 'Biceps', ['dumbbell', 'bench'], ['biceps'], { sec: ['forearms'], lvl: I }),
  ex('ex-preacher-curl', 'Preacher Curl', 'Biceps', ['ez_bar', 'bench'], ['biceps']),
  ex('ex-concentration', 'Concentration Curl', 'Biceps', ['dumbbell', 'bench'], ['biceps']),
  ex('ex-cable-curl', 'Cable Curl', 'Biceps', ['cable'], ['biceps'], { sec: ['forearms'] }),
  ex('ex-band-curl', 'Resistance Band Curl', 'Biceps', ['band'], ['biceps'], { sec: ['forearms'], track: 'reps' }),

  // ── TRICEPS ───────────────────────────────────────────
  ex('ex-close-grip-bench', 'Close-Grip Bench Press', 'Triceps', ['barbell', 'bench', 'rack'], ['triceps'], { sec: ['chest', 'front_delts'], mech: C, lvl: I }),
  ex('ex-tri-pushdown', 'Tricep Pushdown', 'Triceps', ['cable'], ['triceps']),
  ex('ex-rope-pushdown', 'Rope Pushdown', 'Triceps', ['cable'], ['triceps']),
  ex('ex-skull-crusher', 'Skull Crushers', 'Triceps', ['ez_bar', 'bench'], ['triceps'], { lvl: I }),
  ex('ex-overhead-ext', 'Overhead Tricep Extension', 'Triceps', ['dumbbell'], ['triceps']),
  ex('ex-cable-overhead-ext', 'Overhead Cable Extension', 'Triceps', ['cable'], ['triceps'], { lvl: I }),
  ex('ex-db-kickback', 'Dumbbell Kickback', 'Triceps', ['dumbbell'], ['triceps']),
  ex('ex-tri-dips', 'Tricep Dips', 'Triceps', ['dip_bars'], ['triceps'], { sec: ['chest', 'front_delts'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-bench-dips', 'Bench Dips', 'Triceps', ['bench'], ['triceps'], { sec: ['chest', 'front_delts'], mech: C, track: 'reps' }),
  ex('ex-diamond-pushup', 'Diamond Push-Up', 'Triceps', [], ['triceps'], { sec: ['chest', 'front_delts'], mech: C, lvl: I, track: 'reps' }),

  // ── FOREARMS ──────────────────────────────────────────
  ex('ex-wrist-curl', 'Wrist Curl', 'Forearms', ['dumbbell'], ['forearms']),
  ex('ex-reverse-curl', 'Reverse Barbell Curl', 'Forearms', ['barbell'], ['forearms'], { sec: ['biceps'] }),
  ex('ex-dead-hang', 'Dead Hang', 'Forearms', ['pullup_bar'], ['forearms'], { sec: ['lats', 'upper_back'], track: 'time' }),

  // ── CORE ──────────────────────────────────────────────
  ex('ex-plank', 'Plank', 'Core', [], ['abs'], { sec: ['obliques', 'lower_back'], track: 'time' }),
  ex('ex-side-plank', 'Side Plank', 'Core', [], ['obliques'], { sec: ['abs'], track: 'time' }),
  ex('ex-hollow-hold', 'Hollow Body Hold', 'Core', [], ['abs'], { sec: ['hip_flexors'], lvl: I, track: 'time' }),
  ex('ex-crunch', 'Crunch', 'Core', [], ['abs'], { track: 'reps' }),
  ex('ex-situp', 'Sit-Up', 'Core', [], ['abs'], { sec: ['hip_flexors'], track: 'reps' }),
  ex('ex-bicycle-crunch', 'Bicycle Crunch', 'Core', [], ['abs', 'obliques'], { sec: ['hip_flexors'], track: 'reps' }),
  ex('ex-russian-twist', 'Russian Twist', 'Core', [], ['obliques'], { sec: ['abs'], track: 'reps' }),
  ex('ex-leg-raise', 'Lying Leg Raise', 'Core', [], ['abs'], { sec: ['hip_flexors'], track: 'reps' }),
  ex('ex-flutter-kicks', 'Flutter Kicks', 'Core', [], ['abs'], { sec: ['hip_flexors'], track: 'time' }),
  ex('ex-dead-bug', 'Dead Bug', 'Core', [], ['abs'], { sec: ['hip_flexors'], track: 'reps' }),
  ex('ex-bird-dog', 'Bird Dog', 'Core', [], ['abs', 'lower_back'], { sec: ['glutes'], track: 'reps' }),
  ex('ex-mountain-climber', 'Mountain Climbers', 'Core', [], ['abs'], { sec: ['hip_flexors', 'front_delts', 'quads'], mech: C, track: 'time' }),
  ex('ex-hanging-knee-raise', 'Hanging Knee Raise', 'Core', ['pullup_bar'], ['abs'], { sec: ['hip_flexors', 'forearms'], track: 'reps' }),
  ex('ex-hanging-raise', 'Hanging Leg Raise', 'Core', ['pullup_bar'], ['abs'], { sec: ['hip_flexors', 'forearms'], lvl: I, track: 'reps' }),
  ex('ex-ab-rollout', 'Ab Rollout', 'Core', ['ab_wheel'], ['abs'], { sec: ['lats', 'lower_back'], lvl: I, track: 'reps' }),
  ex('ex-cable-crunch', 'Cable Crunch', 'Core', ['cable'], ['abs']),
  ex('ex-pallof-press', 'Pallof Press', 'Core', ['cable'], ['obliques', 'abs']),
  ex('ex-woodchopper', 'Cable Woodchopper', 'Core', ['cable'], ['obliques'], { sec: ['abs', 'front_delts'], mech: C, lvl: I }),

  // ── FULL BODY ─────────────────────────────────────────
  ex('ex-burpee', 'Burpee', 'Full Body', [], ['quads', 'chest'], { sec: ['triceps', 'front_delts', 'abs', 'glutes'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-kb-swing', 'Kettlebell Swing', 'Full Body', ['kettlebell'], ['glutes', 'hamstrings'], { sec: ['lower_back', 'front_delts', 'forearms'], mech: C, lvl: I }),
  ex('ex-thruster', 'Dumbbell Thruster', 'Full Body', ['dumbbell'], ['quads', 'front_delts'], { sec: ['glutes', 'triceps'], mech: C, lvl: I }),
  ex('ex-wall-ball', 'Wall Ball', 'Full Body', ['medicine_ball'], ['quads', 'front_delts'], { sec: ['glutes', 'triceps'], mech: C, lvl: I, track: 'reps' }),
  ex('ex-power-clean', 'Power Clean', 'Full Body', ['barbell'], ['glutes', 'hamstrings', 'traps'], { sec: ['quads', 'upper_back', 'forearms'], mech: C, lvl: A }),
  ex('ex-farmer-walk', "Farmer's Walk", 'Full Body', ['dumbbell'], ['forearms', 'traps'], { sec: ['abs', 'quads', 'glutes'], mech: C, track: 'time' }),
  ex('ex-sled-push', 'Sled Push', 'Full Body', ['sled'], ['quads', 'glutes'], { sec: ['calves', 'chest', 'triceps'], mech: C, lvl: I, track: 'time' }),

  // ── CARDIO ────────────────────────────────────────────
  ex('ex-outdoor-run', 'Running', 'Cardio', [], ['quads', 'calves'], { sec: ['hamstrings', 'glutes'] }),
  ex('ex-walking', 'Walking', 'Cardio', [], ['quads', 'calves'], { sec: ['glutes'] }),
  ex('ex-treadmill', 'Treadmill Run', 'Cardio', ['cardio_machine'], ['quads', 'calves'], { sec: ['hamstrings', 'glutes'] }),
  ex('ex-cycling', 'Cycling', 'Cardio', ['cardio_machine'], ['quads'], { sec: ['hamstrings', 'calves', 'glutes'] }),
  ex('ex-air-bike', 'Air Bike', 'Cardio', ['cardio_machine'], ['quads'], { sec: ['front_delts', 'triceps', 'lats'], lvl: I }),
  ex('ex-rowing', 'Rowing Machine', 'Cardio', ['cardio_machine'], ['upper_back', 'quads'], { sec: ['lats', 'biceps', 'glutes'] }),
  ex('ex-ski-erg', 'Ski Erg', 'Cardio', ['cardio_machine'], ['lats', 'triceps'], { sec: ['abs', 'glutes'], lvl: I }),
  ex('ex-elliptical', 'Elliptical', 'Cardio', ['cardio_machine'], ['quads'], { sec: ['glutes', 'hamstrings'] }),
  ex('ex-stairmaster', 'Stairmaster', 'Cardio', ['cardio_machine'], ['quads', 'glutes'], { sec: ['calves'] }),
  ex('ex-swimming', 'Swimming', 'Cardio', ['pool'], ['lats', 'front_delts'], { sec: ['triceps', 'abs', 'glutes'], lvl: I }),
  ex('ex-jump-rope', 'Jump Rope', 'Cardio', ['jump_rope'], ['calves'], { sec: ['quads', 'front_delts'] }),
  ex('ex-jumping-jacks', 'Jumping Jacks', 'Cardio', [], ['calves'], { sec: ['side_delts', 'abductors'], track: 'time' }),
  ex('ex-high-knees', 'High Knees', 'Cardio', [], ['hip_flexors', 'quads'], { sec: ['calves', 'abs'], track: 'time' }),
  ex('ex-shadow-boxing', 'Shadow Boxing', 'Cardio', [], ['front_delts'], { sec: ['abs', 'obliques', 'calves'] }),
  ex('ex-battle-ropes', 'Battle Ropes', 'Cardio', ['battle_ropes'], ['front_delts'], { sec: ['abs', 'forearms', 'quads'], lvl: I, track: 'time' }),

  // ── MOBILITY ──────────────────────────────────────────
  ex('ex-arm-circles', 'Arm Circles', 'Mobility', [], ['front_delts', 'side_delts']),
  ex('ex-leg-swings', 'Leg Swings', 'Mobility', [], ['hip_flexors', 'hamstrings']),
  ex('ex-cat-cow', 'Cat-Cow', 'Mobility', [], ['lower_back'], { sec: ['abs'] }),
  ex('ex-childs-pose', "Child's Pose", 'Mobility', [], ['lower_back', 'lats']),
  ex('ex-downward-dog', 'Downward Dog', 'Mobility', [], ['hamstrings', 'calves'], { sec: ['lats', 'front_delts'] }),
  ex('ex-cobra', 'Cobra Stretch', 'Mobility', [], ['abs'], { sec: ['lower_back', 'hip_flexors'] }),
  ex('ex-hip-flexor-stretch', 'Kneeling Hip Flexor Stretch', 'Mobility', [], ['hip_flexors'], { sec: ['quads'] }),
  ex('ex-hamstring-stretch', 'Standing Hamstring Stretch', 'Mobility', [], ['hamstrings'], { sec: ['lower_back'] }),
  ex('ex-quad-stretch', 'Standing Quad Stretch', 'Mobility', [], ['quads'], { sec: ['hip_flexors'] }),
  ex('ex-pigeon-stretch', 'Pigeon Stretch', 'Mobility', [], ['glutes'], { sec: ['hip_flexors'] }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISE_CATALOG.map(e => [e.id, e]),
);

export const MUSCLE_GROUP_LIST = [
  'Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Biceps', 'Triceps',
  'Forearms', 'Core', 'Full Body', 'Cardio', 'Mobility',
] as const;

export const ALL_EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'kettlebell', 'ez_bar', 'trap_bar', 'plate',
  'machine', 'cable', 'smith', 'rack', 'bench',
  'pullup_bar', 'dip_bars', 'band', 'box', 'medicine_ball', 'ab_wheel',
  'jump_rope', 'cardio_machine', 'battle_ropes', 'sled', 'pool',
];

/** Quick setups the user can start from when describing their equipment. */
export const EQUIPMENT_PRESETS: Record<'gym' | 'home' | 'bodyweight', Equipment[]> = {
  gym: ALL_EQUIPMENT.filter(e => e !== 'pool'),
  home: ['dumbbell', 'bench', 'band', 'pullup_bar'],
  bodyweight: [],
};

/** Every exercise whose required equipment is available. */
export function exercisesForEquipment(available: Equipment[] | undefined, list: Exercise[] = EXERCISE_CATALOG): Exercise[] {
  if (!available) return list;
  const have = new Set(available);
  return list.filter(e => (e.equipment ?? []).every(item => have.has(item)));
}

/** Muscle group → muscles it covers (for recovery / volume tracking). */
export const GROUP_MUSCLES: Record<string, string[]> = {
  Chest: ['chest', 'upper_chest'],
  Back: ['lats', 'upper_back', 'traps', 'lower_back'],
  Legs: ['quads', 'hamstrings', 'adductors', 'calves'],
  Glutes: ['glutes', 'abductors'],
  Shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Forearms: ['forearms'],
  Core: ['abs', 'obliques', 'hip_flexors'],
};
