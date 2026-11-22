/**
 * Live rest countdown in the notification shade (Android only).
 *
 * The native module only exists in builds made after it was added: on iOS,
 * Expo Go or an older build every call is a harmless no-op.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface RestTimerNotificationNative {
  show(endAtMs: number, title: string, body: string, channelName: string): boolean;
  dismiss(): void;
}

const native = Platform.OS === 'android'
  ? requireOptionalNativeModule<RestTimerNotificationNative>('RestTimerNotification')
  : null;

export const LIVE_COUNTDOWN_SUPPORTED = native != null;

/** Show or update the countdown to `endAtMs`. Returns false if it couldn't be shown. */
export function showLiveCountdown(endAtMs: number, title: string, body: string, channelName: string): boolean {
  if (!native) return false;
  try {
    return native.show(endAtMs, title, body, channelName);
  } catch (e) {
    console.warn('[rest] Live countdown failed:', e);
    return false;
  }
}

export function dismissLiveCountdown(): void {
  try {
    native?.dismiss();
  } catch {
    // Nothing to clean up.
  }
}
