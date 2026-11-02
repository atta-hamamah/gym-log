import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import i18n from '../i18n';
import { useSubscription } from './SubscriptionContext';
import { useWorkout } from './WorkoutContext';
import { TrainingPlan, WorkoutSession } from '../types';
import { dateKey, planProgress, PlanProgress, resolveSession, sessionKey } from '../utils/trainingPlan';

/** Last plan seen from the server, so the plan works offline and shows instantly on launch. */
const CACHE_KEY = '@gym_log_training_plan';

interface PlanContextType {
    /** The active AI training plan: null when there's none, undefined while loading. */
    plan: TrainingPlan | null | undefined;
    progress: PlanProgress<WorkoutSession> | null;
    /** Today's date (refreshed when the app comes back to the foreground). */
    today: Date;
    /** `sessionKey(week, sessionId)` of the plan session in progress, if any. */
    activeSessionKey: string | null;
    /** Start a plan session as the current workout. False when another workout is running. */
    startSession: (week: number, sessionId: string) => boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAISubscriber } = useSubscription();
    const { isAuthenticated } = useConvexAuth();
    const { workouts, currentWorkout, startPlannedWorkout } = useWorkout();

    const remote = useQuery(api.plans.active, isAISubscriber && isAuthenticated ? {} : 'skip');
    const [cached, setCached] = useState<TrainingPlan | null | undefined>(undefined);

    useEffect(() => {
        AsyncStorage.getItem(CACHE_KEY)
            .then(json => setCached(json ? JSON.parse(json) : null))
            .catch(() => setCached(null));
    }, []);

    // Keep the offline copy in step with the server.
    useEffect(() => {
        if (remote === undefined) return;
        setCached(remote);
        (remote ? AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)) : AsyncStorage.removeItem(CACHE_KEY)).catch(() => {});
    }, [remote]);

    // "Today" moves on when the app is reopened on another day.
    const [today, setToday] = useState(() => new Date());
    useEffect(() => {
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') {
                const now = new Date();
                setToday(prev => (dateKey(prev) === dateKey(now) ? prev : now));
            }
        });
        return () => sub.remove();
    }, []);

    const plan = !isAISubscriber ? null : remote !== undefined ? remote : cached;

    const progress = useMemo(
        () => (plan ? planProgress(plan, workouts, today) : null),
        [plan, workouts, today],
    );

    const source = currentWorkout?.source;
    const activeSessionKey =
        plan && source?.type === 'plan' && source.planId === plan.id && source.planWeek && source.planSessionId
            ? sessionKey(source.planWeek, source.planSessionId)
            : null;

    const startSession = useCallback((week: number, sessionId: string): boolean => {
        if (!plan || currentWorkout) return false;
        const resolved = resolveSession(plan, week, sessionId);
        if (!resolved) return false;
        startPlannedWorkout(
            `${resolved.session.name} · ${i18n.t('aiPlan.weekN', { n: week })}`,
            { type: 'plan', planId: plan.id, planWeek: week, planSessionId: sessionId, dayName: resolved.session.name },
            resolved.exercises.map(ex => ({
                exercise: { id: ex.exerciseId, name: ex.exerciseName },
                supersetGroup: ex.supersetGroup,
                target: {
                    sets: ex.sets,
                    reps: ex.reps,
                    restSeconds: ex.restSeconds,
                    ...(ex.targetWeight ? { weight: ex.targetWeight } : {}),
                    ...(ex.notes ? { notes: ex.notes } : {}),
                },
            })),
        );
        return true;
    }, [plan, currentWorkout, startPlannedWorkout]);

    return (
        <PlanContext.Provider value={{ plan, progress, today, activeSessionKey, startSession }}>
            {children}
        </PlanContext.Provider>
    );
};

export const usePlan = () => {
    const context = useContext(PlanContext);
    if (!context) throw new Error('usePlan must be used within a PlanProvider');
    return context;
};
