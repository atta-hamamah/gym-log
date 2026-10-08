import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useConvex, useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { StorageService, pendingChangeCount, type SyncState } from '../services/storage';
import {
  runSync,
  pushWorkoutNow as pushWorkoutToCloud,
  claimLocalData,
  linkLocalDataToAccount,
  replaceLocalDataWithAccount,
  getOwnership,
  SyncOwnershipError,
  SyncAccessError,
  type Ownership,
  type SyncAccount,
  type SyncProgress,
  type SyncReport,
} from '../services/cloudSync';
import { useSubscription } from './SubscriptionContext';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'conflict';

export type SyncResult =
  | { ok: true; report: SyncReport }
  | { ok: false; reason: 'inactive' | 'conflict' | 'notVerified' | 'error'; message?: string };

/** `lastError` value when the server couldn't confirm the subscription. */
export const SUBSCRIPTION_NOT_VERIFIED = 'subscription_not_verified';

/** Max wait for the cloud ID of a just-finished workout before falling back to local stats. */
const PUSH_NOW_TIMEOUT_MS = 8000;
const FOREGROUND_MIN_INTERVAL_MS = 60 * 1000;
const LOCAL_CHANGE_DEBOUNCE_MS = 1500;

interface CloudSyncContextType {
  /** Signed in + active AI subscription + connected → data syncs with the cloud */
  cloudSyncActive: boolean;
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Local changes not uploaded yet (kept safely on the device until they are) */
  pendingChanges: number;
  lastError: string | null;
  /** This device's data is linked to an account (deletes also apply to its cloud copy) */
  accountLinked: boolean;
  /** How this device's data relates to the signed-in account (null when signed out) */
  ownership: Ownership | null;

  syncNow: (onProgress?: (p: SyncProgress) => void) => Promise<SyncResult>;
  /** Upload a just-finished workout right away; resolves to its cloud ID or null */
  pushWorkoutNow: (workoutId: string) => Promise<string | null>;
  /** Link unowned local data to the signed-in account; reports data owned by another account */
  claimLocalData: () => Promise<Ownership | null>;
  /** Local data belongs to another account: move it to this one, or replace it */
  resolveOwnership: (choice: 'merge' | 'replace') => Promise<void>;
  /** Upload pending changes, then sign out. Workouts stay on this device. */
  signOut: () => Promise<void>;
  /** Delete the cloud account, the Clerk user and all data on this device */
  deleteAccount: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextType | undefined>(undefined);

export const CloudSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const convex = useConvex();
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  const { isSignedIn, userId, signOut: clerkSignOut } = useAuth();
  const { user } = useUser();
  const { isAISubscriber, forgetDeviceEntitlements } = useSubscription();

  const cloudSyncActive = isAISubscriber && !!isSignedIn && convexAuthenticated;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const fullName = user?.fullName ?? null;

  const account: SyncAccount | null = useMemo(
    () => (isSignedIn && userId ? { userId, email, name: fullName } : null),
    [isSignedIn, userId, email, fullName],
  );

  // Refs give async work the latest values without re-creating callbacks.
  const accountRef = useRef(account);
  accountRef.current = account;
  const activeRef = useRef(cloudSyncActive);
  activeRef.current = cloudSyncActive;
  const convexAuthRef = useRef(convexAuthenticated);
  convexAuthRef.current = convexAuthenticated;

  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshSyncState = useCallback(async () => {
    try {
      setSyncState(await StorageService.getSyncState());
    } catch (e) {
      console.warn('[CloudSync] Failed to read sync state', e);
    }
  }, []);

  // ── Sync runner (single flight; requests during a run queue one follow-up) ──
  const inFlightRef = useRef<Promise<SyncResult> | null>(null);
  const rerunRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunRef = useRef(0);
  const scheduleRef = useRef<(delay?: number) => void>(() => {});

  const syncNow = useCallback((onProgress?: (p: SyncProgress) => void): Promise<SyncResult> => {
    if (inFlightRef.current) {
      rerunRef.current = true;
      return inFlightRef.current;
    }
    const acc = accountRef.current;
    if (!activeRef.current || !acc) {
      return Promise.resolve({ ok: false, reason: 'inactive' });
    }

    const run = (async (): Promise<SyncResult> => {
      setStatus('syncing');
      lastRunRef.current = Date.now();
      try {
        const report = await runSync(convex, acc, onProgress);
        setStatus('idle');
        setLastError(null);
        return { ok: true, report };
      } catch (e: any) {
        if (e instanceof SyncOwnershipError) {
          setStatus('conflict');
          return { ok: false, reason: 'conflict' };
        }
        if (e instanceof SyncAccessError) {
          setStatus('error');
          setLastError(SUBSCRIPTION_NOT_VERIFIED);
          return { ok: false, reason: 'notVerified' };
        }
        console.warn('[CloudSync] Sync failed:', e);
        setStatus('error');
        setLastError(e?.message ?? String(e));
        return { ok: false, reason: 'error', message: e?.message };
      } finally {
        inFlightRef.current = null;
        refreshSyncState();
        if (rerunRef.current) {
          rerunRef.current = false;
          scheduleRef.current(1000);
        }
      }
    })();
    inFlightRef.current = run;
    return run;
  }, [convex, refreshSyncState]);

