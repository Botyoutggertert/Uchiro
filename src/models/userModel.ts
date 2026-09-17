/**
 * User Schema / Database Model
 * Enforces strict username formatting (lowercase alphanumeric, no spaces, 3-20 chars)
 * and Role-Based Access Control (RBAC) role definition ('customer' | 'admin').
 */

export type UserRole = 'customer' | 'admin';

export const USER_ROLES: Record<string, UserRole> = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
};

/**
 * Strict username constraint:
 * - Lowercase alphanumeric characters and underscores only ([a-z0-9_])
 * - No spaces, uppercase letters, or special characters
 * - 3 to 20 characters in length
 */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a candidate username against the strict formatting policy.
 */
export function validateUsername(username: string | undefined | null): UsernameValidationResult {
  if (!username || typeof username !== 'string') {
    return {
      isValid: false,
      error: 'Username is required and must be a string.',
    };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Username must be at least 3 characters long.',
    };
  }

  if (trimmed.length > 20) {
    return {
      isValid: false,
      error: 'Username cannot exceed 20 characters.',
    };
  }

  if (/[A-Z]/.test(username)) {
    return {
      isValid: false,
      error: 'Username must be entirely lowercase. Uppercase letters are not allowed.',
    };
  }

  if (/\s/.test(username)) {
    return {
      isValid: false,
      error: 'Username cannot contain spaces.',
    };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      isValid: false,
      error: 'Username can only contain lowercase letters (a-z), numbers (0-9), and underscores (_).',
    };
  }

  return { isValid: true };
}

/**
 * Helper to ensure a username is normalized cleanly (lowercase trimmed).
 */
export function normalizeUsername(username: string): string {
  return (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * User database record representation
 */
export interface UserRecord {
  id: string;
  email: string;
  username: string; // Strictly formatted & immutable once created
  role: UserRole;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  balanceUSD: number;
  totalSpentUSD?: number;
  isResellerUnlocked?: boolean;
  referralCode?: string;
  isBanned?: boolean;
  bannedReason?: string;
  createdAt: string;
  updatedAt: string;
}
