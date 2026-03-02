import { WorkoutProgram } from '../types';

export const PROGRAMS: WorkoutProgram[] = [
    // ──────────────── PUSH / PULL / LEGS ────────────────
    {
        id: 'prog-ppl-3',
        name: 'Push Pull Legs',
        description: 'The classic 3-day PPL split. Hit every muscle group once per week with high volume and compound lifts.',
        level: 'intermediate',
        daysPerWeek: 3,
        goal: 'hypertrophy',
        duration: 'Ongoing',
        icon: '🔥',
        color: '#FF6B6B',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Push',
                exercises: [
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 4, reps: '8-10', restSeconds: 120 },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-lateral-raise', exerciseName: 'Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-tri-pushdown', exerciseName: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-overhead-ext', exerciseName: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Pull',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 3, reps: '5-6', restSeconds: 180 },
                    { exerciseId: 'ex-pull-ups', exerciseName: 'Pull Ups', sets: 4, reps: '6-10', restSeconds: 120 },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 4, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
                    { exerciseId: 'ex-bb-curl', exerciseName: 'Barbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-hammer-curl', exerciseName: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Legs',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 4, reps: '6-8', restSeconds: 180 },
                    { exerciseId: 'ex-rdl', exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 120 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-leg-ext', exerciseName: 'Leg Extension', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── PPL 6-DAY ────────────────
    {
        id: 'prog-ppl-6',
        name: 'PPL 6-Day Split',
        description: 'High-frequency PPL. Each muscle group twice per week for maximum growth. For serious lifters.',
        level: 'advanced',
        daysPerWeek: 6,
        goal: 'hypertrophy',
        duration: 'Ongoing',
        icon: '💪',
        color: '#845EF7',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Push (Heavy)',
                exercises: [
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 5, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-lateral-raise', exerciseName: 'Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-tri-pushdown', exerciseName: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-skull-crusher', exerciseName: 'Skull Crushers', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Pull (Heavy)',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 4, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 4, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-pull-ups', exerciseName: 'Pull Ups', sets: 4, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
                    { exerciseId: 'ex-bb-curl', exerciseName: 'Barbell Curl', sets: 4, reps: '8-10', restSeconds: 60 },
                    { exerciseId: 'ex-hammer-curl', exerciseName: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Legs (Quad Focus)',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 5, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 120 },
                    { exerciseId: 'ex-leg-ext', exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 4',
                name: 'Push (Volume)',
                exercises: [
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 4, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-db-fly', exerciseName: 'Dumbbell Fly', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-arnold-press', exerciseName: 'Arnold Press', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-lateral-raise', exerciseName: 'Lateral Raise', sets: 4, reps: '15-20', restSeconds: 45 },
                    { exerciseId: 'ex-overhead-ext', exerciseName: 'Overhead Tricep Extension', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-tri-dips', exerciseName: 'Tricep Dips', sets: 3, reps: '10-15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 5',
                name: 'Pull (Volume)',
                exercises: [
                    { exerciseId: 'ex-seated-row', exerciseName: 'Seated Cable Row', sets: 4, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-lat-pulldown', exerciseName: 'Lat Pulldown', sets: 4, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-tbar-row', exerciseName: 'T-Bar Row', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-rear-delt-fly', exerciseName: 'Rear Delt Fly', sets: 3, reps: '15-20', restSeconds: 60 },
                    { exerciseId: 'ex-preacher-curl', exerciseName: 'Preacher Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-concentration', exerciseName: 'Concentration Curl', sets: 3, reps: '12-15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 6',
                name: 'Legs (Ham/Glute Focus)',
                exercises: [
                    { exerciseId: 'ex-rdl', exerciseName: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120 },
                    { exerciseId: 'ex-bulgarian', exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-hack-squat', exerciseName: 'Hack Squat', sets: 3, reps: '10-12', restSeconds: 120 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 4, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── UPPER / LOWER ────────────────
    {
        id: 'prog-upper-lower',
        name: 'Upper / Lower Split',
        description: 'Balanced 4-day program alternating between upper and lower body. Great for intermediate lifters.',
        level: 'intermediate',
        daysPerWeek: 4,
        goal: 'general',
        duration: 'Ongoing',
        icon: '⚡',
        color: '#20C997',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Upper (Strength)',
                exercises: [
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 4, reps: '5-6', restSeconds: 180 },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 4, reps: '5-6', restSeconds: 180 },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-chinups', exerciseName: 'Chin Ups', sets: 3, reps: '6-10', restSeconds: 120 },
                    { exerciseId: 'ex-bb-curl', exerciseName: 'Barbell Curl', sets: 2, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-tri-pushdown', exerciseName: 'Tricep Pushdown', sets: 2, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Lower (Strength)',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 4, reps: '5-6', restSeconds: 180 },
                    { exerciseId: 'ex-rdl', exerciseName: 'Romanian Deadlift', sets: 3, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 3, reps: '8-10', restSeconds: 120 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '8-10', restSeconds: 60 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '10-15', restSeconds: 60 },
                    { exerciseId: 'ex-plank', exerciseName: 'Plank', sets: 3, reps: '60s hold', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Upper (Hypertrophy)',
                exercises: [
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 4, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-seated-row', exerciseName: 'Seated Cable Row', sets: 4, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-cable-cross', exerciseName: 'Cable Crossovers', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-lateral-raise', exerciseName: 'Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
                    { exerciseId: 'ex-hammer-curl', exerciseName: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-skull-crusher', exerciseName: 'Skull Crushers', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 4',
                name: 'Lower (Hypertrophy)',
                exercises: [
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 4, reps: '12-15', restSeconds: 90 },
                    { exerciseId: 'ex-bulgarian', exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-leg-ext', exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
                    { exerciseId: 'ex-hanging-raise', exerciseName: 'Hanging Leg Raise', sets: 3, reps: '12-15', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── FULL BODY 3x ────────────────
    {
        id: 'prog-full-body',
        name: 'Full Body 3x/Week',
        description: 'Hit every major muscle group three times a week. Perfect for beginners building a strength foundation.',
        level: 'beginner',
        daysPerWeek: 3,
        goal: 'strength',
        duration: '12 weeks',
        icon: '🏋️',
        color: '#339AF0',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Full Body A',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 3, reps: '5', restSeconds: 180, notes: 'Add 2.5kg each session' },
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 3, reps: '5', restSeconds: 180, notes: 'Add 2.5kg each session' },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 3, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-plank', exerciseName: 'Plank', sets: 3, reps: '45s hold', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Full Body B',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 3, reps: '5', restSeconds: 180, notes: 'Add 5kg each session' },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-chinups', exerciseName: 'Chin Ups', sets: 3, reps: '5-8', restSeconds: 120, notes: 'Use assisted if needed' },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-bb-curl', exerciseName: 'Barbell Curl', sets: 2, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Full Body C',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 3, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 3, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 3, reps: '5', restSeconds: 180 },
                    { exerciseId: 'ex-lunges', exerciseName: 'Lunges', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── 5/3/1 WENDLER ────────────────
    {
        id: 'prog-531',
        name: '5/3/1 Strength',
        description: 'Jim Wendler\'s proven strength program. Focus on 4 big lifts with slow, steady progress. Built for long-term gains.',
        level: 'intermediate',
        daysPerWeek: 4,
        goal: 'strength',
        duration: '4-week cycles',
        icon: '🏆',
        color: '#FAB005',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Squat Day',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 3, reps: '5/3/1', restSeconds: 180, notes: 'Week 1: 5×65%, 5×75%, 5+×85%' },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 5, reps: '10', restSeconds: 90, notes: 'BBB: 5×10 @50-60%' },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-hanging-raise', exerciseName: 'Hanging Leg Raise', sets: 3, reps: '10-15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Bench Day',
                exercises: [
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 3, reps: '5/3/1', restSeconds: 180, notes: 'Week 1: 5×65%, 5×75%, 5+×85%' },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 5, reps: '10', restSeconds: 90, notes: 'BBB: 5×10 @50-60%' },
                    { exerciseId: 'ex-seated-row', exerciseName: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-tri-pushdown', exerciseName: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Deadlift Day',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 3, reps: '5/3/1', restSeconds: 180, notes: 'Week 1: 5×65%, 5×75%, 5+×85%' },
                    { exerciseId: 'ex-rdl', exerciseName: 'Romanian Deadlift', sets: 5, reps: '10', restSeconds: 90, notes: 'BBB: 5×10 @50-60%' },
                    { exerciseId: 'ex-chinups', exerciseName: 'Chin Ups', sets: 3, reps: '8-10', restSeconds: 60 },
                    { exerciseId: 'ex-ab-rollout', exerciseName: 'Ab Rollout', sets: 3, reps: '10-15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 4',
                name: 'OHP Day',
                exercises: [
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '5/3/1', restSeconds: 180, notes: 'Week 1: 5×65%, 5×75%, 5+×85%' },
                    { exerciseId: 'ex-arnold-press', exerciseName: 'Arnold Press', sets: 5, reps: '10', restSeconds: 90, notes: 'BBB: 5×10 @50-60%' },
                    { exerciseId: 'ex-lat-pulldown', exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── BRO SPLIT ────────────────
    {
        id: 'prog-bro-split',
        name: 'Classic Bro Split',
        description: 'One muscle group per day, 5 days a week. High volume approach for experienced lifters chasing maximum pump.',
        level: 'intermediate',
        daysPerWeek: 5,
        goal: 'hypertrophy',
        duration: 'Ongoing',
        icon: '💥',
        color: '#F03E3E',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Chest',
                exercises: [
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-decline-bench', exerciseName: 'Decline Bench Press', sets: 3, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-cable-cross', exerciseName: 'Cable Crossovers', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-db-fly', exerciseName: 'Dumbbell Fly', sets: 3, reps: '12-15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Back',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 4, reps: '5-6', restSeconds: 180 },
                    { exerciseId: 'ex-pull-ups', exerciseName: 'Pull Ups', sets: 4, reps: '6-10', restSeconds: 120 },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 4, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-seated-row', exerciseName: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-lat-pulldown', exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Shoulders',
                exercises: [
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 120 },
                    { exerciseId: 'ex-arnold-press', exerciseName: 'Arnold Press', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-lateral-raise', exerciseName: 'Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
                    { exerciseId: 'ex-rear-delt-fly', exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-front-raise', exerciseName: 'Front Raise', sets: 3, reps: '12-15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 4',
                name: 'Legs',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 4, reps: '6-8', restSeconds: 180 },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 120 },
                    { exerciseId: 'ex-rdl', exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-leg-ext', exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 5',
                name: 'Arms',
                exercises: [
                    { exerciseId: 'ex-bb-curl', exerciseName: 'Barbell Curl', sets: 4, reps: '8-10', restSeconds: 60 },
                    { exerciseId: 'ex-skull-crusher', exerciseName: 'Skull Crushers', sets: 4, reps: '8-10', restSeconds: 60 },
                    { exerciseId: 'ex-hammer-curl', exerciseName: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-tri-pushdown', exerciseName: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-preacher-curl', exerciseName: 'Preacher Curl', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-overhead-ext', exerciseName: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── HOME / BODYWEIGHT ────────────────
    {
        id: 'prog-home',
        name: 'Home Workout',
        description: 'No gym? No problem. Full bodyweight program you can do anywhere. Zero equipment needed.',
        level: 'beginner',
        daysPerWeek: 3,
        goal: 'general',
        duration: '8 weeks',
        icon: '🏠',
        color: '#22B8CF',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Upper Body',
                exercises: [
                    { exerciseId: 'ex-chest-dips', exerciseName: 'Chest Dips', sets: 4, reps: '8-15', restSeconds: 90, notes: 'Use chairs if no dip station' },
                    { exerciseId: 'ex-pull-ups', exerciseName: 'Pull Ups', sets: 4, reps: '5-12', restSeconds: 90, notes: 'Use door-frame bar or playground' },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '10-15', restSeconds: 60, notes: 'Pike push-ups as substitute' },
                    { exerciseId: 'ex-plank', exerciseName: 'Plank', sets: 3, reps: '30-60s', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Lower Body',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 4, reps: '15-20', restSeconds: 60, notes: 'Bodyweight squats' },
                    { exerciseId: 'ex-bulgarian', exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '12-15', restSeconds: 60, notes: 'Use a chair' },
                    { exerciseId: 'ex-lunges', exerciseName: 'Lunges', sets: 3, reps: '12-15', restSeconds: 60, notes: 'Walking lunges' },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 4, reps: '20-25', restSeconds: 45, notes: 'On a step for full ROM' },
                    { exerciseId: 'ex-hanging-raise', exerciseName: 'Hanging Leg Raise', sets: 3, reps: '10-15', restSeconds: 60, notes: 'Lying leg raises as substitute' },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Full Body HIIT',
                exercises: [
                    { exerciseId: 'ex-jump-rope', exerciseName: 'Jump Rope', sets: 3, reps: '2 min', restSeconds: 60, notes: 'Or jumping jacks' },
                    { exerciseId: 'ex-chest-dips', exerciseName: 'Chest Dips', sets: 3, reps: '10-15', restSeconds: 45 },
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 3, reps: '20', restSeconds: 45, notes: 'Jump squats' },
                    { exerciseId: 'ex-plank', exerciseName: 'Plank', sets: 3, reps: '45-60s', restSeconds: 30 },
                    { exerciseId: 'ex-lunges', exerciseName: 'Lunges', sets: 3, reps: '15', restSeconds: 45, notes: 'Alternating jump lunges' },
                ],
            },
        ],
    },

    // ──────────────── STRENGTH FOCUS ────────────────
    {
        id: 'prog-strength',
        name: 'Pure Strength',
        description: 'Low reps, heavy weights, long rest. Maximise your squat, bench, deadlift, and overhead press.',
        level: 'advanced',
        daysPerWeek: 4,
        goal: 'strength',
        duration: '12 weeks',
        icon: '🦾',
        color: '#E64980',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Squat + Bench',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 5, reps: '3', restSeconds: 240, notes: 'Work up to 85-90% 1RM' },
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 4, reps: '5', restSeconds: 180, notes: '75-80% 1RM' },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 3, reps: '8', restSeconds: 120 },
                    { exerciseId: 'ex-tri-dips', exerciseName: 'Tricep Dips', sets: 3, reps: '8-10', restSeconds: 90 },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Deadlift + OHP',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 5, reps: '3', restSeconds: 240, notes: 'Work up to 85-90% 1RM' },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 4, reps: '5', restSeconds: 180, notes: '75-80% 1RM' },
                    { exerciseId: 'ex-pull-ups', exerciseName: 'Pull Ups', sets: 4, reps: '5-8', restSeconds: 120, notes: 'Add weight if possible' },
                    { exerciseId: 'ex-face-pull', exerciseName: 'Face Pull', sets: 3, reps: '15', restSeconds: 60 },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Squat + Bench (Volume)',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 4, reps: '6-8', restSeconds: 180, notes: '65-75% 1RM' },
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 180, notes: '65-75% 1RM' },
                    { exerciseId: 'ex-bulgarian', exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '10-12', restSeconds: 90 },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 90 },
                ],
            },
            {
                dayLabel: 'Day 4',
                name: 'Deadlift + OHP (Volume)',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 4, reps: '6-8', restSeconds: 180, notes: '65-75% 1RM' },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 180, notes: '65-75% 1RM' },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 4, reps: '8-10', restSeconds: 90 },
                    { exerciseId: 'ex-lateral-raise', exerciseName: 'Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
                ],
            },
        ],
    },

    // ──────────────── FAT LOSS / HIIT ────────────────
    {
        id: 'prog-fat-loss',
        name: 'Burn & Build',
        description: 'High-intensity circuits combining strength and cardio. Torch fat while keeping muscle. Short, intense sessions.',
        level: 'beginner',
        daysPerWeek: 4,
        goal: 'fat_loss',
        duration: '8 weeks',
        icon: '🔥',
        color: '#FF922B',
        days: [
            {
                dayLabel: 'Day 1',
                name: 'Upper Body Circuit',
                exercises: [
                    { exerciseId: 'ex-bench-press', exerciseName: 'Barbell Bench Press', sets: 4, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-bent-rows', exerciseName: 'Bent Over Rows', sets: 4, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: 3, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-bb-curl', exerciseName: 'Barbell Curl', sets: 3, reps: '12-15', restSeconds: 30 },
                    { exerciseId: 'ex-tri-pushdown', exerciseName: 'Tricep Pushdown', sets: 3, reps: '12-15', restSeconds: 30 },
                    { exerciseId: 'ex-treadmill', exerciseName: 'Treadmill Run', sets: 1, reps: '10 min', restSeconds: 0, notes: 'Finish with 10 min HIIT intervals' },
                ],
            },
            {
                dayLabel: 'Day 2',
                name: 'Lower Body Circuit',
                exercises: [
                    { exerciseId: 'ex-squat', exerciseName: 'Barbell Squat', sets: 4, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-rdl', exerciseName: 'Romanian Deadlift', sets: 3, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-lunges', exerciseName: 'Lunges', sets: 3, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-leg-curl', exerciseName: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 30 },
                    { exerciseId: 'ex-calf-raise', exerciseName: 'Calf Raise', sets: 3, reps: '15-20', restSeconds: 30 },
                    { exerciseId: 'ex-cycling', exerciseName: 'Cycling', sets: 1, reps: '10 min', restSeconds: 0, notes: 'Finish with 10 min HIIT intervals' },
                ],
            },
            {
                dayLabel: 'Day 3',
                name: 'Full Body Burn',
                exercises: [
                    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sets: 3, reps: '10-12', restSeconds: 60 },
                    { exerciseId: 'ex-incline-db', exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-lat-pulldown', exerciseName: 'Lat Pulldown', sets: 3, reps: '12-15', restSeconds: 45 },
                    { exerciseId: 'ex-leg-press', exerciseName: 'Leg Press', sets: 3, reps: '15-20', restSeconds: 45 },
                    { exerciseId: 'ex-cable-crunch', exerciseName: 'Cable Crunch', sets: 3, reps: '15-20', restSeconds: 30 },
                    { exerciseId: 'ex-rowing', exerciseName: 'Rowing Machine', sets: 1, reps: '10 min', restSeconds: 0, notes: 'Finish with rowing intervals' },
                ],
            },
            {
                dayLabel: 'Day 4',
                name: 'Cardio + Core',
                exercises: [
                    { exerciseId: 'ex-treadmill', exerciseName: 'Treadmill Run', sets: 1, reps: '5 min', restSeconds: 60, notes: 'Warmup jog' },
                    { exerciseId: 'ex-jump-rope', exerciseName: 'Jump Rope', sets: 5, reps: '2 min', restSeconds: 30, notes: '30/30 work/rest intervals' },
                    { exerciseId: 'ex-plank', exerciseName: 'Plank', sets: 3, reps: '45-60s', restSeconds: 30 },
                    { exerciseId: 'ex-hanging-raise', exerciseName: 'Hanging Leg Raise', sets: 3, reps: '12-15', restSeconds: 30 },
                    { exerciseId: 'ex-ab-rollout', exerciseName: 'Ab Rollout', sets: 3, reps: '10-12', restSeconds: 30 },
                    { exerciseId: 'ex-stairmaster', exerciseName: 'Stairmaster', sets: 1, reps: '15 min', restSeconds: 0, notes: '15 min steady state to finish' },
                ],
            },
        ],
    },
];

export const PROGRAM_LEVELS = ['all', 'beginner', 'intermediate', 'advanced'] as const;
export const PROGRAM_GOALS = ['all', 'strength', 'hypertrophy', 'general', 'fat_loss'] as const;
