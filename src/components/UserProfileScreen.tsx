import React, { useState } from 'react';
import { UserProfile, ActiveScreen } from '../types';
import {
  Shield,
  ShoppingBag,
  Lock,
  Link as LinkIcon,
  MessageCircle,
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Sparkles,
  Award,
  Crown,
  Gem,
  Check,
  TrendingUp,
  Gift,
  Copy,
  ExternalLink,
  Wallet,
  Zap,
  Edit3,
  Camera,
  User,
  Mail,
  Phone,
  FileText,
  X,
  KeyRound,
  AlertCircle,
  HelpCircle,
  CreditCard,
  Layers,
  LogOut,
  LogIn,
  Chrome,
  Upload,
} from 'lucide-react';
import { getMemberRankInfo, MEMBER_THRESHOLDS, verifyResellerCode } from '../utils/memberRank';
import { ensureRandomReferralCode } from '../utils/referral';
import confetti from 'canvas-confetti';
import { FirebaseUser, triggerPasswordReset, saveUsernameMapping } from '../lib/firebase';

const AVATAR_PRESETS = [
  {
    name: 'Shadow Walker',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCV3j4VML-lVWoaql9SA7mM_jmhuKq3z5ICBl-mVI5bBXY4pS6WXd_tOZ8PkLI9Vv6GTMIlFgnf6QiwoOszhs5DGGUxvMoqnDnVNcTWIVNnKjKcnKgs0JGbUZ78wivDcMmWXni4dGDPJt8dXFbjR_bo1eva4Fn3x0rjdiuE0uCrwJwO42IQR-gQYF6eCxZ9O628DwUDqFQ2o4-prFhIZqe0w2kVzDOM3ndfkRjW6WDgkdirsNk0roiB',
  },
  {
    name: 'Golden Dominus',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Cyber Samurai',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Anime Protagonist',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Valkyrie Warrior',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Neon Hacker',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
  },
];

