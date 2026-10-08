/**
 * Durable JSON documents for the large collections (workouts, PRs, ...).
 *
 * On Android, AsyncStorage keeps values in SQLite: a single value larger than
 * ~2MB can't be read back (CursorWindow limit) and the whole store is capped at
 * 6MB. A multi-year history synced down from the cloud would hit both, so these
 * collections live in files in the app's document directory instead.
 *
 * Writes go to a temp file that then replaces the main file, so a crash
 * mid-write never leaves a half-written file behind.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

// expo-file-system has no document directory on web; keep AsyncStorage there.
const USE_FILES = Platform.OS !== 'web';

let dataDir: Directory | null = null;
function getDataDir(): Directory {
  if (!dataDir) {
    dataDir = new Directory(Paths.document, 'gymlog-data');
  }
  if (!dataDir.exists) {
    dataDir.create({ intermediates: true, idempotent: true });
  }
  return dataDir;
}

const mainFile = (name: string) => new File(getDataDir(), `${name}.json`);
const tempFile = (name: string) => new File(getDataDir(), `${name}.json.tmp`);

function writeText(name: string, json: string) {
  const temp = tempFile(name);
  if (temp.exists) temp.delete();
  temp.write(json);

  const main = mainFile(name);
  if (main.exists) main.delete();
  temp.move(main);
}

/** Keep an unreadable file for inspection instead of overwriting it on the next save. */
function quarantine(file: File) {
  try {
    file.move(new File(getDataDir(), `${file.name}.corrupt-${Date.now()}`));
  } catch (e) {
    console.error('[FileStore] Could not move unreadable file aside', e);
  }
}

/**
 * Read a document. On first use after the update, the value is moved out of
 * AsyncStorage (`legacyKey`) into its file.
 */
export async function readDocument<T>(name: string, legacyKey: string, fallback: T): Promise<T> {
  if (!USE_FILES) {
    const json = await AsyncStorage.getItem(legacyKey);
    return json ? JSON.parse(json) : fallback;
  }

  // The temp file only outlives the main one if a write was interrupted
  // right after the main file was removed — then it holds the latest data.
  for (const file of [mainFile(name), tempFile(name)]) {
    if (!file.exists) continue;
    try {
      return JSON.parse(await file.text()) as T;
    } catch (e) {
      console.error(`[FileStore] Unreadable ${file.uri}`, e);
      quarantine(file);
    }
  }

  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy !== null) {
    const value = JSON.parse(legacy) as T;
    writeText(name, legacy);
    await AsyncStorage.removeItem(legacyKey);
    return value;
  }
  return fallback;
}

export async function writeDocument(name: string, legacyKey: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  if (!USE_FILES) {
    await AsyncStorage.setItem(legacyKey, json);
    return;
  }
  writeText(name, json);
}

export async function removeDocument(name: string, legacyKey: string): Promise<void> {
  if (USE_FILES) {
    for (const file of [mainFile(name), tempFile(name)]) {
      if (file.exists) file.delete();
    }
  }
  await AsyncStorage.removeItem(legacyKey);
}
