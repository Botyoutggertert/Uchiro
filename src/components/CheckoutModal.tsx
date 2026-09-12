import React, { useState, useRef, useEffect } from 'react';
import { Product, Order, Coupon, StoreSettings, UserProfile, RobloxProfile } from '../types';
import { generateKHQRDataURL, generateKHQRPayload, computeMD5, generateBakongDeepLink } from '../utils/khqr';
import { getMemberRankInfo } from '../utils/memberRank';
import { AccountLoginRulesModal } from './AccountLoginRulesModal';
import { Api, api } from '../utils/api';
import {
  X,
  CheckCircle,
  Upload,
  QrCode,
  Tag,
  ShieldCheck,
  Info,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Gift,
  Users,
  Send,
  AlertCircle,
  Wallet,
  Zap,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  Ban,
  ChevronRight,
  UserCheck,
  ExternalLink,
  Search,
  Radio,
  Clock,
  LifeBuoy,
  MessageCircle,
  FileDown,
  Receipt,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateReceiptPdf } from '../utils/generateReceiptPdf';
import { playPaymentSuccessSound, playPaymentErrorSound } from '../utils/soundEffects';

interface CheckoutModalProps {
  product: Product;
  onClose: () => void;
  onCompleteOrder: (newOrder: Order) => void;
  availableCoupons: Coupon[];
  settings?: StoreSettings;
  userProfile?: UserProfile;
  lang: 'KM' | 'EN';
  onOpenTopup?: () => void;
  onOpenAuth?: () => void;
  isLoggedIn?: boolean;
  onViewMyOrders?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  product,
  onClose,
  onCompleteOrder,
  availableCoupons,
  settings,
  userProfile,
  lang,
  onOpenTopup,
  onOpenAuth,
  isLoggedIn = false,
  onViewMyOrders,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'khqr'>('balance');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);

  // KHQR creation states (NOT auto generated; only when confirmed by user)
  const [isKhqrGenerated, setIsKhqrGenerated] = useState<boolean>(false);
  const [isGeneratingKhqr, setIsGeneratingKhqr] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [khqrString, setKhqrString] = useState<string>('');
  const [md5Hash, setMd5Hash] = useState<string>('');
  const [deepLinkUrl, setDeepLinkUrl] = useState<string>('');
  const [currentOrderRef, setCurrentOrderRef] = useState<string>('');
  const [uploadedSlip, setUploadedSlip] = useState<string | null>(null);
  const [copiedKHQR, setCopiedKHQR] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaymentFailed, setIsPaymentFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string>('');
  const [failureDetailMessage, setFailureDetailMessage] = useState<string>('');
  const [isCheckingRealApi, setIsCheckingRealApi] = useState(false);
  const [apiStatusMessage, setApiStatusMessage] = useState('');
  const [manualCheckResult, setManualCheckResult] = useState<{
    status: 'idle' | 'checking' | 'waiting' | 'confirmed';
    message: string;
    timestamp?: number;
  }>({ status: 'idle', message: '' });

  const [isProcessing, setIsProcessing] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [checkedRobloxProfile, setCheckedRobloxProfile] = useState<RobloxProfile | null>(null);
  const [usernameVerified, setUsernameVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Slip Upload waiting & review states (3 minutes waiting flow)
  const [isWaitingSlipReview, setIsWaitingSlipReview] = useState(false);
  const [slipCountdownSeconds, setSlipCountdownSeconds] = useState(180);
  const [submittedSlipOrder, setSubmittedSlipOrder] = useState<Order | null>(null);
  const [isSlipApproved, setIsSlipApproved] = useState(false);
  const slipPollRef = useRef<NodeJS.Timeout | null>(null);
  const slipTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const isSoldOut = product.isSold || product.stock <= 0;
  const isFruit = product.category === 'fruit';
  const isAccount = product.fulfillmentType === 'account' || product.category === 'account';
  const isGift = !isAccount && product.fulfillmentType === 'gift';
  const isTrade = !isAccount && (product.fulfillmentType === 'trade' || (!isGift && !isAccount));
  const warrantyDays = product.warrantyDays || 14;

  // Check and verify Roblox username for gifts
  const handleCheckUsername = async (overrideUser?: string): Promise<RobloxProfile | null> => {
    const rawUser = (overrideUser !== undefined ? overrideUser : robloxUsername).trim();
    const cleanUser = rawUser.replace(/^@/, '').trim();

    if (!cleanUser) {
      setUsernameError(
        lang === 'KM'
          ? 'សូមបញ្ចូល Roblox Username របស់អ្នកដើម្បីពិនិត្យ'
          : 'Please enter your Roblox username to verify'
      );
      setCheckedRobloxProfile(null);
      setUsernameVerified(false);
      return null;
    }

    if (cleanUser.length < 3 || cleanUser.length > 20) {
      setUsernameError(
        lang === 'KM'
          ? 'Roblox Username ត្រូវមានចន្លោះពី ៣ ដល់ ២០ តួអក្សរ'
          : 'Roblox username must be between 3 and 20 characters'
      );
      setCheckedRobloxProfile(null);
      setUsernameVerified(false);
      return null;
    }

    setIsCheckingUsername(true);
    setUsernameError('');

    try {
      const res = await Api.checkRobloxProfile(cleanUser);
      if (res.success && res.profile) {
        setCheckedRobloxProfile(res.profile);
        setRobloxUsername(res.profile.username);
        setUsernameVerified(true);
        setUsernameError('');
        return res.profile;
      } else {
        setUsernameError(
          res.error ||
            (lang === 'KM'
              ? 'រកមិនឃើញគណនី Roblox នេះទេ សូមពិនិត្យឈ្មោះឡើងវិញ'
              : 'Roblox user not found. Please verify spelling.')
        );
        setCheckedRobloxProfile(null);
        setUsernameVerified(false);
        return null;
      }
    } catch (err: any) {
      setUsernameError(err.message || 'Error checking Roblox username');
      setCheckedRobloxProfile(null);
      setUsernameVerified(false);
      return null;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Member Rank Auto Discount Calculation
  const productPrice = product?.price ?? 0;
  const rankInfo = getMemberRankInfo(userProfile?.totalSpentUSD || 0, userProfile?.isResellerUnlocked);
  const rankDiscountPercent = rankInfo.autoDiscountPercent;
  const rankDiscountUSD = (productPrice * rankDiscountPercent) / 100;

  // Coupon Discount
  const couponDiscountUSD = appliedCoupon
    ? (productPrice * appliedCoupon.discountPercent) / 100
    : 0;

  // Total discounts combined
  const totalDiscountUSD = rankDiscountUSD + couponDiscountUSD;
  const finalTotalUSD = Math.max(0, productPrice - totalDiscountUSD);

  const currentBalance = userProfile?.balanceUSD ?? 0;
  const hasSufficientBalance = currentBalance >= finalTotalUSD;

  const merchantName = (settings?.merchantName || 'UCHIRO STORE').trim();
  const merchantCity = (settings?.merchantCity || 'Phnom Penh').trim();
  const bakongAccountId = (settings?.bakongAccountId || 'khinsovan_noreakyout@bkrt').trim();

  // Helpers for timer display
  const remainingSeconds = Math.max(0, 300 - elapsedSeconds);
  const formatTimeRemaining = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Polling for automated payment confirmation with real API verification & 5-minute timeout
  const startOrderPaymentListener = (md5: string, billNumber: string) => {
    // Clear any previous intervals
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
    setFailureReason('');
    setFailureDetailMessage('');
    setIsAutoChecking(true);
    setApiStatusMessage(
      lang === 'KM'
        ? 'បណ្តាញ Bakong ៖ កំពុងរង់ចាំការទូទាត់...'
        : 'Bakong Gateway: Waiting for transaction...'
    );

    // Track consecutive network failures to prevent infinite silent polling on disconnect
    let consecutiveNetworkErrors = 0;

    // 1. Ticking 1-second countdown timer up to 300s (5 minutes)
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= 300) {
          // 5 Minutes (300s) timeout reached - Mark Payment Failed
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
          setFailureReason('timeout');
          setFailureDetailMessage(
            lang === 'KM'
              ? 'ការទូទាត់បានផុតកំណត់រយៈពេល ៥ នាទី ដោយមិនទាន់ទទួលបានការបញ្ជាក់ពីប្រព័ន្ធ Bakong។ ប្រសិនបើអ្នកមិនទាន់បានផ្ទេរប្រាក់ សូមចុច "Try Again" ដើម្បីបង្កើតកូដ QR ថ្មី។'
              : 'The payment verification window (5 minutes) timed out without detecting a confirmed transaction on the Bakong KHQR network. No funds have been lost.'
          );
          playPaymentErrorSound();
        }
        return next;
      });
    }, 1000);

    // 2. Real API check polling every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        setIsCheckingRealApi(true);
        const checkRes = await api.checkKHQRPayment({
          md5,
          billNumber,
          amountUSD: finalTotalUSD,
          buyerUsername: userProfile?.username,
          orderId: billNumber,
        });

        consecutiveNetworkErrors = 0; // reset on valid response

        if (checkRes.paid || checkRes.status === 'PAID') {
          // Successfully confirmed by Bakong API!
          playPaymentSuccessSound();
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsAutoChecking(false);
          setIsPaymentFailed(false);
          setFailureReason('');
          setFailureDetailMessage('');
          handleSubmitOrder(false, billNumber, true);
        } else if (checkRes.status === 'FAILED' || checkRes.status === 'EXPIRED') {
          // Payment explicitly marked failed or expired by gateway
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
          setFailureReason(checkRes.status.toLowerCase());
          setFailureDetailMessage(
            checkRes.message ||
              (lang === 'KM'
                ? 'ប្រព័ន្ធទូទាត់ Bakong បានរាយការណ៍ថាប្រតិបត្តិការនេះមិនជោគជ័យ ឬផុតកំណត់។'
                : 'The payment gateway reported that this transaction was expired or could not be verified.')
          );
          playPaymentErrorSound();
        } else {
          // Transaction still waiting/pending on network
          setApiStatusMessage(
            lang === 'KM'
              ? 'បណ្តាញ Bakong ៖ កំពុងរង់ចាំការស្កេន និងផ្ទេរប្រាក់...'
              : 'Bakong Network: Waiting for scan & transfer...'
          );
        }
      } catch (e) {
        consecutiveNetworkErrors++;
        // If 6 consecutive polling calls fail (18+ seconds of network outage), trigger error state
        if (consecutiveNetworkErrors >= 6) {
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
          setFailureReason('network_error');
          setFailureDetailMessage(
            lang === 'KM'
              ? 'ការតភ្ជាប់បណ្តាញទៅកាន់ប្រព័ន្ធផ្ទៀងផ្ទាត់ Bakong មានបញ្ហា។ សូមពិនិត្យមើលអ៊ីនធឺណិតរបស់អ្នក រួចចុច "Try Again" ឬទាក់ទងជំនួយ។'
              : 'Network connection was interrupted while verifying the payment with Bakong. Please check your internet connection and tap "Try Again" or "Contact Support".'
          );
          playPaymentErrorSound();
        }
      } finally {
        setIsCheckingRealApi(false);
      }
    }, 3000);
  };

  // Retry payment: Resets states and creates fresh KHQR session
  const handleRetryPayment = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPaymentFailed(false);
    setFailureReason('');
    setFailureDetailMessage('');
    setElapsedSeconds(0);
    setIsKhqrGenerated(false);
    setUploadedSlip(null);
    setQrDataUrl('');
    setKhqrString('');
    setMd5Hash('');
    setDeepLinkUrl('');
    setPaymentMethod('khqr');

    // Trigger fresh QR code generation immediately
    setTimeout(() => {
      handleGenerateKHQR();
    }, 60);
  };

  // Manual instant API payment check triggered by user
  const handleRefreshPaymentCheck = async () => {
    if (!md5Hash && !currentOrderRef) return;
    if (isPaymentFailed) {
      handleRetryPayment();
      return;
    }

    setIsCheckingRealApi(true);

    try {
      const checkRes = await api.checkKHQRPayment({
        md5: md5Hash,
        billNumber: currentOrderRef,
        amountUSD: finalTotalUSD,
        buyerUsername: userProfile?.username,
        orderId: currentOrderRef,
      });

      if (checkRes.paid || checkRes.status === 'PAID') {
        playPaymentSuccessSound();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsAutoChecking(false);
        setIsPaymentFailed(false);
        setFailureReason('');
        setFailureDetailMessage('');
        handleSubmitOrder(false, currentOrderRef, true);
      } else if (checkRes.status === 'FAILED' || checkRes.status === 'EXPIRED') {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsAutoChecking(false);
        setIsPaymentFailed(true);
        setFailureReason(checkRes.status.toLowerCase());
        setFailureDetailMessage(
          checkRes.message ||
            (lang === 'KM'
              ? 'ប្រតិបត្តិការទូទាត់មិនជោគជ័យ ឬបានផុតកំណត់។'
              : 'Payment verification returned failure or session expired.')
        );
        playPaymentErrorSound();
      }
    } catch {
      // Continue polling silently
    } finally {
      setIsCheckingRealApi(false);
    }
  };

  // Generate dynamic KHQR only when user explicitly confirms
  const handleGenerateKHQR = async () => {
    if (isGift) {
      if (!robloxUsername.trim()) {
        setUsernameError(
          lang === 'KM'
            ? 'សូមបញ្ចូល Roblox Username របស់អ្នកដើម្បីទទួលកាដូ'
            : 'Please enter your Roblox username for the gift'
        );
        return;
      }
      if (!checkedRobloxProfile) {
        const verified = await handleCheckUsername();
        if (!verified) return;
      }
    }

    if (finalTotalUSD < 0.01) {
      return;
    }

    // Reset payment states for fresh generation
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setElapsedSeconds(0);
    setIsPaymentFailed(false);
    setIsGeneratingKhqr(true);

    const orderRef = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    setCurrentOrderRef(orderRef);

    try {
      // 1. Try server-side generation
      const res = await api.generateKHQR({
        amount: finalTotalUSD,
        currency: 'USD',
        billNumber: orderRef,
        storeLabel: settings?.storeName || 'Uchiro Order',
        merchantName,
        merchantCity,
        bakongAccountId,
      });

      let payload = res.qrString;
      let qrUrl = res.qrDataUrl;
      let md5 = res.md5;
      let deep = res.deepLink;

      // 2. Fallback to client-side if server returned empty
      if (!payload || !qrUrl) {
        payload = generateKHQRPayload({
          merchantName,
          merchantCity,
          bakongAccountId,
          amount: finalTotalUSD,
          currency: 'USD',
          billNumber: orderRef,
        });
        qrUrl = await generateKHQRDataURL(payload);
        md5 = computeMD5(payload);
        deep = generateBakongDeepLink(payload);
      }

      setKhqrString(payload);
      setQrDataUrl(qrUrl);
      setMd5Hash(md5);
      setDeepLinkUrl(deep);
      setIsKhqrGenerated(true);

      // Start live real API detection & 5-minute timer
      startOrderPaymentListener(md5, orderRef);
    } catch (err: any) {
      console.error('Failed to generate KHQR:', err);
      setIsPaymentFailed(true);
      setFailureReason('generation_error');
      setFailureDetailMessage(
        lang === 'KM'
          ? 'មិនអាចបង្កើតកូដ KHQR បានទេ ដោយសារបញ្ហាបណ្តាញ។ សូមចុច "Try Again" ដើម្បីព្យាយាមម្តងទៀត។'
          : 'Unable to generate KHQR payment code due to a network or server issue. Please tap "Try Again" to retry.'
      );
      playPaymentErrorSound();
    } finally {
      setIsGeneratingKhqr(false);
    }
  };

  // Apply discount code
  const handleApplyCoupon = () => {
    setCouponError('');
    const code = discountCode.trim().toUpperCase();
    if (!code) {
      setCouponError(lang === 'KM' ? 'សូមបញ្ចូលកូដបញ្ចុះតម្លៃ' : 'Please enter a discount code');
      return;
    }
    const found = availableCoupons.find((c) => c.code.toUpperCase() === code);
    if (!found || !found.active) {
      setCouponError(lang === 'KM' ? 'កូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវ ឬមិនសកម្ម។' : 'Invalid or inactive discount code.');
      return;
    }

    // Check if coupon has expired
    if (found.expiresAt && new Date(found.expiresAt).getTime() < Date.now()) {
      setCouponError(
        lang === 'KM'
          ? `កូដ ${found.code} បានផុតកំណត់កាលបរិច្ឆេទប្រើប្រាស់ (${found.expiresAt})។`
          : `Coupon ${found.code} has expired on ${found.expiresAt}.`
      );
      return;
    }

    setAppliedCoupon(found);
    // Reset KHQR state if already generated so the new price is reflected
    if (isKhqrGenerated) {
      setIsKhqrGenerated(false);
    }
  };

  // File slip upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedSlip(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Order via Payment Slip (1-2 min Waiting & Admin Telegram Verification Flow)
  const handleSlipSubmitOrder = async () => {
    if (!isLoggedIn && !userProfile?.firebaseUid) {
      onClose();
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!uploadedSlip) {
      return;
    }

    let finalRecipientProfile = checkedRobloxProfile;
    if (isGift) {
      if (!robloxUsername.trim()) {
        setUsernameError(
          lang === 'KM'
            ? 'សូមបញ្ចូល Roblox Username របស់អ្នក ដើម្បីទទួលកាដូ / Please enter your Roblox Username'
            : 'Please enter your Roblox username for the gift'
        );
        return;
      }

      if (!finalRecipientProfile) {
        finalRecipientProfile = await handleCheckUsername();
        if (!finalRecipientProfile) return;
      }
    }
    setUsernameError('');
    setIsProcessing(true);

    const newOrderId = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: Order = {
      id: newOrderId,
      customerName: isGift ? robloxUsername.trim() : (userProfile?.username || 'Uchiro_Player77'),
      date: 'Just now',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      product: product,
      quantity: 1,
      totalUSD: finalTotalUSD,
      status: 'pending',
      slipStatus: 'admin_review',
      paymentMethod: 'KHQR',
      fulfillmentType: isAccount ? 'account' : isGift ? 'gift' : 'trade',
      recipientRobloxUsername: isGift ? robloxUsername.trim() : undefined,
      recipientRobloxProfile: isGift ? (finalRecipientProfile || undefined) : undefined,
      paymentSlipUrl: uploadedSlip,
      khqrPayload: khqrString,
      credentialsDelivered: undefined, // Locked! Only released when Admin or Bank API confirms payment
      discountApplied: appliedCoupon
        ? {
            code: appliedCoupon.code,
            discountPercent: appliedCoupon.discountPercent,
            amountSavedUSD: couponDiscountUSD,
          }
        : undefined,
      rankDiscountApplied: rankDiscountPercent > 0
        ? {
            rankTier: rankInfo.tier,
            rankTitle: rankInfo.title,
            discountPercent: rankDiscountPercent,
            amountSavedUSD: rankDiscountUSD,
          }
        : undefined,
      transactionRef: `SLIP-${Date.now().toString().slice(-6)}`,
      md5Hash: md5Hash || undefined,
    };

    try {
      await api.submitPaymentSlip({
        type: 'order',
        orderData: newOrder,
        slipBase64: uploadedSlip,
      });
    } catch (err) {
      console.warn('Submit slip API fallback:', err);
    }

    setSubmittedSlipOrder(newOrder);
    setIsWaitingSlipReview(true);
    setSlipCountdownSeconds(180); // 3 minutes countdown
    setIsProcessing(false);

    // 1. Live Countdown Timer (every 1 sec)
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

    // 2. Active Polling (every 3 sec) for Bank Auto-Confirmation or Admin Approval
    if (slipPollRef.current) clearInterval(slipPollRef.current);
    slipPollRef.current = setInterval(async () => {
      try {
        // A. Check if Admin clicked confirm in Telegram or Admin Orders
        const ordersRes = await api.getOrders();
        if (ordersRes && Array.isArray(ordersRes)) {
          const cleanId = newOrderId.replace(/[^a-zA-Z0-9_-]/g, '');
          const found = ordersRes.find(
            (o) =>
              o.id === newOrderId ||
              o.id === cleanId ||
              o.id === `#${cleanId}` ||
              o.id.replace('#', '') === cleanId
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
            const completedOrder: Order = {
              ...found,
              status: 'delivered',
              slipStatus: 'confirmed',
              credentialsDelivered:
                found.credentialsDelivered ||
                (isAccount
                  ? {
                      username: product.autoDeliveryPayload?.username || 'Uchiro_Player77',
                      password: product.autoDeliveryPayload?.password || 'Trus7!P@ss24',
                      authenticatorKey: product.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
                      live2faSeed: product.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
                      deliveryTime: 'Just now',
                      warrantyDurationDays: warrantyDays,
                    }
                  : undefined),
            };
            setTimeout(() => {
              onCompleteOrder(completedOrder);
            }, 1200);
            return;
          }
        }

        // B. Check real KHQR payment gateway auto-confirmation if md5 or order reference exists
        if (md5Hash || currentOrderRef) {
          const checkRes = await api.checkKHQRPayment({
            md5: md5Hash,
            billNumber: currentOrderRef || newOrderId,
            amountUSD: finalTotalUSD,
            orderId: newOrderId,
          });
          if (checkRes.paid || checkRes.status === 'PAID') {
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
            const deliveredOrder: Order = {
              ...newOrder,
              status: 'delivered',
              slipStatus: 'confirmed',
              credentialsDelivered: isAccount
                ? {
                    username: product.autoDeliveryPayload?.username || 'Uchiro_Player77',
                    password: product.autoDeliveryPayload?.password || 'Trus7!P@ss24',
                    authenticatorKey: product.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
                    live2faSeed: product.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
                    deliveryTime: 'Just now',
                    warrantyDurationDays: warrantyDays,
                  }
                : undefined,
            };
            await api.updateOrderStatus(newOrderId, 'delivered');
            setTimeout(() => {
              onCompleteOrder(deliveredOrder);
            }, 1200);
            return;
          }
        }
      } catch (e) {
        // silent polling catch
      }
    }, 3000);
  };

  // Submit Order flow (Balance vs KHQR)
  const handleSubmitOrder = async (
    isBalancePayment: boolean = false,
    orderIdOverride?: string,
    isApiConfirmed: boolean = false
  ) => {
    if (!isLoggedIn && !userProfile?.firebaseUid) {
      onClose();
      if (onOpenAuth) onOpenAuth();
      return;
    }

    let finalRecipientProfile = checkedRobloxProfile;

    if (isGift) {
      if (!robloxUsername.trim()) {
        setUsernameError(
          lang === 'KM'
            ? 'សូមបញ្ចូល Roblox Username របស់អ្នក ដើម្បីទទួលកាដូ / Please enter your Roblox Username'
            : 'Please enter your Roblox username for the gift'
        );
        return;
      }

      if (!finalRecipientProfile) {
        finalRecipientProfile = await handleCheckUsername();
        if (!finalRecipientProfile) return;
      }
    }
    setUsernameError('');

    if (isBalancePayment && !hasSufficientBalance) {
      return;
    }

    setIsProcessing(true);

    try {
      playPaymentSuccessSound();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ffb230', '#3ECF8E', '#ffffff', '#6F00BE'],
      });
    } catch {
      // Confetti fallback
    }

    setTimeout(() => {
      setIsProcessing(false);
      const newOrderId = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const isDeliveredNow = isBalancePayment || isApiConfirmed;

      const newOrder: Order = {
        id: newOrderId,
        customerName: isGift ? robloxUsername.trim() : (userProfile?.username || 'Uchiro_Player77'),
        date: 'Just now',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        product: product,
        quantity: 1,
        totalUSD: finalTotalUSD,
        status: isDeliveredNow ? 'delivered' : 'pending',
        slipStatus: isDeliveredNow ? 'confirmed' : 'admin_review',
        paymentMethod: isBalancePayment ? 'Balance' : 'KHQR',
        fulfillmentType: isAccount ? 'account' : isGift ? 'gift' : 'trade',
        recipientRobloxUsername: isGift ? robloxUsername.trim() : undefined,
        recipientRobloxProfile: isGift ? (finalRecipientProfile || undefined) : undefined,
        paymentSlipUrl: isBalancePayment
          ? undefined
          : (uploadedSlip || 'https://lh3.googleusercontent.com/aida/AEtjO1Wd_gGrzgJ8oYxj2s2PXAeDAm_I7pteiAAYAQmsETHiI3aggEjvNC-M4XsWrx-bXgntwWAl7wiFlbc3SkrCF8Q4wh1CXWCt8wwSX4RnLnV5bi3xNtluTAe-mAoOsUbDECvCnTOHM6eyMGsM_Cj5WCK8Yinoj1M7bZcAtxnUsnjjgEhOc3dbJxMzJNOlx771tkQ6m_8NIFnx4FHkl-X44TtJBY6lqO0Hbkvee6kiBS4yuBIvnGaoygQlLc8'),
        khqrPayload: isBalancePayment ? undefined : khqrString,
        credentialsDelivered: (isAccount && isDeliveredNow)
          ? {
              username: product.autoDeliveryPayload?.username || 'Uchiro_Player77',
              password: product.autoDeliveryPayload?.password || 'Trus7!P@ss24',
              authenticatorKey: product.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
              live2faSeed: product.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
              deliveryTime: 'Just now',
              warrantyDurationDays: warrantyDays,
            }
          : undefined,
        discountApplied: appliedCoupon
          ? {
              code: appliedCoupon.code,
              discountPercent: appliedCoupon.discountPercent,
              amountSavedUSD: couponDiscountUSD,
            }
          : undefined,
        rankDiscountApplied: rankDiscountPercent > 0
          ? {
              rankTier: rankInfo.tier,
              rankTitle: rankInfo.title,
              discountPercent: rankDiscountPercent,
              amountSavedUSD: rankDiscountUSD,
            }
          : undefined,
        transactionRef: isBalancePayment
          ? `WALLET-BAL-${Math.floor(1000 + Math.random() * 9000)}`
          : `KHQR-${Math.floor(1000 + Math.random() * 9000)}-ABA`,
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
        apiSource: isBalancePayment
          ? 'Internal Uchiro Wallet'
          : (settings?.khqrApiKey ? 'KHPay Gateway (khpay.site) / NBC Bakong' : 'Instant KHQR Ledger Verification'),
      };

      onCompleteOrder(newOrder);
    }, 1100);
  };

  const copyKHQRPayload = () => {
    if (khqrString) {
      navigator.clipboard.writeText(khqrString);
      setCopiedKHQR(true);
      setTimeout(() => setCopiedKHQR(false), 2000);
    }
  };

  const handleDownloadReceipt = () => {
    generateReceiptPdf({
      orderId: currentOrderRef || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: isGift ? robloxUsername.trim() || userProfile?.username : (userProfile?.username || 'Valued Customer'),
      robloxUsername: isGift ? robloxUsername.trim() : undefined,
      product: {
        title: product.title,
        category: product.category,
        price: product.price,
      },
      quantity: 1,
      totalUSD: finalTotalUSD,
      paymentMethod: paymentMethod === 'balance' ? 'Account Balance' : 'Bakong / ABA KHQR',
      status: 'pending',
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
      apiSource: paymentMethod === 'balance' ? 'Internal Uchiro Wallet' : 'KHPay (khpay.site) / Bakong KHQR Gateway',
      discountApplied: appliedCoupon
        ? {
            code: appliedCoupon.code,
            discountPercent: appliedCoupon.discountPercent,
            amountSavedUSD: couponDiscountUSD,
          }
        : undefined,
      rankDiscountApplied: rankDiscountPercent > 0
        ? {
            rankTier: rankInfo.tier,
            rankTitle: rankInfo.title,
            discountPercent: rankDiscountPercent,
            amountSavedUSD: rankDiscountUSD,
          }
        : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Checkout Bottom Sheet / Dialog */}
      <div className="w-full max-w-lg bg-[#1C1F29] rounded-t-[32px] sm:rounded-[32px] z-50 relative overflow-hidden flex flex-col shadow-2xl border-t sm:border border-white/10 max-h-[92vh] animate-[slideUp_0.3s_ease-out]">
        {/* Drag Handle on Mobile */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-[#33343c] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 sm:pt-6 pb-3 border-b border-white/10 flex items-center justify-between">
          {isPaymentFailed ? (
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="bg-[#E8433F]/20 text-[#ff8e8b] text-[10px] font-price font-bold px-2.5 py-0.5 rounded-full border border-[#E8433F]/40 flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-[#E8433F]" />
                  <span>
                    {failureReason === 'timeout'
                      ? 'SESSION TIMED OUT'
                      : failureReason === 'network_error'
                      ? 'NETWORK ERROR'
                      : 'PAYMENT VERIFICATION FAILED'}
                  </span>
                </span>
                {currentOrderRef && (
                  <span className="font-mono text-xs text-[#8B90A0]">
                    REF: {currentOrderRef}
                  </span>
                )}
              </div>
              <h1 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wide line-clamp-1">
                {failureReason === 'timeout'
                  ? (lang === 'KM' ? 'ការទូទាត់បានផុតកំណត់ (Timeout)' : 'Transaction Timed Out')
                  : (lang === 'KM' ? 'ការទូទាត់មិនជោគជ័យ' : 'Payment Verification Failed')}
              </h1>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-price text-xs text-[#ffb230] uppercase font-bold tracking-wider">
                  CHECKOUT & PURCHASE
                </span>
                {isAccount && (
                  <span className="bg-[#ffb230]/20 text-[#ffd7a1] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#ffb230]/40">
                    🛡️ {warrantyDays}D WARRANTY
                  </span>
                )}
                {isGift && (
                  <span className="bg-[#E8433F]/20 text-[#ff8e8b] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#E8433F]/40">
                    🎁 GIFT (15-30m)
                  </span>
                )}
                {isTrade && (
                  <span className="bg-[#60a5fa]/20 text-[#93c5fd] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#60a5fa]/40">
                    🤝 IN-GAME TRADE
                  </span>
                )}
              </div>
              <h1 className="font-headline text-xl sm:text-2xl text-[#e2e2ec] uppercase tracking-wide line-clamp-1">
                {product.title}
              </h1>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#14161D] text-[#8B90A0] hover:text-white flex items-center justify-center border border-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* ================= ORDER FAILED STATE (TIMEOUT OR FAILURE) ================= */}
          {isPaymentFailed ? (
            <div className="w-full bg-[#1A1215] border-2 border-[#E8433F]/60 rounded-3xl p-5 sm:p-6 space-y-5 animate-fade-in shadow-[0_0_35px_rgba(232,67,63,0.25)]">
              {/* Failed Icon & Status Ribbon */}
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#E8433F]/20 border-2 border-[#E8433F]/60 flex items-center justify-center text-[#ff6b67] shadow-[0_0_25px_rgba(232,67,63,0.35)]">
                    {failureReason === 'timeout' ? (
                      <Clock className="w-8 h-8 text-[#ff8e8b] animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-[#ff6b67] animate-pulse" />
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-[#E8433F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono shadow">
                    !
                  </span>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8433F]/20 border border-[#E8433F]/40 text-[#ff8e8b] text-xs font-headline uppercase font-bold mb-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {failureReason === 'timeout'
                        ? (lang === 'KM' ? 'ផុតកំណត់ ៥ នាទី (5m Timeout)' : 'Session Expired (5-Min Timeout)')
                        : failureReason === 'network_error'
                        ? (lang === 'KM' ? 'បញ្ហាបណ្តាញ (Network Outage)' : 'Network Connection Interrupted')
                        : (lang === 'KM' ? 'ការទូទាត់មិនជោគជ័យ' : 'Payment Verification Failed')}
                    </span>
                  </div>
                  <h2 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wide font-bold">
                    {failureReason === 'timeout'
                      ? (lang === 'KM' ? 'ការទូទាត់បានផុតកំណត់រយៈពេល' : 'Transaction Window Expired')
                      : (lang === 'KM' ? 'ការទូទាត់មិនជោគជ័យ' : 'Order Payment Failed')}
                  </h2>
                  <p className="font-sans text-xs text-[#d1d5db] mt-1.5 max-w-md mx-auto leading-relaxed">
                    {failureDetailMessage || (
                      lang === 'KM'
                        ? 'កូដទូទាត់ KHQR នេះបានផុតកំណត់រយៈពេល ៥ នាទី ដោយមិនទាន់ទទួលបានការបញ្ជាក់ពីបណ្តាញ Bakong។ គណនីរបស់អ្នកមិនត្រូវបានកាត់ប្រាក់ឡើយ។'
                        : 'The payment verification window (5 minutes) timed out without detecting a confirmed transaction on the Bakong KHQR network. No funds were lost.'
                    )}
                  </p>
                </div>
              </div>

              {/* Order Details Summary Card */}
              <div className="bg-[#11131a] rounded-2xl p-4 border border-white/10 space-y-2.5 text-xs font-price">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[#8B90A0] uppercase font-bold text-[11px]">ORDER SUMMARY</span>
                  <span className="bg-[#E8433F]/20 text-[#ff8e8b] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E8433F]/30">
                    UNPAID / EXPIRED
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={product.image || (product as any).imageUrl}
                    alt={product.title}
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-headline text-sm text-[#e2e2ec] font-bold truncate">
                      {product.title}
                    </h4>
                    <p className="text-[11px] text-[#8B90A0] capitalize">
                      {product.category} • {isGift ? `Gift to @${robloxUsername || 'Player'}` : 'Instant Delivery'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-headline text-base font-bold text-[#ffb94d]">
                      ${finalTotalUSD.toFixed(2)} USD
                    </span>
                    <span className="block text-[10px] text-[#8B90A0]">
                      ≈ ៛{(finalTotalUSD * 4100).toLocaleString()} KHR
                    </span>
                  </div>
                </div>

                {currentOrderRef && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-[#8B90A0]">Reference Code:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[#ffd7a1] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        {currentOrderRef}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(currentOrderRef);
                          setIsCopiedId(true);
                          setTimeout(() => setIsCopiedId(false), 2000);
                        }}
                        className="text-[#8B90A0] hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                        title="Copy Reference"
                      >
                        {isCopiedId ? <Check className="w-3.5 h-3.5 text-[#3ECF8E]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Friendly Support Reassurance */}
              <div className="bg-[#1C1F29] border border-[#ffb230]/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-left text-xs font-sans">
                <LifeBuoy className="w-5 h-5 text-[#ffb230] shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-headline text-xs text-[#ffd7a1] uppercase font-bold">
                    {lang === 'KM' ? 'បានផ្ទេរប្រាក់រួចហើយតែមិនទាន់ទទួលបានទំនិញ?' : 'Already transferred money before timeout?'}
                  </h5>
                  <p className="text-[11px] text-[#cac6bb] mt-0.5 leading-relaxed">
                    {lang === 'KM'
                      ? 'កុំបារម្ភ! សូមរក្សាទុករូបភាពវិក្កយបត្រ (Slip) ហើយចុចប៊ូតុង "ទាក់ទងជំនួយ Telegram" ខាងក្រោម។ ក្រុមការងារយើងនឹងជួយផ្ទៀងផ្ទាត់ និងបញ្ជូនទំនិញជូនភ្លាមៗ ២៤/៧។'
                      : 'Don\'t worry! Keep your payment screenshot and click "Contact Support" below. Our staff will manually verify your transfer and dispatch your item immediately.'}
                  </p>
                </div>
              </div>

              {/* Primary Action Buttons: Clear 'Try Again' & 'Contact Support' */}
              <div className="space-y-2.5 pt-1">
                {/* Clear Try Again Button */}
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] py-3.5 px-4 rounded-xl font-headline text-sm sm:text-base uppercase font-bold tracking-wider chunky-btn-gold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,178,48,0.3)] active:scale-98 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-[#291800]" />
                  <span>{lang === 'KM' ? 'ព្យាយាមម្តងទៀត (Try Again)' : 'Try Again'}</span>
                </button>

                {/* Clear Contact Support Button */}
                <a
                  href={`https://t.me/Noreakyout?text=${encodeURIComponent(`Hello Uchiro Store Support, my order payment failed/timed out for item "${product.title}" ($${finalTotalUSD.toFixed(2)} USD). Order Ref: ${currentOrderRef || 'N/A'}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#2AABEE] hover:bg-[#229ed9] text-white py-3.5 px-4 rounded-xl font-headline text-sm sm:text-base uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(42,171,238,0.3)] active:scale-98 cursor-pointer text-center"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{lang === 'KM' ? 'ទាក់ទងជំនួយ (Contact Support)' : 'Contact Support'}</span>
                </a>

                {/* Alternative Method if user has balance */}
                {hasSufficientBalance && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentFailed(false);
                      setFailureReason('');
                      setFailureDetailMessage('');
                      setPaymentMethod('balance');
                    }}
                    className="w-full bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 text-[#3ECF8E] border border-[#3ECF8E]/40 py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{lang === 'KM' ? `ប្តូរទៅទូទាត់ជាមួយកាបូប ($${currentBalance.toFixed(2)} USD)` : `Pay with Wallet Balance ($${currentBalance.toFixed(2)} USD)`}</span>
                  </button>
                )}

                {/* Secondary Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-white/5 hover:bg-white/10 text-[#8B90A0] hover:text-white py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold transition-all cursor-pointer"
                >
                  {lang === 'KM' ? 'បិទផ្ទាំង (Close)' : 'Close Window'}
                </button>
              </div>
            </div>
          ) : isWaitingSlipReview ? (
            /* ================= PAYMENT SLIP 1-2 MIN WAITING & REVIEW VIEW ================= */
            <div className="w-full bg-[#11131a] border-2 border-[#ffb230]/40 rounded-3xl p-5 sm:p-6 space-y-5 animate-fade-in shadow-[0_0_35px_rgba(255,178,48,0.15)]">
              {/* Header & Status Indicator */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all ${
                    isSlipApproved
                      ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] text-[#3ECF8E] shadow-[0_0_25px_rgba(62,207,142,0.4)]'
                      : 'bg-[#ffb230]/15 border-[#ffb230]/50 text-[#ffb230] shadow-[0_0_25px_rgba(255,178,48,0.25)]'
                  }`}>
                    {isSlipApproved ? (
                      <CheckCircle className="w-8 h-8 text-[#3ECF8E] animate-bounce" />
                    ) : (
                      <Loader2 className="w-8 h-8 text-[#ffb230] animate-spin" />
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-[#ffb230] text-[#291800] text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono shadow">
                    ⏳
                  </span>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffb230]/15 border border-[#ffb230]/30 text-[#ffd7a1] text-xs font-headline uppercase font-bold mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#ffb230]" />
                    <span>
                      {isSlipApproved
                        ? (lang === 'KM' ? 'ការទូទាត់ត្រូវបានបញ្ជាក់!' : 'Payment Verified!')
                        : (lang === 'KM' ? 'កំពុងផ្ទៀងផ្ទាត់វិក្កយបត្រ (៣ នាទី)' : 'Verifying Payment Slip (3 Min)')}
                    </span>
                  </div>
                  <h2 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wide font-bold">
                    {isSlipApproved
                      ? (lang === 'KM' ? '🎉 ការទូទាត់ជោគជ័យ!' : '🎉 Payment Approved!')
                      : (lang === 'KM' ? 'កំពុងផ្ទៀងផ្ទាត់... សូមរង់ចាំ ៣ នាទី' : 'Verifying Slip... Please Wait 3 Min')}
                  </h2>
                  <p className="font-sans text-xs text-[#d1d5db] mt-1.5 max-w-md mx-auto leading-relaxed">
                    {isSlipApproved
                      ? (lang === 'KM' ? 'ការទូទាត់របស់អ្នកត្រូវបានបញ្ជាក់រួចរាល់ហើយ! កំពុងប្រគល់ទំនិញជូន...' : 'Your payment has been successfully confirmed. Delivering your items now...')
                      : (lang === 'KM'
                        ? 'ប្រព័ន្ធកំពុងផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ។ ប្រសិនបើប្រព័ន្ធមិនទាន់បញ្ជាក់ វាត្រូវបានបញ្ជូនទៅ Admin លើ Telegram រួចរាល់ហើយ ដើម្បីចុចបញ្ជាក់ (Confirm) ជូនភ្លាមៗ។'
                        : 'System is checking bank transaction. If not auto-confirmed, it has already been sent to Admin on Telegram for 1-click manual approval.')}
                  </p>
                </div>

                {/* Live Countdown Clock */}
                {!isSlipApproved && (
                  <div className="bg-[#1C1F29] border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-[#ffb230] animate-pulse" />
                    <div className="text-left">
                      <span className="text-[10px] text-[#8B90A0] uppercase font-bold block">
                        {lang === 'KM' ? 'ពេលវេលារង់ចាំ (Time Remaining)' : 'Time Remaining'}
                      </span>
                      <span className="font-mono text-2xl text-[#ffd7a1] font-bold tracking-widest">
                        {Math.floor(slipCountdownSeconds / 60)}:{(slipCountdownSeconds % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Info & Slip Preview */}
              <div className="bg-[#14161D] rounded-2xl p-4 border border-white/10 space-y-3 text-xs font-price">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#ffd7a1] bg-[#11131a] px-2 py-0.5 rounded border border-white/5 font-bold">
                      {submittedSlipOrder?.id || '#ORD-SLIP'}
                    </span>
                    <span className="text-[#8B90A0] font-sans">
                      {product.title}
                    </span>
                  </div>
                  <span className="font-bold text-[#ffb94d] text-sm">
                    ${finalTotalUSD.toFixed(2)} USD
                  </span>
                </div>

                {/* Uploaded Slip Thumbnail */}
                {uploadedSlip && (
                  <div className="flex items-center gap-3 bg-[#11131a] p-2.5 rounded-xl border border-white/5">
                    <img
                      src={uploadedSlip}
                      alt="Uploaded Slip"
                      className="w-14 h-14 object-cover rounded-lg border border-[#ffb230]/40 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-sans font-bold text-xs text-[#e2e2ec] block truncate">
                        {lang === 'KM' ? 'វិក្កយបត្របានបញ្ចូល' : 'Payment Slip Uploaded'}
                      </span>
                      <span className="text-[11px] text-[#8B90A0] block">
                        {lang === 'KM' ? 'បានបញ្ជូនទៅ Admin លើ Telegram' : 'Dispatched to Admin Telegram'}
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-[#ffb230]/15 text-[#ffd7a1] border border-[#ffb230]/30 rounded-lg text-[10px] font-bold">
                      REVIEWING
                    </span>
                  </div>
                )}

                {/* 3-Step Verification Progress */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2 text-[11px]">
                    <CheckCircle className="w-4 h-4 text-[#3ECF8E] shrink-0" />
                    <span className="text-[#3ECF8E] font-medium">
                      1. {lang === 'KM' ? 'វិក្កយបត្រត្រូវបានបញ្ចូល (Slip Uploaded)' : 'Payment Slip Uploaded'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {isSlipApproved ? (
                      <CheckCircle className="w-4 h-4 text-[#3ECF8E] shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-[#ffb230] animate-spin shrink-0" />
                    )}
                    <span className={isSlipApproved ? 'text-[#3ECF8E] font-medium' : 'text-[#ffd7a1] font-medium'}>
                      2. {lang === 'KM' ? 'ប្រព័ន្ធកំពុងផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ (Auto Bank Checking)' : 'Auto Bank Checking (3 Min)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Send className="w-4 h-4 text-[#00F0FF] shrink-0" />
                    <span className="text-[#00F0FF] font-medium">
                      3. {lang === 'KM' ? 'បញ្ជូនទៅ Admin លើ Telegram សម្រាប់ 1-Click Approve' : 'Dispatched to Admin Telegram for Instant Approval'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alert when timer hits 0 and still awaiting admin confirmation */}
              {slipCountdownSeconds === 0 && !isSlipApproved && (
                <div className="bg-[#1C1F29] border border-[#ffb230]/40 rounded-2xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <LifeBuoy className="w-5 h-5 text-[#ffb230] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-headline text-xs text-[#ffd7a1] uppercase font-bold">
                        {lang === 'KM' ? 'វិក្កយបត្រត្រូវបានបញ្ជូនទៅ Admin រួចរាល់!' : 'Slip Sent to Admin on Telegram!'}
                      </h4>
                      <p className="text-[11px] text-[#cac6bb] mt-0.5 leading-relaxed">
                        {lang === 'KM'
                          ? 'វិក្កយបត្ររបស់អ្នកត្រូវបានបញ្ជូនទៅ Telegram Admin (@Noreakyout) រួចរាល់ហើយ។ Admin អាចចុច Confirm ភ្លាមៗ ឬអ្នកអាចទាក់ទងឆាតផ្ទាល់បាន។'
                          : 'Your slip has been sent to Admin on Telegram (@Noreakyout). Admin is reviewing and will confirm shortly, or you can chat directly.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <a
                      href={`https://t.me/Noreakyout?text=${encodeURIComponent(`Hello Admin, I have submitted a payment slip for order ${submittedSlipOrder?.id || ''} ($${finalTotalUSD.toFixed(2)} USD). Please verify and confirm.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#2AABEE] hover:bg-[#229ed9] text-white py-2.5 px-3 rounded-xl font-headline text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow-md text-center cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{lang === 'KM' ? 'ឆាតជាមួយ Admin (Telegram)' : 'Chat Admin on Telegram'}</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setSlipCountdownSeconds(180);
                      }}
                      className="bg-[#282a31] hover:bg-[#343740] text-[#ffd7a1] py-2.5 px-3 rounded-xl font-headline text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-all border border-white/10 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-[#ffb230]" />
                      <span>{lang === 'KM' ? 'បន្តរង់ចាំ (Keep Waiting)' : 'Keep Waiting'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Close / View My Orders Action */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                {onViewMyOrders && (
                  <button
                    type="button"
                    onClick={() => {
                      if (slipPollRef.current) clearInterval(slipPollRef.current);
                      if (slipTimerRef.current) clearInterval(slipTimerRef.current);
                      onClose();
                      onViewMyOrders();
                    }}
                    className="flex-1 bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] py-3 rounded-xl font-headline text-xs sm:text-sm uppercase font-bold flex items-center justify-center gap-2 transition-all chunky-btn-gold cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{lang === 'KM' ? 'មើលការបញ្ជាទិញរបស់ខ្ញុំ (My Orders)' : 'View My Orders'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (slipPollRef.current) clearInterval(slipPollRef.current);
                    if (slipTimerRef.current) clearInterval(slipTimerRef.current);
                    onClose();
                  }}
                  className="px-4 py-3 rounded-xl bg-[#1C1F29] hover:bg-[#282a31] text-[#8B90A0] hover:text-white font-headline text-xs uppercase font-bold border border-white/10 transition-all cursor-pointer"
                >
                  {lang === 'KM' ? 'បិទ (Close)' : 'Close Window'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* SOLD OUT WARNING */}
              {isSoldOut && (
                <div className="p-4 bg-[#E8433F]/15 border border-[#E8433F]/40 rounded-2xl flex items-center gap-3 text-[#ff8e8b] shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-[#E8433F] shrink-0 animate-bounce" />
                  <div className="text-xs">
                    <strong className="block text-sm text-[#E8433F] font-headline uppercase">
                      {lang === 'KM' ? 'ទំនិញនេះត្រូវបានលក់អស់ហើយ' : 'ITEM OUT OF STOCK / SOLD OUT'}
                    </strong>
                    <span>
                      {lang === 'KM'
                        ? 'ទំនិញនេះមិនមានស្តុកទៀតទេ មិនអាចធ្វើការទូទាត់បានឡើយ។'
                        : 'This product has been sold out and cannot be purchased at this time.'}
                    </span>
                  </div>
                </div>
              )}

              {/* ACCOUNT REQUIRED WARNING */}
              {!isLoggedIn && (
                <div className="p-3.5 bg-gradient-to-r from-[#ffb230]/20 to-[#ff9e00]/10 border border-[#ffb230]/40 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#ffb230]/20 border border-[#ffb230]/40 flex items-center justify-center text-[#ffb230] shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-headline text-xs sm:text-sm text-[#ffd7a1] uppercase font-bold">
                        {lang === 'KM' ? 'តម្រូវឱ្យចូលគណនីមុនពេលទិញ' : 'Account Required to Purchase'}
                      </h4>
                      <p className="text-[11px] font-price text-[#d1d5db] mt-0.5">
                        {lang === 'KM'
                          ? 'អ្នកត្រូវមានគណនីដើម្បីទទួលព័ត៌មានសម្ងាត់ និងការធានា'
                          : 'Please sign in to safeguard your account delivery & warranty'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenAuth) onOpenAuth();
                    }}
                    className="px-3 py-1.5 bg-[#ffb230] hover:bg-[#ffbe4d] text-[#291800] rounded-xl font-headline text-xs font-bold uppercase shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    {lang === 'KM' ? 'ចូលគណនី' : 'Sign In'}
                  </button>
                </div>
              )}

          {/* Automatic Member Rank Discount Banner */}
          {rankDiscountPercent > 0 ? (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-md ${
                rankInfo.tier === 'Reseller'
                  ? 'bg-[#FF007A]/15 border-[#FF007A]/40 text-[#FF007A]'
                  : rankInfo.tier === 'Diamond'
                  ? 'bg-[#00F0FF]/15 border-[#00F0FF]/40 text-[#00F0FF]'
                  : 'bg-[#ffb230]/15 border-[#ffb230]/40 text-[#ffd7a1]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{rankInfo.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-xs uppercase tracking-wider font-bold">
                      {rankInfo.title}
                    </span>
                    <span className="bg-white/10 text-[10px] font-price font-bold px-2 py-0.2 rounded-full">
                      -{rankDiscountPercent}% AUTO DISCOUNT
                    </span>
                  </div>
                  <p className="text-[11px] font-price text-[#cac6bb] mt-0.5">
                    {lang === 'KM'
                      ? `បញ្ចុះតម្លៃ ${rankDiscountPercent}% ស្វ័យប្រវត្តិតាមឋានៈ VIP (សន្សំបាន $${rankDiscountUSD.toFixed(2)})`
                      : `Automatic ${rankDiscountPercent}% member discount saved -$${rankDiscountUSD.toFixed(2)} USD`}
                  </p>
                </div>
              </div>
              <span className="font-headline text-base font-bold text-[#3ECF8E]">
                -${rankDiscountUSD.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="bg-[#14161D] border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#8B90A0]">
                <span>👑</span>
                <span>
                  Spend <strong>$30+</strong> for Gold (5% OFF), <strong>$50+</strong> for Diamond (10% OFF), <strong>$100+</strong> for Reseller (20% OFF)
                </span>
              </div>
            </div>
          )}

          {/* FULFILLMENT METHOD (CONFIGURED BY ADMIN) */}
          <div className="bg-[#14161D] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              {isAccount ? (
                <div className="p-2 rounded-xl bg-[#3ECF8E]/15 text-[#3ECF8E]">
                  <Zap className="w-4 h-4" />
                </div>
              ) : isGift ? (
                <div className="p-2 rounded-xl bg-[#ffb230]/15 text-[#ffb230]">
                  <Gift className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-[#60a5fa]/15 text-[#60a5fa]">
                  <Users className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="text-[10px] font-price text-[#8B90A0] uppercase">
                  {lang === 'KM' ? 'របៀបទទួលទំនិញ (កំណត់ដោយ ADMIN)' : 'DELIVERY METHOD (ADMIN CONFIGURED)'}
                </div>
                <div className="font-headline text-xs text-[#e2e2ec] font-bold">
                  {isAccount
                    ? (lang === 'KM' ? '⚡ គណនីស្វ័យប្រវត្តិ (Instant Auto Delivery)' : '⚡ Instant Account Delivery')
                    : isGift
                    ? (lang === 'KM' ? '🎁 ផ្ញើកាដូ (Gift 15-30m ទៅ Roblox)' : '🎁 Gift Delivery (15-30m)')
                    : (lang === 'KM' ? '👥 Trade ក្នុងហ្គេម (Join Server Admin)' : '👥 In-Game Trade with Admin')}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-price font-bold px-2.5 py-1 rounded-full border ${
              isAccount
                ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border-[#3ECF8E]/30'
                : isGift
                ? 'bg-[#ffb230]/10 text-[#ffb230] border-[#ffb230]/30'
                : 'bg-[#60a5fa]/10 text-[#60a5fa] border-[#60a5fa]/30'
            }`}>
              {isAccount ? 'ACCOUNT' : isGift ? 'GIFT' : 'TRADE'}
            </span>
          </div>

          {/* GIFT RECIPIENT USERNAME PROMPT WITH LIVE ROBLOX AVATAR CHECK */}
          {isGift && (
            <div className="bg-[#11131a] border border-[#ffb230]/40 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="font-price text-xs text-[#ffd7a1] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#ffb230]" />
                  <span>{lang === 'KM' ? 'ROBLOX USERNAME ទទួលកាដូ (GIFT RECIPIENT)' : 'ROBLOX RECIPIENT (REQUIRED)'}</span>
                </label>
                <span className="bg-[#ffb230]/15 text-[#ffd7a1] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#ffb230]/30">
                  REQUIRED
                </span>
              </div>

              {/* Input & Check Button */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={robloxUsername}
                    onChange={(e) => {
                      setRobloxUsername(e.target.value);
                      if (usernameError) setUsernameError('');
                      if (checkedRobloxProfile && e.target.value.trim() !== checkedRobloxProfile.username) {
                        setCheckedRobloxProfile(null);
                        setUsernameVerified(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCheckUsername();
                      }
                    }}
                    placeholder="e.g. RobloxUser_123 or @Username"
                    className={`w-full bg-[#1C1F29] text-[#e2e2ec] border rounded-xl px-4 py-3 focus:outline-none focus:border-[#ffb230] font-price text-sm transition-all ${
                      usernameVerified
                        ? 'border-[#3ECF8E]/60 focus:border-[#3ECF8E]'
                        : usernameError
                        ? 'border-[#E8433F]/60'
                        : 'border-white/20'
                    }`}
                  />
                  {usernameVerified && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#3ECF8E] text-xs font-price font-bold">
                      <CheckCircle className="w-4 h-4 text-[#3ECF8E]" />
                      <span className="hidden sm:inline">Verified</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCheckUsername()}
                  disabled={isCheckingUsername || !robloxUsername.trim()}
                  className="bg-[#282a31] hover:bg-[#ffb230] hover:text-[#291800] text-[#ffd7a1] border border-white/10 font-headline text-xs sm:text-sm px-4 py-3 rounded-xl uppercase font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isCheckingUsername ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#ffb230]" />
                      <span>{lang === 'KM' ? 'កំពុងពិនិត្យ...' : 'Checking...'}</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 text-[#3ECF8E]" />
                      <span>{lang === 'KM' ? 'ផ្ទៀងផ្ទាត់ (Check)' : 'Check Username'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error message */}
              {usernameError && (
                <div className="bg-[#E8433F]/15 border border-[#E8433F]/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-[#E8433F]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-price">{usernameError}</span>
                </div>
              )}

              {/* Verified Roblox Player Preview Card */}
              {checkedRobloxProfile && (
                <div className="bg-[#141622] border border-[#3ECF8E]/40 rounded-xl p-3.5 flex items-center justify-between gap-3 animate-fade-in shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={checkedRobloxProfile.avatarUrl}
                        alt={checkedRobloxProfile.displayName}
                        className="w-12 h-12 rounded-xl object-cover bg-black/40 border-2 border-[#3ECF8E] shadow-[0_0_12px_rgba(62,207,142,0.3)]"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-[#3ECF8E] text-[#003822] rounded-full p-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-headline text-sm text-[#e2e2ec] font-bold">
                          {checkedRobloxProfile.displayName}
                        </h4>
                        <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-1.5 py-0.5 rounded border border-[#3ECF8E]/40">
                          Roblox Player
                        </span>
                      </div>
                      <p className="font-price text-xs text-[#00F0FF]">
                        @{checkedRobloxProfile.username} <span className="text-[#8B90A0] text-[11px]">• ID: {checkedRobloxProfile.userId}</span>
                      </p>
                      <p className="font-khmer text-[11px] text-[#3ECF8E] font-medium mt-0.5 flex items-center gap-1">
                        <span>✅ គណនីត្រឹមត្រូវ កាដូនឹងផ្ញើជូនរូបតំណាងនេះ</span>
                      </p>
                    </div>
                  </div>

                  <a
                    href={`https://www.roblox.com/search/users?keyword=${encodeURIComponent(checkedRobloxProfile.username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8B90A0] hover:text-[#00F0FF] p-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                    title="Open Roblox Profile in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Explanatory helper note */}
              <p className="font-khmer text-[11px] text-[#8B90A0] leading-relaxed">
                {lang === 'KM'
                  ? '⚡ សូមពិនិត្យមើលឈ្មោះ (Username) និងរូប Avatar ឱ្យបានត្រឹមត្រូវមុនពេលទូទាត់ ដើម្បីធានាថាកាដូ Gamepass ឬ Fruit នឹងត្រូវបញ្ជូនទៅគណនីពិតប្រាកដរបស់អ្នក។'
                  : '⚡ The gamepass/gift will be dispatched directly to this verified Roblox account within 15-30 minutes after payment.'}
              </p>
            </div>
          )}

          {/* TRADE NOTICE (FOR MM2, BLADE BALL, PHYSICAL FRUITS) */}
          {isTrade && (
            <div className="bg-[#11131a] border border-[#60a5fa]/40 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-[#60a5fa] font-price text-xs font-bold uppercase">
                <Users className="w-4 h-4" />
                <span>IN-GAME TRADE PROCEDURE</span>
              </div>
              <p className="font-khmer text-xs text-[#ffd7a1] leading-relaxed">
                {lang === 'KM'
                  ? 'បន្ទាប់ពីទូទាត់រួច សូមទាក់ទងមកកាន់ Telegram: @Noreakyout ដើម្បី Join Game ធ្វើការ Trade អាវុធ/ផ្លែឈើ។'
                  : 'After payment, message Telegram @Noreakyout to join private server for fast in-game trade.'}
              </p>
            </div>
          )}

          {/* Discount Code Section */}
          <div className="space-y-1.5">
            <label className="font-price text-xs text-[#8B90A0] uppercase tracking-wider flex items-center justify-between">
              <span>COUPON CODE (OPTIONAL)</span>
              <span
                className="text-[10px] text-[#ffb230] cursor-pointer hover:underline"
                onClick={() => setDiscountCode('UCHIRO10')}
              >
                Use code: UCHIRO10
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  placeholder="UCHIRO10"
                  className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:border-[#ffb230] focus:ring-1 focus:ring-[#ffb230] font-price text-sm uppercase"
                />
                {appliedCoupon && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#3ECF8E]/40">
                    -{appliedCoupon.discountPercent}% OFF
                  </span>
                )}
              </div>
              <button
                onClick={handleApplyCoupon}
                className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-base px-6 py-3 rounded-xl chunky-btn-gold uppercase font-bold"
              >
                APPLY
              </button>
            </div>
            {couponError && <p className="text-xs text-[#E8433F] font-price">{couponError}</p>}
          </div>

          {/* ================= PAYMENT METHOD SELECTION ================= */}
          <div className="space-y-2 pt-1">
            <label className="font-price text-xs text-[#ffd7a1] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <span>SELECT PAYMENT METHOD</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Option A: Store Balance */}
              <button
                type="button"
                onClick={() => setPaymentMethod('balance')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === 'balance'
                    ? 'bg-[#1C1F29] border-2 border-[#3ECF8E] shadow-[0_0_15px_rgba(62,207,142,0.25)]'
                    : 'bg-[#11131a] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#3ECF8E]" />
                    <span className="font-headline text-sm text-[#e2e2ec] uppercase">Store Wallet</span>
                  </div>
                  {paymentMethod === 'balance' && (
                    <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
                  )}
                </div>
                <div className="font-price text-xs text-[#8B90A0]">
                  Available:{' '}
                  <span className="text-[#3ECF8E] font-bold">
                    ${currentBalance.toFixed(2)} USD
                  </span>
                </div>
                <span className="text-[10px] text-[#ffd7a1] font-price font-bold mt-1 bg-[#3ECF8E]/10 rounded px-1.5 py-0.5 self-start">
                  Instant Auto-Cut ⚡
                </span>
              </button>

              {/* Option B: Bakong KHQR */}
              <button
                type="button"
                onClick={() => setPaymentMethod('khqr')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === 'khqr'
                    ? 'bg-[#1C1F29] border-2 border-[#ffb230] shadow-[0_0_15px_rgba(255,178,48,0.25)]'
                    : 'bg-[#11131a] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#ffb230]" />
                    <span className="font-headline text-sm text-[#e2e2ec] uppercase">Bakong KHQR</span>
                  </div>
                  {paymentMethod === 'khqr' && (
                    <span className="w-2 h-2 rounded-full bg-[#ffb230] animate-pulse" />
                  )}
                </div>
                <div className="font-price text-xs text-[#8B90A0]">
                  ABA • ACLEDA • Wing
                </div>
                <span className="text-[10px] text-[#ffd7a1] font-price font-bold mt-1 bg-[#ffb230]/10 rounded px-1.5 py-0.5 self-start">
                  Scan to Pay 🇰🇭
                </span>
              </button>
            </div>
          </div>

          {/* ================= BALANCE PAYMENT DETAILS ================= */}
          {paymentMethod === 'balance' && (
            <div className="bg-[#11131a] rounded-2xl p-4 sm:p-5 border border-[#3ECF8E]/30 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#3ECF8E]" />
                  <span className="font-headline text-sm text-[#3ECF8E] uppercase tracking-wide">
                    Pay with Account Balance
                  </span>
                </div>
                <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#3ECF8E]/40">
                  Instant Auto-Delivery
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-price">
                <div className="bg-[#1C1F29] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                  <span className="text-[#8B90A0]">Your Wallet:</span>
                  <p className="font-bold text-sm text-white">${currentBalance.toFixed(2)} USD</p>
                </div>
                <div className="bg-[#1C1F29] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                  <span className="text-[#8B90A0]">Item Cost:</span>
                  <p className="font-bold text-sm text-[#ffb230]">${finalTotalUSD.toFixed(2)} USD</p>
                </div>
              </div>

              {hasSufficientBalance ? (
                <div className="bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 rounded-xl p-3 flex items-center justify-between text-xs font-price">
                  <span className="text-[#3ECF8E] font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span>Sufficient Funds (Ready to Buy)</span>
                  </span>
                  <span className="text-[#8B90A0]">
                    Remaining: <strong className="text-white">${(currentBalance - finalTotalUSD).toFixed(2)}</strong>
                  </span>
                </div>
              ) : (
                <div className="bg-[#E8433F]/15 border border-[#E8433F]/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#ff8e8b] font-price font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Insufficient Balance (Needs +${(finalTotalUSD - currentBalance).toFixed(2)} USD)
                    </span>
                  </div>
                  <p className="text-[11px] font-price text-[#cac6bb]">
                    Please top up your wallet balance or switch to Bakong KHQR scan.
                  </p>
                  {onOpenTopup && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTopup();
                      }}
                      className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] py-2 rounded-lg text-xs font-headline font-bold uppercase flex items-center justify-center gap-1.5 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Top Up Wallet Now</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= BAKONG KHQR PAYMENT DETAILS (ONLY GENERATED ON CONFIRM) ================= */}
          {paymentMethod === 'khqr' && (
            <div className="bg-[#11131a] rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden shadow-inner space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-1 z-10">
                <span className="w-2 h-2 rounded-full bg-[#ffb230] animate-pulse" />
                <h2 className="font-headline text-lg sm:text-xl text-[#ffd7a1] tracking-wider uppercase">
                  BAKONG KHQR PAYMENT
                </h2>
              </div>

              {!isKhqrGenerated ? (
                /* Uncreated State: Prompt to generate KHQR */
                <div className="w-full flex flex-col items-center justify-center text-center p-5 bg-[#1C1F29]/70 rounded-2xl border border-white/10 space-y-3 z-10">
                  <div className="w-16 h-16 rounded-2xl bg-[#ffb230]/10 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230]">
                    <QrCode className="w-8 h-8 opacity-90" />
                  </div>
                  <h4 className="font-headline text-base text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'បង្កើតកូដ KHQR សម្រាប់ការទូទាត់' : 'Create KHQR Code to Pay'}
                  </h4>
                  <p className="font-price text-xs text-[#8B90A0] max-w-[260px]">
                    {lang === 'KM'
                      ? `តម្លៃសរុប $${finalTotalUSD.toFixed(2)} USD។ ចុចខាងក្រោមដើម្បីបង្កើតកូដ KHQR ផ្លូវការ។`
                      : `Total is $${finalTotalUSD.toFixed(2)} USD. Click below to generate your unique Bakong KHQR code.`}
                  </p>

                  {finalTotalUSD < 0.01 && (
                    <div className="bg-[#ffb230]/15 border border-[#ffb230]/40 rounded-xl p-2.5 text-left text-[11px] font-price text-[#ffd7a1] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#ffb230] shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Minimum KHQR is $0.01 USD</strong>
                        <span>
                          {lang === 'KM'
                            ? 'កូដ Bakong KHQR អាចបង្កើតបានចាប់ពី $0.01 USD ឡើងទៅ។'
                            : 'Bakong KHQR requires a minimum of $0.01 USD.'}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateKHQR}
                    disabled={isGeneratingKhqr || finalTotalUSD < 0.01}
                    className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-base py-3.5 rounded-xl chunky-btn-gold uppercase font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {isGeneratingKhqr ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : finalTotalUSD < 0.01 ? (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <span>Min $0.01 USD for KHQR</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-5 h-5" />
                        <span className="font-khmer font-bold">
                          {lang === 'KM' ? `បង្កើតកូដ KHQR ($${finalTotalUSD.toFixed(2)})` : `Generate KHQR ($${finalTotalUSD.toFixed(2)} USD)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Generated KHQR State */
                <div className="flex flex-col items-center justify-center w-full z-10 space-y-3 animate-fade-in">
                  {/* Live Status Header with Real-time Timer & Polling Indicator */}
                  <div className={`w-full border rounded-xl px-3.5 py-3 flex items-center justify-between transition-all ${
                    isPaymentFailed
                      ? 'bg-[#E8433F]/10 border-[#E8433F]/40'
                      : elapsedSeconds >= 60
                      ? 'bg-[#ffb230]/10 border-[#ffb230]/40 shadow-[0_0_15px_rgba(255,178,48,0.15)]'
                      : 'bg-[#14161F] border-[#3ECF8E]/40 shadow-[0_0_20px_rgba(62,207,142,0.15)]'
                  }`}>
                    <div className="flex items-center gap-3">
                      {isPaymentFailed ? (
                        <AlertCircle className="w-5 h-5 text-[#E8433F] shrink-0" />
                      ) : (
                        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                          <span className={`animate-ping absolute inline-flex h-4 w-4 rounded-full opacity-60 ${
                            elapsedSeconds >= 60 ? 'bg-[#ffb230]' : 'bg-[#3ECF8E]'
                          }`}></span>
                          <span className={`animate-pulse absolute inline-flex h-3 w-3 rounded-full opacity-80 ${
                            elapsedSeconds >= 60 ? 'bg-[#ffb230]' : 'bg-[#00F0FF]'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${
                            elapsedSeconds >= 60 ? 'bg-[#ffb230]' : 'bg-[#3ECF8E]'
                          }`}></span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-headline font-bold uppercase tracking-wider ${
                            isPaymentFailed
                              ? 'text-[#E8433F]'
                              : elapsedSeconds >= 60
                              ? 'text-[#ffd7a1]'
                              : 'text-[#3ECF8E]'
                          }`}>
                            {isPaymentFailed
                              ? (lang === 'KM' ? 'ការទូទាត់ផុតកំណត់ (5mn Timeout)' : 'Payment Session Expired (5mn)')
                              : (lang === 'KM' ? 'កំពុងរង់ចាំការទូទាត់...' : 'Awaiting Payment...')}
                          </span>
                          {!isPaymentFailed && (
                            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/30 animate-pulse">
                              LIVE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-price text-[#8B90A0]">
                          {isPaymentFailed
                            ? '5-minute window ended'
                            : apiStatusMessage || 'Listening to Bakong Network in real-time...'}
                        </span>
                      </div>
                    </div>

                    {/* Timer Countdown Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-full border shadow-sm ${
                        isPaymentFailed
                          ? 'bg-[#E8433F]/20 text-[#E8433F] border-[#E8433F]/30'
                          : elapsedSeconds >= 240
                          ? 'bg-[#E8433F]/20 text-[#E8433F] border-[#E8433F]/30 animate-pulse'
                          : elapsedSeconds >= 60
                          ? 'bg-[#ffb230]/20 text-[#ffb230] border-[#ffb230]/30'
                          : 'bg-[#3ECF8E]/15 text-[#3ECF8E] border-[#3ECF8E]/30'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTimeRemaining(remainingSeconds)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Clean, Official Standard Bakong KHQR Card */}
                  <div className="flex flex-col items-center my-2 w-full max-w-[250px]">
                    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col items-center w-full">
                      {/* Official KHQR Red Header */}
                      <div className="w-full bg-[#E8433F] text-white py-2 px-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-sans font-black text-sm tracking-wider">
                          <span className="text-base">🇰🇭</span>
                          <span>KHQR</span>
                        </div>
                        <span className="text-[9px] font-sans font-extrabold uppercase tracking-widest bg-black/20 text-white px-2 py-0.5 rounded">
                          BAKONG
                        </span>
                      </div>

                      {/* Merchant Header Info */}
                      <div className="w-full bg-white px-3.5 pt-2.5 pb-1.5 text-center border-b border-gray-100">
                        <h4 className="font-sans font-bold text-xs text-gray-900 uppercase tracking-tight">
                          {settings?.merchantName || 'UCHIRO STORE'}
                        </h4>
                        <p className="text-[10px] text-gray-500 font-sans">
                          {settings?.merchantCity || 'Phnom Penh'}
                        </p>
                      </div>

                      {/* QR Code Container (Crisp, completely unobstructed, scan-ready) */}
                      <div className="w-full aspect-square bg-white flex items-center justify-center p-3 relative">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Bakong KHQR Payment Code"
                            className="w-full h-full object-contain select-none"
                          />
                        ) : (
                          <div
                            id="khqr-generating-skeleton"
                            className="w-full h-full bg-gray-50 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden select-none border border-gray-100"
                          >
                            <Loader2 className="w-8 h-8 text-[#E8433F] animate-spin mb-2" />
                            <span className="text-xs font-sans font-bold text-gray-800">
                              {lang === 'KM' ? 'កំពុងបង្កើតកូដ KHQR...' : 'Generating KHQR...'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-sans mt-0.5">
                              {settings?.merchantName || 'UCHIRO STORE'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Amount Row */}
                      <div className="w-full bg-gray-50 py-2.5 px-3.5 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono font-bold uppercase">AMOUNT</span>
                        <div className="text-right">
                          <div className="text-sm font-price font-extrabold text-gray-900">
                            ${finalTotalUSD.toFixed(2)} USD
                          </div>
                          <div className="text-[10px] font-price text-gray-500 font-medium">
                            ≈ {(finalTotalUSD * 4100).toLocaleString()} KHR
                          </div>
                        </div>
                      </div>

                      {/* Supported Banks Row */}
                      <div className="w-full bg-white py-1.5 px-3 border-t border-gray-100 text-center">
                        <span className="text-[9px] text-gray-500 font-sans font-medium">
                          Bakong • ABA Bank • Wing • ACLEDA • Canadia
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 60-Second Friendly Timeout Notice */}
                  {elapsedSeconds >= 60 && !isPaymentFailed && (
                    <div className="w-full bg-[#ffb230]/10 border border-[#ffb230]/30 rounded-2xl p-3 text-left space-y-2 animate-fade-in">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-[#ffb230] shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-headline text-xs text-[#ffd7a1] uppercase font-bold">
                            {lang === 'KM'
                              ? 'ការទូទាត់ចំណាយពេលយូរជាងធម្មតា (60s+)?'
                              : 'Payment taking longer than expected (60s+)?'}
                          </h5>
                          <p className="font-sans text-[11px] text-[#d1d5db] mt-0.5 leading-snug">
                            {lang === 'KM'
                              ? 'ប្រសិនបើអ្នកបានផ្ទេររួចរាល់ សូមរង់ចាំបន្តិច ឬចុច "ខ្ញុំបានទូទាត់រួចរាល់" ខាងក្រោម។ ប្រសិនបើមានបញ្ហា អ្នកអាចបង្កើតកូដ QR ថ្មី ឬទាក់ទងមកកាន់យើង។'
                              : 'If you already transferred in ABA/Bakong, please wait a few seconds or click "I HAVE PAID" below. If the transaction didn\'t register, feel free to try again or contact support.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                            setIsKhqrGenerated(false);
                          }}
                          className="flex-1 text-[#ffd7a1] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 py-1.5 px-2 rounded-lg text-[10px] font-headline uppercase font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{lang === 'KM' ? 'បង្កើត QR ម្តងទៀត' : 'Try Again'}</span>
                        </button>
                        <a
                          href="https://t.me/Noreakyout"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-[#2AABEE] hover:text-white bg-[#2AABEE]/15 hover:bg-[#2AABEE]/25 border border-[#2AABEE]/30 py-1.5 px-2 rounded-lg text-[10px] font-headline uppercase font-bold flex items-center justify-center gap-1 transition-all text-center"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>{lang === 'KM' ? 'ជំនួយ Support' : 'Contact Support'}</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Live Waiting Status & Reset option */}
                  {!isPaymentFailed && (
                    <div className="w-full flex items-center justify-between pt-1 px-1 bg-white/[0.02] border border-white/5 rounded-xl py-2 px-3">
                      <div className="flex items-center gap-2.5 text-xs text-[#8B90A0]">
                        <div className="relative flex items-center justify-center w-3 h-3">
                          <span className="w-3 h-3 rounded-full bg-[#3ECF8E] animate-ping absolute opacity-75" />
                          <span className="w-2 h-2 rounded-full bg-[#3ECF8E] relative" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-headline uppercase text-[11px] text-[#3ECF8E] font-bold tracking-wide">
                            {lang === 'KM' ? 'កំពុងរង់ចាំការទូទាត់...' : 'Awaiting Payment Confirmation'}
                          </span>
                          <span className="flex gap-0.5 items-end h-2.5">
                            <span className="w-0.5 h-1.5 bg-[#3ECF8E] rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-0.5 h-2.5 bg-[#3ECF8E] rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                            <span className="w-0.5 h-2 bg-[#3ECF8E] rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                          setIsKhqrGenerated(false);
                        }}
                        className="text-[#8B90A0] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 py-1 px-2.5 rounded-lg text-[11px] font-headline font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{lang === 'KM' ? 'កូដថ្មី' : 'Reset'}</span>
                      </button>
                    </div>
                  )}

                  {/* Screenshot Upload Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl p-3.5 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#11131a]/60 hover:bg-[#11131a] ${
                      uploadedSlip ? 'border-[#3ECF8E] bg-[#3ECF8E]/5' : 'border-white/20 hover:border-[#ffb230]/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />

                    {uploadedSlip ? (
                      <div className="flex items-center gap-3 w-full">
                        <img
                          src={uploadedSlip}
                          alt="Payment Slip"
                          className="w-12 h-12 object-cover rounded-lg border border-[#3ECF8E]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1 text-[#3ECF8E] font-price text-xs font-bold">
                            <CheckCircle className="w-4 h-4" />
                            <span>Payment Slip Uploaded</span>
                          </div>
                          <p className="text-[11px] text-[#8B90A0] font-price mt-0.5">
                            Click to change screenshot
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-8 h-8 rounded-full bg-[#1C1F29] flex items-center justify-center mb-1 text-[#8B90A0]">
                          <Upload className="w-4 h-4 text-[#ffd7a1]" />
                        </div>
                        <span className="font-khmer text-xs font-semibold text-[#e2e2ec]">
                          {lang === 'KM' ? 'បញ្ចូលរូបភាពវិក្កយបត្រ (Upload Slip)' : 'Upload payment screenshot'}
                        </span>
                        <span className="font-price text-[10px] text-[#8B90A0]">
                          ABA / ACLEDA / Wing Transfer Receipt (PNG, JPG)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Warranty & Purchase Rules Notice */}
          <div className="bg-[#14161F] border border-[#ffb230]/30 rounded-2xl p-3.5 space-y-2 text-xs font-price">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#ffb230] shrink-0" />
                <span className="text-[#ffd7a1] font-bold uppercase">
                  {isAccount
                    ? (lang === 'KM' ? 'លក្ខខណ្ឌធានា ១៤ ថ្ងៃ & មិនបង្វិលប្រាក់' : '14-Day Warranty & No-Refund Policy')
                    : (lang === 'KM' ? 'គោលការណ៍មិនបង្វិលប្រាក់ (No Refund)' : 'Strict No-Refund Policy')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="text-[#ffb230] hover:underline text-[11px] font-bold flex items-center gap-0.5"
              >
                <span>{lang === 'KM' ? 'មើលច្បាប់លម្អិត' : 'View Rules'}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {isAccount ? (
              <p className="text-[11px] text-[#cac6bb] leading-relaxed">
                {lang === 'KM'
                  ? '🛡️ ធានា ១៤ ថ្ងៃ៖ អ្នកទិញត្រូវរក្សាទុក 2FA & Email ក្នុងអំឡុងពេល ១៤ ថ្ងៃ។ ប្រសិនបើលុប 2FA/Email ការធានានឹងអស់សុពលភាព (No Warranty)។ ផុត ១៤ ថ្ងៃ អាចលុប/ប្តូរគ្រប់យ៉ាងបាន។'
                  : '🛡️ 14-Day Warranty: You must keep 2FA Authenticator & email active during 14 days (removing them voids warranty). After 14 days, you can change everything freely.'}
              </p>
            ) : (
              <p className="text-[11px] text-[#cac6bb] leading-relaxed">
                {lang === 'KM'
                  ? '🚫 មុខទំនិញ Gamepass, ផ្លែឈើ, ឬអាវុធ MM2/Blade Ball ដែលបានផ្ញើជូនរួច មិនអាចបង្វិលប្រាក់វិញបានឡើយ (No Refund)។'
                  : '🚫 Digital items including Gamepasses, Fruits, and MM2/Blade Ball trade items cannot be refunded once dispatched.'}
              </p>
            )}
          </div>

          {/* Pricing Breakdown & Total Row */}
          <div className="bg-[#11131a] rounded-2xl p-4 border border-white/10 space-y-2 font-price text-xs">
            <div className="flex justify-between text-[#8B90A0]">
              <span>Original Price</span>
              <span>${product.price.toFixed(2)} USD</span>
            </div>

            {rankDiscountPercent > 0 && (
              <div className="flex justify-between text-[#3ECF8E] font-bold">
                <span className="flex items-center gap-1">
                  <span>{rankInfo.icon}</span>
                  <span>{rankInfo.title} Discount (-{rankDiscountPercent}%)</span>
                </span>
                <span>-${rankDiscountUSD.toFixed(2)} USD</span>
              </div>
            )}

            {appliedCoupon && (
              <div className="flex justify-between text-[#ffb230]">
                <span>Coupon ({appliedCoupon.code} -{appliedCoupon.discountPercent}%)</span>
                <span>-${couponDiscountUSD.toFixed(2)} USD</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-white/10 text-base">
              <span className="font-headline text-lg text-[#e2e2ec] uppercase">Total to Pay</span>
              <span className="font-price text-2xl font-bold text-[#ffb94d] drop-shadow-[0_0_10px_rgba(255,178,48,0.4)]">
                ${finalTotalUSD.toFixed(2)} USD
              </span>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 glass-panel sm:rounded-b-[32px] space-y-2.5">
          {isSoldOut ? (
            <div className="w-full bg-[#1e2029] border border-[#E8433F]/30 text-[#E8433F] font-headline text-lg py-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider text-center">
              <Ban className="w-5 h-5" />
              <span>{lang === 'KM' ? 'ទំនិញដាច់ស្តុក • មិនអាចទិញបានទេ' : 'SOLD OUT • PURCHASING CLOSED'}</span>
            </div>
          ) : isWaitingSlipReview ? (
            /* Slip review waiting view handles its own actions */
            null
          ) : isPaymentFailed ? (
            /* Order Failed Quick Action Footer */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRetryPayment}
                className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] py-3.5 px-4 rounded-xl font-headline text-sm uppercase font-bold tracking-wider chunky-btn-gold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,178,48,0.3)] cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4 text-[#291800]" />
                <span>{lang === 'KM' ? 'ព្យាយាមម្តងទៀត (Try Again)' : 'Try Again'}</span>
              </button>

              <a
                href={`https://t.me/Noreakyout?text=${encodeURIComponent(`Hello Uchiro Store Support, payment issue for "${product.title}" ($${finalTotalUSD.toFixed(2)} USD). Order Ref: ${currentOrderRef || 'N/A'}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#2AABEE] hover:bg-[#229ed9] text-white py-3.5 px-4 rounded-xl font-headline text-sm uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(42,171,238,0.3)] cursor-pointer text-center active:scale-98"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{lang === 'KM' ? 'ទាក់ទងជំនួយ (Contact Support)' : 'Contact Support'}</span>
              </a>
            </div>
          ) : !isLoggedIn ? (
            /* Sign-in Required CTA */
            <button
              onClick={() => {
                onClose();
                if (onOpenAuth) onOpenAuth();
              }}
              className="w-full font-headline text-base sm:text-lg py-4 rounded-xl bg-gradient-to-r from-[#ffb230] to-[#ffa000] hover:from-[#ffbe4d] hover:to-[#ffb230] text-[#291800] shadow-[0_0_25px_rgba(255,178,48,0.35)] flex items-center justify-center gap-2 uppercase tracking-wider transition-all cursor-pointer font-bold active:scale-98"
            >
              <Lock className="w-5 h-5 text-[#291800]" />
              <span className="font-khmer font-bold">
                {lang === 'KM' ? `ចូលគណនីដើម្បីទិញ ($${finalTotalUSD.toFixed(2)})` : `Sign In to Buy ($${finalTotalUSD.toFixed(2)} USD)`}
              </span>
            </button>
          ) : paymentMethod === 'balance' ? (
            /* Balance Payment Trigger */
            <button
              onClick={() => handleSubmitOrder(true)}
              disabled={isProcessing || !hasSufficientBalance}
              className={`w-full font-headline text-lg sm:text-xl py-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider transition-all ${
                hasSufficientBalance
                  ? 'bg-[#3ECF8E] hover:bg-[#32b479] text-[#052e16] shadow-[0_0_20px_rgba(62,207,142,0.4)] cursor-pointer'
                  : 'bg-[#1C1F29] text-[#8B90A0] border border-white/10 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Deducting Balance & Delivering...</span>
                </>
              ) : hasSufficientBalance ? (
                <>
                  <Zap className="w-5 h-5 text-[#052e16]" />
                  <span className="font-khmer font-bold">
                    {lang === 'KM' ? `ទូទាត់ជាមួយកាបូប ($${finalTotalUSD.toFixed(2)})` : `Pay with Balance ($${finalTotalUSD.toFixed(2)} USD)`}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <span>Insufficient Balance ($${currentBalance.toFixed(2)})</span>
                </>
              )}
            </button>
          ) : (
            /* KHQR Payment Trigger */
            <button
              onClick={() => {
                if (!isKhqrGenerated) {
                  handleGenerateKHQR();
                } else if (uploadedSlip) {
                  handleSlipSubmitOrder();
                } else {
                  handleRefreshPaymentCheck();
                }
              }}
              disabled={isProcessing || isGeneratingKhqr || isCheckingRealApi}
              className={`w-full font-headline text-base sm:text-lg py-4 rounded-xl chunky-btn-gold flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-75 transition-all cursor-pointer ${
                uploadedSlip
                  ? 'bg-[#3ECF8E] hover:bg-[#32b479] text-[#052e16] shadow-[0_0_20px_rgba(62,207,142,0.3)]'
                  : 'bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] shadow-[0_0_20px_rgba(255,178,48,0.3)]'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#291800]" />
                  <span>Processing Order...</span>
                </>
              ) : isGeneratingKhqr ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#291800]" />
                  <span>Generating Code...</span>
                </>
              ) : isCheckingRealApi ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#291800]" />
                  <span>{lang === 'KM' ? 'កំពុងពិនិត្យការទូទាត់...' : 'Checking Payment Status...'}</span>
                </>
              ) : isPaymentFailed ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span className="font-khmer font-bold">
                    {lang === 'KM' ? 'ផុតកំណត់ • បង្កើតកូដ QR ថ្មី' : 'EXPIRED • GENERATE NEW QR CODE'}
                  </span>
                </>
              ) : !isKhqrGenerated ? (
                <>
                  <QrCode className="w-5 h-5" />
                  <span className="font-khmer font-bold">
                    {lang === 'KM' ? 'បង្កើតកូដ KHQR ដើម្បីទូទាត់' : `Generate KHQR Code ($${finalTotalUSD.toFixed(2)})`}
                  </span>
                </>
              ) : uploadedSlip ? (
                <>
                  <Upload className="w-5 h-5" />
                  <span className="font-khmer font-bold">
                    {lang === 'KM' ? 'បញ្ជូនកុម្ម៉ង់ជាមួយបង្កាន់ដៃ' : 'SUBMIT ORDER WITH PAYMENT RECEIPT'}
                  </span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span className="font-khmer font-bold">
                    {lang === 'KM' ? 'ពិនិត្យការទូទាត់ (Refresh Payment)' : 'Refresh Payment Status'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Info Banner */}
          <div className="flex items-start gap-2 bg-[#14161D] p-3 rounded-xl border border-white/5">
            <Info className="w-4 h-4 text-[#ffb230] shrink-0 mt-0.5" />
            <p className="font-sans text-xs text-[#8B90A0] leading-snug">
              {isAccount
                ? `Account credentials & 2FA live key are delivered immediately with ${warrantyDays}-day warranty.`
                : isGift
                ? 'Gift items are dispatched to your Roblox Username within 15-30 minutes.'
                : 'Trade items will be delivered in-game via Private Server. Staff support available on Telegram.'}
            </p>
          </div>
        </div>
      </div>

      {/* Account Login & Rules Modal */}
      <AccountLoginRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        lang={lang}
        initialTab="rules"
      />
    </div>
  );
};
