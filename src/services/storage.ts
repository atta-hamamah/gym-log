
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession, Exercise, UserStats, PersonalRecord, BodyMeasurement } from '../types';
import { EXERCISES } from '../constants/exercises';
import { readDocument, writeDocument, removeDocument } from './fileStore';

// Large, growing collections are stored as files (see fileStore.ts). Their
// AsyncStorage keys below are only read once, to migrate older installs.
const DOCS = {
  WORKOUTS: 'workouts',
  CUSTOM_EXERCISES: 'custom_exercises',
  PERSONAL_RECORDS: 'personal_records',
  BODY_MEASUREMENTS: 'body_measurements',
} as const;

const KEYS = {
  WORKOUTS: '@gym_log_workouts',
  CUSTOM_EXERCISES: '@gym_log_custom_exercises',
  USER_STATS: '@gym_log_user_stats',
  CURRENT_WORKOUT: '@gym_log_current_workout', // For resuming if app crashes
  PERSONAL_RECORDS: '@gym_log_personal_records',
  BODY_MEASUREMENTS: '@gym_log_body_measurements',
  FIRST_OPEN: '@gym_log_first_open',
  THEME_PREFERENCE: '@gym_log_theme_preference',
  UNIT_PREFERENCE: '@gym_log_unit_preference',
  SYNC_STATE: '@gym_log_sync_state',
  BILLING_CACHE: '@gym_log_billing_cache',
};

// Written by older app versions; read once for migration, then removed.
const LEGACY_KEYS = {
  PURCHASE_STATUS: '@gym_log_purchase_status',
  IS_LIVE: '@gym_log_is_live',
  AI_SUBSCRIPTION_STATUS: '@gym_log_ai_sub_status',
};

export interface BillingCache {
  /**
   * This device has seen a Pro purchase or an AI subscription. Pro stays
   * unlocked here after signing out and while offline.
   */
  lifetimePro: boolean;
  hasAI: boolean;
  aiExpiresAt: number | null;
  appUserId: string | null;
}

// ── Sync bookkeeping ─────────────────────────────────────

export type WipeScope = 'history' | 'all';

export interface MeasurementTombstone {
  id: string;
  date: number;
}

/**
 * Tracks how the local data relates to the cloud copy.
 *
 * Invariant: every local record is either confirmed in the cloud of `ownerId`,
 * or listed in `pending`. Deletes are kept in `deleted` until the cloud
 * confirms them, so nothing is lost or resurrected while sync is paused
 * (offline, signed out, or AI subscription inactive).
 */
export interface SyncState {
  version: 1;
  /** Clerk user ID whose cloud account this local data belongs to. */
  ownerId: string | null;
  ownerEmail: string | null;
  pending: {
    workouts: string[];
    customExercises: string[];
    bodyMeasurements: string[];
    personalRecords: string[];
  };
  deleted: {
    workouts: string[];
    bodyMeasurements: MeasurementTombstone[];
  };
  /** A "clear all" made locally that still has to be applied to the cloud. */
  wipe: WipeScope | null;
  lastSyncedAt: number | null;
}

/** PRs have no ID; a workout produces at most one PR per exercise and type. */
export const personalRecordKey = (pr: Pick<PersonalRecord, 'workoutId' | 'exerciseId' | 'type'>) =>
  `${pr.workoutId}|${pr.exerciseId}|${pr.type}`;

export function emptySyncState(ownerId: string | null = null, ownerEmail: string | null = null): SyncState {
  return {
    version: 1,
    ownerId,
    ownerEmail,
    pending: { workouts: [], customExercises: [], bodyMeasurements: [], personalRecords: [] },
    deleted: { workouts: [], bodyMeasurements: [] },
    wipe: null,
    lastSyncedAt: null,
  };
}

export function pendingChangeCount(state: SyncState): number {
  return (
    state.pending.workouts.length +
    state.pending.customExercises.length +
    state.pending.bodyMeasurements.length +
    state.pending.personalRecords.length +
    state.deleted.workouts.length +
    state.deleted.bodyMeasurements.length +
    (state.wipe ? 1 : 0)
  );
}

