/**
 * Cloud sync engine.
 *
 * Local storage is always the app's working copy. While the user has an
 * active AI subscription and is signed in, this engine keeps it in two-way
 * sync with Convex:
 *
 *   1. push — apply local "clear all", deletes, then upload pending records
 *   2. pull — download the cloud manifest, fetch workouts this device is
 *             missing, and drop local records that were deleted elsewhere
 *
 * Records are matched by their client-generated IDs and every cloud write is
 * an idempotent upsert, so switching between local-only and cloud mode (sub
 * lapses, resubscribes, new device, reinstall) never duplicates or loses data.
 */

import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  SyncStore,
  emptySyncState,
  personalRecordKey,
  type SyncState,
} from './storage';
import type {
  WorkoutSession,
  Exercise,
  PersonalRecord,
  BodyMeasurement,
  Set as WorkoutSet,
} from '../types';

export interface SyncAccount {
  userId: string;
  email: string | null;
  name: string | null;
}

export interface SyncProgress {
  phase: 'uploading' | 'downloading';
  done: number;
  total: number;
}

export interface SyncReport {
  uploaded: number;
  downloaded: number;
  removed: number;
}

/** Local data belongs to a different account; the user must choose what to do. */
export class SyncOwnershipError extends Error {
  constructor(public ownerEmail: string | null) {
    super('Local data belongs to another account');
    this.name = 'SyncOwnershipError';
  }
}

/** The server couldn't confirm an active AI subscription with RevenueCat. */
export class SyncAccessError extends Error {
  constructor() {
    super('Subscription not verified by the server');
    this.name = 'SyncAccessError';
  }
}

// One engine operation at a time (full sync or single-workout push).
let engineQueue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = engineQueue.then(fn);
  engineQueue = run.catch(() => undefined);
  return run;
}

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
const SET_TYPES: WorkoutSet['type'][] = ['warmup', 'normal', 'failure', 'drop'];

// ── Shape conversion ─────────────────────────────────────
// Convex validators reject unknown fields, so payloads are built explicitly.

function toCloudWorkout(w: WorkoutSession) {
  return {
    id: String(w.id),
    name: w.name ?? '',
    startTime: w.startTime,
    endTime: num(w.endTime),
    notes: str(w.notes),
    bodyWeight: num(w.bodyWeight),
    mood: num(w.mood),
    exercises: (w.exercises ?? []).map(ex => ({
      id: String(ex.id),
      exerciseId: String(ex.exerciseId),
      exerciseName: ex.exerciseName ?? '',
      notes: str(ex.notes),
      supersetGroupId: str(ex.supersetGroupId),
      sets: (ex.sets ?? []).map(s => ({
        id: String(s.id),
        weight: num(Number(s.weight)) ?? 0,
        reps: num(Number(s.reps)) ?? 0,
        rpe: num(s.rpe),
        completed: !!s.completed,
        type: SET_TYPES.includes(s.type) ? s.type : 'normal' as const,
      })),
    })),
  };
}

function toCloudMeasurement(m: BodyMeasurement) {
  return {
    id: m.id,
    date: m.date,
    neck: num(m.neck),
    chest: num(m.chest),
    waist: num(m.waist),
    hips: num(m.hips),
    biceps: num(m.biceps),
    thighs: num(m.thighs),
    calves: num(m.calves),
  };
}

function toCloudPR(pr: PersonalRecord) {
  return {
    exerciseId: pr.exerciseId,
    exerciseName: pr.exerciseName,
    type: pr.type,
    value: pr.value,
    reps: num(pr.reps),
    date: pr.date,
    workoutId: pr.workoutId,
  };
}

/** Remove keys whose value is undefined (Convex omits them; keep local JSON tidy). */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

// ── Local state helpers ──────────────────────────────────

async function updateSyncState(mutate: (state: SyncState) => void): Promise<SyncState> {
  return SyncStore.withLock(async () => {
    const state = await SyncStore.readSyncState();
    mutate(state);
    await SyncStore.writeSyncState(state);
    return state;
  });
}

