/**
 * Device side of coach nudges (expo-notifications): the Android channel,
 * permission, this device's Expo push token, and the template nudges
 * scheduled on the phone. NotificationsContext decides what to do with them.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { CoachChoice, NudgeKind, SentNudge } from '../notifications/nudges';

export const NUDGES_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

/** Android channel for coach nudges (the server sends to the same one). */
export const NUDGE_CHANNEL = 'coach';
/** Identifier prefix of scheduled template nudges. */
const NUDGE_ID_PREFIX = 'nudge-';
const STORE_KEY = '@gym_log_nudges';

export interface ScheduledNudge {
  id: string;
  at: number;
  day: number;
  kind: NudgeKind;
  group?: string;
}

export interface NudgeStore {
  enabled: boolean;
  coach: CoachChoice;
  /** Day the app was first opened with nudges (welcome nudges). */
  firstSeenDay?: number;
  /** Template nudges already delivered on this phone (spacing and weekly cap). */
  sent: SentNudge[];
  /** Template nudges scheduled on this phone right now. */
  scheduled: ScheduledNudge[];
  /** Push token registered with the server for AI nudges, and the Clerk user it's registered to. */
  registered?: { token: string; userId: string };
  /** Asked for notification permission after a workout already (only once). */
  askedAfterWorkout?: boolean;
}

export const DEFAULT_NUDGE_STORE: NudgeStore = { enabled: true, coach: 'mix', sent: [], scheduled: [] };

export async function loadNudgeStore(): Promise<NudgeStore> {
  try {
    const json = await AsyncStorage.getItem(STORE_KEY);
    return json ? { ...DEFAULT_NUDGE_STORE, ...JSON.parse(json) } : { ...DEFAULT_NUDGE_STORE };
  } catch {
    return { ...DEFAULT_NUDGE_STORE };
  }
}

export async function saveNudgeStore(store: NudgeStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[nudges] Could not save settings:', e);
  }
}

if (NUDGES_SUPPORTED) {
  // Show nudges as a banner even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs the channel before it shows the permission prompt (Android 13+) or any notification. */
export async function ensureNudgeChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#4FB8FF',
  });
}

export interface NotificationPermission {
  granted: boolean;
  /** False once the user said no for good: only the phone's settings can turn it back on. */
  canAskAgain: boolean;
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const p = await Notifications.requestPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

/** This device's Expo push token (needs a development or store build with Firebase set up). */
export async function getPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.warn('[nudges] No push token:', e);
    return null;
  }
}

export function deviceTimeZone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export const nudgeId = (day: number) => `${NUDGE_ID_PREFIX}${day}`;

/** Cancel every template nudge scheduled on this phone. */
export async function cancelScheduledNudges(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter(n => n.identifier.startsWith(NUDGE_ID_PREFIX))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

export async function scheduleNudge(id: string, at: Date, title: string, body: string, kind: NudgeKind): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { type: 'nudge', kind } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: NUDGE_CHANNEL },
  });
}

/** Show a notification right away (Settings preview). */
export async function presentNow(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { type: 'preview' } },
    trigger: Platform.OS === 'android' ? { channelId: NUDGE_CHANNEL } : null,
  });
}

/**
 * Stop AI nudges to this device. Called on sign-out, while the session is
 * still valid; never blocks sign-out for more than a few seconds.
 */
export async function unregisterPushDevice(convex: ConvexReactClient): Promise<void> {
  const store = await loadNudgeStore();
  if (!store.registered) return;
  try {
    await Promise.race([
      convex.mutation(api.notifications.unregisterDevice, { token: store.registered.token }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
  } catch (e) {
    console.warn('[nudges] Could not unregister this device:', e);
  }
  await saveNudgeStore({ ...store, registered: undefined });
}
