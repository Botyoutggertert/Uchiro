// Optional Firestore-backed persistence for the store's JSON "database".
//
// Why this exists: on Vercel, server.ts writes its data file to /tmp, which is
// ephemeral per serverless instance -- products/orders/users can silently
// reset. This module lets that same data live in Firestore instead, using the
// Firebase project already configured for auth (see src/lib/firebase.ts).
//
// It is entirely opt-in: if FIREBASE_SERVICE_ACCOUNT is not set, every
// function here is a no-op and the app behaves exactly as before (local JSON
// file only -- fine for local dev and for Railway, which has a persistent disk).
//
// To enable on Vercel:
//   1. Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.
//   2. Copy the entire downloaded JSON file's contents.
//   3. In Vercel Project Settings -> Environment Variables, add FIREBASE_SERVICE_ACCOUNT
//      with that JSON as the value (paste it as one line/string).

import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'uchiro_store_system';
const DOCUMENT_ID = 'database';
const BACKUP_COLLECTION = 'uchiro_store_backups';
const MAX_BACKUPS = 20;

let app: App | null = null;
let firestore: Firestore | null = null;
let initAttempted = false;
let initError: string | null = null;

function tryInit(): void {
  if (initAttempted) return;
  initAttempted = true;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCredentials) {
    // Not configured -- this is a normal, supported state (local dev / Railway).
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getFirestore } = require('firebase-admin/firestore');

    const serviceAccount = JSON.parse(rawCredentials);
    app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    firestore = getFirestore(app);
  } catch (err: any) {
    initError = err?.message || String(err);
    console.error(
      '[remoteDb] FIREBASE_SERVICE_ACCOUNT is set but failed to initialize Firestore. ' +
      'Falling back to local-file-only persistence. Error:', initError
    );
    app = null;
    firestore = null;
  }
}

export function isRemotePersistenceEnabled(): boolean {
  tryInit();
  return firestore !== null;
}

export function getRemotePersistenceError(): string | null {
  return initError;
}

/**
 * Fetch the full store database document from Firestore.
 * Returns null if remote persistence isn't configured, or no document exists yet.
 */
export async function loadRemoteDatabase(): Promise<Record<string, any> | null> {
  tryInit();
  if (!firestore) return null;

  try {
    const snap = await firestore.collection(COLLECTION).doc(DOCUMENT_ID).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return data?.payload ? JSON.parse(data.payload) : null;
  } catch (err) {
    console.error('[remoteDb] Failed to load database from Firestore:', err);
    return null;
  }
}

/**
 * Writes a timestamped snapshot of the database to a separate backups
 * collection, then prunes to the most recent MAX_BACKUPS.
 *
 * This is distinct from saveRemoteDatabase: that one overwrites the single live
 * document, so a bad write or accidental reset destroys the previous state.
 * Snapshots give you a point you can roll back to.
 */
export async function createRemoteBackup(
  db: Record<string, any>,
  label = 'auto'
): Promise<{ success: boolean; id?: string; error?: string }> {
  tryInit();
  if (!firestore) return { success: false, error: 'Remote persistence is not configured' };

  try {
    const id = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`;
    await firestore.collection(BACKUP_COLLECTION).doc(id).set({
      payload: JSON.stringify(db),
      label,
      createdAt: new Date().toISOString(),
    });

    // Prune oldest beyond the retention limit.
    const snap = await firestore
      .collection(BACKUP_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
    const stale = snap.docs.slice(MAX_BACKUPS);
    await Promise.all(stale.map((d) => d.ref.delete().catch(() => {})));

    return { success: true, id };
  } catch (err: any) {
    console.error('[remoteDb] Failed to create backup:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function listRemoteBackups(): Promise<
  Array<{ id: string; label: string; createdAt: string; sizeBytes: number }>
> {
  tryInit();
  if (!firestore) return [];

  try {
    const snap = await firestore
      .collection(BACKUP_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        label: data.label || 'auto',
        createdAt: data.createdAt || '',
        sizeBytes: typeof data.payload === 'string' ? data.payload.length : 0,
      };
    });
  } catch (err) {
    console.error('[remoteDb] Failed to list backups:', err);
    return [];
  }
}

export async function loadRemoteBackup(id: string): Promise<Record<string, any> | null> {
  tryInit();
  if (!firestore) return null;

  try {
    const snap = await firestore.collection(BACKUP_COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return data?.payload ? JSON.parse(data.payload) : null;
  } catch (err) {
    console.error('[remoteDb] Failed to load backup:', err);
    return null;
  }
}
export async function saveRemoteDatabase(db: Record<string, any>): Promise<boolean> {
  tryInit();
  if (!firestore) return true;

  try {
    // Stored as a single JSON string field rather than a native map so we
    // never hit Firestore's per-document field/nesting limits as the store grows.
    await firestore.collection(COLLECTION).doc(DOCUMENT_ID).set({
      payload: JSON.stringify(db),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('[remoteDb] Failed to save database to Firestore:', err);
    return false;
  }
}
