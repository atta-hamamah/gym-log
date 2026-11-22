/**
 * The rest timer, app-wide: it keeps running when the user leaves the workout
 * screen or the app.
 *
 * It counts down to a fixed end time (not a tick counter), so the time is
 * right again the moment the app comes back from the background. Outside the
 * app, restAlerts.ts rings at the end and shows the live countdown; inside,
 * this provider plays the alert and RestTimerPill shows the time on every
 * screen.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { useWorkout } from './WorkoutContext';
import { cancelRestAlerts, scheduleRestAlerts, type RestAlertTexts } from '../services/restAlerts';

const DEFAULT_REST = 90;
/** After this long past the end, the user has clearly moved on: stop the timer. */
const MAX_OVERTIME_S = 10 * 60;

interface RestTimerValue {
  /** Seconds left; negative while overtime; null when no rest is running. */
  remaining: number | null;
  /** Length of the current rest, in seconds (for the progress bar). */
  total: number;
  finished: boolean;
  /** Rest length used when none is given (the plan's or the last one picked). */
  defaultDuration: number;
  setDefaultDuration: (seconds: number) => void;
  /** Start a rest of `seconds` (or the default). */
  start: (seconds?: number) => void;
  /** Restart with a new length, which also becomes the default. */
  restart: (seconds: number) => void;
  addTime: (seconds: number) => void;
  stop: () => void;
}

const RestTimerContext = createContext<RestTimerValue | null>(null);

const secondsUntil = (endAt: number) => Math.ceil((endAt - Date.now()) / 1000);

export const RestTimerProvider = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const { currentWorkout } = useWorkout();
  const player = useAudioPlayer(require('../../assets/alert.mp3'));

  const [endAt, setEndAt] = useState<number | null>(null);
  const [total, setTotal] = useState(DEFAULT_REST);
  const [defaultDuration, setDefaultDurationState] = useState(DEFAULT_REST);
  const [remaining, setRemaining] = useState<number | null>(null);
  const defaultRef = useRef(DEFAULT_REST);
  const alertedFor = useRef<number | null>(null);

  const texts = useCallback((): RestAlertTexts => ({
    channelName: t('restTimer.channelName'),
    liveChannelName: t('restTimer.liveChannelName'),
    endTitle: t('restTimer.endTitle'),
    endBody: t('restTimer.endBody'),
    liveTitle: t('restTimer.liveTitle'),
    liveBody: t('restTimer.liveBody'),
  }), [t]);

  const run = useCallback((end: number, length: number) => {
    setEndAt(end);
    setTotal(length);
    setRemaining(secondsUntil(end));
    alertedFor.current = null;
    scheduleRestAlerts(end, texts());
  }, [texts]);

  const setDefaultDuration = useCallback((seconds: number) => {
    defaultRef.current = seconds;
    setDefaultDurationState(seconds);
  }, []);

  const start = useCallback((seconds?: number) => {
    const length = seconds && seconds > 0 ? seconds : defaultRef.current;
    run(Date.now() + length * 1000, length);
  }, [run]);

  const restart = useCallback((seconds: number) => {
    setDefaultDuration(seconds);
    run(Date.now() + seconds * 1000, seconds);
  }, [run, setDefaultDuration]);

  const stop = useCallback(() => {
    setEndAt(null);
    setRemaining(null);
    cancelRestAlerts();
  }, []);

  const addTime = useCallback((seconds: number) => {
    if (endAt === null) return;
    // Overtime: +30s means 30s from now, not 30s added to an end in the past.
    const base = Math.max(endAt, Date.now());
    const left = Math.max(0, secondsUntil(endAt));
    run(base + seconds * 1000, left > 0 ? total + seconds : seconds);
  }, [endAt, total, run]);

  // Tick: recompute from the end time, re-render once per second.
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const left = secondsUntil(endAt);
      if (left < -MAX_OVERTIME_S) {
        stop();
        return;
      }
      setRemaining(prev => (prev === left ? prev : left));
    }, 250);
    return () => clearInterval(id);
  }, [endAt, stop]);

  // Rest just ended: ring in the app. If the app was away at that moment, the
  // scheduled notification already rang, so stay quiet when coming back.
  useEffect(() => {
    if (endAt === null || remaining === null || remaining > 0 || alertedFor.current === endAt) return;
    alertedFor.current = endAt;
    if (AppState.currentState !== 'active' || Date.now() - endAt > 3000) return;
    try {
      player.seekTo(0);
      player.play();
      setTimeout(() => {
        try {
          player.seekTo(0);
          player.play();
        } catch {
          // The second beep is a nice-to-have.
        }
      }, 1000);
    } catch (e) {
      console.warn('Could not play alert sound:', e);
    }
    Vibration.vibrate([0, 400, 200, 400]);
  }, [remaining, endAt, player]);

  // Workout finished or discarded: no more rest.
  useEffect(() => {
    if (!currentWorkout && endAt !== null) stop();
  }, [currentWorkout, endAt, stop]);

  const value = useMemo<RestTimerValue>(() => ({
    remaining: endAt === null ? null : remaining,
    total,
    finished: endAt !== null && remaining !== null && remaining <= 0,
    defaultDuration,
    setDefaultDuration,
    start,
    restart,
    addTime,
    stop,
  }), [endAt, remaining, total, defaultDuration, setDefaultDuration, start, restart, addTime, stop]);

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
};

export const useRestTimer = (): RestTimerValue => {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used inside RestTimerProvider');
  return ctx;
};

/** "1:05", or "+0:12" while overtime. */
export const formatRest = (seconds: number) => {
  const abs = Math.abs(seconds);
  const sign = seconds < 0 ? '+' : '';
  return `${sign}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
};