const without = (list: string[], ids: string[]) => {
  const drop = new Set(ids);
  return list.filter(id => !drop.has(id));
};

/**
 * Merge cloud records into local ones.
 * - cloud records are kept (local version wins while it has pending changes)
 * - local-only records are kept only if they are pending upload
 *   (otherwise they were deleted on another device)
 * - records deleted locally but not yet confirmed stay deleted
 */
function mergeById<T>(
  local: T[],
  remote: T[],
  getId: (item: T) => string,
  pending: Set<string>,
  deleted: Set<string>,
): T[] {
  const localById = new Map(local.map(item => [getId(item), item]));
  const result: T[] = [];
  const seen = new Set<string>();

  for (const item of remote) {
    const id = getId(item);
    if (seen.has(id) || deleted.has(id)) continue;
    seen.add(id);
    const localItem = localById.get(id);
    result.push(localItem && pending.has(id) ? localItem : item);
  }
  for (const item of local) {
    const id = getId(item);
    if (!seen.has(id) && pending.has(id)) {
      seen.add(id);
      result.push(item);
    }
  }
  return result;
}

const sameIds = <T,>(a: T[], b: T[], getId: (item: T) => string) =>
  a.length === b.length && a.every((item, i) => getId(item) === getId(b[i]));

// ── Ownership ────────────────────────────────────────────

export type Ownership =
  | { status: 'owned' }
  | { status: 'unlinked' }
  | { status: 'otherAccount'; ownerEmail: string | null };

export function getOwnership(state: SyncState, userId: string): Ownership {
  if (state.ownerId === userId) return { status: 'owned' };
  if (!state.ownerId) return { status: 'unlinked' };
  return { status: 'otherAccount', ownerEmail: state.ownerEmail };
}

/**
 * Link this device's data to the account. Everything stored locally is queued
 * for upload; uploads are idempotent, so records the cloud already has are
 * skipped server-side.
 */
export function linkLocalDataToAccount(account: SyncAccount): Promise<void> {
  return SyncStore.withLock(async () => {
    const [state, workouts, customs, prs, measurements] = await Promise.all([
      SyncStore.readSyncState(),
      SyncStore.readWorkouts(),
      SyncStore.readCustomExercises(),
      SyncStore.readPersonalRecords(),
      SyncStore.readBodyMeasurements(),
    ]);
    const next = emptySyncState(account.userId, account.email);
    next.pending = {
      workouts: workouts.map(w => w.id),
      customExercises: customs.map(e => e.id),
      bodyMeasurements: measurements.map(m => m.id),
      personalRecords: prs.map(personalRecordKey),
    };
    // Deletes only name IDs from this device, so they're safe to carry over.
    // A "clear all" is not: it would wipe the account's existing cloud data.
    if (!state.ownerId || state.ownerId === account.userId) next.deleted = state.deleted;
    next.wipe = state.ownerId === account.userId ? state.wipe : null;
    await SyncStore.writeSyncState(next);
  });
}

/** Remove another account's data from this device and link it to `account`. */
export async function replaceLocalDataWithAccount(account: SyncAccount): Promise<void> {
  await SyncStore.withLock(async () => {
    await SyncStore.wipeData('all');
    await SyncStore.writeSyncState(emptySyncState(account.userId, account.email));
  });
  SyncStore.emitChange('remote');
}

/**
 * Link unowned local data to the signed-in account. Leaves data that belongs
 * to a different account untouched and reports it, so the UI can ask.
 */
export async function claimLocalData(account: SyncAccount): Promise<Ownership> {
  const state = await SyncStore.withLock(() => SyncStore.readSyncState());
  const ownership = getOwnership(state, account.userId);
  if (ownership.status === 'unlinked') {
    await linkLocalDataToAccount(account);
    return { status: 'owned' };
  }
  if (ownership.status === 'owned' && state.ownerEmail !== account.email && account.email) {
    await updateSyncState(s => {
      s.ownerEmail = account.email;
    });
  }
  return ownership;
}

// ── Push ─────────────────────────────────────────────────

