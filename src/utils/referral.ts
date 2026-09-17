/**
 * Utility for generating and validating unique, randomized referral codes for all accounts.
 * Pattern: "UCH-" + 6 random alphanumeric characters (e.g., "UCH-7X9K2P")
 */
export function generateRandomReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `UCH-${randomPart}`;
}

/**
 * Validates if the referral code format is a modern randomized code
 */
export function isRandomReferralCode(code?: string): boolean {
  if (!code) return false;
  // If it's a legacy static code or based on username
  if (
    code.startsWith('UCHIRO-') ||
    code === 'UCH-GUEST-99' ||
    code === 'VIP' ||
    code === 'MEMBER'
  ) {
    return false;
  }
  return /^UCH-[A-Z0-9]{4,8}$/.test(code);
}

/**
 * Ensures a user profile always has a unique randomized referral code
 */
export function ensureRandomReferralCode(existingCode?: string): string {
  if (existingCode && isRandomReferralCode(existingCode)) {
    return existingCode;
  }
  return generateRandomReferralCode();
}
