// Firebase Admin Auth helper, used specifically for Telegram code-login.
//
// This is separate from src/lib/remoteDb.ts (which handles Firestore data
// persistence) but shares the same underlying Firebase Admin app instance
// and the same FIREBASE_SERVICE_ACCOUNT env var -- so if you've already set
// that up for data persistence, Telegram login works with no extra setup.
//
// Why a custom token: Telegram accounts have no email/password, so they
// can't use Firebase's normal email-based sign-in. A Firebase Admin custom
// token lets the backend vouch for a Telegram-verified identity, which the
// frontend then exchanges for a real Firebase session via
// signInWithCustomToken().

import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';

let app: App | null = null;
let auth: Auth | null = null;
let initAttempted = false;

function tryInit(): void {
  if (initAttempted) return;
  initAttempted = true;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCredentials) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuth } = require('firebase-admin/auth');

    const serviceAccount = JSON.parse(rawCredentials);
    // Reuse the existing default app if remoteDb.ts already initialized one --
    // firebase-admin only allows one unnamed default app per process.
    app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    auth = getAuth(app);
  } catch (err: any) {
    console.error('[firebaseAdmin] Failed to initialize:', err?.message || err);
    app = null;
    auth = null;
  }
}

export function isAdminAuthEnabled(): boolean {
  tryInit();
  return auth !== null;
}

/**
 * Finds or creates a Firebase Auth user for a Telegram-verified identity, then
 * issues a custom token the frontend can exchange for a real session via
 * signInWithCustomToken(). The uid is deterministic (based on the Telegram
 * username), so the same Telegram account always maps to the same Firebase user.
 */
export async function createTelegramCustomToken(
  telegramUsername: string
): Promise<{ success: boolean; token?: string; uid?: string; error?: string }> {
  tryInit();
  if (!auth) {
    return {
      success: false,
      error: 'Telegram login requires FIREBASE_SERVICE_ACCOUNT to be configured on the server.',
    };
  }

  const clean = telegramUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!clean) return { success: false, error: 'Invalid Telegram username' };

  const uid = `tg_${clean}`;

  try {
    try {
      await auth.getUser(uid);
    } catch {
      // User doesn't exist yet -- create it.
      await auth.createUser({
        uid,
        displayName: telegramUsername,
      });
    }

    const token = await auth.createCustomToken(uid, { telegramUsername: clean });
    return { success: true, token, uid };
  } catch (err: any) {
    console.error('[firebaseAdmin] Failed to create Telegram custom token:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
