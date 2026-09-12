import React from 'react';
import { ActiveScreen, StoreSettings, UserProfile } from '../types';
import { Shield, Lock, Store as StoreIcon, Globe, Sparkles, Wallet, LogIn, LogOut } from 'lucide-react';
import { getMemberRankInfo } from '../utils/memberRank';
import { AnimatedWalletBalance } from './AnimatedWalletBalance';
import { FirebaseUser } from '../lib/firebase';

interface TopAppBarProps {
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  lang: 'KM' | 'EN';
  setLang: (lang: 'KM' | 'EN') => void;
  userBalanceUSD: number;
  pendingOrdersCount: number;
  onOpenTopup: () => void;
  settings: StoreSettings;
  isAdminAuthenticated: boolean;
  onAdminPortalClick: () => void;
  userProfile?: UserProfile;
  currentUser?: FirebaseUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  activeScreen,
  setActiveScreen,
  lang,
  setLang,
  userBalanceUSD,
  pendingOrdersCount,
  onOpenTopup,
  settings,
  isAdminAuthenticated,
  onAdminPortalClick,
  userProfile,
  currentUser,
  onOpenAuth,
  onLogout,
}) => {
  const isAdminMode = activeScreen.startsWith('admin-') && activeScreen !== 'admin-login';
  const rankInfo = userProfile
    ? getMemberRankInfo(userProfile.totalSpentUSD || 0, userProfile.isResellerUnlocked)
    : null;
  const [logoClickCount, setLogoClickCount] = React.useState(0);
  const logoTimerRef = React.useRef<any>(null);

  const handleLogoClick = () => {
    // Clicking the brand logo should always return to the customer store view
    setActiveScreen('store');
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#11131a]/95 backdrop-blur-[20px] border-b border-white/10 shadow-lg">
      <div className="max-w-[1280px] mx-auto px-3 sm:px-4 md:px-8 h-13 sm:h-15 md:h-18 flex items-center justify-between">
        {/* Left: Brand Store Header (Text name removed near top up as requested) */}
        <div
          className="flex items-center gap-2 cursor-pointer shrink-0"
          onClick={handleLogoClick}
          title="Uchiro Store (Triple click for Admin)"
        >
          {settings.logoUrl ? (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-gradient-to-br from-[#ffb230] to-[#E8433F] p-0.5 shadow-[0_0_12px_rgba(255,178,48,0.35)] active:scale-95 transition-transform">
              <img
                src={settings.logoUrl}
                alt="Store Logo"
                className="w-full h-full object-cover rounded-[10px]"
              />
            </div>
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#ffb230]/20 to-[#ffb230]/5 border border-[#ffb230]/40 flex items-center justify-center text-[#ffb230] shadow-[0_0_12px_rgba(255,178,48,0.25)] active:scale-95 transition-transform">
              <StoreIcon className="w-4 h-4 text-[#ffb230]" />
            </div>
          )}
          {isAdminMode && (
            <div className="flex items-center gap-1.5">
              <span className="bg-[#ffb230]/20 text-[#ffb230] border border-[#ffb230]/40 text-[9px] sm:text-[10px] font-price px-1.5 py-0.2 rounded-full font-bold uppercase">
                Staff
              </span>
            </div>
          )}
        </div>

        {/* Center: Desktop Nav Links for Customer */}
        {!isAdminMode && (
          <nav className="hidden md:flex items-center gap-4 lg:gap-6">
            <button
              onClick={() => setActiveScreen('store')}
              className={`font-user text-sm font-semibold transition-colors ${
                activeScreen === 'store' ? 'text-[#ffb230] font-bold' : 'text-[#cac6bb] hover:text-[#ffb230]'
              }`}
            >
              {lang === 'KM' ? 'ទំព័រដើម' : 'Store'}
            </button>
            <button
              onClick={() => setActiveScreen('my-orders')}
              className={`font-user text-sm font-semibold transition-colors flex items-center gap-1 ${
                activeScreen === 'my-orders' ? 'text-[#ffb230] font-bold' : 'text-[#cac6bb] hover:text-[#ffb230]'
              }`}
            >
              {lang === 'KM' ? 'ការបញ្ជាទិញ' : 'Orders'}
            </button>
            <button
              onClick={() => setActiveScreen('referral')}
              className={`font-user text-sm font-semibold transition-colors flex items-center gap-1 ${
                activeScreen === 'referral'
                  ? 'text-[#ffb230] font-bold'
                  : 'text-[#cac6bb] hover:text-[#ffb230]'
              }`}
            >
              <span className="text-[#3ECF8E]">🎁</span>
              <span>{lang === 'KM' ? 'ណែនាំ & រង្វាន់' : 'Refer & Earn'}</span>
            </button>
            <button
              onClick={() => setActiveScreen('help')}
              className={`font-user text-sm font-semibold transition-colors ${
                activeScreen === 'help'
                  ? 'text-[#ffb230] font-bold'
                  : 'text-[#cac6bb] hover:text-[#ffb230]'
              }`}
            >
              {lang === 'KM' ? 'ជំនួយ' : 'Help'}
            </button>
            <button
              onClick={() => setActiveScreen('profile')}
              className={`font-user text-sm font-semibold transition-colors ${
                activeScreen === 'profile' || activeScreen === 'security'
                  ? 'text-[#ffb230] font-bold'
                  : 'text-[#cac6bb] hover:text-[#ffb230]'
              }`}
            >
              {lang === 'KM' ? 'គណនី' : 'Account'}
            </button>
          </nav>
        )}

        {/* Right: Controls, Balance, Language, View Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3.5">
          {/* Balance Pill for Customer */}
          {!isAdminMode && (
            <button
              onClick={() => {
                if (!currentUser && onOpenAuth) {
                  onOpenAuth();
                } else {
                  onOpenTopup();
                }
              }}
              id="topappbar-user-wallet-pill"
              className="flex items-center gap-1.5 bg-[#1C1F29] hover:bg-[#282a31] border border-[#ffb230]/30 hover:border-[#ffb230]/60 text-[#ffd7a1] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-price shadow-inner transition-all active:scale-95 group relative"
              title={currentUser ? "Click to Top-up USD via KHQR" : (lang === 'KM' ? "សូមចូលប្រើដើម្បីបញ្ចូលទឹកប្រាក់" : "Sign In to Top-up USD")}
            >
              <div className="w-4 h-4 rounded-full bg-[#3ECF8E]/20 text-[#3ECF8E] flex items-center justify-center font-bold text-[11px] leading-none shrink-0 group-hover:scale-110 transition-transform">
                $
              </div>
              <AnimatedWalletBalance balance={currentUser ? (userBalanceUSD ?? 0) : 0} />
              <span className="bg-[#ffb230] text-[#291800] text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded font-bold ml-0.5 group-hover:scale-105 transition-transform">
                + Top Up
              </span>
            </button>
          )}

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'KM' ? 'EN' : 'KM')}
            className="flex items-center gap-1 text-[#d6c4ae] hover:text-[#ffb230] transition-colors text-xs font-price bg-[#1C1F29]/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-white/5"
            title="Toggle Language (KM / EN)"
          >
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="font-bold text-[11px] sm:text-xs">{lang}</span>
          </button>

          {/* Admin Dashboard Navigation Button: Conditionally rendered ONLY if user.role === 'admin' */}
          {userProfile?.role === 'admin' && !isAdminMode && (
            <button
              id="topappbar-admin-panel-btn"
              onClick={() => setActiveScreen('admin-dashboard')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-[#ffb230] to-[#f59e0b] text-[#291800] hover:brightness-110 font-headline font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(255,178,48,0.4)] transition-all active:scale-95 cursor-pointer shrink-0"
              title="Enter Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Dashboard</span>
            </button>
          )}

          {/* Mode Switcher Button: ALWAYS clearly visible when currently in admin mode */}
          {isAdminMode && (
            <button
              onClick={() => setActiveScreen('store')}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-headline uppercase tracking-wider transition-all active:scale-95 bg-[#3ECF8E]/20 border border-[#3ECF8E]/60 text-[#3ECF8E] hover:bg-[#3ECF8E]/30 font-bold shadow-[0_0_12px_rgba(62,207,142,0.3)] cursor-pointer shrink-0"
              title="Return to Customer Store"
            >
              <StoreIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'KM' ? 'ហាងទំនិញ' : 'Store'}</span>
            </button>
          )}

          {/* User Profile & Rank Badge in Store Header */}
          {isAdminMode ? (
            <button
              onClick={() => setActiveScreen('admin-dashboard')}
              className="p-1 rounded-full bg-[#1C1F29]/80 hover:bg-[#1C1F29] border border-[#ffb230]/40 transition-all group shrink-0"
              title="Admin Profile"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 border-[#ffb230] shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(255,178,48,0.3)]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGjl6eh5pUP_7c6Jvet7EisIdcMEmHdbe6fXeVnIwOC6MrLpaqzHUgiy9imwKdfKng_HXxJsfxjXYoTba2l4RxQvrGPb_p7mFQBmZ6poiEHqCOa1ICevgeq3OmRpMdDqqACeHtYY4gMCMvqbhDQcZhah4bMirl0SyNLZ9OhRpJpdfP_JKp4DLfy3aGZdXRPNcZS9R1vX_6UZLNuWZ-voATX8XsY3NcC8gbCl_x4CR3vKsUaf0vGWXW"
                  alt="Admin Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            </button>
          ) : currentUser && userProfile?.username ? (
            <button
              onClick={() => setActiveScreen('profile')}
              className="p-1 rounded-full bg-[#1C1F29]/90 hover:bg-[#282a31] border border-white/10 hover:border-[#ffb230]/40 transition-all group shadow-md shrink-0"
              title={`Logged in as @${userProfile.username} (${rankInfo?.title || 'Member'}) - Click to view profile & rank`}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 ${rankInfo?.avatarBorder || 'border-[#ffb230]'} shrink-0 group-hover:scale-105 transition-transform`}
              >
                <img
                  src={userProfile.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCV3j4VML-lVWoaql9SA7mM_jmhuKq3z5ICBl-mVI5bBXY4pS6WXd_tOZ8PkLI9Vv6GTMIlFgnf6QiwoOszhs5DGGUxvMoqnDnVNcTWIVNnKjKcnKgs0JGbUZ78wivDcMmWXni4dGDPJt8dXFbjR_bo1eva4Fn3x0rjdiuE0uCrwJwO42IQR-gQYF6eCxZ9O628DwUDqFQ2o4-prFhIZqe0w2kVzDOM3ndfkRjW6WDgkdirsNk0roiB'}
                  alt={userProfile.username}
                  className="w-full h-full object-cover"
                />
              </div>
            </button>
          ) : null}

          {/* Quick Firebase Auth Buttons */}
          {!isAdminMode && !currentUser && onOpenAuth && (
            <button
              id="topappbar-signin-btn"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#ffb230] text-[#291800] hover:bg-[#ffbe4d] font-headline font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(255,178,48,0.35)] transition-all active:scale-95 cursor-pointer shrink-0"
              title={lang === 'KM' ? 'ចូលប្រើ ឬ បង្កើតគណនី' : 'Sign In or Create Account'}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'KM' ? 'ចូលប្រើ' : 'Sign In'}</span>
            </button>
          )}

          {!isAdminMode && currentUser && onLogout && (
            <button
              id="topappbar-logout-btn"
              onClick={onLogout}
              className="p-1.5 sm:p-2 rounded-xl bg-[#1C1F29]/80 hover:bg-[#E8433F]/20 border border-white/5 hover:border-[#E8433F]/30 text-[#8B90A0] hover:text-[#E8433F] transition-colors cursor-pointer shrink-0"
              title={lang === 'KM' ? 'ចាកចេញពីគណនី (Log Out)' : 'Log Out'}
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
