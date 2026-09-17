import { Request, Response } from 'express';
import crypto from 'crypto';
import { validateUsername, UserRole } from '../models/userModel';
import { generateAuthToken } from '../middleware/authMiddleware';

const ADMIN_EMAILS = [
  'youtgg13@gmail.com',
];

/**
 * Helper to determine if an email or role designates administrator status.
 * Strictly restricted to youtgg13@gmail.com.
 */
export function isUserAdmin(email?: string, existingRole?: string): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return cleanEmail === 'youtgg13@gmail.com';
}

/**
 * Unified Login Controller:
 * Handles authentication for both customers and administrators in a single interface.
 * Issues a signed JWT containing the user's role ('customer' | 'admin').
 */
export function handleUnifiedLogin(db: any, req: Request, res: Response) {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Identifier (username or email) and password are required.',
    });
  }

  const cleanInput = identifier.trim().toLowerCase();
  let targetEmail = cleanInput;

  // If input doesn't contain '@', look up email from usernameDirectory or users list
  if (!cleanInput.includes('@')) {
    const cleanUser = cleanInput.replace(/[^a-z0-9_]/g, '');
    if (db.usernameDirectory && db.usernameDirectory[cleanUser]) {
      targetEmail = db.usernameDirectory[cleanUser].toLowerCase();
    }
  }

  if (!Array.isArray(db.users)) {
    db.users = [];
  }

  const user = db.users.find(
    (u: any) =>
      u.email?.toLowerCase() === targetEmail ||
      u.username?.toLowerCase() === cleanInput.replace(/[^a-z0-9_]/g, '')
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials. User not found.',
    });
  }

  // Verify password hash
  if (user.passwordHash && user.salt) {
    const computed = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');
    if (computed !== user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your username and password.',
      });
    }
  }

  // Determine role based on administrator privileges
  const role: UserRole = isUserAdmin(user.email, user.role) ? 'admin' : 'customer';

  // Issue signed JWT with user details and RBAC role
  const token = generateAuthToken({
    uid: user.id || user.uid,
    email: user.email,
    username: user.username,
    role,
    displayName: user.displayName || user.username,
  });

  return res.json({
    success: true,
    message: 'Login successful.',
    token,
    user: {
      uid: user.id || user.uid,
      id: user.id || user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName || user.username,
      role,
      balanceUSD: user.balanceUSD ?? 0,
      totalSpentUSD: user.totalSpentUSD ?? 0,
      isResellerUnlocked: user.isResellerUnlocked ?? false,
      referralCode: user.referralCode,
      avatarUrl: user.avatarUrl,
    },
  });
}

/**
 * Profile Update Controller:
 * Strictly prevents username modifications (immutable).
 * If a username modification is attempted, returns HTTP 400.
 * Explicitly strips the username field from the update payload.
 */
export function handleUpdateProfile(db: any, req: Request, res: Response) {
  // req.user is guaranteed by verifyAuth middleware
  const authenticatedUser = req.user;
  const currentUsername = authenticatedUser?.username || db.userProfile?.username;

  // Check if caller is attempting to alter the immutable username
  if (req.body.username !== undefined && req.body.username !== currentUsername) {
    return res.status(400).json({
      success: false,
      error: 'Username is permanent and cannot be changed under any circumstances.',
    });
  }

  // Explicitly strip username to guarantee database integrity
  delete req.body.username;

  const { displayName, bio, avatarUrl, phone, is2FAEnabled } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

  if (displayName !== undefined) updates.displayName = String(displayName).trim().slice(0, 50);
  if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 250);
  if (avatarUrl !== undefined) updates.avatarUrl = String(avatarUrl).trim();
  if (phone !== undefined) updates.phone = String(phone).trim();
  if (is2FAEnabled !== undefined) updates.is2FAEnabled = Boolean(is2FAEnabled);

  // Apply updates to in-memory profile
  db.userProfile = { ...db.userProfile, ...updates };

  // Sync with matching user in db.users list if available
  if (Array.isArray(db.users) && authenticatedUser?.uid) {
    const userIdx = db.users.findIndex(
      (u: any) => u.id === authenticatedUser.uid || u.uid === authenticatedUser.uid
    );
    if (userIdx !== -1) {
      db.users[userIdx] = { ...db.users[userIdx], ...updates };
    }
  }

  return res.json({
    success: true,
    message: 'Profile updated successfully.',
    userProfile: db.userProfile,
  });
}
