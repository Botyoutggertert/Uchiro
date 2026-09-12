import React, { useEffect } from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { UserRole } from '../models/userModel';
import { safeStorage } from '../utils/storage';

interface AdminRouteGuardProps {
  userRole?: UserRole | string;
  isLoggedIn: boolean;
  onRedirectToDashboard: () => void;
  onOpenAuthModal?: () => void;
  children: React.ReactNode;
  lang?: 'KM' | 'EN';
}

/**
 * AdminRouteGuard:
 * Protects administrative screens against unauthorized access.
 * If a customer forces navigation to an admin view, it renders an access denied gate
 * and securely redirects them to the customer dashboard/store.
 */
export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  userRole,
  isLoggedIn,
  onRedirectToDashboard,
  onOpenAuthModal,
  children,
  lang = 'EN',
}) => {
  const hasLocalAdminToken = !!safeStorage.getItem('uchiro_admin_token');
  const isAdmin = (isLoggedIn && userRole === 'admin') || hasLocalAdminToken;

  useEffect(() => {
    if (!isAdmin) {
      console.warn('[Security] Unauthorized access attempt to Admin route blocked.');
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-[#14161D] border border-[#E8433F]/30 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8433F]/5 rounded-full blur-3xl pointer-events-none" />

          {/* Shield Alert Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#E8433F]/15 border border-[#E8433F]/30 text-[#E8433F] mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(232,67,63,0.25)]">
            {isLoggedIn ? <ShieldAlert className="w-8 h-8" /> : <Lock className="w-8 h-8 text-[#ffb230]" />}
          </div>

          <div className="space-y-2">
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              isLoggedIn
                ? 'bg-[#E8433F]/15 text-[#E8433F] border border-[#E8433F]/30'
                : 'bg-[#ffb230]/15 text-[#ffb230] border border-[#ffb230]/30'
            }`}>
              {isLoggedIn ? '403 Forbidden' : 'Authentication Required'}
            </span>
            <h2 className="font-headline text-2xl text-[#e2e2ec] font-bold">
              {isLoggedIn
                ? (lang === 'KM' ? 'ការអនុញ្ញាតត្រូវបានបដិសេធ' : 'Access Denied')
                : (lang === 'KM' ? 'ត្រូវការចូលគណនី Admin' : 'Admin Sign In Required')}
            </h2>
            <p className="font-price text-xs text-[#8B90A0] leading-relaxed">
              {isLoggedIn
                ? (lang === 'KM'
                    ? 'ទំព័រនេះត្រូវបានកំណត់សម្រាប់តែអ្នកគ្រប់គ្រង (Administrator) ប៉ុណ្ណោះ។ គណនីរបស់អ្នកមិនមានសិទ្ធិចូលមើលទេ។'
                    : 'This portal requires administrator privileges. Your current account role does not grant access to the admin management dashboard.')
                : (lang === 'KM'
                    ? 'សូមចូលគណនីតាមរយៈ Single Standard Portal (/login) ដោយប្រើគណនី Admin របស់អ្នក។'
                    : 'Please sign in with an Administrator account using the unified login interface.')}
            </p>
          </div>

          <div className="pt-2 space-y-2">
            {!isLoggedIn && onOpenAuthModal && (
              <button
                id="admin-guard-signin-btn"
                onClick={onOpenAuthModal}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#ffb230] to-[#f59e0b] text-[#291800] font-headline text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(255,178,48,0.3)] cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{lang === 'KM' ? 'ចូលប្រើប្រាស់តាម Standard Portal' : 'Sign In via Standard Portal'}</span>
              </button>
            )}
            <button
              id="admin-guard-return-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history) {
                  try {
                    window.history.pushState(null, '', '/');
                  } catch {}
                }
                onRedirectToDashboard();
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#3ECF8E] to-[#2EAF72] hover:brightness-110 text-[#0c0e15] font-headline text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'KM' ? 'ត្រឡប់ទៅហាងទំនិញ (Return to Store)' : 'Return to Customer Store'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
