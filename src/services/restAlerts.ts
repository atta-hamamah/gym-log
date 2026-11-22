/**
 * Rest timer alerts outside the app:
 * - the alarm when rest ends: a notification scheduled for the end time, so it
 *   rings even if the user is in another app or the phone is locked (Android
 *   and iOS);
 * - the live countdown in the notification shade (Android, native module).
 *
 * While the app is open, the in-app alert plays instead (see the foreground
 * handler in notifications.ts and RestTimerContext).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dismissLiveCountdown, showLiveCountdown } from '../../modules/rest-timer-notification';

/** `data.type` of the end-of-rest notification. */
export const REST_END_TYPE = 'restEnd';

const REST_CHANNEL = 'rest-timer';
const REST_END_ID = 'rest-end';
/** Set once we've asked for notification permission for the rest alarm. */
const ASKED_KEY = '@gym_log_rest_alerts_asked';
const SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

export interface RestAlertTexts {
  channelName: string;
  liveChannelName: string;
  endTitle: string;
  endBody: string;
  liveTitle: string;
  liveBody: string;
}

async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REST_CHANNEL, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Notification permission for the alarm. Asks at most once (the first rest), never nags. */
async function canNotify(texts: RestAlertTexts): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  if (await AsyncStorage.getItem(ASKED_KEY).catch(() => null)) return false;
  await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
  // Android 13+ shows the permission prompt only once a channel exists.
  await ensureChannel(texts.channelName);
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Start, +30s and skip can follow each other quickly: run the async work in
// order so an older schedule never lands after a newer one.
let queue: Promise<void> = Promise.resolve();
function enqueue(job: () => Promise<void>): void {
  queue = queue.then(job).catch(e => console.warn('[rest] Alert update failed:', e));
}

async function clearAlerts(): Promise<void> {
  dismissLiveCountdown();
  await Notifications.cancelScheduledNotificationAsync(REST_END_ID).catch(() => {});
  // The alarm may already be in the shade (rest ended while away).
  await Notifications.dismissNotificationAsync(REST_END_ID).catch(() => {});
}

/** Rest ends at `endAt` (ms): schedule the alarm and show the live countdown, replacing any previous ones. */
export function scheduleRestAlerts(endAt: number, texts: RestAlertTexts): void {
  if (!SUPPORTED) return;
  enqueue(async () => {
    await clearAlerts();
    if (endAt - Date.now() < 1000) return;
    if (!(await canNotify(texts))) return;
    await ensureChannel(texts.channelName);
    await Notifications.scheduleNotificationAsync({
      identifier: REST_END_ID,
      content: {
        title: texts.endTitle,
        body: texts.endBody,
        sound: 'default',
        vibrate: [0, 400, 200, 400],
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { type: REST_END_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endAt), channelId: REST_CHANNEL },
    });
    showLiveCountdown(endAt, texts.liveTitle, texts.liveBody, texts.liveChannelName);
  });
}

/** Rest skipped or done: remove the alarm and the countdown. */
export function cancelRestAlerts(): void {
  if (!SUPPORTED) return;
  enqueue(clearAlerts);
}
