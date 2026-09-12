/**
 * Simple client-side pseudo-TOTP generator for live visual 2FA code generation
 * with standard 30-second rotating cycles and smooth countdown.
 */

export function generateLiveCode(seedStr: string = 'JBSWY3DPEHPK3PXP'): {
  code: string;
  formattedCode: string;
  remainingSeconds: number;
  progressPercent: number;
} {
  const step = 30;
  const now = Math.floor(Date.now() / 1000);
  const timeSlice = Math.floor(now / step);
  const remainingSeconds = step - (now % step);
  const progressPercent = ((step - remainingSeconds) / step) * 100;

  // Simple deterministic hash based on seed and timeSlice
  let hash = 0;
  const combined = `${seedStr}-${timeSlice}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  const positiveHash = Math.abs(hash);
  const codeNum = (positiveHash % 900000) + 100000;
  const codeStr = codeNum.toString();
  const formattedCode = `${codeStr.slice(0, 3)} ${codeStr.slice(3)}`;

  return {
    code: codeStr,
    formattedCode,
    remainingSeconds,
    progressPercent,
  };
}
