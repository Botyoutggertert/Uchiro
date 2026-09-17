import React, { useState, useEffect, useRef } from 'react';
import { generateKHQRDataURL, generateKHQRPayload, computeMD5, generateBakongDeepLink } from '../utils/khqr';
import { api } from '../utils/api';
import { UserProfile, StoreSettings } from '../types';
import { generateReceiptPdf } from '../utils/generateReceiptPdf';
import {
  QrCode,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Sparkles,
  Check,
  Gift,
  Tag,
  Edit3,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Copy,
  Radio,
  AlertCircle,
  Clock,
  AlertTriangle,
  MessageCircle,
  Zap,
  FileDown,
  Upload,
  X,
  Send,
  LifeBuoy,
  Receipt,
  Lock,
  UserCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playPaymentSuccessSound } from '../utils/soundEffects';

interface TopUpModalProps {
  userBalanceUSD: number;
  userProfile?: UserProfile;
  settings?: StoreSettings;
  onClose: () => void;
  onTopUpSuccess: (amount: number, bonusAmount?: number, referralCode?: string) => void;
  lang: 'KM' | 'EN';
  defaultReferralCode?: string;
  isLoggedIn?: boolean;
  onRequireAuth?: () => void;
}

interface TopUpPackage {
  id: string;
  name: string;
  amountUSD: number;
  popular?: boolean;
}

const PACKAGES: TopUpPackage[] = [
  { id: 'pkg-0', name: '$1.00 Pack', amountUSD: 1.00 },
  { id: 'pkg-1', name: '$5.00 Pack', amountUSD: 5.00 },
  { id: 'pkg-2', name: '$10.00 Pack', amountUSD: 10.00 },
  { id: 'pkg-3', name: '$20.00 Pack', amountUSD: 20.00, popular: true },
  { id: 'pkg-4', name: '$50.00 Pack', amountUSD: 50.00 },
];

