import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, ShoppingBag, Clock, X, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { RateLimitAlert } from '../types';

interface RateLimitToastProps {
  lang?: 'KM' | 'EN';
  onDismiss?: () => void;
}

export const RateLimitToast: React.FC<RateLimitToastProps> = ({
  lang = 'EN',
  onDismiss,
}) => {
  const [activeAlert, setActiveAlert] = useState<RateLimitAlert | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [initialSeconds, setInitialSeconds] = useState<number>(0);
  const [isCooldownComplete, setIsCooldownComplete] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for global rate-limit alerts dispatched anywhere in the application
  useEffect(() => {
    const handleRateLimitEvent = (e: CustomEvent<RateLimitAlert>) => {
      const alert = e.detail;
      if (!alert) return;

      const duration = Math.max(1, alert.retryAfterSeconds || 30);
      setActiveAlert(alert);
      setRemainingSeconds(duration);
      setInitialSeconds(alert.totalDurationSeconds || duration);
      setIsCooldownComplete(false);

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };

    window.addEventListener('uchiro:rate_limit_alert' as any, handleRateLimitEvent);

    return () => {
      window.removeEventListener('uchiro:rate_limit_alert' as any, handleRateLimitEvent);
      if (timerRef.current) clearInterval(timerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Live countdown clock
  useEffect(() => {
    if (!activeAlert || remainingSeconds <= 0) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsCooldownComplete(true);

          // Auto-dismiss 3.5 seconds after cooldown ends
          dismissTimerRef.current = setTimeout(() => {
            handleClose();
          }, 3500);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeAlert, remainingSeconds > 0]);

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setActiveAlert(null);
    setIsCooldownComplete(false);
    setShowDetails(false);
    onDismiss?.();
  };

  if (!activeAlert) return null;

  const isLogin = activeAlert.action === 'login' || activeAlert.action === 'admin_login';
  const isOrder = activeAlert.action === 'order_create' || activeAlert.action === 'payment_slip';

  // Progress percentage (100% down to 0%)
  const progressPercent = initialSeconds > 0
    ? Math.max(0, Math.min(100, (remainingSeconds / initialSeconds) * 100))
    : 0;

  // Bilingual titles & labels
  const getHeaderTitle = () => {
    if (isCooldownComplete) {
      return lang === 'KM' ? '✅ ការរង់ចាំបានបញ្ចប់!' : '✅ Cooldown Finished!';
    }
    if (isLogin) {
      return lang === 'KM' ? '🔒 ការពារការចូល (Login Rate Limit)' : '🔒 Security Lockout: Login Throttled';
    }
    if (isOrder) {
      return lang === 'KM' ? '🛒 ការពារការកុម្ម៉ង់ (Order Rate Limit)' : '🛒 Anti-Spam: Order Throttled';
    }
    return lang === 'KM' ? '🛡️ ប្រព័ន្ធការពារសុវត្ថិភាព' : '🛡️ Security Rate Limit Active';
  };

  const getActionBadge = () => {
    if (isLogin) {
      return lang === 'KM' ? 'ការពារ Brute-Force' : 'Brute-Force Shield';
    }
    if (isOrder) {
      return lang === 'KM' ? 'ការពារ Order Spam' : 'Order Protection';
    }
    return lang === 'KM' ? 'ប្រព័ន្ធការពារ' : 'Rate Limited';
  };

  const getDescription = () => {
    if (isCooldownComplete) {
      return lang === 'KM'
        ? 'លោកអ្នកអាចបន្តការចូលគណនី ឬការបញ្ជាទិញឡើងវិញបានហើយ។ សូមអរគុណសម្រាប់ការអត់ធ្មត់!'
        : 'You may now proceed with signing in or creating your order. Thank you for your patience!';
    }

    if (lang === 'KM' && activeAlert.messageKhmer) {
      return activeAlert.messageKhmer;
    }
    if (lang === 'EN' && activeAlert.message) {
      return activeAlert.message;
    }

    if (isLogin) {
      return lang === 'KM'
        ? 'ប្រព័ន្ធបានរកឃើញការព្យាយាមចូលច្រើនដងពេក។ ដើម្បីការពារសុវត្ថិភាពគណនីពីការវាយប្រហារ ការចូលត្រូវបានផ្អាកជាបណ្តោះអាសន្ន។'
        : 'Too many login attempts detected. To protect accounts against unauthorized credential guessing, requests are temporarily throttled.';
    }

    if (isOrder) {
      return lang === 'KM'
        ? 'ការបញ្ជាទិញញឹកញាប់ពេកក្នុងរយៈពេលខ្លី។ ដើម្បីការពារការកាត់ប្រាក់ស្ទួន និងរក្សាសុវត្ថិភាពស្តុក សូមរង់ចាំបន្តិច។'
        : 'Too many order requests submitted in a short interval. To avoid double payments and protect stock integrity, please wait before re-ordering.';
    }

    return lang === 'KM'
      ? 'ប្រព័ន្ធបានកំណត់ល្បឿននៃការផ្ញើសំណើ ដើម្បីធានាសុវត្ថិភាពទិន្នន័យ។'
      : 'Requests have been temporarily limited to preserve application security and server stability.';
  };

  return (
    <div
      id="rate-limit-toast"
      role="alert"
      aria-live="assertive"
      className={`fixed top-20 right-4 z-[9999] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[460px] rounded-2xl p-4 shadow-2xl transition-all duration-300 animate-[slideDown_0.3s_ease-out] border backdrop-blur-xl ${
        isCooldownComplete
          ? 'bg-[#0f2419]/95 border-emerald-500/60 shadow-emerald-950/40 text-emerald-100'
          : 'bg-[#181a24]/95 border-amber-500/50 shadow-black/70 text-[#f3f4f8]'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-start justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
              isCooldownComplete
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : isLogin
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                : 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse'
            }`}
          >
            {isCooldownComplete ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isLogin ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <ShoppingBag className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-headline font-bold text-sm leading-tight text-white">
                {getHeaderTitle()}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                  isCooldownComplete
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {getActionBadge()}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {new Date(activeAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <button
          id="rate-limit-toast-close"
          onClick={handleClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Informational Body */}
      <p className="text-xs leading-relaxed text-gray-300 font-sans mb-3">
        {getDescription()}
      </p>

      {/* Live Countdown & Progress Bar */}
      {!isCooldownComplete && remainingSeconds > 0 && (
        <div className="bg-[#0e1017] border border-white/5 rounded-xl p-2.5 mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-gray-400 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
              {lang === 'KM' ? 'រង់ចាំមុនពេលព្យាយាមម្តងទៀត:' : 'Cooldown active:'}
            </span>
            <span className="font-price font-bold text-amber-400 text-sm tracking-wide">
              {remainingSeconds}s
            </span>
          </div>

          {/* Animated Cooldown Bar */}
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Footer & Transparency Expandable Details */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-amber-300 font-medium transition-colors"
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>{lang === 'KM' ? 'ព័ត៌មានសុវត្ថិភាព' : 'Security transparency'}</span>
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            isCooldownComplete
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md'
              : 'bg-white/10 hover:bg-white/15 text-white'
          }`}
        >
          {isCooldownComplete
            ? lang === 'KM' ? 'រួចរាល់' : 'Continue'
            : lang === 'KM' ? 'យល់ព្រម' : 'Understood'}
        </button>
      </div>

      {/* Expanded Transparency Drawer */}
      {showDetails && (
        <div className="mt-2.5 pt-2.5 border-t border-white/10 text-[11px] space-y-1.5 text-gray-300 font-mono bg-black/30 p-2 rounded-lg">
          <div className="flex justify-between">
            <span className="text-gray-400">{lang === 'KM' ? 'សកម្មភាព:' : 'Action Type:'}</span>
            <span className="text-amber-300 font-semibold">{activeAlert.action}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{lang === 'KM' ? 'មូលហេតុ:' : 'Trigger Reason:'}</span>
            <span className="text-gray-200">{activeAlert.reason || 'Sliding Window Request Threshold'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{lang === 'KM' ? 'ការការពារ:' : 'Protection:'}</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Per-IP Defense Active
            </span>
          </div>
          <p className="text-[10px] text-gray-400 pt-1 font-sans italic">
            {lang === 'KM'
              ? 'ប្រព័ន្ធ rate limit ការពារការទិញស្ទួន ការបោកប្រាស់ និងការវាយប្រហារលើគណនីរបស់អ្នក។'
              : 'Our rate limiting ensures high availability, fairness during drops, and brute-force protection.'}
          </p>
        </div>
      )}
    </div>
  );
};