async function applyCloudWipe(convex: ConvexReactClient, state: SyncState) {
  if (!state.wipe) return;
  const scope = state.wipe;
  let before: number | undefined;
  for (;;) {
    const result = await convex.mutation(api.sync.wipeData, { scope, before });
    before = result.before;
    if (result.done) break;
  }
  await updateSyncState(s => {
    if (s.wipe === scope || scope === 'all') s.wipe = null;
  });
}

async function pushDeletes(convex: ConvexReactClient, state: SyncState) {
  for (const ids of chunk(state.deleted.workouts, 25)) {
    await convex.mutation(api.sync.deleteWorkouts, { ids });
    await updateSyncState(s => {
      s.deleted.workouts = without(s.deleted.workouts, ids);
    });
  }
  for (const items of chunk(state.deleted.bodyMeasurements, 50)) {
    await convex.mutation(api.sync.deleteBodyMeasurements, { items });
    const ids = items.map(t => t.id);
    await updateSyncState(s => {
      s.deleted.bodyMeasurements = s.deleted.bodyMeasurements.filter(t => !ids.includes(t.id));
    });
  }
}

/** Read the records waiting for upload, dropping pending IDs that no longer exist locally. */
async function collectPending() {
  return SyncStore.withLock(async () => {
    const [state, workouts, customs, prs, measurements] = await Promise.all([
      SyncStore.readSyncState(),
      SyncStore.readWorkouts(),
      SyncStore.readCustomExercises(),
      SyncStore.readPersonalRecords(),
      SyncStore.readBodyMeasurements(),
    ]);

    const pick = <T,>(items: T[], ids: string[], getId: (item: T) => string) => {
      const wanted = new Set(ids);
      return items.filter(item => wanted.has(getId(item)));
    };

    const pending = {
      workouts: pick(workouts, state.pending.workouts, w => w.id),
      customExercises: pick(customs, state.pending.customExercises, e => e.id),
      personalRecords: pick(prs, state.pending.personalRecords, personalRecordKey),
      bodyMeasurements: pick(measurements, state.pending.bodyMeasurements, m => m.id),
    };

    // Forget pending IDs whose record was removed in the meantime.
    state.pending = {
      workouts: pending.workouts.map(w => w.id),
      customExercises: pending.customExercises.map(e => e.id),
      personalRecords: pending.personalRecords.map(personalRecordKey),
      bodyMeasurements: pending.bodyMeasurements.map(m => m.id),
    };
    await SyncStore.writeSyncState(state);
    return pending;
  });
}

async function pushPending(
  convex: ConvexReactClient,
  onProgress?: (p: SyncProgress) => void,
): Promise<number> {
  const pending = await collectPending();
  const total =
    pending.workouts.length +
    pending.customExercises.length +
    pending.personalRecords.length +
    pending.bodyMeasurements.length;
  let done = 0;
  const report = (n: number) => {
    done += n;
    onProgress?.({ phase: 'uploading', done, total });
  };
  if (total > 0) onProgress?.({ phase: 'uploading', done: 0, total });

  // Custom exercises first so workouts never reference an exercise the cloud doesn't know.
  for (const batch of chunk(pending.customExercises, 50)) {
    await convex.mutation(api.sync.pushCustomExercises, {
      exercises: batch.map(e => ({ id: e.id, name: e.name, category: e.category, muscleGroup: e.muscleGroup })),
    });
    const ids = batch.map(e => e.id);
    await updateSyncState(s => {
      s.pending.customExercises = without(s.pending.customExercises, ids);
    });
    report(batch.length);
  }

  for (const batch of chunk(pending.workouts, 10)) {
    await convex.mutation(api.sync.pushWorkouts, { workouts: batch.map(toCloudWorkout) });
    const ids = batch.map(w => w.id);
    await updateSyncState(s => {
      s.pending.workouts = without(s.pending.workouts, ids);
    });
    report(batch.length);
  }

  for (const batch of chunk(pending.personalRecords, 100)) {
    await convex.mutation(api.sync.pushPersonalRecords, { records: batch.map(toCloudPR) });
    const keys = batch.map(personalRecordKey);
    await updateSyncState(s => {
      s.pending.personalRecords = without(s.pending.personalRecords, keys);
    });
    report(batch.length);
  }

  for (const batch of chunk(pending.bodyMeasurements, 50)) {
    await convex.mutation(api.sync.pushBodyMeasurements, { measurements: batch.map(toCloudMeasurement) });
    const ids = batch.map(m => m.id);
    await updateSyncState(s => {
      s.pending.bodyMeasurements = without(s.pending.bodyMeasurements, ids);
    });
    report(batch.length);
  }

  return total;
}