export const TopUpModal: React.FC<TopUpModalProps> = ({
  userBalanceUSD,
  userProfile,
  settings,
  onClose,
  onTopUpSuccess,
  lang,
  defaultReferralCode = '',
  isLoggedIn,
  onRequireAuth,
}) => {
  const [selectedPkg, setSelectedPkg] = useState<TopUpPackage>(PACKAGES[1]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isQrGenerated, setIsQrGenerated] = useState<boolean>(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [khqrString, setKhqrString] = useState<string>('');
  const [md5Hash, setMd5Hash] = useState<string>('');
  const [deepLinkUrl, setDeepLinkUrl] = useState<string>('');
  const [currentBillRef, setCurrentBillRef] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaymentFailed, setIsPaymentFailed] = useState(false);
  const [isCheckingRealApi, setIsCheckingRealApi] = useState(false);
  const [apiStatusMsg, setApiStatusMsg] = useState('');
  const [amountError, setAmountError] = useState<string>('');
  const [paymentCheckError, setPaymentCheckError] = useState<string>('');
  const [manualCheckResult, setManualCheckResult] = useState<{
    status: 'idle' | 'checking' | 'waiting' | 'confirmed';
    message: string;
  }>({ status: 'idle', message: '' });

  // Safe referral code: never auto-fill user's own code
  const myOwnCode = (
    userProfile?.referralCode ||
    (userProfile?.username ? `UCHIRO-${userProfile.username.toUpperCase()}` : '')
  ).toUpperCase();
  const safeInitialRef =
    defaultReferralCode && defaultReferralCode.trim().toUpperCase() !== myOwnCode
      ? defaultReferralCode.trim().toUpperCase()
      : '';

  // Mode switcher: Instant KHQR vs Send Slip
  const [topUpMode, setTopUpMode] = useState<'khqr' | 'slip'>('khqr');
  const [uploadedSlip, setUploadedSlip] = useState<string | null>(null);
  const [isWaitingSlipReview, setIsWaitingSlipReview] = useState(false);
  const [slipCountdownSeconds, setSlipCountdownSeconds] = useState(90);
  const [submittedTopup, setSubmittedTopup] = useState<any>(null);
  const [isSlipApproved, setIsSlipApproved] = useState(false);
  const slipFileInputRef = useRef<HTMLInputElement>(null);
  const slipPollRef = useRef<NodeJS.Timeout | null>(null);
  const slipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Referral code state for 2.5% friend topup bonus
  const [refCodeInput, setRefCodeInput] = useState<string>(safeInitialRef);
  const [appliedRefCode, setAppliedRefCode] = useState<string>(safeInitialRef);
  const [isValidatingRef, setIsValidatingRef] = useState(false);
  const [refError, setRefError] = useState<string>('');
  const [refSuccessMsg, setRefSuccessMsg] = useState<string>(
    safeInitialRef ? 'Referral code applied (+2.5% Bonus)' : ''
  );

  const rawCustom = customAmount ? parseFloat(customAmount) : null;
  const finalAmount = rawCustom !== null && !isNaN(rawCustom) ? rawCustom : selectedPkg.amountUSD;
  const isAmountValid = finalAmount >= 1.00;
  // 2.5% friend bonus on top-up
  const referralBonusUSD = appliedRefCode ? parseFloat((finalAmount * 0.025).toFixed(2)) : 0;
  const totalCreditedUSD = finalAmount + referralBonusUSD;

  const activeBakongId = (settings?.bakongAccountId || 'khinsovan_noreakyout@bkrt').trim();
  const activeMerchantName = (settings?.merchantName || 'UCHIRO STORE').trim();
  const activeMerchantCity = (settings?.merchantCity || 'Phnom Penh').trim();

  // Helpers for timer display
  const remainingSeconds = Math.max(0, 300 - elapsedSeconds);
  const formatTimeRemaining = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Polling & timer refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear polling & timers on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (slipPollRef.current) {
        clearInterval(slipPollRef.current);
      }
      if (slipTimerRef.current) {
        clearInterval(slipTimerRef.current);
      }
    };
  }, []);

  // Generate KHQR
  const handleGenerateKHQR = async () => {
    if (finalAmount < 1.00) {
      setAmountError(
        lang === 'KM'
          ? 'ចំនួនទឹកប្រាក់បញ្ចូលអប្បបរមាគឺ $1.00 USD'
          : 'Minimum top-up amount is $1.00 USD'
      );
      return;
    }
    setAmountError('');

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setElapsedSeconds(0);
    setIsPaymentFailed(false);
    setIsGeneratingQR(true);

    const topupRef = `TOPUP-${Math.floor(1000 + Math.random() * 9000)}`;
    setCurrentBillRef(topupRef);

    try {
      // 1. Try server-side generation
      const res = await api.generateKHQR({
        amount: Math.max(0.01, finalAmount),
        currency: 'USD',
        billNumber: topupRef,
        storeLabel: settings?.storeName || 'Uchiro Wallet',
        merchantName: activeMerchantName,
        merchantCity: activeMerchantCity,
        bakongAccountId: activeBakongId,
      });

      let payload = res.qrString;
      let qrUrl = res.qrDataUrl;
      let md5 = res.md5;
      let deep = res.deepLink;

      // 2. Fallback to client-side if server returned empty
      if (!payload || !qrUrl) {
        payload = generateKHQRPayload({
          merchantName: activeMerchantName,
          merchantCity: activeMerchantCity,
          bakongAccountId: activeBakongId,
          amount: Math.max(0.01, finalAmount),
          currency: 'USD',
          billNumber: topupRef,
          storeLabel: 'Uchiro Wallet',
        });
        qrUrl = await generateKHQRDataURL(payload);
        md5 = computeMD5(payload);
        deep = generateBakongDeepLink(payload);
      }

      setKhqrString(payload);
      setQrDataUrl(qrUrl);
      setMd5Hash(md5);
      setDeepLinkUrl(deep);
      setIsQrGenerated(true);

      // Start automatic live payment detection polling & 5-minute timer
      startPaymentListener(md5, topupRef);
    } catch (err) {
      console.error('Failed to generate KHQR:', err);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const triggerPaymentSuccess = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsAutoChecking(false);
    setIsProcessing(false);
    setIsSuccess(true);

    try {
      playPaymentSuccessSound();
      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#ffb230', '#3ECF8E', '#ffffff', '#00F0FF'],
      });
    } catch {}

    setTimeout(() => {
      onTopUpSuccess(finalAmount, referralBonusUSD, appliedRefCode || undefined);
    }, 1500);
  };

  const startPaymentListener = (md5: string, billNumber: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setElapsedSeconds(0);
    setIsPaymentFailed(false);
    setIsAutoChecking(true);
    setApiStatusMsg(
      lang === 'KM'
        ? 'បណ្តាញ Bakong ៖ កំពុងរង់ចាំការទូទាត់...'
        : 'Bakong Gateway: Waiting for transaction...'
    );

    // 1-second interval timer up to 300 seconds (5 minutes)
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= 300) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsAutoChecking(false);
          setIsPaymentFailed(true);
        }
        return next;
      });
    }, 1000);

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const checkRes = await api.checkKHQRPayment({
          md5,
          billNumber,
          amountUSD: finalAmount,
          referralCode: appliedRefCode,
          buyerUsername: userProfile?.username,
        });

        if (checkRes.paid || checkRes.status === 'PAID') {
          triggerPaymentSuccess();
        }
      } catch (e) {
        // Continue polling silently
      }
    }, 3000);
  };

  const handleConfirmPaid = async () => {
    setIsProcessing(true);
    setPaymentCheckError('');
    setApiStatusMsg(
      lang === 'KM'
        ? 'កំពុងត្រួតពិនិត្យប្រតិបត្តិការក្នុងប្រព័ន្ធធនាគារ (Bakong / KHPay)...'
        : 'Verifying payment with Bakong / KHPay API...'
    );

    try {
      const res = await api.checkKHQRPayment({
        md5: md5Hash,
        billNumber: currentBillRef,
        amountUSD: finalAmount,
        referralCode: appliedRefCode,
        buyerUsername: userProfile?.username,
      });

      if (res.paid || res.status === 'PAID') {
        triggerPaymentSuccess();
      } else {
        setPaymentCheckError(
          lang === 'KM'
            ? `⚠️ មិនទាន់រកឃើញការផ្ទេរប្រាក់ $${finalAmount.toFixed(2)} USD ក្នុងគណនីធនាគារទេ។ សូមស្កេន KHQR និងផ្ទេរប្រាក់តាមកម្មវិធីធនាគារ (Bakong / ABA / Wing) ជាមុនសិន រួចចុចបញ្ជាក់ម្តងទៀត!`
            : `⚠️ Payment not detected yet! Please scan the KHQR and transfer $${finalAmount.toFixed(2)} USD via your banking app (Bakong, ABA, Wing, etc.) first, then confirm.`
        );
      }
    } catch {
      setPaymentCheckError(
        lang === 'KM'
          ? 'មិនអាចពិនិត្យការទូទាត់បានទេ។ សូមប្រាកដថាអ្នកបានផ្ទេរប្រាក់រួចរាល់តាម KHQR។'
          : 'Unable to verify payment. Please ensure you have transferred via KHQR and try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyAccountId = () => {
    navigator.clipboard?.writeText(activeBakongId);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  const handleApplyReferral = async () => {
    const code = refCodeInput.trim().toUpperCase();
    if (!code) {
      setRefError(lang === 'KM' ? 'សូមបញ្ចូលកូដណែនាំ' : 'Please enter a referral code');
      setRefSuccessMsg('');
      return;
    }

    const myCode = (userProfile?.referralCode || (userProfile?.username ? `UCHIRO-${userProfile.username.toUpperCase()}` : '')).toUpperCase();
    const cleanUser = userProfile?.username ? userProfile.username.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') : '';
    if ((myCode && code === myCode) || (cleanUser && (code === `UCHIRO-${cleanUser}` || code === cleanUser))) {
      setRefError(
        lang === 'KM'
          ? 'អ្នកមិនអាចប្រើប្រាស់កូដណែនាំផ្ទាល់ខ្លួនរបស់អ្នកបានទេ។ សូមចែករំលែកកូដនេះទៅមិត្តភក្តិរបស់អ្នក!'
          : 'You cannot use your own referral code. Share your code with friends to earn commission!'
      );
      setRefSuccessMsg('');
      return;
    }

    setIsValidatingRef(true);
    setRefError('');
    setRefSuccessMsg('');

    try {
      const res = await api.validateReferralCode(code, userProfile?.username);
      if (!res.valid) {
        setRefError(
          res.error ||
            (lang === 'KM'
              ? 'កូដណែនាំមិនមានក្នុងប្រព័ន្ធទេ។ សូមពិនិត្យមើលឡើងវិញ!'
              : 'Referral code not found. Only existing user codes can be used.')
        );
        setAppliedRefCode('');
        return;
      }

      setAppliedRefCode(code);
      setRefSuccessMsg(
        lang === 'KM'
          ? '🎉 កូដត្រឹមត្រូវ! អ្នកនឹងទទួលបានប្រាក់រង្វាន់បន្ថែម +2.5%!'
          : '🎉 Valid Referral Code! You will get +2.5% Extra Balance Bonus!'
      );

      if (isQrGenerated) {
        setIsQrGenerated(false);
      }
    } catch {
      setRefError('Network error validating referral code');
    } finally {
      setIsValidatingRef(false);
    }
  };

  const handleSlipFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(
        lang === 'KM'
          ? 'សូមជ្រើសរើសរូបភាពវិក្កយបត្រ (JPG, PNG, WebP)'
          : 'Please upload an image file (JPG, PNG, WebP)'
      );
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert(
        lang === 'KM'
          ? 'ទំហំរូបភាពធំពេក (អតិបរមា 8MB)'
          : 'Image size is too large (Max 8MB)'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedSlip(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSlip = () => {
    setUploadedSlip(null);
    if (slipFileInputRef.current) {
      slipFileInputRef.current.value = '';
    }
  };

  const handleSlipSubmitTopup = async () => {
    if (!uploadedSlip) return;
    setIsProcessing(true);

    const newTopupId = `#TOP-${Math.floor(1000 + Math.random() * 9000)}`;
    const topupData = {
      id: newTopupId,
      customerUsername: userProfile?.username || 'Customer',
      amountUSD: finalAmount,
      bonusUSD: referralBonusUSD,
      totalCreditUSD: totalCreditedUSD,
      status: 'pending',
      slipStatus: 'admin_review',
      paymentMethod: 'KHQR',
      referralCode: appliedRefCode || undefined,
      paymentSlipUrl: uploadedSlip,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      await api.submitPaymentSlip({
        type: 'topup',
        topupData,
        slipBase64: uploadedSlip,
      });
    } catch (err) {
      console.warn('Submit topup slip fallback:', err);
    }

    setSubmittedTopup(topupData);
    setIsWaitingSlipReview(true);
    setSlipCountdownSeconds(90);
    setIsProcessing(false);

    // 1. Live Countdown Timer
    if (slipTimerRef.current) clearInterval(slipTimerRef.current);
    slipTimerRef.current = setInterval(() => {
      setSlipCountdownSeconds((prev) => {
        if (prev <= 1) {
          if (slipTimerRef.current) {
            clearInterval(slipTimerRef.current);
            slipTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Active Polling every 3s
    if (slipPollRef.current) clearInterval(slipPollRef.current);
    slipPollRef.current = setInterval(async () => {
      try {
        const topupsRes = await api.getTopupRequests();
        if (topupsRes && Array.isArray(topupsRes.topupRequests)) {
          const found = topupsRes.topupRequests.find(
            (t: any) => t.id === newTopupId || t.id === newTopupId.replace('#', '')
          );
          if (found && (found.status === 'delivered' || found.slipStatus === 'confirmed')) {
            if (slipPollRef.current) clearInterval(slipPollRef.current);
            if (slipTimerRef.current) clearInterval(slipTimerRef.current);
            setIsSlipApproved(true);
            try {
              playPaymentSuccessSound();
              confetti({
                particleCount: 100,
                spread: 75,
                origin: { y: 0.6 },
                colors: ['#3ECF8E', '#ffb230', '#ffffff', '#00F0FF'],
              });
            } catch {}

            const newBalance = Number(((userBalanceUSD || 0) + totalCreditedUSD).toFixed(2));
            setTimeout(() => {
              onTopUpSuccess(newBalance);
            }, 1200);
            return;
          }
        }

        // Also check if user profile balance increased
        const profileRes = await api.getUserProfile();
        if (profileRes && typeof profileRes.balanceUSD === 'number' && profileRes.balanceUSD > (userBalanceUSD || 0)) {
          if (slipPollRef.current) clearInterval(slipPollRef.current);
          if (slipTimerRef.current) clearInterval(slipTimerRef.current);
          setIsSlipApproved(true);
          try {
            playPaymentSuccessSound();
            confetti({
              particleCount: 100,
              spread: 75,
              origin: { y: 0.6 },
              colors: ['#3ECF8E', '#ffb230', '#ffffff', '#00F0FF'],
            });
          } catch {}
          setTimeout(() => {
            onTopUpSuccess(profileRes.balanceUSD);
          }, 1200);
          return;
        }
      } catch (e) {
        // silent catch
      }
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overflow-x-hidden min-h-screen">
      <div className="relative w-full max-w-xl bg-[#14161D] rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 my-3 sm:my-auto mb-28 sm:mb-auto animate-[scaleIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-white flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
            {lang === 'KM' ? 'បញ្ចូលសមតុល្យកាបូប (USD)' : 'TOP-UP BALANCE (USD)'}
          </h1>
        </div>

        {/* Current Balance Display */}
        <section className="glass-panel rounded-2xl p-4 text-center flex flex-col items-center justify-center relative overflow-hidden border border-white/10 shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ffb230]/10 via-transparent to-transparent pointer-events-none" />
          <p className="font-sans text-xs text-[#8B90A0] uppercase font-bold tracking-widest mb-1">
            {lang === 'KM' ? 'សមតុល្យកាបូបបច្ចុប្បន្ន' : 'Current Wallet Balance'}
          </p>
          <h2 className="font-headline text-3xl md:text-4xl text-[#ffd7a1] drop-shadow-[0_0_15px_rgba(255,178,48,0.3)]">
            ${(userBalanceUSD ?? 0).toFixed(2)}{' '}
            <span className="text-lg font-price text-[#3ECF8E] font-bold">USD</span>
          </h2>
        </section>

        {/* Authentication Gate: User must be signed in to Top Up */}
        {isLoggedIn === false ? (
          <div
            id="topup-auth-required-gate"
            className="glass-panel p-6 sm:p-8 rounded-2xl border border-[#ffb230]/40 text-center space-y-4 my-2 relative overflow-hidden"
          >
            <div className="w-16 h-16 rounded-3xl bg-[#ffb230]/15 border-2 border-[#ffb230] text-[#ffb230] flex items-center justify-center mx-auto shadow-lg">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wide">
                {lang === 'KM' ? 'សូមចូលគណនីជាមុនសិន' : 'Sign In Required to Top Up'}
              </h3>
              <p className="font-sans text-xs sm:text-sm text-[#8B90A0] leading-relaxed">
                {lang === 'KM'
                  ? 'ដើម្បីធានាថាសមតុល្យលុយត្រូវបានបញ្ចូលដោយសុវត្ថិភាពទៅកាន់កាបូបផ្ទាល់ខ្លួនរបស់អ្នក សូមចូលគណនី (Sign In) ឬចុះឈ្មោះ (Sign Up) ជាមុនសិន។'
                  : 'To ensure your funds are credited securely to your personal verified wallet, you must sign in or register an account first.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                id="btn-topup-signin-gate"
                onClick={() => {
                  onClose();
                  if (onRequireAuth) onRequireAuth();
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-sm font-bold uppercase tracking-wider chunky-btn-gold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <UserCheck className="w-4 h-4" />
                <span>{lang === 'KM' ? 'ចូលគណនី / ចុះឈ្មោះឥឡូវនេះ' : 'Sign In / Register Now'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-headline text-sm font-bold uppercase tracking-wider border border-white/10 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span>{lang === 'KM' ? 'ត្រឡប់ក្រោយ' : 'Cancel'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal KHQR / Slip Top-Up Flow */
          <>
            {isSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-[#3ECF8E]/20 text-[#3ECF8E] rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="font-headline text-2xl text-[#3ECF8E] uppercase">
                  {lang === 'KM' ? 'បញ្ចូលលុយជោគជ័យ!' : 'TOP-UP SUCCESSFUL!'}
                </h3>
                <p className="font-price text-sm text-[#e2e2ec]">
                  Added{' '}
                  <span className="text-[#ffd7a1] font-bold">
                    +${totalCreditedUSD.toFixed(2)} USD
                  </span>{' '}
                  to your wallet!
                </p>
                {referralBonusUSD > 0 && (
                  <div className="inline-flex items-center gap-1.5 bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E] px-3 py-1 rounded-full text-xs font-price font-bold">
                    <Gift className="w-3.5 h-3.5" />
                    <span>Includes +${referralBonusUSD.toFixed(2)} USD (2.5% Friend Bonus)</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      generateReceiptPdf({
                        orderId: `TOPUP-${Date.now().toString().slice(-6)}`,
                        customerName: userProfile?.username || 'Valued Customer',
                        product: {
                          title: `Store Wallet Balance Top-Up ($${finalAmount.toFixed(2)} USD)`,
                          category: 'Wallet Deposit',
                          price: finalAmount,
                          fulfillmentType: 'Instant Balance Credit',
                        },
                        quantity: 1,
                        totalUSD: finalAmount,
                        paymentMethod: 'Bakong / ABA KHQR',
                        status: 'delivered',
                        md5Hash: md5Hash || undefined,
                        apiConfirmedAt: new Date().toLocaleString('en-US', {
                          timeZone: 'Asia/Phnom_Penh',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        apiSource: settings?.khqrApiKey ? 'KHPay Gateway (khpay.site) / NBC Bakong' : 'Instant KHQR Ledger Verification',
                      });
                    }}
                    className="w-full sm:w-auto bg-[#1C1F29] hover:bg-[#282a31] border border-[#ffb230]/50 hover:border-[#ffb230] text-[#ffd7a1] hover:text-[#ffb230] py-2.5 px-5 rounded-xl font-headline text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-[#ffb230]" />
                    <span>{lang === 'KM' ? 'ទាញយកវិក្កយបត្រ PDF (Download Receipt)' : 'Download Verified PDF Receipt'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] py-2.5 px-6 rounded-xl font-headline text-xs uppercase font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    {lang === 'KM' ? 'រួចរាល់ (Done)' : 'Done'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: Package Selection & Referral Code */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline text-sm sm:text-base text-[#e2e2ec] uppercase">
                      1. Select USD Amount
                    </h3>
                    {isQrGenerated && (
                      <span className="text-[10px] font-price text-[#3ECF8E] font-bold bg-[#3ECF8E]/15 px-2 py-0.5 rounded-full">
                        Confirmed
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {PACKAGES.map((pkg) => {
                      const isSelected = selectedPkg.id === pkg.id && !customAmount;
                      return (
                        <button
                          key={pkg.id}
                          onClick={() => {
                            setSelectedPkg(pkg);
                            setCustomAmount('');
                            if (isQrGenerated) setIsQrGenerated(false);
                          }}
                          className={`relative rounded-2xl p-3 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                            pkg.popular ? 'shimmer-wrapper' : ''
                          } ${
                            isSelected
                              ? 'bg-[#1C1F29] border-2 border-[#ffb230] shadow-[0_0_15px_rgba(255,178,48,0.3)]'
                              : 'bg-[#1C1F29] border border-white/10 hover:border-white/25'
                          }`}
                        >
                          {pkg.popular && (
                            <div className="absolute -top-2.5 bg-[#ffb230] text-[#291800] text-[8px] font-headline font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                              Popular
                            </div>
                          )}
                          <span className="font-headline text-lg text-[#ffd7a1]">
                            ${pkg.amountUSD.toFixed(2)}
                          </span>
                          <span className="font-price text-[10px] text-[#8B90A0]">
                            Instant Credit
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-price text-[11px] text-[#8B90A0]">
                        Or enter custom USD amount:
                      </label>
                      <span className="font-price text-[10px] text-[#ffb230] font-bold">
                        Min: $1.00 USD
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-price text-xs text-[#ffb230] font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        min="1.00"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setAmountError('');
                          if (isQrGenerated) setIsQrGenerated(false);
                        }}
                        placeholder="e.g. 5.00 (min $1.00)"
                        className={`w-full bg-[#11131a] text-[#e2e2ec] border rounded-xl pl-7 pr-3 py-2 font-price text-xs focus:outline-none ${
                          customAmount && parseFloat(customAmount) < 1.00
                            ? 'border-[#E8433F] focus:border-[#E8433F]'
                            : 'border-white/15 focus:border-[#ffb230]'
                        }`}
                      />
                    </div>
                    {customAmount && parseFloat(customAmount) < 1.00 && (
                      <p className="text-[10px] text-[#ff5752] font-price mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{lang === 'KM' ? 'ចំនួនទឹកប្រាក់បញ្ចូលអប្បបរមាគឺ $1.00 USD' : 'Minimum top-up amount is $1.00 USD'}</span>
                      </p>
                    )}
                    {amountError && (
                      <p className="text-[10px] text-[#ff5752] font-price mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{amountError}</span>
                      </p>
                    )}
                  </div>

                  {/* Referral Code Box (2.5% Bonus for Friend, 5% for Referrer) */}
                  <div className="bg-[#1C1F29] p-3 rounded-2xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-price text-xs text-[#ffd7a1] font-bold flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-[#3ECF8E]" />
                        <span>Friend Referral Code</span>
                      </span>
                      {appliedRefCode && (
                        <span className="text-[9px] font-price font-bold bg-[#3ECF8E]/20 text-[#3ECF8E] px-2 py-0.5 rounded-full">
                          +2.5% APPLIED
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={refCodeInput}
                        onChange={(e) => {
                          setRefCodeInput(e.target.value);
                          setRefError('');
                        }}
                        placeholder="e.g. UCH-NORE-01"
                        className="flex-1 bg-[#11131a] text-[#e2e2ec] border border-white/15 rounded-xl px-3 py-2 text-xs font-price uppercase focus:outline-none focus:border-[#3ECF8E]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyReferral}
                        disabled={isValidatingRef}
                        className="bg-[#3ECF8E]/20 hover:bg-[#3ECF8E]/30 text-[#3ECF8E] border border-[#3ECF8E]/40 px-3 py-2 rounded-xl text-xs font-headline font-bold uppercase transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        {isValidatingRef ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                      </button>
                    </div>

                    {refError && (
                      <p className="text-[10px] text-[#ff5752] font-price flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{refError}</span>
                      </p>
                    )}

                    {refSuccessMsg && (
                      <p className="text-[10px] text-[#3ECF8E] font-price flex items-center gap-1">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>{refSuccessMsg}</span>
                      </p>
                    )}

                    {appliedRefCode && (
                      <div className="flex items-center justify-between text-[11px] font-price text-[#3ECF8E] pt-0.5 border-t border-white/5">
                        <span>Code <strong className="text-white">{appliedRefCode}</strong>:</span>
                        <span className="font-bold">+${referralBonusUSD.toFixed(2)} USD (2.5% Bonus)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: KHQR Creation & Payment Container */}
                <div className="bg-[#11131a] rounded-2xl p-4 border border-white/10 flex flex-col items-center justify-between gap-3">
                  <div className="w-full flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-[#ffb230]" />
                      <span className="font-price text-xs font-bold text-[#e2e2ec]">KHQR Instant Pay</span>
                    </div>
                    <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40 text-[9px] font-price font-bold px-2 py-0.5 rounded-full">
                      Bakong API
                    </span>
                  </div>

                  {!isQrGenerated ? (
                    <div className="w-full flex-1 flex flex-col items-center justify-center text-center p-4 bg-[#1C1F29]/60 rounded-2xl border border-white/5 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#ffb230]/10 border border-[#ffb230]/20 flex items-center justify-center text-[#ffb230]">
                        <QrCode className="w-6 h-6 opacity-80" />
                      </div>
                      <div>
                        <h4 className="font-headline text-sm text-[#ffd7a1] uppercase">
                          {lang === 'KM' ? 'ជ្រើសរើសចំនួនប្រាក់ រួចបង្កើត QR' : 'Confirm Amount to Create QR'}
                        </h4>
                        <p className="font-price text-[11px] text-[#8B90A0] mt-1 max-w-[200px]">
                          {lang === 'KM'
                            ? `ចុចខាងក្រោមដើម្បីបង្កើតកូដ KHQR ចំនួន $${finalAmount.toFixed(2)} USD`
                            : `Click confirm to generate dynamic KHQR for $${finalAmount.toFixed(2)} USD.`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 w-full flex flex-col items-center animate-fade-in">
                      {/* Live Status Header with Real-time Timer & Polling Indicator */}
                      <div className={`w-full border rounded-xl px-3 py-2 flex items-center justify-between transition-colors ${
                        isPaymentFailed
                          ? 'bg-[#E8433F]/10 border-[#E8433F]/40'
                          : elapsedSeconds >= 60
                          ? 'bg-[#ffb230]/10 border-[#ffb230]/40'
                          : 'bg-[#14161F] border-[#3ECF8E]/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isPaymentFailed ? (
                            <AlertCircle className="w-4 h-4 text-[#E8433F] shrink-0" />
                          ) : (
                            <span className="relative flex h-2 w-2">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                elapsedSeconds >= 60 ? 'bg-[#ffb230]' : 'bg-[#3ECF8E]'
                              }`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                elapsedSeconds >= 60 ? 'bg-[#ffb230]' : 'bg-[#3ECF8E]'
                              }`}></span>
                            </span>
                          )}
                          <div className="flex flex-col">
                            <span className={`text-[11px] font-headline font-bold ${
                              isPaymentFailed
                                ? 'text-[#E8433F]'
                                : elapsedSeconds >= 60
                                ? 'text-[#ffd7a1]'
                                : 'text-[#3ECF8E]'
                            }`}>
                              {isPaymentFailed
                                ? (lang === 'KM' ? 'ផុតកំណត់ (5mn Timeout)' : 'Session Expired (5mn)')
                                : (lang === 'KM' ? 'កំពុងរង់ចាំការទូទាត់...' : 'Waiting for payment...')}
                            </span>
                            <span className="text-[9px] font-price text-[#8B90A0]">
                              {isPaymentFailed ? '5-minute limit reached' : apiStatusMsg || 'Bakong Gateway live'}
                            </span>
                          </div>
                        </div>

                        {/* Timer Countdown Badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isPaymentFailed
                              ? 'bg-[#E8433F]/20 text-[#E8433F] border-[#E8433F]/30'
                              : elapsedSeconds >= 240
                              ? 'bg-[#E8433F]/20 text-[#E8433F] border-[#E8433F]/30 animate-pulse'
                              : elapsedSeconds >= 60
                              ? 'bg-[#ffb230]/20 text-[#ffb230] border-[#ffb230]/30'
                              : 'bg-[#3ECF8E]/15 text-[#3ECF8E] border-[#3ECF8E]/30'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeRemaining(remainingSeconds)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 5-Minute Timeout (Payment Failed State) */}
                      {isPaymentFailed ? (
                        <div className="w-full bg-[#1e1518] border-2 border-[#E8433F]/50 rounded-2xl p-4 text-center space-y-3 animate-fade-in">
                          <div className="w-10 h-10 rounded-xl bg-[#E8433F]/20 border border-[#E8433F]/40 flex items-center justify-center mx-auto text-[#E8433F]">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-headline text-sm text-[#ff706c] uppercase">
                              {lang === 'KM' ? 'ការទូទាត់មិនជោគជ័យ / ផុតកំណត់' : 'Payment Timeout (Failed)'}
                            </h4>
                            <p className="font-sans text-xs text-[#d1d5db] mt-1 leading-snug">
                              {lang === 'KM'
                                ? 'កូដ QR បានផុតកំណត់ 5 នាទី។ សូមបង្កើតកូដថ្មី ឬទាក់ទងមកកាន់ Support Telegram។'
                                : 'QR code expired after 5 minutes. Click below to generate a fresh QR or message support.'}
                            </p>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleGenerateKHQR}
                              className="flex-1 bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs py-2 px-2.5 rounded-xl font-bold uppercase transition-all flex items-center justify-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>{lang === 'KM' ? 'បង្កើត QR ឡើងវិញ' : 'Try Again'}</span>
                            </button>
                            <a
                              href="https://t.me/Noreakyout"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#2AABEE]/20 hover:bg-[#2AABEE]/30 text-[#2AABEE] border border-[#2AABEE]/40 font-headline text-xs py-2 px-2.5 rounded-xl font-bold uppercase transition-all flex items-center justify-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Support</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        /* Standard Clean KHQR Card */
                        <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-4 border-[#ffb230]/40 flex flex-col items-center w-full max-w-[220px]">
                          <div className="w-full bg-[#E8433F] text-white text-center text-[11px] font-bold py-1 rounded-t-lg mb-1.5 font-headline uppercase tracking-widest flex items-center justify-center gap-1.5">
                            <span>🇰🇭</span>
                            <span>KHQR PAYMENT</span>
                          </div>

                          <div className="w-full aspect-square bg-white flex items-center justify-center p-1">
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                alt="KHQR Topup Code"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Loader2 className="w-8 h-8 text-[#ffb230] animate-spin" />
                            )}
                          </div>

                          <div className="w-full bg-[#0A0B0E] text-[#ffd7a1] text-center text-xs font-price font-bold py-1.5 rounded-b-lg mt-1.5 border border-white/10 flex items-center justify-between px-2.5">
                            <span className="text-[10px] text-[#8B90A0] font-mono uppercase">AMOUNT</span>
                            <span>${finalAmount.toFixed(2)} USD</span>
                          </div>
                        </div>
                      )}

                      {/* 60-Second Friendly Timeout Notice */}
                      {elapsedSeconds >= 60 && !isPaymentFailed && (
                        <div className="w-full bg-[#ffb230]/10 border border-[#ffb230]/30 rounded-2xl p-2.5 text-left space-y-1.5 animate-fade-in">
                          <div className="flex items-start gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#ffb230] shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-headline text-[11px] text-[#ffd7a1] uppercase font-bold">
                                {lang === 'KM' ? 'ចំណាយពេលយូរជាងធម្មតា (60s+)?' : 'Payment taking longer (60s+)?'}
                              </h5>
                              <p className="font-sans text-[10px] text-[#d1d5db] mt-0.5 leading-snug">
                                {lang === 'KM'
                                  ? 'ប្រសិនបើអ្នកបានផ្ទេររួច សូមរង់ចាំបន្តិច ឬចុចផ្ទៀងផ្ទាត់ខាងក្រោម។'
                                  : 'If already paid in your app, please wait a moment or click verify below. Need help? Message Telegram.'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => {
                                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                                setIsQrGenerated(false);
                              }}
                              className="flex-1 text-[#ffd7a1] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 py-1 px-1.5 rounded-lg text-[9px] font-headline uppercase font-bold flex items-center justify-center gap-1"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>{lang === 'KM' ? 'ព្យាយាមម្តងទៀត' : 'Try Again'}</span>
                            </button>
                            <a
                              href="https://t.me/Noreakyout"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-[#2AABEE] hover:text-white bg-[#2AABEE]/15 hover:bg-[#2AABEE]/25 border border-[#2AABEE]/30 py-1 px-1.5 rounded-lg text-[9px] font-headline uppercase font-bold flex items-center justify-center gap-1 text-center"
                            >
                              <MessageCircle className="w-2.5 h-2.5" />
                              <span>Support</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Live Waiting Status & Change option */}
                      {!isPaymentFailed && (
                        <div className="w-full flex items-center justify-between pt-1 px-1">
                          <div className="flex items-center gap-2 text-xs text-[#8B90A0]">
                            <div className="w-2 h-2 rounded-full bg-[#ffb230] animate-ping" />
                            <span className="font-headline uppercase text-[11px] text-[#ffd7a1]">
                              {lang === 'KM' ? 'កំពុងរង់ចាំការទូទាត់...' : 'Waiting for payment...'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                              setIsQrGenerated(false);
                            }}
                            className="text-[#8B90A0] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 py-1.5 px-3 rounded-lg text-xs font-headline font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{lang === 'KM' ? 'ប្តូរចំនួន' : 'Change'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Amount Breakdown */}
                  <div className="w-full bg-[#1C1F29] p-2.5 rounded-xl border border-white/5 space-y-1 text-[11px] font-price">
                    <div className="flex justify-between text-[#8B90A0]">
                      <span>Top-Up Amount:</span>
                      <span className="text-white font-bold">${finalAmount.toFixed(2)} USD</span>
                    </div>
                    {referralBonusUSD > 0 && (
                      <div className="flex justify-between text-[#3ECF8E]">
                        <span>+2.5% Friend Bonus:</span>
                        <span className="font-bold">+${referralBonusUSD.toFixed(2)} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#ffd7a1] pt-1 border-t border-white/5 font-bold">
                      <span>Total Wallet Credit:</span>
                      <span>${totalCreditedUSD.toFixed(2)} USD</span>
                    </div>
                  </div>

                  {!isQrGenerated ? (
                    <button
                      type="button"
                      onClick={handleGenerateKHQR}
                      disabled={isGeneratingQR || !isAmountValid}
                      className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-sm py-3 rounded-xl uppercase font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                    >
                      {isGeneratingQR ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating QR...</span>
                        </>
                      ) : !isAmountValid ? (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          <span>Min $1.00 USD required</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>
                            {lang === 'KM' ? `បង្កើតកូដ QR ($${finalAmount.toFixed(2)})` : `Generate KHQR ($${finalAmount.toFixed(2)})`}
                          </span>
                        </>
                      )}
                    </button>
                  ) : isPaymentFailed ? (
                    <button
                      type="button"
                      onClick={handleGenerateKHQR}
                      disabled={isGeneratingQR}
                      className="w-full bg-[#E8433F] hover:bg-[#ff5752] text-white font-headline text-sm sm:text-base py-3.5 rounded-xl uppercase font-bold tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(232,67,63,0.3)] cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{lang === 'KM' ? 'ផុតកំណត់ • បង្កើតកូដ QR ថ្មី' : 'EXPIRED • GENERATE NEW QR'}</span>
                    </button>
                  ) : (
                    <div className="w-full space-y-2.5">
                      {paymentCheckError && (
                        <div className="bg-[#E8433F]/15 border border-[#E8433F]/40 rounded-xl p-3 text-xs text-[#ff9894] font-price flex items-start gap-2 animate-pulse">
                          <AlertCircle className="w-4 h-4 shrink-0 text-[#E8433F] mt-0.5" />
                          <span>{paymentCheckError}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleConfirmPaid}
                        disabled={isProcessing}
                        className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-sm sm:text-base py-3.5 rounded-xl uppercase font-bold tracking-wider disabled:opacity-75 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,178,48,0.3)] cursor-pointer transition-all active:scale-98"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-[#291800]" />
                            <span>{lang === 'KM' ? 'កំពុងត្រួតពិនិត្យប្រព័ន្ធធនាគារ...' : 'Verifying with Bank API...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            <span>{lang === 'KM' ? 'ខ្ញុំបានផ្ទេររួចរាល់ (បញ្ជាក់ការទូទាត់)' : 'I Have Paid (Confirm & Add Balance)'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
