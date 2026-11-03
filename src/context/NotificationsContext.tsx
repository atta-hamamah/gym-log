import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useConvex, useConvexAuth } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../convex/_generated/api';
import { useWorkout } from './WorkoutContext';
import { usePlan } from './PlanContext';
import { useSubscription } from './SubscriptionContext';
import { useUnits } from './UnitsContext';
import {
  coachFor,
  dateToDay,
  nudgeHourFor,
  planDaysFor,
  planNudges,
  sampleNudge,
  toNudgeWorkouts,
  zonedTime,
  type CoachChoice,
  type NudgeWorkout,
} from '../notifications/nudges';
import { renderNudge } from '../notifications/templates';
import {
  NUDGES_SUPPORTED,
  cancelScheduledNudges,
  deviceTimeZone,
  ensureNudgeChannel,
  getNotificationPermission,
  getPushToken,
  loadNudgeStore,
  nudgeId,
  presentNow,
  requestNotificationPermission,
  saveNudgeStore,
  scheduleNudge,
  type NotificationPermission,
  type NudgeStore,
} from '../services/notifications';

/**
 * Coach nudges: short notifications from RepAI Coach, Chad or Kevin about
 * the user's own training (plan day, usual day, comeback, skipped muscle
 * group, weekly recap, first workout).
 *
 * - AI subscribers: this device's push token is registered with the server,
 *   which picks the nudge with the shared rules and has the AI write it
 *   (convex/notifications.ts, convex/nudgeAI.ts).
 * - Everyone else (or when push isn't available): the same rules run here
 *   and template lines are scheduled on the phone for the next week. No
 *   server and no AI involved, so it costs nothing.
 *
 * Template nudges are rescheduled whenever the data they depend on changes
 * (a finished workout, the plan, settings, language, units, the day).
 */

/** Days ahead to schedule template nudges (the app reschedules whenever it opens). */
const HORIZON_DAYS = 7;
/** Keep delivered template nudges this long for spacing and the weekly cap. */
const SENT_HISTORY_DAYS = 30;
const SYNC_DEBOUNCE_MS = 1500;

interface NotificationsContextType {
  /** Notifications work on this platform. */
  supported: boolean;
  /** Nudges are on and the phone allows notifications. */
  enabled: boolean;
  /** Notifications are blocked in the phone's settings (the app can't ask again). */
  blocked: boolean;
  coach: CoachChoice;
  /** The server writes nudges with AI (AI subscribers). */
  aiNudges: boolean;
  setEnabled: (on: boolean) => Promise<void>;
  setCoach: (coach: CoachChoice) => void;
  /** Show a template nudge right now, in the chosen coach's voice. */
  sendPreview: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { workouts, exercises, currentWorkout, loading } = useWorkout();
  const { plan } = usePlan();
  const { isAISubscriber } = useSubscription();
  const { isSignedIn, userId } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const { displayWeight, weightUnit } = useUnits();

  const [store, setStore] = useState<NudgeStore | null>(null);
  const storeRef = useRef<NudgeStore | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [tick, setTick] = useState(0);

  const aiMode = isAISubscriber && !!isSignedIn && !!userId;

  const updateStore = useCallback((patch: Partial<NudgeStore>) => {
    if (!storeRef.current) return;
    const next = { ...storeRef.current, ...patch };
    storeRef.current = next;
    setStore(next);
    saveNudgeStore(next);
  }, []);

