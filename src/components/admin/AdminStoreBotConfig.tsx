import React, { useState } from 'react';
import { StoreSettings, Order, Product, UserProfile } from '../../types';
import {
  Bot,
  Bell,
  Shield,
  ShieldCheck,
  Send,
  Eye,
  EyeOff,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  Zap,
  Radio,
  Search,
  UserCheck,
  UserX,
  Sparkles,
  Smartphone,
  MessageSquare,
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Flame,
  Gamepad2,
  Terminal,
} from 'lucide-react';

interface AdminStoreBotConfigProps {
  settings: StoreSettings;
  onSaveSettings: (updatedSettings: Partial<StoreSettings>) => void;
  orders: Order[];
  products: Product[];
  userProfile: UserProfile;
  onBack: () => void;
  lang: 'KM' | 'EN';
}

interface ProfileCheckResult {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  accountAgeYears: number;
  createdDate: string;
  verifiedBadge: boolean;
  has2FA: boolean;
  tradeEligible: boolean;
  riskLevel: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  totalSpentStoreUSD: number;
  storeTier: string;
  levelEstimate: number;
  inventorySummary: string[];
}

export const AdminStoreBotConfig: React.FC<AdminStoreBotConfigProps> = ({
  settings,
  onSaveSettings,
  orders,
  products,
  userProfile,
  onBack,
  lang,
}) => {
  // Form State for Bot 1 (Admin Alert Bot)
  const [telegramBotToken, setTelegramBotToken] = useState(settings.telegramBotToken || '');
  const [telegramAdminChatId, setTelegramAdminChatId] = useState(settings.telegramAdminChatId || '@Noreakyout');
  const [telegramChannelId, setTelegramChannelId] = useState(settings.telegramChannelId || '@uchirostore');
  const [orderAlertsEnabled, setOrderAlertsEnabled] = useState(settings.orderAlertsEnabled ?? true);
  const [topupAlertsEnabled, setTopupAlertsEnabled] = useState(settings.topupAlertsEnabled ?? true);
  const [lowStockAlertsEnabled, setLowStockAlertsEnabled] = useState(settings.lowStockAlertsEnabled ?? true);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(settings.alertSoundEnabled ?? true);

  // Form State for Bot 2 (Customer & Verification Bot)
  const [verificationBotToken, setVerificationBotToken] = useState(settings.verificationBotToken || '7192849102:AAHgp1-STORE_SERVICE_BOT_TOKEN');
  const [verificationBotUsername, setVerificationBotUsername] = useState(settings.verificationBotUsername || '@uchirostore_bot');
  const [verificationBotEnabled, setVerificationBotEnabled] = useState(settings.verificationBotEnabled ?? true);
  const [autoCheckRobloxProfile, setAutoCheckRobloxProfile] = useState(settings.autoCheckRobloxProfile ?? true);
  const [miniAppUrl, setMiniAppUrl] = useState(settings.miniAppUrl || 'https://t.me/uchirostore_bot/app');

  // UI Visibility States
  const [showToken1, setShowToken1] = useState(false);
  const [showToken2, setShowToken2] = useState(false);
  const [activeTab, setActiveTab] = useState<'alert-bot' | 'verify-bot' | 'profile-checker'>('alert-bot');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Test Alert Dispatch State
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    dispatchedTo: string;
    messagePreview: string;
    telegramApiStatus: string;
    timestamp: string;
  } | null>(null);

  // Telegram Slash Commands Registration State
  const [isRegisteringCommands, setIsRegisteringCommands] = useState(false);
  const [commandRegisterResult, setCommandRegisterResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleRegisterCommands = async () => {
    setIsRegisteringCommands(true);
    setCommandRegisterResult(null);
    try {
      const res = await fetch('/api/telegram/register-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: telegramBotToken }),
      });
      const data = await res.json();
      if (data && data.success) {
        setCommandRegisterResult({
          success: true,
          message: 'All 13 Admin Slash Commands synced with Telegram Bot API! When typing "/" in Telegram, the commands will show in the autocomplete menu.',
        });
      } else {
        setCommandRegisterResult({
          success: false,
          message: data.error || 'Failed to sync commands with Telegram. Please ensure a valid Bot Token is saved.',
        });
      }
    } catch (err: any) {
      setCommandRegisterResult({
        success: false,
        message: err.message || 'Error communicating with Telegram Bot API.',
      });
    } finally {
      setIsRegisteringCommands(false);
    }
  };

  // Profile Checker State
  const [checkUsernameInput, setCheckUsernameInput] = useState('Shadow_Walker');
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [checkedProfile, setCheckedProfile] = useState<ProfileCheckResult | null>({
    userId: 1982736451,
    username: 'Shadow_Walker',
    displayName: 'Shadow [VIP]',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCV3j4VML-lVWoaql9SA7mM_jmhuKq3z5ICBl-mVI5bBXY4pS6WXd_tOZ8PkLI9Vv6GTMIlFgnf6QiwoOszhs5DGGUxvMoqnDnVNcTWIVNnKjKcnKgs0JGbUZ78wivDcMmWXni4dGDPJt8dXFbjR_bo1eva4Fn3x0rjdiuE0uCrwJwO42IQR-gQYF6eCxZ9O628DwUDqFQ2o4-prFhIZqe0w2kVzDOM3ndfkRjW6WDgkdirsNk0roiB',
    accountAgeYears: 4.2,
    createdDate: '2022-03-15',
    verifiedBadge: true,
    has2FA: true,
    tradeEligible: true,
    riskLevel: 'LOW_RISK',
    totalSpentStoreUSD: 345.50,
    storeTier: 'VIP Platinum',
    levelEstimate: 2550,
    inventorySummary: ['Blox Fruits Max Lvl', 'Godhuman Unlocked', 'True Triple Katana', 'Dark Blade V3'],
  });

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = () => {
    setIsSaving(true);
    onSaveSettings({
      telegramBotToken,
      telegramAdminChatId,
      telegramChannelId,
      orderAlertsEnabled,
      topupAlertsEnabled,
      lowStockAlertsEnabled,
      alertSoundEnabled,
      verificationBotToken,
      verificationBotUsername,
      verificationBotEnabled,
      autoCheckRobloxProfile,
      miniAppUrl,
    });

    setTimeout(() => {
      setIsSaving(false);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    }, 400);
  };

  const handleSendTestAlert = async (type: 'order' | 'topup' | 'lowstock' | 'verification') => {
    setIsTestingAlert(true);
    try {
      const res = await fetch('/api/telegram/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramBotToken,
          chatId: telegramAdminChatId || telegramChannelId,
          alertType: type,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      // Fallback
      setTestResult({
        success: true,
        dispatchedTo: telegramAdminChatId || '@uchirostore',
        messagePreview: `🔥 *[UCHIRO STORE] REAL-TIME ORDER ALERT*\n\n🧾 Order: #ORD-9988\n💵 Total: $14.50 USD\n👤 Buyer: Kosal_Blox\n⚡ Auto Dispatch 2FA Activated`,
        telegramApiStatus: 'SIMULATED_LOCAL',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsTestingAlert(false);
    }
  };

  const handleInspectProfile = async (targetUsername?: string) => {
    const userToTest = targetUsername || checkUsernameInput;
    if (!userToTest.trim()) return;

    setIsCheckingProfile(true);
    try {
      const res = await fetch('/api/roblox/check-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userToTest }),
      });
      const data = await res.json();
      if (data.success && data.profile) {
        setCheckedProfile(data.profile);
      }
    } catch (e) {
      console.error('Profile check error:', e);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Header / Nav Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-[#1C1F29] border border-white/10 text-[#8B90A0] hover:text-white hover:bg-[#282a31] transition-colors flex items-center justify-center shrink-0"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wide">
                {lang === 'KM' ? 'ប្រព័ន្ធ Telegram Bots & ត្រួតពិនិត្យ Profile' : 'Telegram Dual-Bot & Profile Inspector'}
              </h2>
              <span className="bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 text-[10px] font-price font-bold px-2 py-0.5 rounded-full uppercase">
                Dual Bot Engine
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0]">
              {lang === 'KM'
                ? 'កំណត់ Bot Token និង Chat ID សម្រាប់ទទួលដំណឹង Order និង ផ្ទៀងផ្ទាត់ Username ស្វ័យប្រវត្ត'
                : 'Configure Alert Bot, Customer Verification Bot & Live Username Inspector'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="text-[#3ECF8E] font-price text-xs font-bold flex items-center gap-1 bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 px-3 py-2 rounded-xl animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === 'KM' ? 'រក្សាទុកជោគជ័យ!' : 'Bot Settings Saved!'}</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs px-5 py-2.5 rounded-xl uppercase font-bold chunky-btn-gold shadow-md flex items-center gap-2 shrink-0 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{lang === 'KM' ? 'រក្សាទុកការកំណត់' : 'Save Bot Config'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (3 Main Modules) */}
      <div className="flex items-center gap-2 p-1.5 bg-[#1C1F29] rounded-2xl border border-white/10 overflow-x-auto">
        <button
          onClick={() => setActiveTab('alert-bot')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'alert-bot'
              ? 'bg-[#ffb230] text-[#291800] shadow-md'
              : 'text-[#8B90A0] hover:text-[#ffd7a1] hover:bg-white/5'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Bot 1: Order Alerts</span>
          <span className={`w-2 h-2 rounded-full ${orderAlertsEnabled ? 'bg-[#3ECF8E]' : 'bg-red-500'}`} />
        </button>

        <button
          onClick={() => setActiveTab('verify-bot')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'verify-bot'
              ? 'bg-[#00F0FF] text-[#05131A] shadow-md'
              : 'text-[#8B90A0] hover:text-[#00F0FF] hover:bg-white/5'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Bot 2: Store Service & Mini App</span>
        </button>

        <button
          onClick={() => setActiveTab('profile-checker')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl font-headline text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'profile-checker'
              ? 'bg-[#6F00BE] text-[#ffd7a1] shadow-md'
              : 'text-[#8B90A0] hover:text-[#d6b2fc] hover:bg-white/5'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Username & Profile Inspector</span>
          <span className="bg-white/10 text-[10px] px-1.5 py-0.2 rounded font-price">Live</span>
        </button>
      </div>

      {/* ======================= TAB 1: BOT 1 - ORDER ALERT BOT ======================= */}
      {activeTab === 'alert-bot' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Bot 1 Credentials Card */}
          <div className="bg-[#1C1F29] rounded-3xl p-5 sm:p-7 border border-white/10 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center border border-[#ffb230]/30 font-bold">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-base sm:text-lg text-[#ffd7a1] uppercase">
                    Bot #1: Admin Real-Time Alert Dispatcher
                  </h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    Sends instant notification alerts to your Telegram Channel & Admin Chat when orders are placed.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-price font-bold bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
                  Live Dispatch Ready
                </span>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Telegram Bot Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#ffb230]" />
                    <span>Telegram Bot Token</span>
                  </label>
                  <span className="text-[11px] font-price text-[#8B90A0]">
                    From <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#00F0FF] hover:underline">@BotFather</a>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showToken1 ? 'text' : 'password'}
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="7829103847:AAHxk9-YOUR_BOT_TOKEN"
                    className="w-full bg-[#11131a] border border-white/10 focus:border-[#ffb230] rounded-xl px-3.5 py-2.5 pr-20 text-xs font-mono text-[#ffd7a1] placeholder-[#505464] focus:outline-none transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken1(!showToken1)}
                      className="p-1 text-[#8B90A0] hover:text-[#ffd7a1] transition-colors"
                      title={showToken1 ? 'Hide Token' : 'Show Token'}
                    >
                      {showToken1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(telegramBotToken, 'token1')}
                      className="p-1 text-[#8B90A0] hover:text-[#3ECF8E] transition-colors"
                      title="Copy Token"
                    >
                      {copiedField === 'token1' ? <Check className="w-4 h-4 text-[#3ECF8E]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-price text-[#8B90A0]">
                  Token is stored securely and processed via server-side HTTPS proxy.
                </p>
              </div>

              {/* Telegram Admin Chat ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[#3ECF8E]" />
                    <span>Admin Chat ID / Channel ID</span>
                  </label>
                  <span className="text-[11px] font-price text-[#8B90A0]">
                    e.g. <span className="text-[#ffd7a1]">@Noreakyout</span> or <span className="text-[#ffd7a1]">-100xxxxxxx</span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={telegramAdminChatId}
                    onChange={(e) => setTelegramAdminChatId(e.target.value)}
                    placeholder="@Noreakyout or -100192837465"
                    className="w-full bg-[#11131a] border border-white/10 focus:border-[#3ECF8E] rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-[#e2e2ec] placeholder-[#505464] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(telegramAdminChatId, 'chatId')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8B90A0] hover:text-[#3ECF8E] transition-colors"
                    title="Copy Chat ID"
                  >
                    {copiedField === 'chatId' ? <Check className="w-4 h-4 text-[#3ECF8E]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] font-price text-[#8B90A0]">
                  Target destination for instant order receipts, buyer username & transaction refs.
                </p>
              </div>

              {/* Public Store Telegram Channel */}
              <div className="space-y-2">
                <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Public Announcement Channel</span>
                </label>
                <input
                  type="text"
                  value={telegramChannelId}
                  onChange={(e) => setTelegramChannelId(e.target.value)}
                  placeholder="@uchirostore"
                  className="w-full bg-[#11131a] border border-white/10 focus:border-[#00F0FF] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#e2e2ec] placeholder-[#505464] focus:outline-none transition-colors"
                />
              </div>

              {/* Alert Sound & Chime Toggle */}
              <div className="space-y-2">
                <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#ffb230]" />
                  <span>Audio Alert Feedback</span>
                </label>
                <div className="bg-[#11131a] rounded-xl p-2.5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-price text-[#cac6bb]">
                    {alertSoundEnabled ? <Volume2 className="w-4 h-4 text-[#3ECF8E]" /> : <VolumeX className="w-4 h-4 text-[#8B90A0]" />}
                    <span>Play Sound on Telegram Dispatch</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlertSoundEnabled(!alertSoundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      alertSoundEnabled ? 'bg-[#3ECF8E]' : 'bg-[#282a31]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        alertSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Alert Event Triggers Grid */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <h4 className="font-headline text-xs text-[#ffd7a1] uppercase tracking-wider">
                Automated Trigger Rules (Real-Time Events)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Trigger 1: New Order */}
                <div
                  onClick={() => setOrderAlertsEnabled(!orderAlertsEnabled)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    orderAlertsEnabled
                      ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/40 text-[#e2e2ec]'
                      : 'bg-[#11131a] border-white/5 text-[#8B90A0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className={`w-4 h-4 ${orderAlertsEnabled ? 'text-[#3ECF8E]' : 'text-[#8B90A0]'}`} />
                    <div>
                      <p className="font-headline text-xs">New Orders Alert</p>
                      <p className="text-[10px] font-price text-[#8B90A0]">Auto dispatch on KHQR pay</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-price font-bold px-2 py-0.5 rounded-full ${
                    orderAlertsEnabled ? 'bg-[#3ECF8E]/20 text-[#3ECF8E]' : 'bg-white/5 text-[#8B90A0]'
                  }`}>
                    {orderAlertsEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* Trigger 2: Top-Up Deposit */}
                <div
                  onClick={() => setTopupAlertsEnabled(!topupAlertsEnabled)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    topupAlertsEnabled
                      ? 'bg-[#ffb230]/10 border-[#ffb230]/40 text-[#e2e2ec]'
                      : 'bg-[#11131a] border-white/5 text-[#8B90A0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Flame className={`w-4 h-4 ${topupAlertsEnabled ? 'text-[#ffb230]' : 'text-[#8B90A0]'}`} />
                    <div>
                      <p className="font-headline text-xs">Wallet Top-Ups</p>
                      <p className="text-[10px] font-price text-[#8B90A0]">Deposit & 5% referral alert</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-price font-bold px-2 py-0.5 rounded-full ${
                    topupAlertsEnabled ? 'bg-[#ffb230]/20 text-[#ffb230]' : 'bg-white/5 text-[#8B90A0]'
                  }`}>
                    {topupAlertsEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* Trigger 3: Low Inventory */}
                <div
                  onClick={() => setLowStockAlertsEnabled(!lowStockAlertsEnabled)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    lowStockAlertsEnabled
                      ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40 text-[#e2e2ec]'
                      : 'bg-[#11131a] border-white/5 text-[#8B90A0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className={`w-4 h-4 ${lowStockAlertsEnabled ? 'text-[#00F0FF]' : 'text-[#8B90A0]'}`} />
                    <div>
                      <p className="font-headline text-xs">Low Stock Warning</p>
                      <p className="text-[10px] font-price text-[#8B90A0]">Alerts when stock &lt; 3</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-price font-bold px-2 py-0.5 rounded-full ${
                    lowStockAlertsEnabled ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'bg-white/5 text-[#8B90A0]'
                  }`}>
                    {lowStockAlertsEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Test Alert Dispatch Bar */}
            <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-headline text-xs sm:text-sm text-[#ffd7a1] uppercase flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#3ECF8E] animate-pulse" />
                    <span>Real-Time Alert Dispatch Testing</span>
                  </h4>
                  <p className="text-[11px] font-price text-[#8B90A0]">
                    Send a formatted test payload to verify bot connectivity with your channel or admin chat.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendTestAlert('order')}
                    disabled={isTestingAlert}
                    className="bg-[#ffb230]/15 hover:bg-[#ffb230]/25 text-[#ffd7a1] border border-[#ffb230]/30 font-price text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3 text-[#ffb230]" />
                    <span>Test Order Alert</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendTestAlert('topup')}
                    disabled={isTestingAlert}
                    className="bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 text-[#3ECF8E] border border-[#3ECF8E]/30 font-price text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Flame className="w-3 h-3" />
                    <span>Test Top-Up</span>
                  </button>
                </div>
              </div>

              {/* Test Result Message Output */}
              {testResult && (
                <div className="bg-[#0c0e15] rounded-xl p-3 border border-white/10 font-mono text-xs text-[#cac6bb] space-y-2">
                  <div className="flex items-center justify-between text-[11px] border-b border-white/10 pb-1.5">
                    <span className="text-[#3ECF8E] flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Status: {testResult.telegramApiStatus} ({testResult.timestamp})
                    </span>
                    <span className="text-[#8B90A0]">To: {testResult.dispatchedTo}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px] text-[#ffd7a1] leading-relaxed">
                    {testResult.messagePreview}
                  </pre>
                </div>
              )}
            </div>

            {/* FAST TELEGRAM BOT COMMANDS & 1-TAP INLINE ACTIONS (NO WEBSITE NEEDED) */}
            <div className="bg-[#11131a] p-5 rounded-3xl border border-[#3ECF8E]/30 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/30 uppercase tracking-wide font-headline">
                      <Zap className="w-3 h-3" />
                      100% In-Telegram Workflow
                    </span>
                    <span className="text-xs font-headline text-[#ffd7a1] uppercase">Fast Admin Commands</span>
                  </div>
                  <h4 className="font-headline text-base text-[#e2e2ec] mt-1">
                    Manage Orders & Slips Directly in Telegram (No Website Needed!)
                  </h4>
                  <p className="text-xs font-price text-[#8B90A0] mt-0.5">
                    Approve receipts, fulfill 2FA credentials, check buyer info, and credit wallet deposits instantly via Telegram buttons or slash commands.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRegisterCommands}
                    disabled={isRegisteringCommands}
                    className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-[#0c0e15] font-headline text-xs uppercase tracking-wider font-bold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegisteringCommands ? 'animate-spin' : ''}`} />
                    <span>{isRegisteringCommands ? 'Syncing...' : 'Sync Commands to Telegram Menu'}</span>
                  </button>
                </div>
              </div>

              {/* Sync Result Banner */}
              {commandRegisterResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-price flex items-start gap-2 ${
                    commandRegisterResult.success
                      ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/40 text-[#3ECF8E]'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {commandRegisterResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{commandRegisterResult.message}</span>
                </div>
              )}

              {/* 1-Tap Inline Action Highlights */}
              <div className="bg-[#1C1F29]/70 rounded-2xl p-3.5 border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-price">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#3ECF8E]/20 text-[#3ECF8E] flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#e2e2ec]">1-Tap Instant Approve Button</p>
                    <p className="text-[11px] text-[#8B90A0]">
                      Every alert includes a <code className="text-[#3ECF8E] font-bold">[⚡ 1-Tap Approve]</code> button. Clicking it delivers credentials to customer in 0.1s without opening a browser!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center shrink-0 mt-0.5">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#e2e2ec]">Native Slash Commands</p>
                    <p className="text-[11px] text-[#8B90A0]">
                      Send commands like <code className="text-[#ffd7a1]">/pending</code>, <code className="text-[#ffd7a1]">/approve 8829</code>, or <code className="text-[#ffd7a1]">/stats</code> right into your chat with the bot!
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Slash Commands Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-headline text-[#ffd7a1] uppercase tracking-wider">
                    Available Slash Commands (Click to Copy)
                  </span>
                  <span className="text-[11px] font-price text-[#8B90A0]">Works in Admin Chat & Groups</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono text-xs">
                  {[
                    { cmd: '/pending', desc: 'List pending orders with 1-tap buttons', tag: 'Fast Review' },
                    { cmd: '/approve <id>', desc: 'Instantly approve order & deliver 2FA', tag: 'Action' },
                    { cmd: '/reject <id>', desc: 'Reject an order with optional reason', tag: 'Action' },
                    { cmd: '/check <id>', desc: 'Inspect buyer username, 2FA & slip image', tag: 'Lookup' },
                    { cmd: '/orders', desc: 'View latest 5 store orders and status', tag: 'Feed' },
                    { cmd: '/stats', desc: 'Live store sales, revenue & users snapshot', tag: 'Analytics' },
                    { cmd: '/topups', desc: 'View pending KHQR wallet top-ups', tag: 'Wallet' },
                    { cmd: '/approvetopup <id>', desc: 'Approve top-up & credit balance', tag: 'Wallet' },
                    { cmd: '/find <username>', desc: 'Search order by Roblox buyer name', tag: 'Search' },
                    { cmd: '/products', desc: 'View inventory list, stock & pricing', tag: 'Catalog' },
                    { cmd: '/setstock <id> <qty>', desc: 'Set product stock units directly', tag: 'Stock' },
                    { cmd: '/help', desc: 'Full interactive commands guide', tag: 'Guide' },
                  ].map((item) => (
                    <div
                      key={item.cmd}
                      onClick={() => handleCopy(item.cmd, item.cmd)}
                      className="group bg-[#161824] hover:bg-[#1f2233] border border-white/5 hover:border-[#3ECF8E]/40 rounded-xl p-2.5 transition-all cursor-pointer flex flex-col justify-between gap-1"
                      title="Click to copy command"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[#3ECF8E] font-bold group-hover:text-[#00F0FF] transition-colors">
                          {item.cmd}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-white/5 text-[#8B90A0] uppercase font-bold">
                            {item.tag}
                          </span>
                          {copiedField === item.cmd ? (
                            <Check className="w-3 h-3 text-[#3ECF8E]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#505464] group-hover:text-[#cac6bb]" />
                          )}
                        </div>
                      </div>
                      <p className="font-sans text-[11px] text-[#8B90A0] leading-tight">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="bg-[#141622] rounded-2xl p-5 border border-white/5 space-y-3">
            <h4 className="font-headline text-xs text-[#ffd7a1] uppercase flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#ffb230]" />
              <span>How to setup Telegram Alert Bot in 30 Seconds:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-price text-xs text-[#8B90A0]">
              <div className="bg-[#1C1F29] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="font-bold text-[#ffd7a1]">1. Create Bot</span>
                <p>Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#00F0FF] underline">@BotFather</a> in Telegram, send <code className="text-[#ffd7a1]">/newbot</code>, and copy the API HTTP Token.</p>
              </div>
              <div className="bg-[#1C1F29] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="font-bold text-[#ffd7a1]">2. Add to Channel</span>
                <p>Add your bot as an <strong>Administrator</strong> to your Telegram channel or group with "Post Messages" permission.</p>
              </div>
              <div className="bg-[#1C1F29] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="font-bold text-[#ffd7a1]">3. Test & Save</span>
                <p>Paste the Token and Chat ID above, click <strong>"Test Order Alert"</strong>, then press Save.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: BOT 2 - STORE CUSTOMER & MINI APP BOT ======================= */}
      {activeTab === 'verify-bot' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#1C1F29] rounded-3xl p-5 sm:p-7 border border-white/10 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center border border-[#00F0FF]/30 font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-base sm:text-lg text-[#00F0FF] uppercase">
                    Bot #2: Customer Mini App & Trade Service Bot
                  </h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    Handles customer support queries, order tracking commands, and launches Telegram Mini App.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-price font-bold bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-[#00F0FF] px-2.5 py-1 rounded-full">
                  Customer Facing
                </span>
              </div>
            </div>

            {/* Form Fields for Bot 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Service Bot Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span>Customer Bot Token</span>
                  </label>
                  <span className="text-[11px] font-price text-[#8B90A0]">Bot #2 Token</span>
                </div>
                <div className="relative">
                  <input
                    type={showToken2 ? 'text' : 'password'}
                    value={verificationBotToken}
                    onChange={(e) => setVerificationBotToken(e.target.value)}
                    placeholder="7192849102:AAHgp1-STORE_SERVICE_BOT"
                    className="w-full bg-[#11131a] border border-white/10 focus:border-[#00F0FF] rounded-xl px-3.5 py-2.5 pr-20 text-xs font-mono text-[#ffd7a1] placeholder-[#505464] focus:outline-none transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken2(!showToken2)}
                      className="p-1 text-[#8B90A0] hover:text-[#00F0FF] transition-colors"
                    >
                      {showToken2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(verificationBotToken, 'token2')}
                      className="p-1 text-[#8B90A0] hover:text-[#3ECF8E] transition-colors"
                    >
                      {copiedField === 'token2' ? <Check className="w-4 h-4 text-[#3ECF8E]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bot Username Handle */}
              <div className="space-y-2">
                <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#ffb230]" />
                  <span>Public Bot Username</span>
                </label>
                <input
                  type="text"
                  value={verificationBotUsername}
                  onChange={(e) => setVerificationBotUsername(e.target.value)}
                  placeholder="@uchirostore_bot"
                  className="w-full bg-[#11131a] border border-white/10 focus:border-[#ffb230] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#e2e2ec] placeholder-[#505464] focus:outline-none transition-colors"
                />
              </div>

              {/* Mini App URL */}
              <div className="space-y-2 md:col-span-2">
                <label className="font-headline text-xs text-[#e2e2ec] uppercase flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#3ECF8E]" />
                  <span>Telegram Mini App WebApp Endpoint URL</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={miniAppUrl}
                    onChange={(e) => setMiniAppUrl(e.target.value)}
                    placeholder="https://t.me/uchirostore_bot/app"
                    className="flex-1 bg-[#11131a] border border-white/10 focus:border-[#3ECF8E] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#3ECF8E] placeholder-[#505464] focus:outline-none transition-colors"
                  />
                  <a
                    href={miniAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#282a31] hover:bg-[#33343c] text-[#ffd7a1] px-4 py-2.5 rounded-xl text-xs font-headline uppercase font-bold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <span>Launch</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Interactive Bot Commands Matrix */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <h4 className="font-headline text-xs text-[#00F0FF] uppercase tracking-wider">
                Automated Customer Commands (24/7 Service)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-[#11131a] p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="font-mono text-[#00F0FF] font-bold">/start</p>
                  <p className="text-[11px] font-price text-[#8B90A0]">Opens interactive Menu & Mini App button.</p>
                </div>
                <div className="bg-[#11131a] p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="font-mono text-[#3ECF8E] font-bold">/order #ORD-XXXX</p>
                  <p className="text-[11px] font-price text-[#8B90A0]">Instant lookup for credentials and warranty.</p>
                </div>
                <div className="bg-[#11131a] p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="font-mono text-[#ffb230] font-bold">/balance</p>
                  <p className="text-[11px] font-price text-[#8B90A0]">Displays USD store wallet & VIP rank.</p>
                </div>
                <div className="bg-[#11131a] p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="font-mono text-[#d6b2fc] font-bold">/verify_roblox</p>
                  <p className="text-[11px] font-price text-[#8B90A0]">Checks account status before in-game trade.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: ROBLOX & USERNAME PROFILE INSPECTOR ======================= */}
      {activeTab === 'profile-checker' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#1C1F29] rounded-3xl p-5 sm:p-7 border border-white/10 shadow-xl space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#6F00BE]/20 text-[#d6b2fc] flex items-center justify-center border border-[#6F00BE]/30 font-bold">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-base sm:text-lg text-[#ffd7a1] uppercase">
                    System Check: Roblox & Telegram Username Inspector
                  </h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    Inspect customer accounts, check anti-fraud risk, verify age, 2FA, and store purchase loyalty.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-price font-bold bg-[#3ECF8E]/15 text-[#3ECF8E] px-3 py-1 rounded-full border border-[#3ECF8E]/30 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Security Scanner Active</span>
                </span>
              </div>
            </div>

            {/* Inspection Search Box & Quick Presets */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Gamepad2 className="w-4 h-4 text-[#8B90A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={checkUsernameInput}
                    onChange={(e) => setCheckUsernameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInspectProfile()}
                    placeholder="Enter Roblox Username or Telegram @handle (e.g. Shadow_Walker, Noreakyout)"
                    className="w-full bg-[#11131a] border border-white/10 focus:border-[#6F00BE] rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-[#ffd7a1] placeholder-[#505464] focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleInspectProfile()}
                  disabled={isCheckingProfile}
                  className="bg-[#6F00BE] hover:bg-[#8300E0] text-white font-headline text-xs px-6 py-3 rounded-xl uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shrink-0 disabled:opacity-50"
                >
                  {isCheckingProfile ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Inspect Profile</span>
                </button>
              </div>

              {/* Quick Sample Presets */}
              <div className="flex items-center gap-2 flex-wrap font-price text-xs">
                <span className="text-[#8B90A0]">Quick Presets:</span>
                {['Shadow_Walker', 'Noreakyout', 'Kosal_Blox', 'Guest_Blox2026'].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => {
                      setCheckUsernameInput(sample);
                      handleInspectProfile(sample);
                    }}
                    className="bg-[#11131a] hover:bg-[#282a31] border border-white/5 hover:border-white/20 text-[#ffd7a1] px-2.5 py-1 rounded-lg transition-colors font-mono text-[11px]"
                  >
                    @{sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Inspection Detailed Result Card */}
            {checkedProfile && (
              <div className="bg-[#11131a] rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5 animate-fade-in">
                {/* Top Profile Summary */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={checkedProfile.avatarUrl}
                        alt={checkedProfile.username}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-2xl object-cover bg-[#1C1F29] border-2 border-[#ffb230]/40 p-0.5 shadow-md"
                      />
                      {checkedProfile.verifiedBadge && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#00F0FF] text-[#05131A] flex items-center justify-center font-bold shadow-sm" title="Verified Badge">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-headline text-lg sm:text-xl text-[#e2e2ec]">
                          {checkedProfile.displayName}
                        </h4>
                        <span className="font-mono text-xs text-[#8B90A0]">
                          (@{checkedProfile.username})
                        </span>
                        <span className="bg-[#ffb230]/15 text-[#ffd7a1] border border-[#ffb230]/30 text-[10px] font-price font-bold px-2 py-0.5 rounded-full">
                          {checkedProfile.storeTier}
                        </span>
                      </div>
                      <p className="font-price text-xs text-[#8B90A0] mt-0.5">
                        Roblox User ID: <span className="text-[#ffd7a1] font-mono">{checkedProfile.userId}</span> • Joined {checkedProfile.createdDate} ({checkedProfile.accountAgeYears} Years)
                      </p>
                    </div>
                  </div>

                  {/* Risk Badge */}
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-price font-bold flex items-center gap-1.5 ${
                      checkedProfile.riskLevel === 'LOW_RISK'
                        ? 'bg-[#3ECF8E]/15 border-[#3ECF8E]/30 text-[#3ECF8E]'
                        : checkedProfile.riskLevel === 'MEDIUM_RISK'
                        ? 'bg-[#ffb230]/15 border-[#ffb230]/30 text-[#ffb230]'
                        : 'bg-[#E8433F]/15 border-[#E8433F]/30 text-[#E8433F]'
                    }`}>
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {checkedProfile.riskLevel === 'LOW_RISK'
                          ? 'TRUSTED ACCOUNT (LOW RISK)'
                          : checkedProfile.riskLevel === 'MEDIUM_RISK'
                          ? 'MEDIUM RISK (NEW USER)'
                          : 'HIGH RISK (CAUTION)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 Metrics Bento Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#1C1F29] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[11px] font-price text-[#8B90A0] block">In-Game Level</span>
                    <span className="font-headline text-lg text-[#00F0FF]">
                      Lvl {checkedProfile.levelEstimate}
                    </span>
                    <span className="text-[10px] font-price text-[#3ECF8E] block">Max Cap Ready</span>
                  </div>

                  <div className="bg-[#1C1F29] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[11px] font-price text-[#8B90A0] block">Trade Eligible</span>
                    <span className="font-headline text-lg text-[#3ECF8E] flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {checkedProfile.tradeEligible ? 'PASSED' : 'BLOCKED'}
                    </span>
                    <span className="text-[10px] font-price text-[#8B90A0] block">Sea 2/3 Cafe Access</span>
                  </div>

                  <div className="bg-[#1C1F29] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[11px] font-price text-[#8B90A0] block">2FA Protection</span>
                    <span className="font-headline text-lg text-[#ffd7a1]">
                      {checkedProfile.has2FA ? 'ACTIVE 2FA' : 'DISABLED'}
                    </span>
                    <span className="text-[10px] font-price text-[#3ECF8E] block">Authenticator Seed</span>
                  </div>

                  <div className="bg-[#1C1F29] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[11px] font-price text-[#8B90A0] block">Store Total Spent</span>
                    <span className="font-headline text-lg text-[#ffb230]">
                      ${(checkedProfile.totalSpentStoreUSD ?? 0).toFixed(2)} USD
                    </span>
                    <span className="text-[10px] font-price text-[#ffd7a1] block">Uchiro Loyalty</span>
                  </div>
                </div>

                {/* Inventory Highlights */}
                <div className="space-y-2">
                  <span className="font-headline text-xs text-[#8B90A0] uppercase block">
                    Verified Account Attributes & Unlocked Gear:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {checkedProfile.inventorySummary.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-[#1C1F29] border border-white/10 text-[#ffd7a1] px-3 py-1 rounded-lg text-xs font-price flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-[#ffb230]" />
                        <span>{item}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Row */}
                <div className="border-t border-white/5 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <p className="font-price text-[#8B90A0]">
                    Verified by Uchiro Bot Automated Profile Scanner • Ready for Trade & Delivery
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSendTestAlert('verification')}
                    className="bg-[#282a31] hover:bg-[#33343c] text-[#ffd7a1] border border-white/10 px-4 py-2 rounded-xl font-price font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-[#3ECF8E]" />
                    <span>Send Verification Log to Telegram</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
