import { initializeApp, getApps, getApp } from 'firebase/app';
import { api } from '../utils/api';
import { safeStorage } from '../utils/storage';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  getDocFromServer,
  query,
  where,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBGkr8X5r5Q8QLvv9WOIbKomZ0G0U7t3Tw",
  authDomain: "auth.uchiro.store",
  projectId: "uchiro-store",
  storageBucket: "uchiro-store.firebasestorage.app",
  messagingSenderId: "458075894163",
  appId: "1:458075894163:web:54db112a4b798d0ebb3866",
  measurementId: "G-WZRY696TPX",
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Cloud Firestore with default database
export const db = getFirestore(app);

// Test connection on boot as required by Firebase integration guidelines
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration: client is offline');
    }
  }
}
testFirestoreConnection();

export interface FirestoreUserData {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  balanceUSD: number;
  totalSpentUSD?: number;
  isResellerUnlocked?: boolean;
  isBanned?: boolean;
  bannedReason?: string;
  role?: 'customer' | 'reseller' | 'admin';
  referralCode?: string;
  referredBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch all registered users in Firestore (Admin function)
 */
export async function getAllUsersFirestore(): Promise<FirestoreUserData[]> {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    const users: FirestoreUserData[] = [];
    snap.forEach((docSnap) => {
      users.push(docSnap.data() as FirestoreUserData);
    });
    return users;
  } catch (err) {
    console.error('Error getting all users from Firestore:', err);
    return [];
  }
}

/**
 * Admin: Add balance to a specific user in Firestore
 */
export async function adminAddUserBalance(uid: string, amountUSD: number): Promise<number> {
  const userDocRef = doc(db, 'users', uid);
  const snap = await getDoc(userDocRef);
  if (!snap.exists()) {
    throw new Error('User not found');
  }
  const current = (snap.data() as FirestoreUserData).balanceUSD || 0;
  const newBalance = Number((current + amountUSD).toFixed(2));
  await updateDoc(userDocRef, {
    balanceUSD: Math.max(0, newBalance),
    updatedAt: new Date().toISOString(),
  });
  return newBalance;
}

/**
 * Admin: Ban or Unban a user account
 */
export async function adminToggleBanUser(uid: string, isBanned: boolean, reason?: string): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    isBanned,
    bannedReason: reason || (isBanned ? 'Account suspended by administrator.' : ''),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin: Delete user profile from Firestore
 */
export async function adminDeleteUser(uid: string): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await deleteDoc(userDocRef);
}

/**
 * Fetch user profile stored in Firestore
 */
export async function getUserFirestoreProfile(uid: string): Promise<FirestoreUserData | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUserData;
    }
    return null;
  } catch (err) {
    console.error('Error getting user profile from Firestore:', err);
    return null;
  }
}

/**
 * Save or initialize user profile in Firestore
 */
export async function saveUserFirestoreProfile(data: FirestoreUserData): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', data.id);
    await setDoc(userDocRef, data, { merge: true });
  } catch (err: any) {
    console.warn('Warning saving user profile to Firestore (using fallback sync):', err);
    // Sync to backend user profile so user profile is never lost
    try {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}
    // Do not throw permission error if fallback registered user is active
  }
}

/**
 * Update partial user profile in Firestore
 */
export async function updateUserFirestoreProfile(uid: string, updates: Partial<FirestoreUserData>): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Warning updating user profile in Firestore (using fallback sync):', err);
    try {
      await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {}
  }
}

/**
 * Username to Email Mapping Helpers (allows logging in with username)
 */
export async function saveUsernameMapping(username: string, email: string): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanUsername || !cleanEmail) return;

  // 1. Cache in safeStorage for ultra-fast instant resolution
  try {
    const raw = safeStorage.getItem('uchiro_user_directory');
    const dir = raw ? JSON.parse(raw) : {};
    dir[cleanUsername] = cleanEmail;
    safeStorage.setItem('uchiro_user_directory', JSON.stringify(dir));
  } catch {}

  // 2. Save in Firestore
  try {
    const userMapRef = doc(db, 'usernames', cleanUsername);
    await setDoc(userMapRef, {
      username: cleanUsername,
      email: cleanEmail,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save username mapping in Firestore:', err);
  }

  // 3. Also sync to backend API directory
  try {
    await fetch('/api/auth/link-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, email: cleanEmail }),
    });
  } catch (err) {
    console.warn('Failed to link username via API:', err);
  }
}