// ── Pull ─────────────────────────────────────────────────

type CloudWorkout = Awaited<ReturnType<typeof fetchWorkouts>>[number];

function fetchWorkouts(convex: ConvexReactClient, ids: string[]) {
  return convex.query(api.sync.getWorkouts, { ids });
}

function fromCloudWorkout(w: CloudWorkout): WorkoutSession {
  return compact({
    id: w.id,
    name: w.name,
    startTime: w.startTime,
    endTime: w.endTime,
    notes: w.notes,
    bodyWeight: w.bodyWeight,
    mood: w.mood,
    exercises: w.exercises.map(ex => compact({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      notes: ex.notes,
      supersetGroupId: ex.supersetGroupId,
      sets: ex.sets.map(s => compact({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        completed: s.completed,
        type: s.type,
      })),
    })),
  });
}

async function pullRemote(
  convex: ConvexReactClient,
  account: SyncAccount,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ downloaded: number; removed: number }> {
  const manifest = await convex.query(api.sync.manifest, {});
  if (!manifest) throw new Error('Cloud profile not found');

  // Fetch only the workouts this device doesn't have yet.
  const { localIds, deletedIds } = await SyncStore.withLock(async () => {
    const [workouts, state] = await Promise.all([SyncStore.readWorkouts(), SyncStore.readSyncState()]);
    return { localIds: new Set(workouts.map(w => w.id)), deletedIds: new Set(state.deleted.workouts) };
  });
  const missing = manifest.workoutIds.filter(id => !localIds.has(id) && !deletedIds.has(id));

  const fetched = new Map<string, WorkoutSession>();
  if (missing.length > 0) onProgress?.({ phase: 'downloading', done: 0, total: missing.length });
  for (const ids of chunk(missing, 25)) {
    const page = await fetchWorkouts(convex, ids);
    page.forEach(w => fetched.set(w.id, fromCloudWorkout(w)));
    onProgress?.({ phase: 'downloading', done: fetched.size, total: missing.length });
  }

  let downloaded = 0;
  let removed = 0;
  const changed = await SyncStore.withLock(async () => {
    const state = await SyncStore.readSyncState();
    // Ownership changed or a local "clear all" happened meanwhile: the next run handles it.
    if (state.ownerId !== account.userId || state.wipe) return false;

    const [workouts, customs, prs, measurements] = await Promise.all([
      SyncStore.readWorkouts(),
      SyncStore.readCustomExercises(),
      SyncStore.readPersonalRecords(),
      SyncStore.readBodyMeasurements(),
    ]);
    const deletedWorkouts = new Set(state.deleted.workouts);
    const deletedMeasurements = new Set(state.deleted.bodyMeasurements.map(t => t.id));
    const none = new Set<string>();

    // Workouts: cloud IDs resolved from local copies or freshly fetched ones.
    const localWorkouts = new Map(workouts.map(w => [w.id, w]));
    const remoteWorkouts = manifest.workoutIds
      .map(id => localWorkouts.get(id) ?? fetched.get(id))
      .filter((w): w is WorkoutSession => !!w);
    const nextWorkouts = mergeById(workouts, remoteWorkouts, w => w.id, new Set(state.pending.workouts), deletedWorkouts)
      .sort((a, b) => b.startTime - a.startTime);

    const remoteCustoms: Exercise[] = manifest.customExercises.map(e => ({ ...e, isCustom: true }));
    const nextCustoms = mergeById(customs, remoteCustoms, e => e.id, new Set(state.pending.customExercises), none);

    const remotePRs: PersonalRecord[] = manifest.personalRecords.map(pr => compact(pr));
    const nextPRs = mergeById(prs, remotePRs, personalRecordKey, new Set(state.pending.personalRecords), none);

    const remoteMeasurements: BodyMeasurement[] = manifest.bodyMeasurements.map(m => compact(m));
    const nextMeasurements = mergeById(
      measurements, remoteMeasurements, m => m.id, new Set(state.pending.bodyMeasurements), deletedMeasurements,
    ).sort((a, b) => b.date - a.date);

    const before = new Set(workouts.map(w => w.id));
    const after = new Set(nextWorkouts.map(w => w.id));
    downloaded = nextWorkouts.filter(w => !before.has(w.id)).length;
    removed = workouts.filter(w => !after.has(w.id)).length;

    let anyChange = false;
    if (!sameIds(workouts, nextWorkouts, w => w.id)) {
      await SyncStore.writeWorkouts(nextWorkouts);
      anyChange = true;
    }
    if (!sameIds(customs, nextCustoms, e => e.id) || JSON.stringify(customs) !== JSON.stringify(nextCustoms)) {
      await SyncStore.writeCustomExercises(nextCustoms);
      anyChange = true;
    }
    if (!sameIds(prs, nextPRs, personalRecordKey)) {
      await SyncStore.writePersonalRecords(nextPRs);
      anyChange = true;
    }
    if (!sameIds(measurements, nextMeasurements, m => m.id)) {
      await SyncStore.writeBodyMeasurements(nextMeasurements);
      anyChange = true;
    }

    state.lastSyncedAt = Date.now();
    await SyncStore.writeSyncState(state);
    return anyChange;
  });

  if (changed) SyncStore.emitChange('remote');
  return { downloaded, removed };
}