  const scheduleSync = useCallback((delay: number = LOCAL_CHANGE_DEBOUNCE_MS) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (activeRef.current) syncNow();
    }, delay);
  }, [syncNow]);
  scheduleRef.current = scheduleSync;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ── Local changes → upload (debounced) ──
  useEffect(() => {
    refreshSyncState();
    return StorageService.onDataChange(source => {
      refreshSyncState();
      if (source === 'local' && activeRef.current) scheduleRef.current();
    });
  }, [refreshSyncState]);

  // ── Signed in → link unowned local data to the account ──
  useEffect(() => {
    if (!account) return;
    claimLocalData(account).then(refreshSyncState).catch(e => {
      console.warn('[CloudSync] Failed to link local data', e);
    });
  }, [account?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync becomes active (subscribed + signed in + connected) → full sync ──
  const seenVersionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    seenVersionRef.current = undefined;
    if (cloudSyncActive) {
      syncNow();
    } else {
      setStatus('off');
    }
  }, [cloudSyncActive, account?.userId, syncNow]);

  // ── Another device changed the cloud data → pull ──
  const cloudVersion = useQuery(api.sync.version, cloudSyncActive ? {} : 'skip');
  useEffect(() => {
    if (cloudVersion === undefined || cloudVersion === null) return;
    if (seenVersionRef.current === undefined) {
      seenVersionRef.current = cloudVersion; // initial value: the activation sync covers it
      return;
    }
    if (cloudVersion !== seenVersionRef.current) {
      seenVersionRef.current = cloudVersion;
      scheduleSync(500);
    }
  }, [cloudVersion, scheduleSync]);

  // ── Connection restored → upload what was saved offline ──
  useEffect(() => {
    let wasConnected = convex.connectionState().isWebSocketConnected;
    return convex.subscribeToConnectionState(state => {
      if (state.isWebSocketConnected && !wasConnected && activeRef.current) {
        scheduleSync(1000);
      }
      wasConnected = state.isWebSocketConnected;
    });
  }, [convex, scheduleSync]);

  // ── App back in foreground → catch up ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (
        next === 'active' &&
        activeRef.current &&
        Date.now() - lastRunRef.current > FOREGROUND_MIN_INTERVAL_MS
      ) {
        scheduleSync(0);
      }
    });
    return () => sub.remove();
  }, [scheduleSync]);

  // ── Actions ──
  const pushWorkoutNow = useCallback(async (workoutId: string): Promise<string | null> => {
    const acc = accountRef.current;
    if (!activeRef.current || !acc) return null;
    // Offline: don't make the user wait — the workout is queued and uploads on reconnect.
    if (!convex.connectionState().isWebSocketConnected) return null;
    const push = pushWorkoutToCloud(convex, acc, workoutId).catch(e => {
      console.warn('[CloudSync] Immediate workout upload failed (will retry):', e);
      return null;
    });
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), PUSH_NOW_TIMEOUT_MS));
    return Promise.race([push, timeout]);
  }, [convex]);

  const claim = useCallback(async (): Promise<Ownership | null> => {
    const acc = accountRef.current;
    if (!acc) return null;
    const result = await claimLocalData(acc);
    await refreshSyncState();
    return result;
  }, [refreshSyncState]);

  const resolveOwnership = useCallback(async (choice: 'merge' | 'replace') => {
    const acc = accountRef.current;
    if (!acc) return;
    if (choice === 'merge') {
      await linkLocalDataToAccount(acc);
    } else {
      await replaceLocalDataWithAccount(acc);
    }
    await refreshSyncState();
    setStatus(activeRef.current ? 'idle' : 'off');
    if (activeRef.current) await syncNow();
  }, [refreshSyncState, syncNow]);

  const signOut = useCallback(async () => {
    if (activeRef.current) {
      await syncNow(); // upload what's pending while we still can
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    await clerkSignOut();
    // RevenueCat follows Clerk (SubscriptionContext switches it to anonymous).
  }, [syncNow, clerkSignOut]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    if (!convexAuthRef.current) {
      throw new Error('Not connected to the server. Check your connection and try again.');
    }
    // Cloud data first: if this fails, nothing has been deleted yet.
    await convex.mutation(api.users.deleteAccount, {});
    await user.delete();
    try {
      await clerkSignOut();
    } catch {
      // Deleting the user already ended the session.
    }
    await StorageService.resetAfterAccountDeletion();
    forgetDeviceEntitlements();
  }, [user, convex, clerkSignOut, forgetDeviceEntitlements]);

  const ownership = account && syncState ? getOwnership(syncState, account.userId) : null;
  const effectiveStatus: SyncStatus = !cloudSyncActive
    ? 'off'
    : ownership?.status === 'otherAccount'
      ? 'conflict'
      : status;

  return (
    <CloudSyncContext.Provider
      value={{
        cloudSyncActive,
        status: effectiveStatus,
        lastSyncedAt: syncState?.lastSyncedAt ?? null,
        pendingChanges: syncState ? pendingChangeCount(syncState) : 0,
        lastError,
        accountLinked: !!syncState?.ownerId,
        ownership,
        syncNow,
        pushWorkoutNow,
        claimLocalData: claim,
        resolveOwnership,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  );
};

export const useCloudSync = () => {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider');
  }
  return context;
};
