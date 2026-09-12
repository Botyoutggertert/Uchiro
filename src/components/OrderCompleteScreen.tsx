import React, { useState, useEffect, useMemo } from 'react';
import { Order, ActiveScreen } from '../types';
import { generateLiveCode } from '../utils/totp';
import { AccountLoginRulesModal } from './AccountLoginRulesModal';
import { api } from '../utils/api';
import {
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Gift,
  Users,
  Send,
  Clock,
  Timer,
  AlertTriangle,
  Zap,
  Sparkles,
  Radio,
  Gamepad2,
  MessageCircle,
  Ban,
  Receipt,
  FileDown,
  Lock,
} from 'lucide-react';
import { generateReceiptPdf } from '../utils/generateReceiptPdf';
import { safeSessionStorage } from '../utils/storage';

interface OrderCompleteScreenProps {
  order: Order;
  onGoHome: () => void;
  onViewOrders: () => void;
  lang: 'KM' | 'EN';
}

const TOTAL_MANUAL_DELIVERY_WINDOW_SECONDS = 30 * 60; // 30 minutes = 1800s

export const OrderCompleteScreen: React.FC<OrderCompleteScreenProps> = ({
  order,
  onGoHome,
  onViewOrders,
  lang,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  // Active polling every 3s if order is still pending admin or bank confirmation
  useEffect(() => {
    if (currentOrder.status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const orders = await api.getOrders();
        if (Array.isArray(orders)) {
          const cleanId = currentOrder.id.replace(/[^a-zA-Z0-9_-]/g, '');
          const found = orders.find(
            (o) =>
              o.id === currentOrder.id ||
              o.id === cleanId ||
              o.id === `#${cleanId}` ||
              o.id.replace('#', '') === cleanId
          );
          if (found && (found.status === 'delivered' || found.slipStatus === 'confirmed')) {
            setCurrentOrder(found);
          }
        }
      } catch {
        // silent polling catch
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentOrder.id, currentOrder.status]);

  const isDelivered = currentOrder.status === 'delivered';
  const isPending = currentOrder.status === 'pending';
  const isAccount =
    currentOrder.fulfillmentType === 'account' ||
    (!currentOrder.fulfillmentType && (!!currentOrder.credentialsDelivered || currentOrder.product?.category === 'account'));
  const hasCredentials = isDelivered && !!currentOrder.credentialsDelivered;

  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [liveCodeData, setLiveCodeData] = useState(
    generateLiveCode(currentOrder.credentialsDelivered?.authenticatorKey || 'JBSWY3DPEHPK3PXP')
  );
  const [showGuideModal, setShowGuideModal] = useState(false);

  const isGift = currentOrder.fulfillmentType === 'gift';
  const isTrade = currentOrder.fulfillmentType === 'trade' || (!isAccount && !isGift);
  // Only gift orders use the automated 30-minute delivery countdown. Trade items require direct admin contact without any countdown.
  const isManualDelivery = isGift && isDelivered;

  // Initialize start timestamp for the 30-minute manual delivery window
  const initialStartTime = useMemo(() => {
    const key = `order_delivery_start_${currentOrder.id}`;
    const stored = safeSessionStorage.getItem(key);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && Date.now() - parsed < TOTAL_MANUAL_DELIVERY_WINDOW_SECONDS * 1000) {
        return parsed;
      }
    }

    if (currentOrder.timestamp && Date.now() - currentOrder.timestamp < TOTAL_MANUAL_DELIVERY_WINDOW_SECONDS * 1000) {
      safeSessionStorage.setItem(key, String(currentOrder.timestamp));
      return currentOrder.timestamp;
    }

    const now = Date.now();
    safeSessionStorage.setItem(key, String(now));
    return now;
  }, [currentOrder.id, currentOrder.timestamp]);

  // Real-time 30-minute countdown timer state in seconds
  const [remainingDeliverySeconds, setRemainingDeliverySeconds] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - initialStartTime) / 1000);
    return Math.max(0, TOTAL_MANUAL_DELIVERY_WINDOW_SECONDS - elapsed);
  });

  // Ticker for 30-minute manual delivery countdown
  useEffect(() => {
    if (!isManualDelivery) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - initialStartTime) / 1000);
      const remaining = Math.max(0, TOTAL_MANUAL_DELIVERY_WINDOW_SECONDS - elapsed);
      setRemainingDeliverySeconds(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [initialStartTime, isManualDelivery]);

  // Live 30-second TOTP generator ticker (only for accounts when delivered)
  useEffect(() => {
    if (!isAccount || !hasCredentials) return;
    const seed = currentOrder.credentialsDelivered?.authenticatorKey || 'JBSWY3DPEHPK3PXP';
    const interval = setInterval(() => {
      setLiveCodeData(generateLiveCode(seed));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentOrder.credentialsDelivered?.authenticatorKey, isAccount, hasCredentials]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const username = currentOrder.credentialsDelivered?.username || '';
  const password = currentOrder.credentialsDelivered?.password || '';
  const authenticatorKey = currentOrder.credentialsDelivered?.authenticatorKey || '';
  const warrantyDays = currentOrder.credentialsDelivered?.warrantyDurationDays || currentOrder.product.warrantyDays || 14;

  // Format remaining manual delivery time MM:SS
  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return {
      minutesStr: String(mins).padStart(2, '0'),
      secondsStr: String(secs).padStart(2, '0'),
      totalFormatted: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    };
  };

  const countdown = formatCountdown(remainingDeliverySeconds);
  const deliveryProgressPercent = Math.min(
    100,
    Math.max(0, (remainingDeliverySeconds / TOTAL_MANUAL_DELIVERY_WINDOW_SECONDS) * 100)
  );

  return (
    <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-3 sm:px-4 md:px-8 max-w-2xl mx-auto flex flex-col gap-5 sm:gap-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onGoHome}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] tracking-wider text-center uppercase flex-1 pr-10">
          {isPending
            ? (lang === 'KM' ? 'រង់ចាំការបញ្ជាក់ (PENDING)' : 'ORDER PENDING VERIFICATION')
            : 'ORDER COMPLETE'}
        </h1>
      </div>

      {/* Header Animation */}
      <section className="flex flex-col items-center justify-center text-center mt-2">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 relative ${
          isPending ? 'bg-[#ffb230]/20' : 'bg-[#3ECF8E]/20'
        }`}>
          <div className={`absolute inset-0 rounded-full animate-ping opacity-60 ${
            isPending ? 'bg-[#ffb230]/10' : 'bg-[#3ECF8E]/10'
          }`} />
          {isPending ? (
            <Clock className="w-12 h-12 text-[#ffb230] animate-spin" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-[#3ECF8E]" />
          )}
        </div>
        <span className={`font-price text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-center ${
          isPending ? 'text-[#ffb230]' : 'text-[#3ECF8E]'
        }`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${
            isPending ? 'bg-[#ffb230]' : 'bg-[#3ECF8E]'
          }`} />
          {isPending
            ? (lang === 'KM'
                ? 'រង់ចាំការបញ្ជាក់ពី ADMIN ឬធនាគារ (ត្រួតពិនិត្យ ៣ នាទី)'
                : 'AWAITING ADMIN / BANK VERIFICATION (3 MIN CHECK)')
            : isAccount
            ? 'DELIVERED INSTANTLY'
            : isGift
            ? 'GIFT ORDER DISPATCHED • 30M DELIVERY SLA'
            : (lang === 'KM' ? 'ការទូទាត់ជោគជ័យ • សូមទាក់ទង ADMIN' : 'PAYMENT COMPLETE • CONTACT ADMIN')}
        </span>
        <h2 className="font-headline text-2xl md:text-3xl text-[#e2e2ec] uppercase">
          {currentOrder.product.title}
        </h2>
        <p className="font-price text-xs text-[#8B90A0] mt-1">
          Order ID: <span className="text-[#ffd7a1] font-bold">{currentOrder.id}</span> • Total: ${(currentOrder.totalUSD ?? currentOrder.product?.price ?? 0).toFixed(2)} USD
        </p>

        {/* Quick Download PDF Receipt Button - Only unlocked when confirmed & delivered */}
        {isDelivered ? (
          <button
            onClick={() => generateReceiptPdf(currentOrder)}
            className="mt-3 bg-[#1C1F29] hover:bg-[#282a31] border border-[#ffb230]/40 hover:border-[#ffb230] text-[#ffd7a1] hover:text-[#ffb230] py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#ffb230]" />
            <span>{lang === 'KM' ? 'ទាញយកវិក្កយបត្រ PDF (Download Receipt)' : 'Download PDF Receipt'}</span>
          </button>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1C1F29]/90 border border-amber-500/30 text-amber-300 font-price text-xs shadow-md">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span>
              {lang === 'KM'
                ? '⏳ វិក្កយបត្រមិនទាន់អាចទាញយកបានទេ (កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់)'
                : '⏳ Receipt locked • Available once payment is confirmed by Admin / Bank'}
            </span>
          </div>
        )}
      </section>

      {/* ===================== MANUAL DELIVERY 30-MINUTE REAL-TIME COUNTDOWN CARD ===================== */}
      {isManualDelivery && (
        <section className="flex flex-col gap-4 animate-fade-in">
          {/* Main Neon Countdown Clock Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border-2 border-[#00F0FF]/40 bg-[#1C1F29] relative overflow-hidden shadow-2xl space-y-4">
            {/* Background Ambient Glow */}
            <div className="absolute -right-10 -top-10 w-44 h-44 bg-[#00F0FF]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 w-44 h-44 bg-[#ffb230]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Card Header & SLA Guarantee Tag */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center border border-[#00F0FF]/30 shrink-0">
                  <Timer className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-headline text-base sm:text-lg text-[#ffd7a1] uppercase flex items-center gap-2">
                    <span>{lang === 'KM' ? 'ពេលវេលាដឹកជញ្ជូន (Delivery Window)' : 'Estimated Delivery Window'}</span>
                  </h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    {lang === 'KM'
                      ? 'ការធានាដឹកជញ្ជូនរហ័សក្នុងរយៈពេល ៣០ នាទី'
                      : 'Guaranteed 30-Minute Priority Delivery Window'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 text-[11px] font-price font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>30m SLA Guarantee</span>
                </span>
              </div>
            </div>

            {/* Centerpiece Large Countdown Display */}
            <div className="flex flex-col items-center justify-center py-2 sm:py-3 relative z-10">
              <span className="font-price text-xs uppercase tracking-widest text-[#00F0FF] font-bold mb-1 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse text-[#00F0FF]" />
                {remainingDeliverySeconds > 0
                  ? (lang === 'KM' ? 'ពេលវេលានៅសល់មុនបញ្ចប់ ៣០ នាទី' : 'TIME REMAINING UNTIL WINDOW CLOSES')
                  : (lang === 'KM' ? 'ដល់ពេលវេលាកំណត់' : 'DELIVERY WINDOW REACHED')}
              </span>

              {/* Digital Time Blocks */}
              <div className="flex items-center gap-3 my-1">
                {/* Minutes Block */}
                <div className="flex flex-col items-center">
                  <div className="bg-[#0c0e15] border border-[#00F0FF]/40 shadow-[0_0_20px_rgba(0,240,255,0.25)] rounded-2xl px-4 py-2 sm:px-6 sm:py-3 min-w-[80px] sm:min-w-[100px] text-center">
                    <span className="font-price text-4xl sm:text-5xl font-extrabold text-[#00F0FF] tracking-wider drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
                      {countdown.minutesStr}
                    </span>
                  </div>
                  <span className="font-price text-[10px] sm:text-xs text-[#8B90A0] uppercase mt-1 font-bold">
                    {lang === 'KM' ? 'នាទី (MINUTES)' : 'MINUTES'}
                  </span>
                </div>

                <span className="font-price text-3xl sm:text-4xl text-[#00F0FF] font-bold animate-pulse -mt-4">
                  :
                </span>

                {/* Seconds Block */}
                <div className="flex flex-col items-center">
                  <div className="bg-[#0c0e15] border border-[#ffb230]/40 shadow-[0_0_20px_rgba(255,178,48,0.25)] rounded-2xl px-4 py-2 sm:px-6 sm:py-3 min-w-[80px] sm:min-w-[100px] text-center">
                    <span className="font-price text-4xl sm:text-5xl font-extrabold text-[#ffb230] tracking-wider drop-shadow-[0_0_10px_rgba(255,178,48,0.6)]">
                      {countdown.secondsStr}
                    </span>
                  </div>
                  <span className="font-price text-[10px] sm:text-xs text-[#8B90A0] uppercase mt-1 font-bold">
                    {lang === 'KM' ? 'វិនាទី (SECONDS)' : 'SECONDS'}
                  </span>
                </div>
              </div>

              {/* Dynamic Status Text */}
              <p className="font-price text-xs sm:text-sm text-[#ffd7a1] mt-2 text-center">
                {remainingDeliverySeconds > 600 ? (
                  <span className="text-[#3ECF8E] font-bold flex items-center gap-1.5 justify-center">
                    <Zap className="w-4 h-4" />
                    {lang === 'KM'
                      ? `ដំណើរការធម្មតា • នៅសល់ ${Math.ceil(remainingDeliverySeconds / 60)} នាទី`
                      : `Standard Queue Active • Estimated ~10-25 mins (${Math.ceil(remainingDeliverySeconds / 60)}m left)`}
                  </span>
                ) : remainingDeliverySeconds > 0 ? (
                  <span className="text-[#ffb230] font-bold flex items-center gap-1.5 justify-center">
                    <Clock className="w-4 h-4 animate-spin" />
                    {lang === 'KM'
                      ? `អាទិភាពខ្ពស់ • Admin កំពុងប្រគល់ជូនឥឡូវនេះ (${countdown.totalFormatted})`
                      : `High Priority Queue • Staff actively completing transfer (${countdown.totalFormatted})`}
                  </span>
                ) : (
                  <span className="text-[#E8433F] font-bold flex items-center gap-1.5 justify-center">
                    <AlertTriangle className="w-4 h-4" />
                    {lang === 'KM'
                      ? 'ផុតកំណត់ ៣០ នាទី • សូមទាក់ទង Admin ភ្លាមៗដើម្បីទទួលទំនិញជាបន្ទាន់'
                      : 'Window Completed • Please message Admin directly for instant claim'}
                  </span>
                )}
              </p>
            </div>

            {/* Smooth Delivery Progress Bar */}
            <div className="space-y-1.5 relative z-10">
              <div className="flex justify-between items-center text-[11px] font-price">
                <span className="text-[#8B90A0]">Window Progress</span>
                <span className="text-[#00F0FF] font-bold">
                  {Math.round(100 - deliveryProgressPercent)}% Elapsed • {Math.round(deliveryProgressPercent)}% Left
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#0c0e15] rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#00F0FF] via-[#ffb230] to-[#3ECF8E] transition-all duration-1000 ease-linear rounded-full shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                  style={{ width: `${deliveryProgressPercent}%` }}
                />
              </div>
            </div>

            {/* 4-Step Delivery Pipeline Stages */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 relative z-10">
              {/* Step 1 */}
              <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#3ECF8E]/30 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-[#3ECF8E] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>1. Payment</span>
                </div>
                <p className="text-[10px] font-price text-[#8B90A0]">KHQR Verified ✅</p>
              </div>

              {/* Step 2 */}
              <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#3ECF8E]/30 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-[#3ECF8E] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>2. Bot Dispatched</span>
                </div>
                <p className="text-[10px] font-price text-[#8B90A0]">Telegram Alert Sent 🚀</p>
              </div>

              {/* Step 3 */}
              <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#00F0FF]/40 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-[#00F0FF] font-bold">
                  <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
                  <span>3. Transferring</span>
                </div>
                <p className="text-[10px] font-price text-[#00F0FF]">
                  {isGift ? 'Gift In-Game' : 'Private Server'}
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-[#11131a] p-2.5 rounded-xl border border-white/5 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-[#8B90A0] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>4. Complete</span>
                </div>
                <p className="text-[10px] font-price text-[#8B90A0]">100% Protected 🛡️</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ACCOUNT FLOW: WARRANTY & BENTO CREDENTIALS */}
      {isAccount && (
        <>
          {!hasCredentials ? (
            <section className="flex flex-col gap-4 animate-fade-in">
              <div className="glass-panel rounded-3xl p-6 sm:p-7 border-2 border-[#ffb230]/40 bg-[#1C1F29] relative overflow-hidden shadow-2xl space-y-4 text-center">
                {/* Glowing ambient background */}
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ffb230]/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#3ECF8E]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="w-16 h-16 rounded-2xl bg-[#ffb230]/15 border border-[#ffb230]/40 text-[#ffb230] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(255,178,48,0.25)]">
                  <Lock className="w-8 h-8 text-[#ffb230]" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffb230]/15 border border-[#ffb230]/30 text-[#ffd7a1] text-xs font-headline uppercase font-bold mb-2">
                    <Clock className="w-3.5 h-3.5 text-[#ffb230] animate-spin" />
                    <span>{lang === 'KM' ? 'រង់ចាំការបញ្ជាក់ (Awaiting Confirmation)' : 'Awaiting Confirmation'}</span>
                  </div>
                  <h3 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase font-bold">
                    {lang === 'KM' ? 'ព័ត៌មានគណនីត្រូវបានចាក់សោសុវត្ថិភាព' : 'Account Credentials Locked'}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-[#d1d5db] mt-2 max-w-md mx-auto leading-relaxed">
                    {lang === 'KM'
                      ? 'ការបញ្ជាទិញនេះកំពុងស្ថិតក្នុងការត្រួតពិនិត្យដោយ Admin ឬប្រព័ន្ធធនាគារ (ត្រួតពិនិត្យ ៣ នាទី)។ នៅពេល Admin ចុច Confirm ឬប្រព័ន្ធស្វ័យប្រវត្តផ្ទៀងផ្ទាត់រួចរាល់ ឈ្មោះគណនី លេខសម្ងាត់ និងកូដ 2FA នឹងបើកចំហរនៅទីនេះដោយស្វ័យប្រវត្តិ។'
                      : 'This order is waiting for Admin approval or bank system auto-confirmation (3-minute check). Once confirmed, your account username, password, and live 2FA will unlock here automatically.'}
                  </p>
                </div>

                <div className="p-4 bg-[#11131a] rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                  <div>
                    <span className="text-[11px] text-[#8B90A0] uppercase font-bold block">
                      {lang === 'KM' ? 'ស្ថានភាពការបញ្ជាក់បច្ចុប្បន្ន' : 'Current Verification Status'}
                    </span>
                    <span className="font-headline text-sm text-[#ffb230] font-bold flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-4 h-4 text-[#ffb230] animate-spin" />
                      <span>{currentOrder.slipStatus === 'admin_review' ? 'Admin Reviewing Slip' : 'Checking Bank Confirmation (3 Min)'}</span>
                    </span>
                  </div>
                  <a
                    href={`https://t.me/Noreakyout?text=${encodeURIComponent(
                      `Hello Admin, I am checking my order ${currentOrder.id} ($${(currentOrder.totalUSD ?? currentOrder.product.price).toFixed(2)} USD). Please confirm to unlock credentials.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto bg-[#2AABEE] hover:bg-[#229ed9] text-white py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{lang === 'KM' ? 'ទាក់ទង Admin (Telegram)' : 'Chat Admin on Telegram'}</span>
                  </a>
                </div>
              </div>
            </section>
          ) : (
            <>
              {/* Warranty Banner & Rules Card */}
              <section className="flex flex-col gap-3">
            <div className="shimmer-wrapper rounded-2xl p-0.5 shadow-lg">
              <div className="bg-[#1C1F29]/95 rounded-2xl p-4 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-[#ffb230]" />
                  <div>
                    <p className="font-sans text-sm font-semibold text-[#e2e2ec]">
                      {warrantyDays}-Day Official Warranty Active
                    </p>
                    <p className="font-khmer text-xs text-[#8B90A0]">ធានាសុវត្ថិភាពគណនី ១៤ ថ្ងៃពេញ</p>
                  </div>
                </div>
                <div className="bg-[#0c0e15] px-3.5 py-1.5 rounded-xl border border-[#ffb230]/30 shadow-inner">
                  <span className="font-price text-sm md:text-base text-[#ffb230] font-bold">
                    {warrantyDays - 1}d 23h 59m
                  </span>
                </div>
              </div>
            </div>

            {/* CRITICAL WARRANTY RULE BOX */}
            <div className="bg-[#E8433F]/15 border-2 border-[#E8433F]/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E8433F] shrink-0 animate-pulse" />
                <h4 className="font-headline text-xs sm:text-sm text-[#ff8e8b] uppercase font-bold">
                  {lang === 'KM' ? 'លក្ខខណ្ឌដាច់ខាតនៃការធានា (WARRANTY RULES)' : 'CRITICAL WARRANTY RULE'}
                </h4>
              </div>
              <p className="text-xs font-price text-[#ffd7a1] leading-relaxed">
                {lang === 'KM' ? (
                  <>
                    ⚠️ <strong>ក្នុងអំឡុងពេលធានា ១៤ ថ្ងៃ</strong> ហាមលុប ឬផ្លាស់ប្តូរ <strong>Authenticator (2FA)</strong> ឬ <strong>Email</strong> ជាដាច់ខាត! ប្រសិនបើអ្នកទិញលុប 2FA/Email <strong className="text-[#ff8e8b]">ការធានានឹងត្រូវអស់សុពលភាពភ្លាមៗ (NO WARRANTY)</strong>។
                  </>
                ) : (
                  <>
                    ⚠️ <strong>During the 14-day warranty</strong>, do NOT delete or remove the <strong>Authenticator (2FA)</strong> or <strong>Email</strong>! Removing 2FA or email will <strong className="text-[#ff8e8b]">immediately VOID the warranty (NO WARRANTY)</strong>.
                  </>
                )}
              </p>
              <div className="text-[11px] font-price text-[#cac6bb] pt-1 border-t border-white/10 flex items-center justify-between">
                <span>
                  {lang === 'KM' ? '✅ ក្រោយផុតកំណត់ ១៤ ថ្ងៃ (Day 15+): អាចលុប/ប្តូរគ្រប់យ៉ាងបាន ១០០%' : '✅ Day 15+: You can delete/change everything freely'}
                </span>
                <span className="text-[#ff8e8b] font-bold">
                  {lang === 'KM' ? '🚫 មិនបង្វិលប្រាក់ (No Refund)' : '🚫 No Refund'}
                </span>
              </div>
            </div>
          </section>

          {/* Credential Bento Cards */}
          <section className="flex flex-col gap-3">
            {/* Card 1: Username */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1 relative group">
              <span className="font-khmer text-xs text-[#d6c4ae] flex items-center gap-2">
                <span className="text-base">👤</span> ឈ្មោះគណនី (Username)
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-price text-lg md:text-xl font-bold text-[#e2e2ec] select-all">
                  {username}
                </span>
                <button
                  onClick={() => copyToClipboard(username, 'username')}
                  className="w-10 h-10 rounded-xl bg-[#1d1f27] hover:bg-[#282a31] border border-white/10 flex items-center justify-center text-[#8B90A0] hover:text-[#ffb230] transition-colors active:scale-95"
                  title="Copy Username"
                >
                  {copiedField === 'username' ? (
                    <Check className="w-5 h-5 text-[#3ECF8E]" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Card 2: Password */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1 relative">
              <span className="font-khmer text-xs text-[#d6c4ae] flex items-center gap-2">
                <span className="text-base">🔑</span> លេខសម្ងាត់ (Password)
              </span>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <span className="font-price text-lg md:text-xl font-bold text-[#e2e2ec] tracking-wider select-all">
                    {showPassword ? password : '••••••••••••'}
                  </span>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#8B90A0] hover:text-white p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => copyToClipboard(password, 'password')}
                  className="w-10 h-10 rounded-xl bg-[#1d1f27] hover:bg-[#282a31] border border-white/10 flex items-center justify-center text-[#8B90A0] hover:text-[#ffb230] transition-colors active:scale-95"
                  title="Copy Password"
                >
                  {copiedField === 'password' ? (
                    <Check className="w-5 h-5 text-[#3ECF8E]" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Card 3: Authenticator Key */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1 relative">
              <span className="font-khmer text-xs text-[#d6c4ae] flex items-center gap-2">
                <span className="text-base">🔐</span> Authenticator Secret Key
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-price text-base md:text-lg font-bold text-[#e2e2ec] truncate pr-2 select-all">
                  {authenticatorKey}
                </span>
                <button
                  onClick={() => copyToClipboard(authenticatorKey, 'authKey')}
                  className="w-10 h-10 rounded-xl bg-[#1d1f27] hover:bg-[#282a31] border border-white/10 flex items-center justify-center text-[#8B90A0] hover:text-[#ffb230] transition-colors active:scale-95 shrink-0"
                  title="Copy Key"
                >
                  {copiedField === 'authKey' ? (
                    <Check className="w-5 h-5 text-[#3ECF8E]" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Card 4: Live 2FA Code (Highlight TOTP) */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3 relative border-2 border-[#ffb230]/40 bg-[#1C1F29] overflow-hidden shadow-2xl">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#ffb230]/15 rounded-full blur-2xl" />

              <div className="flex items-center justify-between z-10">
                <span className="font-khmer text-sm text-[#ffb94d] font-bold flex items-center gap-2">
                  <span className="text-base">⚡</span> លេខកូដលឿន (Live 2FA Code)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#3ECF8E] rounded-full animate-pulse shadow-[0_0_10px_#3ECF8E]" />
                  <span className="font-price text-xs text-[#3ECF8E] font-bold">
                    {liveCodeData.remainingSeconds}s
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between z-10">
                <span className="font-price text-4xl sm:text-5xl font-bold tracking-widest text-[#ffb230] drop-shadow-[0_0_15px_rgba(255,178,48,0.5)] select-all">
                  {liveCodeData.formattedCode}
                </span>
                <button
                  onClick={() => copyToClipboard(liveCodeData.code, 'liveCode')}
                  className="flex items-center gap-1 bg-[#282a31] hover:bg-[#ffb230] text-[#ffd7a1] hover:text-[#291800] px-3 py-2 rounded-xl text-xs font-price font-bold border border-white/10 transition-all active:scale-95"
                >
                  {copiedField === 'liveCode' ? (
                    <>
                      <Check className="w-4 h-4 text-[#3ECF8E]" />
                      <span>COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPY CODE</span>
                    </>
                  )}
                </button>
              </div>

              {/* Smooth Countdown Progress Bar */}
              <div className="w-full h-1.5 bg-[#0c0e15] rounded-full overflow-hidden mt-1 z-10 border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-[#ffb230] to-[#3ECF8E] transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(liveCodeData.remainingSeconds / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Card 5: Step by Step Guide & Rules Link */}
            <button
              onClick={() => setShowGuideModal(true)}
              className="glass-panel rounded-2xl p-4 flex items-center justify-between hover:bg-[#282a31] border border-white/10 transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📲</span>
                <div>
                  <span className="font-khmer text-sm text-[#ffd7a1] font-bold block">
                    {lang === 'KM' ? 'របៀបចូលគណនី & ច្បាប់ទិញគណនី' : 'How to Login & Account Purchase Rules'}
                  </span>
                  <span className="text-[11px] font-price text-[#8B90A0]">
                    {lang === 'KM' ? 'ច្បាប់រក្សាទុក 2FA & គោលការណ៍ធានា ១៤ ថ្ងៃ' : '2FA rules, 14-day warranty conditions & No refund'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#8B90A0] group-hover:text-[#ffb230] transition-colors" />
            </button>
          </section>
        </>
      )}
    </>
  )}

      {/* GIFT FLOW: ROBLOX USERNAME & DETAILS */}
      {isGift && (
        <section className="flex flex-col gap-4">
          <div className="glass-panel rounded-3xl p-6 border border-[#E8433F]/40 bg-[#1C1F29] space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#E8433F]/20 text-[#E8433F] rounded-2xl">
                <Gift className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-headline text-xl text-[#ffd7a1] uppercase">Gift Dispatch In Progress</h3>
                <p className="font-price text-xs text-[#8B90A0]">Roblox Direct In-Game Gift</p>
              </div>
            </div>

            {/* Recipient Profile Card with Avatar if available */}
            {order.recipientRobloxProfile ? (
              <div className="bg-[#11131a] rounded-2xl p-4 border border-[#3ECF8E]/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={order.recipientRobloxProfile.avatarUrl}
                      alt={order.recipientRobloxProfile.displayName}
                      className="w-12 h-12 rounded-xl object-cover bg-black/40 border-2 border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#3ECF8E] text-[#003822] rounded-full p-0.5">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-headline text-sm font-bold text-[#e2e2ec]">
                        {order.recipientRobloxProfile.displayName}
                      </span>
                      <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-1.5 py-0.5 rounded">
                        Verified Recipient
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#00F0FF] font-bold">
                      @{order.recipientRobloxProfile.username}
                    </span>
                    <span className="text-[11px] text-[#8B90A0] ml-2">
                      ID: {order.recipientRobloxProfile.userId}
                    </span>
                  </div>
                </div>

                <a
                  href={`https://www.roblox.com/search/users?keyword=${encodeURIComponent(order.recipientRobloxProfile.username)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8B90A0] hover:text-[#00F0FF] p-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                  title="View Roblox Profile"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : null}

            <div className="bg-[#11131a] rounded-2xl p-4 border border-white/10 space-y-2">
              <div className="flex justify-between items-center text-xs font-price">
                <span className="text-[#8B90A0]">Recipient Username:</span>
                <span className="text-[#3ECF8E] font-bold text-sm select-all">{order.recipientRobloxUsername || order.customerName}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-price">
                <span className="text-[#8B90A0]">Order Reference:</span>
                <span className="text-[#ffd7a1] font-bold select-all">{order.id}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-price">
                <span className="text-[#8B90A0]">Delivery Status:</span>
                <span className="text-[#00F0FF] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
                  Auto-Queued for Admin Bot Dispatch
                </span>
              </div>
            </div>

            <p className="font-khmer text-xs text-[#d6c4ae] leading-relaxed">
              {lang === 'KM'
                ? 'Admin កំពុងផ្ញើ Gift Gamepass ទៅកាន់គណនីរបស់អ្នក។ ប្រសិនបើត្រូវការជំនួយបន្ទាន់ សូមទាក់ទងមក Telegram ខាងក្រោម។'
                : 'Admin is dispatching your gift item within the 30-minute priority delivery window. If you need any assistance, contact our official Telegram admin.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <a
                href="https://t.me/Noreakyout"
                target="_blank"
                rel="noreferrer"
                className="bg-[#229ED9] hover:bg-[#1e8bc0] text-white py-3.5 rounded-xl font-headline text-sm flex items-center justify-center gap-2 uppercase tracking-wide transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Admin @Noreakyout</span>
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(`Hello Admin, my Order ID is ${order.id}. Please send my gift to Roblox username: ${order.recipientRobloxUsername || order.customerName}`, 'giftMsg')}
                className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/20 text-[#ffd7a1] py-3.5 rounded-xl font-headline text-sm flex items-center justify-center gap-2 uppercase tracking-wide transition-colors"
              >
                {copiedField === 'giftMsg' ? (
                  <>
                    <Check className="w-4 h-4 text-[#3ECF8E]" />
                    <span>COPIED MESSAGE</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#ffb230]" />
                    <span>Copy Order Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TRADE FLOW: CONTACT ADMIN FOR MM2 / BLOX FRUITS / BLADE BALL (NO COUNTDOWN) */}
      {isTrade && (
        <section className="flex flex-col gap-4 animate-fade-in">
          {/* Main Clean Trade Delivery Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border-2 border-[#60a5fa]/40 bg-[#1C1F29] relative overflow-hidden shadow-2xl space-y-4">
            {/* Background Glow */}
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#60a5fa]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-[#3ECF8E]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-[#60a5fa]/20 text-[#60a5fa] rounded-2xl flex items-center justify-center border border-[#60a5fa]/30 shrink-0 shadow-[0_0_15px_rgba(96,165,250,0.3)]">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline text-lg sm:text-xl text-[#ffd7a1] uppercase flex items-center gap-2">
                    <span>{lang === 'KM' ? 'ទាក់ទង ADMIN ដើម្បីទទួលទំនិញ' : 'Contact Admin for Trade'}</span>
                  </h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    {lang === 'KM' ? 'ទំនិញ Trade ក្នុងហ្គេម • ផ្ទេរផ្ទាល់ភ្លាមៗ' : 'In-Game Trade • Direct Staff Delivery'}
                  </p>
                </div>
              </div>
              <span className="bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 text-[11px] font-price font-bold px-2.5 py-1 rounded-full hidden sm:flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Paid & Ready</span>
              </span>
            </div>

            {/* Prompt Banner */}
            <div className="bg-[#60a5fa]/10 border border-[#60a5fa]/30 rounded-2xl p-3.5 sm:p-4 text-xs font-price text-[#d6c4ae] leading-relaxed relative z-10 space-y-1">
              <p className="text-[#ffd7a1] font-bold flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-[#ffb230]" />
                {lang === 'KM' ? 'ការទូទាត់ជោគជ័យ! សូមចុចផ្ញើសារ ឬចម្លងសារខាងក្រោមផ្ញើទៅ Admin' : 'Payment Verified! Click below to send trade message directly to Admin:'}
              </p>
              <p className="text-[#cac6bb]">
                {lang === 'KM'
                  ? 'Admin នឹងផ្ញើ Link Private Server (Sea 2 / Cafe / Trading Plaza) ដើម្បី Trade ទំនិញជូនលោកអ្នកភ្លាមៗ។'
                  : 'Admin will invite you to the Private Server link to deliver your in-game items.'}
              </p>
            </div>

            {/* Clean Order Summary Overview (No multiple separate copy buttons) */}
            <div className="bg-[#11131a] rounded-2xl p-4 border border-white/10 relative z-10 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-price border-b border-white/5 pb-2">
                <span className="text-[#8B90A0] flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[#ffb230]" />
                  <span>Order Reference</span>
                </span>
                <span className="font-price font-bold text-[#ffd7a1] text-sm select-all">{order.id}</span>
              </div>

              <div className="flex justify-between items-center text-xs font-price border-b border-white/5 pb-2">
                <span className="text-[#8B90A0] flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Purchased Item</span>
                </span>
                <span className="font-price font-bold text-[#e2e2ec] text-sm text-right select-all">{order.product.title}</span>
              </div>

              {order.recipientRobloxUsername && (
                <div className="flex justify-between items-center text-xs font-price border-b border-white/5 pb-2">
                  <span className="text-[#8B90A0]">Roblox Username</span>
                  <span className="font-price font-bold text-[#3ECF8E] text-sm select-all">{order.recipientRobloxUsername}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-price pt-0.5">
                <span className="text-[#8B90A0]">Payment Status</span>
                <span className="font-price font-bold text-[#3ECF8E] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Paid ${(order.totalUSD || 0).toFixed(2)} USD</span>
                </span>
              </div>
            </div>

            {/* Pre-composed Full Trade Message with 1-Click Copy */}
            <div className="bg-[#11131a] rounded-2xl p-4 border border-white/10 relative z-10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-khmer text-xs text-[#ffd7a1] font-bold flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-[#ffb230]" />
                  {lang === 'KM' ? 'សាររៀបចំរួចសម្រាប់ផ្ញើទៅ Admin' : 'Full Pre-composed Trade Message'}
                </span>
                <span className="text-[10px] font-price text-[#3ECF8E] font-bold">Ready to Send</span>
              </div>

              <div className="bg-[#0c0e15] rounded-xl p-3.5 border border-white/5 font-mono text-xs text-[#cac6bb] leading-relaxed select-all">
                Hello Admin, I have paid for <span className="text-[#ffd7a1] font-bold">{order.product.title}</span> (Order ID: <span className="text-[#00F0FF] font-bold">{order.id}</span>
                {order.recipientRobloxUsername ? `, Roblox: ${order.recipientRobloxUsername}` : ''}). Please invite me to the private server to trade!
              </div>

              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Hello Admin, I have paid for ${order.product.title} (Order ID: ${order.id}${order.recipientRobloxUsername ? `, Roblox: ${order.recipientRobloxUsername}` : ''}). Please invite me to the private server to trade!`,
                    'fullTradeMsg'
                  )
                }
                className="w-full bg-[#1d1f27] hover:bg-[#2a2c35] text-[#ffd7a1] hover:text-[#ffb230] border border-white/15 py-3 rounded-xl font-price text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                {copiedField === 'fullTradeMsg' ? (
                  <>
                    <Check className="w-4 h-4 text-[#3ECF8E]" />
                    <span className="text-[#3ECF8E]">COPIED FULL MESSAGE TO CLIPBOARD</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#ffb230]" />
                    <span>{lang === 'KM' ? 'ចម្លងសារទាំងមូល (Copy Full Message)' : 'Copy Full Message'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct Contact Admin Buttons - Telegram Direct (No phone numbers) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 relative z-10">
              <a
                href={`https://t.me/Noreakyout?text=${encodeURIComponent(
                  `Hello Admin, I have paid for ${order.product.title} (Order ID: ${order.id}${order.recipientRobloxUsername ? `, Roblox: ${order.recipientRobloxUsername}` : ''}). Please invite me to the private server to trade!`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#229ED9] hover:bg-[#1e8bc0] text-white py-3.5 rounded-xl font-headline text-sm flex items-center justify-center gap-2 uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(34,158,217,0.3)] active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Chat Admin @Noreakyout</span>
              </a>

              <a
                href="https://t.me/uchirostore"
                target="_blank"
                rel="noreferrer"
                className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/20 text-[#ffd7a1] hover:text-[#ffb230] py-3.5 rounded-xl font-headline text-sm flex items-center justify-center gap-2 uppercase tracking-wider transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4 text-[#00F0FF]" />
                <span>Telegram Support Channel</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Action Buttons */}
      <section className="flex flex-col sm:flex-row gap-3 mt-2">
        {isDelivered && (
          <button
            onClick={() => generateReceiptPdf(order)}
            className="bg-[#1C1F29] hover:bg-[#282a31] border border-[#ffb230]/40 text-[#ffd7a1] hover:text-[#ffb230] rounded-xl py-3.5 px-4 font-headline text-sm font-bold flex items-center justify-center gap-2 uppercase transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#ffb230]" />
            <span>{lang === 'KM' ? 'ទាញយកវិក្កយបត្រ' : 'Download Receipt'}</span>
          </button>
        )}
        <button
          onClick={onGoHome}
          className="flex-1 bg-[#1C1F29] hover:bg-[#282a31] border border-white/15 rounded-xl py-3.5 font-khmer text-sm font-bold text-[#e2e2ec] chunky-btn-outline uppercase cursor-pointer"
        >
          {lang === 'KM' ? 'ទៅកាន់ទំព័រដើម' : 'Back to Store'}
        </button>
        <button
          onClick={onViewOrders}
          className="flex-1 bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] rounded-xl py-3.5 font-khmer text-sm font-bold chunky-btn-gold uppercase cursor-pointer"
        >
          {lang === 'KM' ? 'មើលការបញ្ជាទិញ' : 'View My Orders'}
        </button>
      </section>

      {/* Comprehensive Account Login & Rules Modal */}
      <AccountLoginRulesModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        lang={lang}
        initialTab="login"
      />
    </div>
  );
};