  // ── Load settings, create the channel, read the permission ──
  useEffect(() => {
    if (!NUDGES_SUPPORTED) return;
    (async () => {
      const loaded = await loadNudgeStore();
      if (loaded.firstSeenDay === undefined) loaded.firstSeenDay = dateToDay(new Date());
      storeRef.current = loaded;
      setStore(loaded);
      saveNudgeStore(loaded);
      try {
        await ensureNudgeChannel(t('nudges.channelName'));
        setPermission(await getNotificationPermission());
      } catch (e) {
        console.warn('[nudges] Setup failed:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the channel name in the app's language.
  useEffect(() => {
    if (NUDGES_SUPPORTED) ensureNudgeChannel(t('nudges.channelName')).catch(() => {});
  }, [i18n.language, t]);

  // Back in the app: the permission may have changed in the phone's settings, and the day may have changed.
  useEffect(() => {
    if (!NUDGES_SUPPORTED) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      getNotificationPermission().then(setPermission).catch(() => {});
      setTick(n => n + 1);
    });
    return () => sub.remove();
  }, []);

  // ── Ask for permission once, right after a finished workout ──
  const inProgressId = useRef<string | null>(null);
  const justEndedId = useRef<string | null>(null);
  useEffect(() => {
    if (currentWorkout) {
      inProgressId.current = currentWorkout.id;
      return;
    }
    if (inProgressId.current) {
      justEndedId.current = inProgressId.current;
      inProgressId.current = null;
    }
    const id = justEndedId.current;
    if (!id || !store || !permission) return;
    // Wait until it's saved as finished (a cancelled workout never is).
    if (!workouts.some(w => w.id === id && w.endTime)) return;
    justEndedId.current = null;
    if (store.askedAfterWorkout || !store.enabled || permission.granted || !permission.canAskAgain) return;
    updateStore({ askedAfterWorkout: true });
    // Let the end-of-workout screen appear first.
    setTimeout(() => {
      requestNotificationPermission().then(setPermission).catch(() => {});
    }, 1500);
  }, [currentWorkout, workouts, store, permission, updateStore]);

  // ── Everything the sync needs, always current ──
  const nudgeWorkouts = useMemo<NudgeWorkout[]>(() => {
    const customGroups = Object.fromEntries(exercises.filter(e => e.isCustom).map(e => [e.id, e.muscleGroup]));
    return toNudgeWorkouts(workouts, customGroups);
  }, [workouts, exercises]);

  const formatVolume = useCallback(
    (kg: number) => `${Math.round(displayWeight(kg)).toLocaleString('en-US')} ${weightUnit}`,
    [displayWeight, weightUnit],
  );

  const latest = useRef({ nudgeWorkouts, workouts, plan, currentWorkout, aiMode, isAuthenticated, userId, permission, formatVolume });
  latest.current = { nudgeWorkouts, workouts, plan, currentWorkout, aiMode, isAuthenticated, userId, permission, formatVolume };

  // ── Sync: register with the server (AI) or schedule template nudges ──
  const syncOnce = useCallback(async () => {
    const s = storeRef.current;
    const L = latest.current;
    if (!s || !L.permission) return;

    const now = Date.now();
    const today = dateToDay(new Date(now));

    // Template nudges whose time has passed were delivered: remember them.
    const delivered = s.scheduled.filter(n => n.at <= now);
    const sent = [...s.sent, ...delivered.map(({ day, kind, group }) => ({ day, kind, group }))]
      .filter(n => n.day > today - SENT_HISTORY_DAYS);
    const next: NudgeStore = { ...s, sent, scheduled: [] };
    // Signed out (or another account): the server registration isn't ours anymore.
    if (next.registered && next.registered.userId !== L.userId) next.registered = undefined;

    const active = next.enabled && L.permission.granted;
    const hour = nudgeHourFor(L.nudgeWorkouts);

    // 1. AI subscribers: the server writes and sends the nudges.
    let serverSends = false;
    if (active && L.aiMode && L.userId) {
      if (L.isAuthenticated) {
        const token = await getPushToken();
        if (token) {
          try {
            await convex.mutation(api.notifications.registerDevice, {
              token,
              platform: Platform.OS === 'ios' ? 'ios' : 'android',
              coach: next.coach,
              language: i18n.language,
              timeZone: deviceTimeZone(),
              hour,
            });
            next.registered = { token, userId: L.userId };
            serverSends = true;
          } catch (e) {
            console.warn('[nudges] Could not register for AI nudges:', e);
          }
        }
      } else if (next.registered) {
        // Offline for now: the server keeps the last schedule.
        serverSends = true;
      }
    }

    // 2. Not (or no longer) on AI nudges: make sure the server stops.
    if (!serverSends && next.registered && L.isAuthenticated) {
      try {
        await convex.mutation(api.notifications.unregisterDevice, { token: next.registered.token });
        next.registered = undefined;
      } catch (e) {
        console.warn('[nudges] Could not unregister:', e);
      }
    }

    // 3. Everyone else: template nudges for the coming week, on the phone.
    await cancelScheduledNudges();
    if (active && !serverSends) {
      const todaySlot = zonedTime(today, hour);
      const fromDay = now < todaySlot - 60_000 && !L.currentWorkout ? today : today + 1;
      const toDay = today + HORIZON_DAYS;
      const planDays = L.plan ? planDaysFor(L.plan, L.workouts, today, toDay) : undefined;
      const nudges = planNudges(
        { today, workouts: L.nudgeWorkouts, planDays, firstSeenDay: next.firstSeenDay, sent },
        fromDay,
        toDay,
      );
      for (const n of nudges) {
        const at = zonedTime(n.day, hour);
        if (at <= now + 60_000) continue;
        const { title, body } = renderNudge(n, coachFor(next.coach, n.day), L.formatVolume);
        try {
          await scheduleNudge(nudgeId(n.day), new Date(at), title, body, n.kind);
          next.scheduled.push({ id: nudgeId(n.day), at, day: n.day, kind: n.kind, group: n.group });
        } catch (e) {
          console.warn('[nudges] Could not schedule:', e);
        }
      }
    }

    // Settings may have changed while we were busy: keep the user's latest choices.
    const current = storeRef.current ?? next;
    const merged: NudgeStore = { ...next, enabled: current.enabled, coach: current.coach, askedAfterWorkout: current.askedAfterWorkout };
    storeRef.current = merged;
    setStore(merged);
    await saveNudgeStore(merged);
  }, [convex, i18n]);

  const running = useRef(false);
  const rerun = useRef(false);
  const sync = useCallback(async () => {
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        rerun.current = false;
        await syncOnce();
      } while (rerun.current);
    } catch (e) {
      console.warn('[nudges] Sync failed:', e);
    } finally {
      running.current = false;
    }
  }, [syncOnce]);

  const ready = !!store && !!permission && !loading;
  useEffect(() => {
    if (!NUDGES_SUPPORTED || !ready) return;
    const timer = setTimeout(sync, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    ready,
    sync,
    store?.enabled,
    store?.coach,
    permission?.granted,
    nudgeWorkouts,
    plan,
    currentWorkout?.id,
    i18n.language,
    weightUnit,
    aiMode,
    isAuthenticated,
    userId,
    tick,
  ]);

  // ── Settings actions ──
  const setEnabled = useCallback(async (on: boolean) => {
    if (!on) {
      updateStore({ enabled: false });
      return;
    }
    let perm = permission ?? (await getNotificationPermission());
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        // Only the phone's settings can turn notifications back on.
        await Linking.openSettings();
        return;
      }
      perm = await requestNotificationPermission();
      setPermission(perm);
    }
    updateStore({ enabled: true, askedAfterWorkout: true });
  }, [permission, updateStore]);

  const setCoach = useCallback((coach: CoachChoice) => updateStore({ coach }), [updateStore]);

  const previewCount = useRef(0);
  const sendPreview = useCallback(async () => {
    let perm = permission ?? (await getNotificationPermission());
    if (!perm.granted) {
      if (!perm.canAskAgain) return;
      perm = await requestNotificationPermission();
      setPermission(perm);
      if (!perm.granted) return;
    }
    const today = dateToDay(new Date());
    const L = latest.current;
    const planDays = L.plan ? planDaysFor(L.plan, L.workouts, today, today + HORIZON_DAYS) : undefined;
    const upcoming = planNudges(
      { today, workouts: L.nudgeWorkouts, planDays, firstSeenDay: storeRef.current?.firstSeenDay, sent: [] },
      today,
      today + HORIZON_DAYS,
    )[0];
    const nudge = upcoming ? { ...upcoming, day: today + previewCount.current } : sampleNudge(today, L.nudgeWorkouts);
    const coach = coachFor(storeRef.current?.coach ?? 'mix', today + previewCount.current++);
    const { title, body } = renderNudge(nudge, coach, L.formatVolume);
    await presentNow(title, body);
  }, [permission]);

  const value: NotificationsContextType = {
    supported: NUDGES_SUPPORTED,
    enabled: !!store?.enabled && !!permission?.granted,
    blocked: !!permission && !permission.granted && !permission.canAskAgain,
    coach: store?.coach ?? 'mix',
    aiNudges: aiMode,
    setEnabled,
    setCoach,
    sendPreview,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
};
