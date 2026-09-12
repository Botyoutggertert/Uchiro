import React, { useMemo } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Zap, Info, Check, X, Sparkles } from 'lucide-react';
import { calculatePasswordStrength, PasswordStrengthResult } from '../utils/passwordStrength';

interface PasswordStrengthMeterProps {
  password: string;
  lang?: 'KM' | 'EN';
  showDetails?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  lang = 'KM',
  showDetails = true,
}) => {
  const result: PasswordStrengthResult = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );

  if (!password) {
    return null;
  }

  const {
    entropyBits,
    score,
    label,
    labelKhmer,
    colorHex,
    barClass,
    textClass,
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
  } = result;

  // Segmented progress indicators (4 segments: Weak, Fair, Good, Strong)
  const segments = [1, 2, 3, 4];

  return (
    <div className="w-full bg-[#0d0f15] border border-white/10 rounded-xl p-3 space-y-2.5 font-price transition-all animate-[fadeIn_0.2s_ease-out]">
      {/* Header: Entropy & Strength Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {score >= 3 ? (
            <ShieldCheck className={`w-4 h-4 ${textClass}`} />
          ) : score === 2 ? (
            <Shield className={`w-4 h-4 ${textClass}`} />
          ) : (
            <ShieldAlert className={`w-4 h-4 ${textClass}`} />
          )}
          <span className="text-[11px] font-semibold text-[#8B90A0]">
            {lang === 'KM' ? 'កម្រិតសុវត្ថិភាពពាក្យសម្ងាត់:' : 'Password Strength:'}
          </span>
          <span className={`text-xs font-bold ${textClass} flex items-center gap-1`}>
            {lang === 'KM' ? labelKhmer : label}
          </span>
        </div>

        {/* Calculated Entropy in Bits */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px]">
          <Zap className="w-2.5 h-2.5 text-[#ffb230]" />
          <span className="text-[#8B90A0]">Entropy:</span>
          <span className={`font-mono font-bold ${textClass}`}>{entropyBits} bits</span>
        </div>
      </div>

      {/* Visual Color-Coded Multi-Segment Meter Bar (Red to Green) */}
      <div className="grid grid-cols-4 gap-1.5 h-2 rounded-full overflow-hidden p-0.5 bg-[#171a23]">
        {segments.map((segIndex) => {
          const isFilled = score >= segIndex;
          return (
            <div
              key={segIndex}
              className={`h-full rounded-full transition-all duration-300 ${
                isFilled ? barClass : 'bg-white/5'
              }`}
              style={{
                boxShadow: isFilled ? `0 0 8px ${colorHex}66` : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Character Complexity Criteria Checklist */}
      {showDetails && (
        <div className="space-y-2 pt-0.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
            {/* 1. Length (8+ chars) */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                hasMinLength
                  ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/30 text-[#3ECF8E]'
                  : 'bg-white/[0.02] border-white/5 text-[#8B90A0]'
              }`}
            >
              {hasMinLength ? (
                <Check className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 ml-0.5 mr-1" />
              )}
              <span className="truncate">
                {lang === 'KM' ? '៨+ តួអក្សរ' : '8+ Length'}
              </span>
            </div>

            {/* 2. Lowercase & Uppercase letters */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                hasLowercase && hasUppercase
                  ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/30 text-[#3ECF8E]'
                  : 'bg-white/[0.02] border-white/5 text-[#8B90A0]'
              }`}
            >
              {hasLowercase && hasUppercase ? (
                <Check className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 ml-0.5 mr-1" />
              )}
              <span className="truncate">
                {lang === 'KM' ? 'អក្សរធំ & តូច' : 'Upper & Lower'}
              </span>
            </div>

            {/* 3. Numbers */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                hasNumber
                  ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/30 text-[#3ECF8E]'
                  : 'bg-white/[0.02] border-white/5 text-[#8B90A0]'
              }`}
            >
              {hasNumber ? (
                <Check className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 ml-0.5 mr-1" />
              )}
              <span className="truncate">
                {lang === 'KM' ? 'លេខ (0-9)' : 'Numbers (0-9)'}
              </span>
            </div>

            {/* 4. Special Characters */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                hasSpecial
                  ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/30 text-[#3ECF8E]'
                  : 'bg-white/[0.02] border-white/5 text-[#8B90A0]'
              }`}
            >
              {hasSpecial ? (
                <Check className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 ml-0.5 mr-1" />
              )}
              <span className="truncate">
                {lang === 'KM' ? 'និមិត្តសញ្ញា (!@#)' : 'Symbols (!@#$)'}
              </span>
            </div>
          </div>

          {/* Crack Time Estimate & Recommendations */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-[#8B90A0] pt-1 border-t border-white/5">
            <span className="flex items-center gap-1">
              <span className="text-[#ffd7a1]">
                {lang === 'KM' ? 'ពេលវេលាបំបែកប៉ាន់ស្មាន:' : 'Estimated crack time:'}
              </span>
              <span className="font-semibold text-white/90">
                {lang === 'KM' ? crackTimeEstimateKhmer : crackTimeEstimate}
              </span>
            </span>

            {suggestions.length > 0 && (
              <span className={`text-[9.5px] font-medium flex items-center gap-1 ${textClass}`}>
                <Info className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">
                  {lang === 'KM' ? suggestionsKhmer[0] : suggestions[0]}
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
