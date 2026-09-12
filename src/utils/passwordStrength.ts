/**
 * Password Entropy & Strength Calculation Utility
 * Calculates mathematical information entropy (bits) based on character complexity,
 * pool size, length, and presence of special characters, mapping to visual color gradients.
 */

export interface PasswordStrengthResult {
  entropyBits: number;
  score: 0 | 1 | 2 | 3 | 4; // 0=Empty/Too short, 1=Weak (Red), 2=Fair (Orange), 3=Good (Yellow), 4=Strong (Green)
  label: 'Empty' | 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
  labelKhmer: string;
  colorHex: string;
  barClass: string;
  textClass: string;
  glowClass: string;
  percent: number; // 0 to 100
  hasMinLength: boolean; // >= 8 chars
  hasOptimalLength: boolean; // >= 12 chars
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  crackTimeEstimate: string;
  crackTimeEstimateKhmer: string;
  suggestions: string[];
  suggestionsKhmer: string[];
}

export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || '';
  const length = pwd.length;

  if (length === 0) {
    return {
      entropyBits: 0,
      score: 0,
      label: 'Empty',
      labelKhmer: 'ទទេ',
      colorHex: '#4B5563',
      barClass: 'bg-[#4B5563]',
      textClass: 'text-[#8B90A0]',
      glowClass: 'shadow-none',
      percent: 0,
      hasMinLength: false,
      hasOptimalLength: false,
      hasLowercase: false,
      hasUppercase: false,
      hasNumber: false,
      hasSpecial: false,
      crackTimeEstimate: '0 seconds',
      crackTimeEstimateKhmer: '០ វិនាទី',
      suggestions: ['Enter at least 8 characters with letters, numbers, and special symbols.'],
      suggestionsKhmer: ['សូមបញ្ចូលយ៉ាងហោច ៨ តួអក្សរ ដោយមានអក្សរ លេខ និងនិមិត្តសញ្ញាពិសេស។'],
    };
  }

  const hasLowercase = /[a-z]/.test(pwd);
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = SPECIAL_CHAR_REGEX.test(pwd);
  const hasMinLength = length >= 8;
  const hasOptimalLength = length >= 12;

  // Calculate character pool size (R)
  let poolSize = 0;
  if (hasLowercase) poolSize += 26;
  if (hasUppercase) poolSize += 26;
  if (hasNumber) poolSize += 10;
  if (hasSpecial) poolSize += 33;

  // If pool size is 0 (unusual characters), default to length of unique chars
  if (poolSize === 0) {
    poolSize = Math.max(10, new Set(pwd.split('')).size);
  }

  // Base Shannon information entropy in bits: E = L * log2(R)
  let entropy = length * (Math.log(poolSize) / Math.LN2);

  // Penalties for repetitive or easily guessable patterns:
  // 1. Repetitive characters (e.g., 'aaaa' or '1111')
  const uniqueChars = new Set(pwd.split('')).size;
  const repetitionRatio = uniqueChars / length;
  if (repetitionRatio < 0.6) {
    entropy *= Math.max(0.4, repetitionRatio);
  }

  // 2. Sequential numbers or letters (e.g. '12345', 'abcdef')
  const lowerPwd = pwd.toLowerCase();
  const sequentialPatterns = ['123', '234', '345', '456', '567', '678', '789', 'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'qwerty', 'asdf', 'zxcv'];
  let sequentialPenalty = 0;
  for (const seq of sequentialPatterns) {
    if (lowerPwd.includes(seq)) {
      sequentialPenalty += 4;
    }
  }
  entropy = Math.max(0, entropy - sequentialPenalty);

  const entropyBits = Math.round(entropy * 10) / 10;

  // Determine score and visual categorization (Red to Green transition)
  let score: 0 | 1 | 2 | 3 | 4 = 1;
  let label: 'Empty' | 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong' = 'Very Weak';
  let labelKhmer = 'ខ្សោយខ្លាំង';
  let colorHex = '#EF4444'; // Red
  let barClass = 'bg-[#EF4444]';
  let textClass = 'text-[#EF4444]';
  let glowClass = 'shadow-[0_0_12px_rgba(239,68,68,0.4)]';
  let percent = 20;
  let crackTimeEstimate = 'Instantly (less than 1s)';
  let crackTimeEstimateKhmer = 'ភ្លាមៗ (តិចជាង ១ វិនាទី)';

  if (length < 6 || entropyBits < 25) {
    score = 1;
    label = 'Very Weak';
    labelKhmer = 'ខ្សោយខ្លាំង';
    colorHex = '#EF4444'; // Red
    barClass = 'bg-[#EF4444]';
    textClass = 'text-[#EF4444]';
    glowClass = 'shadow-[0_0_12px_rgba(239,68,68,0.45)]';
    percent = Math.min(25, Math.max(12, length * 3));
    crackTimeEstimate = 'Under 1 second';
    crackTimeEstimateKhmer = 'ក្រោម ១ វិនាទី';
  } else if (!hasMinLength || entropyBits < 36) {
    score = 1;
    label = 'Weak';
    labelKhmer = 'ខ្សោយ';
    colorHex = '#F97316'; // Orange
    barClass = 'bg-[#F97316]';
    textClass = 'text-[#F97316]';
    glowClass = 'shadow-[0_0_12px_rgba(249,115,22,0.4)]';
    percent = 40;
    crackTimeEstimate = 'Few minutes';
    crackTimeEstimateKhmer = 'ប៉ុន្មាននាទី';
  } else if (entropyBits < 56 || (!hasSpecial && !hasUppercase)) {
    score = 2;
    label = 'Medium';
    labelKhmer = 'មធ្យម';
    colorHex = '#F59E0B'; // Amber / Gold
    barClass = 'bg-[#F59E0B]';
    textClass = 'text-[#F59E0B]';
    glowClass = 'shadow-[0_0_12px_rgba(245,158,11,0.4)]';
    percent = 65;
    crackTimeEstimate = 'Several days to months';
    crackTimeEstimateKhmer = 'ពីរបីថ្ងៃទៅច្រើនខែ';
  } else if (entropyBits < 75 || !hasOptimalLength) {
    score = 3;
    label = 'Strong';
    labelKhmer = 'រឹងមាំ';
    colorHex = '#10B981'; // Emerald Green
    barClass = 'bg-[#10B981]';
    textClass = 'text-[#10B981]';
    glowClass = 'shadow-[0_0_12px_rgba(16,185,129,0.45)]';
    percent = 85;
    crackTimeEstimate = 'Years to decades';
    crackTimeEstimateKhmer = 'ច្រើនឆ្នាំទៅច្រើនទសវត្សរ៍';
  } else {
    score = 4;
    label = 'Very Strong';
    labelKhmer = 'រឹងមាំខ្លាំង';
    colorHex = '#3ECF8E'; // Bright Cyan-Green
    barClass = 'bg-[#3ECF8E]';
    textClass = 'text-[#3ECF8E]';
    glowClass = 'shadow-[0_0_14px_rgba(62,207,142,0.5)]';
    percent = 100;
    crackTimeEstimate = 'Centuries (Military grade)';
    crackTimeEstimateKhmer = 'រាប់រយឆ្នាំ (កម្រិតយោធា)';
  }

  // Construct helpful suggestions based on missing criteria
  const suggestions: string[] = [];
  const suggestionsKhmer: string[] = [];

  if (!hasMinLength) {
    suggestions.push('Make password at least 8 characters long');
    suggestionsKhmer.push('សូមប្រើប្រវែងយ៉ាងហោច ៨ តួអក្សរ');
  }
  if (!hasUppercase) {
    suggestions.push('Add an uppercase letter (A-Z)');
    suggestionsKhmer.push('បន្ថែមអក្សរធំ (A-Z)');
  }
  if (!hasLowercase) {
    suggestions.push('Add a lowercase letter (a-z)');
    suggestionsKhmer.push('បន្ថែមអក្សរតូច (a-z)');
  }
  if (!hasNumber) {
    suggestions.push('Include a number (0-9)');
    suggestionsKhmer.push('បន្ថែមលេខ (0-9)');
  }
  if (!hasSpecial) {
    suggestions.push('Add special symbols (!@#$%^&*)');
    suggestionsKhmer.push('បន្ថែមនិមិត្តសញ្ញាពិសេស (!@#$%^&*)');
  }
  if (hasMinLength && !hasOptimalLength && suggestions.length === 0) {
    suggestions.push('Extend to 12+ characters for maximum entropy resistance');
    suggestionsKhmer.push('ពង្រីកដល់ ១២+ តួអក្សរដើម្បីទទួលបានកម្រិតសុវត្ថិភាពអតិបរមា');
  }

  return {
    entropyBits,
    score,
    label,
    labelKhmer,
    colorHex,
    barClass,
    textClass,
    glowClass,
    percent,
    hasMinLength,
    hasOptimalLength,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecial,
    crackTimeEstimate,
    crackTimeEstimateKhmer,
    suggestions,
    suggestionsKhmer,
  };
}