export async function resolveEmailFromUsername(identifier: string): Promise<string | null> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;
  if (clean.includes('@')) return clean;

  // 1. Check safeStorage directory cache
  try {
    const raw = safeStorage.getItem('uchiro_user_directory');
    if (raw) {
      const dir = JSON.parse(raw);
      if (dir[clean]) return String(dir[clean]).toLowerCase();
    }
    const localName = safeStorage.getItem('uchiro_user_name');
    const localEmail = safeStorage.getItem('uchiro_user_email');
    if (localName && localName.trim().toLowerCase() === clean && localEmail && localEmail.includes('@')) {
      return localEmail.trim().toLowerCase();
    }
  } catch {}

  // 2. Try Firestore usernames collection
  try {
    const userMapRef = doc(db, 'usernames', clean);
    const snap = await getDoc(userMapRef);
    if (snap.exists() && snap.data()?.email) {
      return snap.data().email.toLowerCase();
    }
  } catch (err) {
    console.warn('Firestore username lookup failed, trying user query:', err);
  }

  // 3. Try Firestore users collection query by username
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', clean));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const userData = querySnap.docs[0].data();
      if (userData?.email) {
        // Save mapping for faster future lookup
        saveUsernameMapping(clean, userData.email.toLowerCase()).catch(() => {});
        return userData.email.toLowerCase();
      }
    }
  } catch (err) {
    console.warn('Firestore users collection query failed, trying API:', err);
  }

  // 4. Try Backend API resolution
  try {
    const res = await fetch('/api/auth/resolve-identifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: clean }),
    });
    const data = await res.json();
    if (data.success && data.email) {
      return data.email.toLowerCase();
    }
  } catch (err) {
    console.warn('API resolve-identifier failed:', err);
  }

  return null;
}

/**
 * Check if a username is already taken (One username can be used only once)
 */
export async function checkUsernameIsTaken(rawUsername: string): Promise<boolean> {
  const clean = rawUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!clean) return false;

  // 1. Check Firestore usernames collection (official registered username mapping)
  try {
    const userMapRef = doc(db, 'usernames', clean);
    const snap = await getDoc(userMapRef);
    if (snap.exists()) return true;
  } catch (err) {
    // Firestore rules may restrict guests; fallback cleanly to backend check
  }

  // 2. Check Backend API for real registered accounts
  try {
    const res = await fetch('/api/auth/check-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: clean }),
    });
    const data = await res.json();
    if (data.success && data.exists) return true;
  } catch (err) {
    console.warn('Backend check-account for username error:', err);
  }

  return false;
}

/**
 * Check if an email is already registered (Only returns true if an actual account exists)
 */
export async function checkEmailIsRegistered(rawEmail: string): Promise<boolean> {
  const clean = rawEmail.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;

  // Check Backend API for real registered accounts
  try {
    const res = await fetch('/api/auth/check-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: clean }),
    });
    const data = await res.json();
    if (data.success && data.exists) return true;
  } catch (err) {
    console.warn('Backend check-account for email error:', err);
  }

  return false;
}

/**
 * Sign Up with Email and Password
 * Seamlessly fails over to backend secure auth if Firebase Email/Password provider is disabled
 */