interface UserProfileScreenProps {
  userProfile: UserProfile;
  setActiveScreen: (screen: ActiveScreen) => void;
  onOpenTopup: (defaultReferralCode?: string) => void;
  onGoHome: () => void;
  lang: 'KM' | 'EN';
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void> | void;
  onSimulateReferralBonus?: (friendName: string, amountUSD: number) => Promise<void> | void;
  onRedeemResellerCode?: (code: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string } | void;
  currentUser?: FirebaseUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  userProfile,
  setActiveScreen,
  onOpenTopup,
  onGoHome,
  lang,
  onUpdateProfile,
  onRedeemResellerCode,
  currentUser,
  onOpenAuth,
  onLogout,
}) => {
  const totalSpent = Number(userProfile?.totalSpentUSD) || 0;
  const isResellerUnlocked = !!userProfile?.isResellerUnlocked || totalSpent >= MEMBER_THRESHOLDS.RESELLER;
  const rankInfo = getMemberRankInfo(totalSpent, isResellerUnlocked);

  const referralCode = ensureRandomReferralCode(userProfile?.referralCode);

  // Modals & Drawers
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showMemberTiersModal, setShowMemberTiersModal] = useState(false);
  const [showResellerRedeemModal, setShowResellerRedeemModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit Profile Form State
  const [editDisplayName, setEditDisplayName] = useState(userProfile.displayName || userProfile.username || '');
  const [editUsername, setEditUsername] = useState(userProfile.username || '');
  const [editEmail, setEditEmail] = useState(userProfile.email || '');
  const [editPhone, setEditPhone] = useState(userProfile.phone || '');
  const [editBio, setEditBio] = useState(userProfile.bio || 'Roblox & Blox Fruits Enthusiast • Uchiro VIP');
  const [editAvatarUrl, setEditAvatarUrl] = useState(userProfile.avatarUrl || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Reseller Code Redeem States
  const [resellerCodeInput, setResellerCodeInput] = useState('');
  const [isRedeemingRank, setIsRedeemingRank] = useState(false);
  const [redeemRankStatus, setRedeemRankStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Firebase Auth & Password Reset states
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailNotice, setResetEmailNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSendPasswordResetFromProfile = async () => {
    const targetEmail = currentUser?.email || userProfile.email;
    if (!targetEmail) {
      setResetEmailNotice({
        type: 'error',
        text: lang === 'KM' ? 'មិនមានអ៊ីមែលសម្រាប់ផ្ញើទេ!' : 'No email address available!',
      });
      return;
    }
    setIsSendingResetEmail(true);
    setResetEmailNotice(null);
    try {
      await triggerPasswordReset(targetEmail);
      setResetEmailNotice({
        type: 'success',
        text:
          lang === 'KM'
            ? `តំណភ្ជាប់ផ្លាស់ប្តូរពាក្យសម្ងាត់ត្រូវបានផ្ញើទៅកាន់ ${targetEmail}! សូមពិនិត្យមើល Inbox និង Spam។`
            : `Password reset email sent to ${targetEmail}! Check your inbox and spam folder.`,
      });
      setTimeout(() => setResetEmailNotice(null), 6000);
    } catch (err: any) {
      setResetEmailNotice({
        type: 'error',
        text: err?.message || 'Failed to send reset email.',
      });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const adminTelegramUsername = 'Noreakyout';
  const telegramApplyMessage = encodeURIComponent(
    `Hello Admin Noreakyout! I want to request an official VIP Reseller Rank Redeem Code for my account @${userProfile.username}.`
  );
  const adminTelegramUrl = `https://t.me/${adminTelegramUsername}?text=${telegramApplyMessage}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setEditAvatarUrl(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const targetEmail = editEmail.trim() || currentUser?.email || userProfile.email || '';
    // Username is immutable and cannot be changed once created.
    // Explicitly omit username from updates payload.
    const updates: Partial<UserProfile> = {
      displayName: editDisplayName.trim() || userProfile.displayName || userProfile.username,
      email: targetEmail,
      phone: editPhone.trim(),
      bio: editBio.trim(),
      avatarUrl: editAvatarUrl.trim() || userProfile.avatarUrl,
    };

    try {
      if (onUpdateProfile) {
        await onUpdateProfile(updates);
      }
      setShowEditProfileModal(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRedeemResellerRank = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = resellerCodeInput.trim().toUpperCase();
    if (!code) return;

    setIsRedeemingRank(true);
    setRedeemRankStatus({ type: null, message: '' });

    try {
      if (onRedeemResellerCode) {
        const res = await onRedeemResellerCode(code);
        if (res && res.success === false) {
          setRedeemRankStatus({
            type: 'error',
            message:
              res.message ||
              (lang === 'KM'
                ? 'កូដ Reseller មិនត្រឹមត្រូវទេ។ សូមទាក់ទង Admin លើ Telegram (@uchirostore) ដើម្បីស្នើសុំកូដ!'
                : 'Invalid Reseller Code. Please contact Admin on Telegram (@uchirostore) to request a valid VIP code!'),
          });
          return;
        }
      } else {
        const isValid = verifyResellerCode(code);
        if (!isValid) {
          setRedeemRankStatus({
            type: 'error',
            message:
              lang === 'KM'
                ? 'កូដ Reseller មិនត្រឹមត្រូវទេ។ សូមទាក់ទង Admin លើ Telegram (@uchirostore) ដើម្បីស្នើសុំកូដ!'
                : 'Invalid Reseller Code. Please contact Admin on Telegram (@uchirostore) to request a valid VIP code!',
          });
          return;
        }
      }

      setRedeemRankStatus({
        type: 'success',
        message:
          lang === 'KM'
            ? '🎉 អបអរសាទរ! អ្នកបានបើកដំណើរការឋានៈ Reseller VIP ជោគជ័យហើយ (ទទួលបានការបញ្ចុះតម្លៃ ២០% គ្រប់មុខទំនិញ)!'
            : '🎉 Congratulations! You have successfully unlocked Reseller VIP Rank (20% Auto Discount on all products)!',
      });
      setResellerCodeInput('');

      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF007A', '#9B51E0', '#00F0FF', '#ffb230'],
        });
      } catch {}
    } catch (err: any) {
      setRedeemRankStatus({
        type: 'error',
        message: err?.message || 'Failed to redeem code. Please try again or contact Admin.',
      });
    } finally {
      setIsRedeemingRank(false);
    }
  };

  // If user is logged out, restrict access and require login
  if (!currentUser) {
    return (
      <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-3 sm:px-4 md:px-8 max-w-lg mx-auto flex flex-col gap-5 sm:gap-6 animate-fade-in">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onGoHome}
            className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shadow-md"
            title="Back to Store"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-user font-extrabold text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
            {lang === 'KM' ? 'គណនីរបស់អ្នក' : 'MY ACCOUNT'}
          </h1>
        </div>

        {/* Lock / Sign In Required Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-[#ffb230]/20 to-[#ffb230]/5 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230] mb-4 shadow-[0_0_25px_rgba(255,178,48,0.2)]">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="font-headline font-bold text-xl sm:text-2xl text-[#e2e2ec] mb-2 tracking-wide">
            {lang === 'KM' ? 'សូមចូលគណនីដើម្បីមើលព័ត៌មាន' : 'Account Sign-In Required'}
          </h2>

          <p className="text-xs sm:text-sm text-[#8B90A0] font-price leading-relaxed max-w-sm mb-6">
            {lang === 'KM'
              ? 'ព័ត៌មានគណនីផ្ទាល់ខ្លួន សមតុល្យកាបូប ប្រវត្តិបញ្ជាទិញ និងសិទ្ធិ VIP ត្រូវបានរក្សាការសម្ងាត់។ សូមចូលគណនី ឬចុះឈ្មោះដើម្បីចូលមើល។'
              : 'Your personal wallet balance, VIP member perks, order history, and account settings are private. Please sign in or create an account to view and manage your account.'}
          </p>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-2.5">
            <button
              id="profile-login-gate-btn"
              onClick={onOpenAuth}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#ffb230] to-[#ff9e00] hover:from-[#ffbe4d] hover:to-[#ffb230] text-[#291800] font-headline font-extrabold text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,178,48,0.35)] transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{lang === 'KM' ? 'ចូលប្រើប្រាស់ / ចុះឈ្មោះ' : 'Sign In or Create Account'}</span>
            </button>

            <button
              onClick={onGoHome}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 text-[#cac6bb] hover:text-white font-user font-semibold text-xs tracking-wide transition-all cursor-pointer"
            >
              {lang === 'KM' ? 'ត្រឡប់ទៅទំព័រទំនិញ' : 'Back to Store'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-3 sm:px-4 md:px-8 max-w-3xl mx-auto flex flex-col gap-5 sm:gap-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onGoHome}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shadow-md"
          title="Back to Store"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-user font-extrabold text-xl sm:text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
          {lang === 'KM' ? 'គណនីរបស់ខ្ញុំ' : 'MY ACCOUNT'}
        </h1>
      </div>

      {/* 1. User Header Profile Card */}
      <section className="glass-panel rounded-3xl p-6 sm:p-7 flex flex-col items-center text-center relative overflow-hidden border border-white/10 shadow-2xl">
        <div className="relative mb-3 group">
          <img
            src={userProfile.avatarUrl}
            alt="Profile Avatar"
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 ${rankInfo.avatarBorder} shadow-lg`}
          />
          <div className="absolute bottom-1 right-1 bg-[#3ECF8E] w-5 h-5 rounded-full border-2 border-[#1C1F29]" />
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[#1C1F29] border border-white/20 flex items-center justify-center shadow-lg text-sm">
            {rankInfo.icon}
          </div>

          <button
            onClick={() => {
              setEditDisplayName(userProfile.displayName || userProfile.username || '');
              setEditUsername(userProfile.username || '');
              setEditEmail(userProfile.email || '');
              setEditPhone(userProfile.phone || '');
              setEditBio(userProfile.bio || 'Roblox & Blox Fruits Enthusiast • Uchiro VIP');
              setEditAvatarUrl(userProfile.avatarUrl || '');
              setShowEditProfileModal(true);
            }}
            className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-user font-bold cursor-pointer"
            title="Change Avatar & Info"
          >
            <Camera className="w-6 h-6 mb-1 text-[#ffb230]" />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Direct File Upload for Profile Picture */}
        <div className="mb-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1C1F29] hover:bg-[#282a31] text-xs font-user font-semibold text-[#ffd7a1] hover:text-[#ffb230] border border-white/10 hover:border-[#ffb230]/40 transition-all active:scale-95 shadow-sm">
            <Upload className="w-3.5 h-3.5 text-[#ffb230]" />
            <span>{lang === 'KM' ? 'ប្តូររូបភាពគណនី (Upload Photo)' : 'Change Profile Picture'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (uploadEvent) => {
                    const base64 = uploadEvent.target?.result as string;
                    if (base64 && onUpdateProfile) {
                      onUpdateProfile({
                        ...userProfile,
                        avatarUrl: base64,
                      });
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <h2 className="font-user font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            {userProfile.displayName || `@${userProfile.username}`}
          </h2>
          <button
            onClick={() => {
              setEditDisplayName(userProfile.displayName || userProfile.username || '');
              setEditUsername(userProfile.username || '');
              setEditEmail(userProfile.email || '');
              setEditPhone(userProfile.phone || '');
              setEditBio(userProfile.bio || 'Roblox & Blox Fruits Enthusiast • Uchiro VIP');
              setEditAvatarUrl(userProfile.avatarUrl || '');
              setShowEditProfileModal(true);
            }}
            className="text-[#8B90A0] hover:text-[#ffb230] p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Edit Profile Settings"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        {/* Username & Referral Code ជាប់គ្នា (Together) */}
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <span className="font-price text-xs text-[#ffb230] bg-[#ffb230]/10 border border-[#ffb230]/25 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
            <User className="w-3.5 h-3.5 text-[#ffb230]" />
            <span>@{userProfile.username}</span>
          </span>

          <span className="font-mono text-xs text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
            <Gift className="w-3.5 h-3.5 text-[#3ECF8E]" />
            <span>REF: {referralCode}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(referralCode);
                setCopiedCode(true);
                try {
                  confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
                } catch {}
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="ml-1 text-[#3ECF8E]/80 hover:text-[#3ECF8E] transition-colors cursor-pointer"
              title={lang === 'KM' ? 'ចម្លងកូដណែនាំ' : 'Copy Referral Code'}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </span>
        </div>

        {userProfile.bio && (
          <p className="font-user text-xs sm:text-sm text-[#cac6bb] mt-2 max-w-md italic font-normal leading-relaxed">
            "{userProfile.bio}"
          </p>
        )}

        {/* Dynamic Member Rank Badge & Modal Trigger */}
        <div className="flex items-center gap-2 mt-3.5 flex-wrap justify-center">
          <div
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-user font-bold border uppercase tracking-wider ${rankInfo.chipClass}`}
          >
            <span className="text-sm">{rankInfo.icon}</span>
            <span>{lang === 'KM' ? rankInfo.badgeLabelKhmer : rankInfo.title}</span>
          </div>

          <button
            onClick={() => setShowMemberTiersModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-user font-semibold bg-[#ffb230]/15 hover:bg-[#ffb230]/25 text-[#ffd7a1] border border-[#ffb230]/30 transition-all active:scale-95 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-[#ffb230]" />
            <span>{lang === 'KM' ? 'មើលកម្រិត VIP ទាំងអស់' : 'View Member Tiers'}</span>
          </button>
        </div>

        {userProfile.email && (
          <div className="flex items-center gap-4 text-xs font-user text-[#8B90A0] mt-3 pt-3 border-t border-white/5 w-full justify-center">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#ffb230]" />
              <span>{userProfile.email}</span>
            </span>
          </div>
        )}
      </section>

      {/* 2. Wallet Balance & Fast Top-Up Card */}
      <section className="bg-gradient-to-r from-[#1C1F29] to-[#141620] rounded-3xl p-5 sm:p-6 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#ffb230]/15 text-[#ffb230] border border-[#ffb230]/30 flex items-center justify-center shadow-md shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="font-user font-bold text-xs text-[#8B90A0] uppercase tracking-wider block">
              {lang === 'KM' ? 'សមតុល្យកាបូប (USD)' : 'WALLET BALANCE (USD)'}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-user font-extrabold text-3xl sm:text-4xl text-[#ffd7a1]">
                ${(userProfile?.balanceUSD ?? 0).toFixed(2)}
              </span>
              <span className="font-user text-xs text-[#3ECF8E] font-bold uppercase tracking-wide">USD Available</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => onOpenTopup()}
            className="flex-1 sm:flex-none bg-[#3ECF8E] hover:bg-[#48de9a] text-[#003822] font-user text-sm px-5 py-3 rounded-2xl uppercase tracking-wider font-extrabold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'KM' ? 'បញ្ចូលលុយ' : 'Top Up'}</span>
          </button>

          <button
            onClick={() => setActiveScreen('my-orders')}
            className="flex-1 sm:flex-none bg-[#282a31] hover:bg-[#33343c] border border-white/10 text-[#ffd7a1] font-user text-sm px-4 py-3 rounded-2xl uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{lang === 'KM' ? 'ការបញ្ជាទិញ' : 'Orders'}</span>
          </button>
        </div>
      </section>

      {/* 3. Streamlined Clean VIP Status Summary (Easy View Modal, No Spam) */}
      <section className="bg-[#181A24] rounded-3xl p-5 sm:p-6 border border-white/10 relative overflow-hidden shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl ${rankInfo.bgColor} flex items-center justify-center text-2xl border ${rankInfo.borderColor} shrink-0 shadow-sm`}>
              {rankInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-user font-bold text-base sm:text-lg text-white tracking-normal">
                  {lang === 'KM' ? 'ឋានៈសមាជិកភាព VIP' : 'VIP Membership Rank'}
                </h3>
                <span className={`text-[11px] font-user font-bold px-2.5 py-0.5 rounded-full border uppercase ${rankInfo.chipClass}`}>
                  {rankInfo.badgeLabel}
                </span>
              </div>
              <p className="font-user text-xs sm:text-sm text-[#8B90A0] mt-0.5">
                {rankInfo.autoDiscountPercent > 0 ? (
                  <span className="text-[#3ECF8E] font-bold">
                    ✨ {rankInfo.autoDiscountPercent}% Auto Discount on all store items!
                  </span>
                ) : (
                  <span>Reach $30.00 spent to unlock 5% automatic discount</span>
                )}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-[#13151D] px-4 py-2.5 rounded-2xl border border-white/5 w-full sm:w-auto">
            <span className="font-user text-[11px] text-[#8B90A0] uppercase font-semibold block tracking-wider">Lifetime Spent</span>
            <span className="font-price text-xl text-[#3ECF8E] font-bold">
              ${totalSpent.toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Compact Progress to Next Tier */}
        <div className="bg-[#13151D] p-4 rounded-2xl border border-white/5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs sm:text-sm font-user">
            <div className="text-[#cac6bb] flex items-center gap-1.5 flex-wrap">
              <TrendingUp className="w-4 h-4 text-[#ffb230] shrink-0" />
              {rankInfo.nextTier ? (
                <span>
                  {lang === 'KM' ? 'កម្រិតបន្ទាប់:' : 'Next Rank:'}{' '}
                  <strong className="text-[#ffb230] font-bold">
                    {rankInfo.nextTier} ({rankInfo.nextTier === 'Reseller' ? '20% OFF' : rankInfo.nextTier === 'Diamond' ? '10% OFF' : '5% OFF'})
                  </strong>
                </span>
              ) : (
                <span className="text-[#FF007A] font-bold">
                  💼 Top VIP Reseller Rank (20% OFF)
                </span>
              )}
            </div>

            {rankInfo.nextTier && (
              <div className="text-[#8B90A0] text-xs font-user font-medium">
                {lang === 'KM' ? 'ត្រូវការ:' : 'Need:'} <strong className="text-[#3ECF8E] font-bold font-price">${(rankInfo.amountNeededForNextTier || 0).toFixed(2)} USD</strong>
              </div>
            )}
          </div>

          <div className="w-full bg-[#1C1F29] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${rankInfo.gradient}`}
              style={{ width: `${Math.max(6, rankInfo.progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Quick Action Buttons for Member Roadmap & Reseller Code */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            onClick={() => setShowMemberTiersModal(true)}
            className="flex-1 bg-[#282a31] hover:bg-[#33353e] text-[#ffd7a1] border border-white/10 px-4 py-3 rounded-xl font-user text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
          >
            <Award className="w-4 h-4 text-[#ffb230] shrink-0" />
            <span>{lang === 'KM' ? 'ចុចមើលអត្ថប្រយោជន៍ Member ទាំងអស់' : 'View Member Perks & Roadmap'}</span>
          </button>

          <button
            onClick={() => setShowResellerRedeemModal(true)}
            className="bg-[#FF007A]/15 hover:bg-[#FF007A]/25 text-[#FF007A] border border-[#FF007A]/35 px-4 py-3 rounded-xl font-user text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span>{isResellerUnlocked ? (lang === 'KM' ? 'Reseller VIP សកម្ម' : 'Reseller VIP Active') : (lang === 'KM' ? 'បញ្ចូលកូដ Reseller VIP' : 'Redeem Reseller Code')}</span>
          </button>
        </div>
      </section>

      {/* 4. Account Settings & Management Links */}
      <section className="flex flex-col gap-2.5">
        <h3 className="font-user font-bold text-xs sm:text-sm text-[#ffd7a1] uppercase tracking-wider px-1">
          {lang === 'KM' ? 'ការកំណត់ និងការគ្រប់គ្រង' : 'Settings & Management'}
        </h3>

        <div className="bg-[#1C1F29] rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
          {/* Edit Profile & Logo */}
          <button
            onClick={() => {
              setEditDisplayName(userProfile.displayName || userProfile.username || '');
              setEditUsername(userProfile.username || '');
              setEditEmail(userProfile.email || '');
              setEditPhone(userProfile.phone || '');
              setEditBio(userProfile.bio || 'Roblox & Blox Fruits Enthusiast • Uchiro VIP');
              setEditAvatarUrl(userProfile.avatarUrl || '');
              setShowEditProfileModal(true);
            }}
            className="w-full p-4 flex items-center justify-between hover:bg-[#282a31] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ffb230]/15 text-[#ffb230] flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-user text-sm font-bold text-[#e2e2ec]">
                  {lang === 'KM' ? 'កែប្រែព័ត៌មាន និងរូបតំណាង (Logo & Info)' : 'Edit Profile Logo & Information'}
                </p>
                <p className="font-user text-xs text-[#8B90A0]">
                  {lang === 'KM' ? 'ប្តូររូបភាព Profile, ឈ្មោះ, Email, Telegram' : 'Change avatar logo, display name, contact info, bio'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8B90A0]" />
          </button>

          {/* My Orders */}
          <button
            onClick={() => setActiveScreen('my-orders')}
            className="w-full p-4 flex items-center justify-between hover:bg-[#282a31] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#3ECF8E]/15 text-[#3ECF8E] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="font-user text-sm font-bold text-[#e2e2ec]">
                  {lang === 'KM' ? 'ការបញ្ជាទិញរបស់ខ្ញុំ' : 'My Orders & Deliveries'}
                </p>
                <p className="font-user text-xs text-[#8B90A0]">
                  {lang === 'KM' ? 'ប្រវត្តិទិញ & ព័ត៌មានគណនី Roblox' : 'View order history & instant account credentials'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8B90A0]" />
          </button>

          {/* Security & 2FA */}
          <button
            onClick={() => setActiveScreen('security')}
            className="w-full p-4 flex items-center justify-between hover:bg-[#282a31] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#6F00BE]/20 text-[#d6b2fc] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-user text-sm font-bold text-[#e2e2ec]">
                  {lang === 'KM' ? 'សុវត្ថិភាព & 2FA' : 'Security & 2FA Authentication'}
                </p>
                <p className="font-user text-xs text-[#8B90A0]">
                  {lang === 'KM' ? 'ប្រព័ន្ធផ្ទៀងផ្ទាត់ 2FA, ឧបករណ៍សកម្ម' : 'Two-factor authenticator, sessions, passwords'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8B90A0]" />
          </button>

          {/* Customer Support */}
          <a
            href="https://t.me/Noreakyout"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-4 flex items-center justify-between hover:bg-[#282a31] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-sans text-sm font-semibold text-[#e2e2ec]">
                  {lang === 'KM' ? 'សេវាបម្រើអតិថិជន ២៤/៧ (Telegram @Noreakyout)' : '24/7 Admin Support (Telegram @Noreakyout)'}
                </p>
                <p className="font-price text-xs text-[#8B90A0]">
                  {lang === 'KM' ? 'ជំនួយរហ័សសម្រាប់អ្នកលេងនៅកម្ពុជា' : 'Direct contact with store administrator'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8B90A0]" />
          </a>

          {/* Firebase Authentication & Cloud Sync Card */}
          <div className="p-4 bg-[#161822] border-t border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-sans text-xs font-bold text-[#e2e2ec] flex items-center gap-1.5">
                    <span>{lang === 'KM' ? 'គណនី Firebase & ការពារទិន្នន័យ' : 'Firebase Cloud Account'}</span>
                    {currentUser ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#3ECF8E]/20 text-[#3ECF8E] font-price">
                        {lang === 'KM' ? 'បានភ្ជាប់' : 'Active'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#8B90A0]/20 text-[#8B90A0] font-price">
                        {lang === 'KM' ? 'ភ្ញៀវ (Guest)' : 'Guest'}
                      </span>
                    )}
                  </h4>
                  <p className="font-price text-[11px] text-[#8B90A0]">
                    {currentUser
                      ? `${currentUser.email || currentUser.displayName || 'Player'} • UID: ${currentUser.uid.slice(0, 8)}...`
                      : (lang === 'KM' ? 'ចូលប្រើដើម្បីរក្សាទុកសមតុល្យ និងការទិញ' : 'Sign in to keep balance & order history safe')}
                  </p>
                </div>
              </div>

              {currentUser && currentUser.providerData?.[0]?.providerId === 'google.com' && (
                <div className="flex items-center gap-1 text-[11px] font-price text-[#ffd7a1] bg-[#1C1F29] px-2 py-1 rounded-lg border border-white/5">
                  <Chrome className="w-3.5 h-3.5 text-[#ffb230]" />
                  <span>Google</span>
                </div>
              )}
            </div>

            {/* Notification alert if password reset triggered */}
            {resetEmailNotice && (
              <div
                className={`p-2.5 rounded-xl text-xs font-price flex items-start gap-2 ${
                  resetEmailNotice.type === 'success'
                    ? 'bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#a6f0cc]'
                    : 'bg-[#E8433F]/15 border border-[#E8433F]/40 text-[#ffb2b0]'
                }`}
              >
                {resetEmailNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#3ECF8E] mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#E8433F] mt-0.5" />
                )}
                <span className="flex-1">{resetEmailNotice.text}</span>
              </div>
            )}

            {/* Buttons depending on Auth status */}
            {currentUser ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  id="profile-reset-pass-btn"
                  onClick={handleSendPasswordResetFromProfile}
                  disabled={isSendingResetEmail}
                  className="flex-1 min-w-[140px] py-2 px-3 bg-[#282a31] hover:bg-[#33353e] text-[#ffd7a1] border border-white/10 rounded-xl font-price text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer disabled:opacity-50"
                  title="Send password reset link to your email"
                >
                  <Mail className="w-3.5 h-3.5 text-[#ffb230]" />
                  <span>
                    {isSendingResetEmail
                      ? (lang === 'KM' ? 'កំពុងផ្ញើ...' : 'Sending...')
                      : (lang === 'KM' ? 'ប្តូរពាក្យសម្ងាត់តាម Email' : 'Reset Password via Email')}
                  </span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    id="profile-logout-btn"
                    onClick={onLogout}
                    className="py-2 px-3.5 bg-[#E8433F]/15 hover:bg-[#E8433F]/25 text-[#E8433F] border border-[#E8433F]/30 rounded-xl font-price text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{lang === 'KM' ? 'ចាកចេញ (Log Out)' : 'Log Out'}</span>
                  </button>
                )}
              </div>
            ) : (
              onOpenAuth && (
                <button
                  type="button"
                  id="profile-signin-btn"
                  onClick={onOpenAuth}
                  className="w-full py-2.5 bg-[#ffb230] hover:bg-[#ffbe4d] text-[#291800] rounded-xl font-headline font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(255,178,48,0.25)] transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{lang === 'KM' ? 'ចូលប្រើ / បង្កើតគណនី (Sign In / Register)' : 'Sign In or Create Account'}</span>
                </button>
              )
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT PROFILE & AVATAR LOGO MODAL */}
      {/* ========================================================================= */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="max-w-md w-full bg-[#181A24] rounded-3xl p-6 border border-white/15 shadow-2xl space-y-5 animate-[scaleIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[#ffd7a1]">
                <Edit3 className="w-5 h-5 text-[#ffb230]" />
                <h3 className="font-user font-bold text-lg">
                  {lang === 'KM' ? 'កែប្រែគណនី & រូបតំណាង' : 'Edit Profile & Logo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="text-[#8B90A0] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Logo Preview & Selector */}
              <div className="flex flex-col items-center gap-3 bg-[#11131A] p-4 rounded-2xl border border-white/5">
                <div className="relative group">
                  <img
                    src={editAvatarUrl || userProfile.avatarUrl}
                    alt="Preview Avatar"
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#ffb230] shadow-md"
                  />
                  <label className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-[#ffb230]" />
                    <span className="text-[10px] font-bold font-user">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="w-full text-center">
                  <label className="font-user text-xs text-[#8B90A0] block font-bold mb-1.5">
                    Pick a Preset Gamer Avatar:
                  </label>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditAvatarUrl(preset.url)}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${
                          editAvatarUrl === preset.url ? 'border-[#ffb230] scale-110 shadow-md' : 'border-white/10 opacity-70 hover:opacity-100'
                        }`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full pt-1 flex justify-center">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1F29] hover:bg-[#282a31] text-xs font-user font-semibold text-[#ffd7a1] hover:text-[#ffb230] border border-white/10 hover:border-[#ffb230]/40 transition-all active:scale-95 shadow-sm">
                    <Upload className="w-3.5 h-3.5 text-[#ffb230]" />
                    <span>{lang === 'KM' ? 'ជ្រើសរើសរូបពីឧបករណ៍' : 'Upload photo from device'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="font-user text-xs text-[#8B90A0] block mb-1 font-bold">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8B90A0] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="e.g. Shadow Gamer"
                    className="w-full bg-[#11131A] text-[#e2e2ec] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-sm font-user focus:border-[#ffb230] outline-none"
                  />
                  {editDisplayName && (
                    <button
                      type="button"
                      onClick={() => setEditDisplayName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-[#cac6bb] hover:text-white flex items-center justify-center text-[10px] transition-colors"
                      title="Clear display name"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Username (Strictly Immutable & Disabled) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-user text-xs text-[#8B90A0] font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#ffb230]" />
                    <span>{lang === 'KM' ? 'ឈ្មោះអ្នកលេង (Username)' : 'Username'}</span>
                  </label>
                  <span className="text-[10px] text-[#8B90A0] font-mono font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-[#8B90A0]" />
                    {lang === 'KM' ? 'មិនអាចកែប្រែបាន' : 'Fixed'}
                  </span>
                </div>
                <div className="relative">
                  <span className="text-xs font-user text-[#8B90A0] absolute left-3 top-1/2 -translate-y-1/2 font-bold">@</span>
                  <input
                    type="text"
                    value={userProfile.username}
                    disabled
                    readOnly
                    className="w-full bg-[#0d0f15] text-[#8B90A0] border border-white/5 rounded-xl pl-8 pr-4 py-2 text-sm font-user cursor-not-allowed font-mono select-none opacity-80"
                  />
                </div>
                <p className="text-[11px] text-[#8B90A0] mt-1.5 font-user flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#ffb230] shrink-0" />
                  <span className="text-[#cac6bb]">
                    {lang === 'KM'
                      ? 'ឈ្មោះអ្នកប្រើប្រាស់មិនអាចផ្លាស់ប្តូរបានទេ (Username cannot be changed).'
                      : 'Username cannot be changed.'}
                  </span>
                </p>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-user text-xs text-[#8B90A0] block mb-1 font-bold">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#8B90A0] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-[#11131A] text-[#e2e2ec] border border-white/10 rounded-xl pl-8 pr-2 py-2 text-xs font-user focus:border-[#ffb230] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-user text-xs text-[#8B90A0] block mb-1 font-bold">
                    Phone / Telegram
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#8B90A0] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+855 ..."
                      className="w-full bg-[#11131A] text-[#e2e2ec] border border-white/10 rounded-xl pl-8 pr-2 py-2 text-xs font-user focus:border-[#ffb230] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="font-user text-xs text-[#8B90A0] block mb-1 font-bold">
                  Bio / Player Motto
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  placeholder="Tell others about your Roblox rank or favorite fruits..."
                  className="w-full bg-[#11131A] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-user focus:border-[#ffb230] outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 bg-[#282a31] hover:bg-[#33353e] text-[#cac6bb] py-2.5 rounded-xl font-user text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] py-2.5 rounded-xl font-user text-xs font-bold chunky-btn-gold transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MEMBER TIERS & BENEFITS MODAL (Easy to view, no spam) */}
      {/* ========================================================================= */}
      {showMemberTiersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="max-w-lg w-full bg-[#181A24] rounded-3xl p-6 border border-white/15 shadow-2xl space-y-4 animate-[scaleIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[#ffd7a1]">
                <Layers className="w-5 h-5 text-[#ffb230]" />
                <div>
                  <h3 className="font-user font-bold text-lg">
                    {lang === 'KM' ? 'តារាងឋានៈសមាជិក VIP' : 'VIP Member Tier Benefits'}
                  </h3>
                  <p className="font-user text-xs text-[#8B90A0]">Automatic discounts apply at checkout</p>
                </div>
              </div>
              <button
                onClick={() => setShowMemberTiersModal(false)}
                className="text-[#8B90A0] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Clean Tier Cards */}
            <div className="space-y-3">
              {/* Member Tier */}
              <div className={`p-4 rounded-2xl border transition-all ${rankInfo.tier === 'Member' ? 'bg-white/10 border-white/30 shadow-md' : 'bg-[#11131A] border-white/5 opacity-80'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <span className="font-user text-sm text-[#e2e2ec] font-bold">MEMBER TIER</span>
                  </div>
                  <span className="font-user text-xs text-[#8B90A0] font-medium">$0 – $30.00 Spent</span>
                </div>
                <ul className="mt-2 text-xs font-user text-[#cac6bb] space-y-1 pl-6 list-disc">
                  <li>Standard store access & instant 2FA credentials</li>
                  <li>Automated KHQR checkout with Cambodia banks</li>
                </ul>
              </div>

              {/* Gold Tier */}
              <div className={`p-4 rounded-2xl border transition-all ${rankInfo.tier === 'Gold' ? 'bg-[#ffb230]/15 border-[#ffb230]/50 shadow-lg' : 'bg-[#11131A] border-white/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👑</span>
                    <span className="font-user text-sm text-[#ffd7a1] font-bold">GOLD MEMBER (5% OFF)</span>
                  </div>
                  <span className="font-user text-xs text-[#ffb230] font-bold">Over $30.00 Spent</span>
                </div>
                <ul className="mt-2 text-xs font-user text-[#cac6bb] space-y-1 pl-6 list-disc">
                  <li><strong className="text-[#3ECF8E]">5% Automatic Discount</strong> on all accounts & game passes</li>
                  <li>Priority order processing & delivery queue</li>
                </ul>
              </div>

              {/* Diamond Tier */}
              <div className={`p-4 rounded-2xl border transition-all ${rankInfo.tier === 'Diamond' ? 'bg-[#00F0FF]/15 border-[#00F0FF]/50 shadow-lg' : 'bg-[#11131A] border-white/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💎</span>
                    <span className="font-user text-sm text-[#00F0FF] font-bold">DIAMOND MEMBER (10% OFF)</span>
                  </div>
                  <span className="font-user text-xs text-[#00F0FF] font-bold">Over $50.00 Spent</span>
                </div>
                <ul className="mt-2 text-xs font-user text-[#cac6bb] space-y-1 pl-6 list-disc">
                  <li><strong className="text-[#3ECF8E]">10% Automatic Discount</strong> on every checkout</li>
                  <li>VIP badge styling & private trade server access</li>
                </ul>
              </div>

              {/* Reseller VIP Tier */}
              <div className={`p-4 rounded-2xl border transition-all ${rankInfo.tier === 'Reseller' ? 'bg-[#FF007A]/15 border-[#FF007A]/50 shadow-lg' : 'bg-[#11131A] border-white/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💼</span>
                    <span className="font-user text-sm text-[#FF007A] font-bold">RESELLER VIP (20% OFF)</span>
                  </div>
                  <span className="font-user text-xs text-[#FF007A] font-bold">Over $100 or Code</span>
                </div>
                <ul className="mt-2 text-xs font-user text-[#cac6bb] space-y-1 pl-6 list-disc">
                  <li><strong className="text-[#FF007A]">20% Highest Auto Discount</strong> storewide</li>
                  <li>Direct bulk account access & dedicated VIP hotline</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowMemberTiersModal(false)}
              className="w-full bg-[#282a31] hover:bg-[#33353e] text-[#ffd7a1] py-3 rounded-2xl font-user text-xs uppercase font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RESELLER VIP CODE REDEEM MODAL */}
      {/* ========================================================================= */}
      {showResellerRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-md w-full bg-[#181A24] rounded-3xl p-6 border border-[#FF007A]/40 shadow-2xl space-y-4 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[#FF007A]">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-user font-bold text-lg">
                  {lang === 'KM' ? 'Redeem កូដ Reseller VIP' : 'Redeem Reseller VIP Code'}
                </h3>
              </div>
              <button
                onClick={() => setShowResellerRedeemModal(false)}
                className="text-[#8B90A0] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="font-user text-xs sm:text-sm text-[#cac6bb] leading-relaxed">
              {lang === 'KM'
                ? 'បញ្ចូលកូដ Reseller VIP ដែលទទួលបានពី Admin ដើម្បីបើកដំណើរការបញ្ចុះតម្លៃ ២០% ភ្លាមៗ!'
                : 'Enter your exclusive VIP Reseller Code from Admin to unlock 20% flat discount on all products.'}
            </p>

            <form onSubmit={handleRedeemResellerRank} className="space-y-3">
              <input
                type="text"
                required
                value={resellerCodeInput}
                onChange={(e) => {
                  setResellerCodeInput(e.target.value);
                  if (redeemRankStatus.type) setRedeemRankStatus({ type: null, message: '' });
                }}
                placeholder="e.g. RESELLER-VIP or VIP-UCHIRO-20"
                className="w-full bg-[#11131A] text-white border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider focus:border-[#FF007A] outline-none"
              />

              {redeemRankStatus.type && (
                <div
                  className={`p-3 rounded-xl text-xs font-user flex items-start gap-2 ${
                    redeemRankStatus.type === 'success'
                      ? 'bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40'
                      : 'bg-[#E8433F]/20 text-[#E8433F] border border-[#E8433F]/40'
                  }`}
                >
                  {redeemRankStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{redeemRankStatus.message}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <a
                  href={adminTelegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0088cc] hover:bg-[#0077b5] text-white px-3.5 py-2.5 rounded-xl text-xs font-user font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Contact Admin</span>
                </a>

                <button
                  type="submit"
                  disabled={isRedeemingRank}
                  className="flex-1 bg-[#FF007A] hover:bg-[#ff1a8c] text-white py-2.5 rounded-xl font-user text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRedeemingRank ? 'Verifying...' : 'Redeem Rank'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