// ── Public API ───────────────────────────────────────────

/**
 * Full two-way sync for the signed-in account.
 * Throws SyncOwnershipError if local data belongs to another account.
 */
export function runSync(
  convex: ConvexReactClient,
  account: SyncAccount,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncReport> {
  return exclusive(async () => {
    await convex.mutation(api.users.ensureUser, {
      name: account.name ?? undefined,
      email: account.email ?? undefined,
    });
    // The server checks the subscription itself; this confirms a fresh
    // purchase with RevenueCat before any cloud read/write is attempted.
    const access = await convex.action(api.entitlements.ensureAccess, {});
    if (!access.active) throw new SyncAccessError();

    const ownership = await claimLocalData(account);
    if (ownership.status === 'otherAccount') throw new SyncOwnershipError(ownership.ownerEmail);

    const state = await SyncStore.withLock(() => SyncStore.readSyncState());
    await applyCloudWipe(convex, state);
    await pushDeletes(convex, state);
    const uploaded = await pushPending(convex, onProgress);
    const { downloaded, removed } = await pullRemote(convex, account, onProgress);
    return { uploaded, downloaded, removed };
  });
}

/**
 * Upload one just-finished workout right away and return its cloud ID
 * (needed for the AI workout summary). Returns null if it can't be done now;
 * the workout stays queued for the next sync.
 */
export function pushWorkoutNow(
  convex: ConvexReactClient,
  account: SyncAccount,
  workoutId: string,
): Promise<string | null> {
  return exclusive(async () => {
    const { state, workout } = await SyncStore.withLock(async () => ({
      state: await SyncStore.readSyncState(),
      workout: (await SyncStore.readWorkouts()).find(w => w.id === workoutId),
    }));
    if (!workout || state.ownerId !== account.userId) return null;

    const [result] = await convex.mutation(api.sync.pushWorkouts, { workouts: [toCloudWorkout(workout)] });
    await updateSyncState(s => {
      s.pending.workouts = without(s.pending.workouts, [workoutId]);
    });
    return result ? (result.cloudId as string) : null;
  });
}