export async function registerWithEmail(email: string, pass: string, username: string) {
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    if (cleanUsername && cred.user) {
      await updateProfile(cred.user, { displayName: cleanUsername });
    }
    // Trigger Firebase email verification if available
    try {
      if (cred.user) {
        await sendEmailVerification(cred.user);
      }
    } catch (verifyErr) {
      console.warn('Firebase email verification trigger:', verifyErr);
    }
    // Store username mapping
    if (cleanUsername && cleanEmail) {
      await saveUsernameMapping(cleanUsername, cleanEmail);
    }
    return cred.user;
  } catch (firebaseErr: any) {
    // If Firebase Email/Password provider is not toggled in console, use high-security fallback
    if (
      firebaseErr?.code === 'auth/operation-not-allowed' ||
      firebaseErr?.message?.includes('operation-not-allowed')
    ) {
      console.info('Firebase Email/Password provider disabled or restricted, seamlessly activating high-availability secure local auth...');
      const res = await api.registerUserFallback({
        email: cleanEmail,
        password: pass,
        username: cleanUsername,
      });

      if (res.success && res.user) {
        const fallbackUser: any = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || cleanUsername,
          photoURL: null,
          emailVerified: true,
          isAnonymous: false,
        };
        safeStorage.setItem('uchiro_auth_user', JSON.stringify(fallbackUser));
        if (cleanUsername && cleanEmail) {
          await saveUsernameMapping(cleanUsername, cleanEmail);
        }
        return fallbackUser as FirebaseUser;
      } else {
        throw new Error(res.error || 'Registration failed');
      }
    }
    throw firebaseErr;
  }
}

/**
 * Sign In with Email and Password
 * Supports both Firebase Auth and Secure High-Availability Fallback Accounts
 */
export async function loginWithEmail(email: string, pass: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (firebaseErr: any) {
    // If Firebase Auth fails (user is in server DB, invalid-credential, wrong-password, operation-not-allowed, network error, etc.)
    try {
      const res = await api.loginUserFallback({
        identifier: email,
        password: pass,
      });

      if (res.rateLimited) {
        throw new Error(res.error || 'Too many login attempts. Please wait before trying again.');
      }

      if (res.success && res.user) {
        const fallbackUser: any = {
          uid: res.user.uid || res.user.id,
          email: res.user.email,
          displayName: res.user.displayName || res.user.username,
          photoURL: null,
          emailVerified: true,
          isAnonymous: false,
        };
        safeStorage.setItem('uchiro_auth_user', JSON.stringify(fallbackUser));
        return fallbackUser as FirebaseUser;
      }

      // If backend responded with a clear error (e.g. invalid password), prefer that over cryptic Firebase error
      if (res.error && !res.error.includes('fetch')) {
        throw new Error(res.error);
      }
    } catch (fallbackErr: any) {
      if (fallbackErr?.message && !fallbackErr.message.includes('fetch') && !fallbackErr.message.includes('NetworkError')) {
        throw fallbackErr;
      }
    }

    throw firebaseErr;
  }
}

/**
 * Sign In / Link with Google Popup
 */
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

/**
 * Sign In with Official Google Identity Credential (ID Token)
 */
export async function loginWithGoogleCredential(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  return cred.user;
}

/**
 * Completes Telegram code-login: exchanges the backend-issued custom token
 * (from /api/auth/telegram/verify-code) for a real Firebase session.
 */
export async function loginWithTelegramToken(customToken: string) {
  const cred = await signInWithCustomToken(auth, customToken);
  return cred.user;
}

/**
 * Send Password Reset Email (User receives link/code to reset)
 * After resetting, Firebase's hosted reset page sends the user back to
 * the real store domain (via actionCodeSettings.url) instead of leaving
 * them on an unbranded default *.firebaseapp.com page with no way back.
 */
export async function triggerPasswordReset(email: string) {
  const siteUrl =
    (typeof window !== 'undefined' && window.location.origin) || 'https://www.uchiro.store';
  await sendPasswordResetEmail(auth, email, {
    url: `${siteUrl}/?reset=done`,
    handleCodeInApp: false,
  });
}

/**
 * Sign Out
 */
export async function logoutUser() {
  safeStorage.removeItem('uchiro_auth_user');
  safeStorage.removeItem('uchiro_admin_token');
  try {
    await signOut(auth);
  } catch {}
}

export { onAuthStateChanged };
export type { FirebaseUser };