const addIds = (list: string[], ids: string[]) => Array.from(new Set([...list, ...ids]));
const removeIds = (list: string[], ids: string[]) => {
  const drop = new Set(ids);
  return list.filter(id => !drop.has(id));
};

// ── Change notifications ─────────────────────────────────
// 'local'  = the user changed data on this device (triggers an upload)
// 'remote' = sync replaced local data with cloud data (triggers a UI reload)

export type DataChangeSource = 'local' | 'remote';
type DataChangeListener = (source: DataChangeSource) => void;
const listeners = new Set<DataChangeListener>();

function emitChange(source: DataChangeSource) {
  listeners.forEach(listener => {
    try {
      listener(source);
    } catch (e) {
      console.warn('[Storage] change listener failed', e);
    }
  });
}

// ── Write lock ───────────────────────────────────────────
// Serializes read-modify-write cycles so a background sync merge can never
// overwrite a workout the user saved a moment earlier.

let lockQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockQueue.then(fn);
  lockQueue = run.catch(() => undefined);
  return run;
}

// ── Raw (unlocked) helpers ───────────────────────────────

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : fallback;
  } catch (e) {
    console.error(`Failed to read ${key}`, e);
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

const sortWorkouts = (list: WorkoutSession[]) => list.sort((a, b) => b.startTime - a.startTime);
const sortMeasurements = (list: BodyMeasurement[]) => list.sort((a, b) => b.date - a.date);

async function readDoc<T>(name: string, legacyKey: string, fallback: T): Promise<T> {
  try {
    return await readDocument(name, legacyKey, fallback);
  } catch (e) {
    console.error(`Failed to read ${name}`, e);
    return fallback;
  }
}

const raw = {
  readWorkouts: () => readDoc<WorkoutSession[]>(DOCS.WORKOUTS, KEYS.WORKOUTS, []),
  writeWorkouts: (workouts: WorkoutSession[]) =>
    writeDocument(DOCS.WORKOUTS, KEYS.WORKOUTS, sortWorkouts(workouts)),
  readCustomExercises: () => readDoc<Exercise[]>(DOCS.CUSTOM_EXERCISES, KEYS.CUSTOM_EXERCISES, []),
  writeCustomExercises: (exercises: Exercise[]) =>
    writeDocument(DOCS.CUSTOM_EXERCISES, KEYS.CUSTOM_EXERCISES, exercises.map(e => ({ ...e, isCustom: true }))),
  readPersonalRecords: () => readDoc<PersonalRecord[]>(DOCS.PERSONAL_RECORDS, KEYS.PERSONAL_RECORDS, []),
  writePersonalRecords: (records: PersonalRecord[]) =>
    writeDocument(DOCS.PERSONAL_RECORDS, KEYS.PERSONAL_RECORDS, records),
  readBodyMeasurements: () => readDoc<BodyMeasurement[]>(DOCS.BODY_MEASUREMENTS, KEYS.BODY_MEASUREMENTS, []),
  writeBodyMeasurements: (measurements: BodyMeasurement[]) =>
    writeDocument(DOCS.BODY_MEASUREMENTS, KEYS.BODY_MEASUREMENTS, sortMeasurements(measurements)),

  /** Load sync state, creating it on first run (or after upgrading from an older version). */
  async readSyncState(): Promise<SyncState> {
    const existing = await readJSON<SyncState | null>(KEYS.SYNC_STATE, null);
    if (existing && existing.version === 1) return existing;

    // Nothing has been confirmed by the new sync engine yet: treat every local
    // record as pending. Uploads are idempotent, so re-sending data the cloud
    // already has creates no duplicates.
    const [workouts, customs, prs, measurements] = await Promise.all([
      raw.readWorkouts(),
      raw.readCustomExercises(),
      raw.readPersonalRecords(),
      raw.readBodyMeasurements(),
    ]);
    const state = emptySyncState();
    state.pending = {
      workouts: workouts.map(w => w.id),
      customExercises: customs.map(e => e.id),
      bodyMeasurements: measurements.map(m => m.id),
      personalRecords: prs.map(personalRecordKey),
    };
    await writeJSON(KEYS.SYNC_STATE, state);
    await AsyncStorage.multiRemove([LEGACY_KEYS.IS_LIVE, LEGACY_KEYS.AI_SUBSCRIPTION_STATUS]);
    return state;
  },
  writeSyncState: (state: SyncState) => writeJSON(KEYS.SYNC_STATE, state),

  /** Remove local data for the given scope (preferences and trial date are kept). */
  async wipeData(scope: WipeScope): Promise<void> {
    await removeDocument(DOCS.WORKOUTS, KEYS.WORKOUTS);
    await removeDocument(DOCS.PERSONAL_RECORDS, KEYS.PERSONAL_RECORDS);
    await AsyncStorage.removeItem(KEYS.CURRENT_WORKOUT);
    if (scope === 'all') {
      await removeDocument(DOCS.CUSTOM_EXERCISES, KEYS.CUSTOM_EXERCISES);
      await removeDocument(DOCS.BODY_MEASUREMENTS, KEYS.BODY_MEASUREMENTS);
      await AsyncStorage.removeItem(KEYS.USER_STATS);
    }
  },
};

/**
 * Low-level access for the sync engine only. Callers must wrap
 * read-modify-write sequences in `withLock` and call `emitChange('remote')`
 * after replacing data.
 */
export const SyncStore = {
  withLock,
  emitChange,
  ...raw,
};

// ── Public storage API ───────────────────────────────────

export const StorageService = {
  /** Subscribe to data changes. Returns an unsubscribe function. */
  onDataChange(listener: DataChangeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // WORKOUTS
  getWorkouts(): Promise<WorkoutSession[]> {
    return raw.readWorkouts();
  },

  // Every write below records the change in the sync state BEFORE touching the
  // data. If the app dies in between, the sync engine just drops a pending ID
  // with no record (or deletes a record that's already marked deleted) —
  // it never ends up with a record that is neither uploaded nor queued.

  async saveWorkout(workout: WorkoutSession): Promise<void> {
    await withLock(async () => {
      const state = await raw.readSyncState();
      const workouts = await raw.readWorkouts();

      state.pending.workouts = addIds(state.pending.workouts, [workout.id]);
      state.deleted.workouts = removeIds(state.deleted.workouts, [workout.id]);
      await raw.writeSyncState(state);

      const index = workouts.findIndex(w => w.id === workout.id);
      if (index >= 0) {
        workouts[index] = workout;
      } else {
        workouts.unshift(workout);
      }
      await raw.writeWorkouts(workouts);
    });
    emitChange('local');
  },

  async deleteWorkout(id: string): Promise<void> {
    await withLock(async () => {
      // Always remember the delete: the cloud may hold a copy even before this
      // device is linked (e.g. data restored by an older app version).
      const state = await raw.readSyncState();
      state.pending.workouts = removeIds(state.pending.workouts, [id]);
      state.deleted.workouts = addIds(state.deleted.workouts, [id]);
      await raw.writeSyncState(state);

      const workouts = await raw.readWorkouts();
      await raw.writeWorkouts(workouts.filter(w => w.id !== id));
    });
    emitChange('local');
  },

  // EXERCISES
  async getExercises(): Promise<Exercise[]> {
    const customExercises = await raw.readCustomExercises();
    return [...EXERCISES, ...customExercises];
  },

  getCustomExercises(): Promise<Exercise[]> {
    return raw.readCustomExercises();
  },

  async addCustomExercise(exercise: Exercise): Promise<void> {
    await withLock(async () => {
      const state = await raw.readSyncState();
      state.pending.customExercises = addIds(state.pending.customExercises, [exercise.id]);
      await raw.writeSyncState(state);

      const customExercises = await raw.readCustomExercises();
      const next = customExercises.filter(e => e.id !== exercise.id);
      next.push({ ...exercise, isCustom: true });
      await raw.writeCustomExercises(next);
    });
    emitChange('local');
  },

  // USER STATS (device-only)
  async getUserStats(): Promise<UserStats | null> {
    return readJSON<UserStats | null>(KEYS.USER_STATS, null);
  },

  async updateUserStats(stats: Partial<UserStats>): Promise<void> {
    try {
      const current = await this.getUserStats();
      const newStats = { ...current, ...stats, lastUpdated: Date.now() };
      await AsyncStorage.setItem(KEYS.USER_STATS, JSON.stringify(newStats));
    } catch (e) {
      console.error('Failed to update stats', e);
    }
  },

  // CURRENT ACTIVE WORKOUT (Resume on restart)
  async saveCurrentWorkout(workout: WorkoutSession | null): Promise<void> {
    if (!workout) {
      await AsyncStorage.removeItem(KEYS.CURRENT_WORKOUT);
    } else {
      await AsyncStorage.setItem(KEYS.CURRENT_WORKOUT, JSON.stringify(workout));
    }
  },

  async getCurrentWorkout(): Promise<WorkoutSession | null> {
    return readJSON<WorkoutSession | null>(KEYS.CURRENT_WORKOUT, null);
  },

  // PERSONAL RECORDS
  getPersonalRecords(): Promise<PersonalRecord[]> {
    return raw.readPersonalRecords();
  },

  async addPersonalRecords(newRecords: PersonalRecord[]): Promise<void> {
    if (newRecords.length === 0) return;
    await withLock(async () => {
      const state = await raw.readSyncState();
      const existing = await raw.readPersonalRecords();
      const keys = new Set(existing.map(personalRecordKey));
      const toAdd = newRecords.filter(pr => !keys.has(personalRecordKey(pr)));

      state.pending.personalRecords = addIds(state.pending.personalRecords, toAdd.map(personalRecordKey));
      await raw.writeSyncState(state);
      await raw.writePersonalRecords([...existing, ...toAdd]);
    });
    emitChange('local');
  },

  // BODY MEASUREMENTS
  getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return raw.readBodyMeasurements();
  },

  async saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
    await withLock(async () => {
      const state = await raw.readSyncState();
      state.pending.bodyMeasurements = addIds(state.pending.bodyMeasurements, [measurement.id]);
      await raw.writeSyncState(state);

      const existing = await raw.readBodyMeasurements();
      await raw.writeBodyMeasurements([...existing.filter(m => m.id !== measurement.id), measurement]);
    });
    emitChange('local');
  },

  async deleteBodyMeasurement(id: string): Promise<void> {
    await withLock(async () => {
      const state = await raw.readSyncState();
      const existing = await raw.readBodyMeasurements();
      const target = existing.find(m => m.id === id);

      state.pending.bodyMeasurements = removeIds(state.pending.bodyMeasurements, [id]);
      if (target) {
        state.deleted.bodyMeasurements = [
          ...state.deleted.bodyMeasurements.filter(t => t.id !== id),
          { id, date: target.date },
        ];
      }
      await raw.writeSyncState(state);
      await raw.writeBodyMeasurements(existing.filter(m => m.id !== id));
    });
    emitChange('local');
  },

  // CLEARING DATA

  /** Delete all workouts and PRs (here and, on next sync, in the cloud). */
  async clearWorkoutHistory(): Promise<void> {
    await withLock(async () => {
      const state = await raw.readSyncState();
      const workouts = await raw.readWorkouts();
      state.pending.workouts = [];
      state.pending.personalRecords = [];
      if (state.ownerId) {
        state.deleted.workouts = [];
        state.wipe = state.wipe === 'all' ? 'all' : 'history';
      } else {
        // Not linked to an account: never wipe a cloud we don't own, just remember the deletes.
        state.deleted.workouts = addIds(state.deleted.workouts, workouts.map(w => w.id));
      }
      await raw.writeSyncState(state);
      await raw.wipeData('history');
    });
    emitChange('local');
  },

  /**
   * Delete all workout data (here and, on next sync, in the cloud).
   * Keeps preferences, language, theme and the trial start date.
   */
  async clearAllUserData(): Promise<void> {
    await withLock(async () => {
      const state = await raw.readSyncState();
      const [workouts, measurements] = await Promise.all([raw.readWorkouts(), raw.readBodyMeasurements()]);
      const cleared = emptySyncState(state.ownerId, state.ownerEmail);
      cleared.lastSyncedAt = state.lastSyncedAt;
      if (state.ownerId) {
        cleared.wipe = 'all';
      } else {
        cleared.deleted = {
          workouts: addIds(state.deleted.workouts, workouts.map(w => w.id)),
          bodyMeasurements: [
            ...state.deleted.bodyMeasurements,
            ...measurements.map(m => ({ id: m.id, date: m.date })),
          ],
        };
      }
      await raw.writeSyncState(cleared);
      await raw.wipeData('all');
    });
    emitChange('local');
  },

  /** After the account was deleted: remove all data and unlink from any account. */
  async resetAfterAccountDeletion(): Promise<void> {
    await withLock(async () => {
      await raw.writeSyncState(emptySyncState());
      await raw.wipeData('all');
      await AsyncStorage.removeItem(KEYS.BILLING_CACHE);
    });
    emitChange('remote');
  },

  // SYNC STATE (read-only view for UI)
  getSyncState(): Promise<SyncState> {
    return withLock(() => raw.readSyncState());
  },

  // SUBSCRIPTION / TRIAL
  async getFirstOpenDate(): Promise<number | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.FIRST_OPEN);
      return value ? parseInt(value, 10) : null;
    } catch (e) {
      console.error('Failed to get first open date', e);
      return null;
    }
  },

  async setFirstOpenDate(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.FIRST_OPEN, timestamp.toString());
    } catch (e) {
      console.error('Failed to set first open date', e);
    }
  },

  /** Last known entitlements, used when RevenueCat can't be reached. */
  async getBillingCache(): Promise<BillingCache | null> {
    const cached = await readJSON<BillingCache | null>(KEYS.BILLING_CACHE, null);
    if (cached) return cached;
    // Older versions only stored whether Pro was bought.
    try {
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.PURCHASE_STATUS);
      if (legacy === 'pro' || legacy === 'local_premium') {
        return { lifetimePro: true, hasAI: false, aiExpiresAt: null, appUserId: null };
      }
    } catch {
      // ignore
    }
    return null;
  },

  async setBillingCache(value: BillingCache): Promise<void> {
    try {
      await writeJSON(KEYS.BILLING_CACHE, value);
    } catch (e) {
      console.error('Failed to cache billing state', e);
    }
  },

  // THEME
  async getThemePreference(): Promise<'dark' | 'light' | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.THEME_PREFERENCE);
      if (value === 'dark' || value === 'light') return value;
      return null;
    } catch (e) {
      console.error('Failed to get theme preference', e);
      return null;
    }
  },

  async setThemePreference(mode: 'dark' | 'light'): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.THEME_PREFERENCE, mode);
    } catch (e) {
      console.error('Failed to set theme preference', e);
    }
  },

  // UNIT SYSTEM
  async getUnitPreference(): Promise<'metric' | 'imperial' | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.UNIT_PREFERENCE);
      if (value === 'metric' || value === 'imperial') return value;
      return null;
    } catch (e) {
      console.error('Failed to get unit preference', e);
      return null;
    }
  },

  async setUnitPreference(unit: 'metric' | 'imperial'): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.UNIT_PREFERENCE, unit);
    } catch (e) {
      console.error('Failed to set unit preference', e);
    }
  },
};
