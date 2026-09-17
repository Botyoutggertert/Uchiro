import React, { useState } from 'react';
import { UserProfile, ActiveScreen } from '../types';
import { ShieldCheck, Smartphone, Laptop, Lock, ArrowLeft, Check, AlertTriangle, Key, Mail, CheckCircle2, LogIn } from 'lucide-react';
import { triggerPasswordReset, FirebaseUser } from '../lib/firebase';

interface SecuritySettingsScreenProps {
  userProfile: UserProfile;
  onBack: () => void;
  lang: 'KM' | 'EN';
  currentUser?: FirebaseUser | null;
  onOpenAuth?: () => void;
}

export const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({
  userProfile,
  onBack,
  lang,
  currentUser,
  onOpenAuth,
}) => {
  const [is2FAEnabled, setIs2FAEnabled] = useState(userProfile.is2FAEnabled);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSaved, setPassSaved] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-4 md:px-8 max-w-lg mx-auto flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
            SECURITY & PRIVACY
          </h1>
        </div>

        <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ffb230]/20 to-[#ffb230]/5 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230] mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="font-headline font-bold text-xl text-[#e2e2ec] mb-2">
            {lang === 'KM' ? 'សូមចូលគណនីរបស់អ្នក' : 'Please Sign In'}
          </h2>
          <p className="text-xs text-[#8B90A0] font-price mb-6">
            {lang === 'KM'
              ? 'ការកំណត់សុវត្ថិភាព និងលេខកូដសម្ងាត់អាចចូលប្រើបានសម្រាប់តែម្ចាស់គណនីដែលបានចូលប៉ុណ្ណោះ។'
              : 'Security and privacy settings can only be accessed by authenticated users.'}
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#ffb230] to-[#ff9e00] text-[#291800] font-headline font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
          >
            <LogIn className="w-4 h-4" />
            <span>{lang === 'KM' ? 'ចូលប្រើប្រាស់គណនី' : 'Sign In'}</span>
          </button>
        </div>
      </div>
    );
  }

  const handleTriggerEmailReset = async () => {
    if (!userProfile.email) return;
    setIsSendingReset(true);
    setResetFeedback(null);
    try {
      await triggerPasswordReset(userProfile.email);
      setResetFeedback(
        lang === 'KM'
          ? `តំណភ្ជាប់ផ្លាស់ប្តូរពាក្យសម្ងាត់ត្រូវបានផ្ញើទៅកាន់ ${userProfile.email}!`
          : `Password reset link sent to ${userProfile.email}!`
      );
      setTimeout(() => setResetFeedback(null), 6000);
    } catch (err: any) {
      setResetFeedback(err?.message || 'Failed to send reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
          SECURITY & PRIVACY
        </h1>
      </div>

      {/* Password Management */}
      <section className="bg-[#1C1F29] rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffb230]/15 text-[#ffb230] flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-[#e2e2ec]">Account Password</h3>
              <p className="font-price text-xs text-[#8B90A0]">Last changed 3 weeks ago</p>
            </div>
          </div>
          <button
            onClick={() => setIsChangingPass(!isChangingPass)}
            className="bg-[#282a31] hover:bg-[#33343c] text-[#ffd7a1] font-price text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
          >
            {isChangingPass ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {isChangingPass && (
          <div className="pt-3 border-t border-white/5 space-y-3">
            <input
              type="password"
              placeholder="Current Password"
              className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
            />
            <input
              type="password"
              placeholder="New Secure Password"
              className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
            />
            <button
              onClick={() => {
                setPassSaved(true);
                setTimeout(() => {
                  setPassSaved(false);
                  setIsChangingPass(false);
                }, 1200);
              }}
              className="w-full bg-[#ffb230] text-[#291800] font-headline py-2.5 rounded-xl uppercase font-bold chunky-btn-gold"
            >
              {passSaved ? 'Password Updated!' : 'Save New Password'}
            </button>
          </div>
        )}

        {/* Firebase Password Reset via Email Option */}
        <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-price text-[#8B90A0]">
            <p className="text-[#e2e2ec] font-semibold">
              {lang === 'KM' ? 'ភ្លេច ឬចង់កំណត់ពាក្យសម្ងាត់ឡើងវិញតាម Email?' : 'Reset or recover password via Email'}
            </p>
            <p>
              {lang === 'KM'
                ? `ប្រព័ន្ធនឹងផ្ញើតំណភ្ជាប់/កូដទៅកាន់៖ ${userProfile.email || 'គណនីរបស់អ្នក'}`
                : `We'll send reset link & code to: ${userProfile.email || 'your registered email'}`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerEmailReset}
            disabled={isSendingReset}
            className="px-4 py-2 bg-[#282a31] hover:bg-[#33343c] text-[#ffd7a1] border border-white/10 rounded-xl font-price text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5 text-[#ffb230]" />
            <span>
              {isSendingReset
                ? (lang === 'KM' ? 'កំពុងផ្ញើ...' : 'Sending...')
                : (lang === 'KM' ? 'ផ្ញើទៅកាន់ Email' : 'Send Reset Link')}
            </span>
          </button>
        </div>

        {resetFeedback && (
          <div className="p-3 bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 rounded-xl text-xs font-price text-[#a6f0cc] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#3ECF8E] shrink-0" />
            <span>{resetFeedback}</span>
          </div>
        )}
      </section>

      {/* Two-Factor Authentication (2FA) */}
      <section className="bg-[#1C1F29] rounded-2xl p-5 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3ECF8E]/15 text-[#3ECF8E] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-sans text-sm font-bold text-[#e2e2ec]">Two-Factor Authentication (2FA)</h3>
              <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full">
                Protected
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0] mt-0.5">
              Google Authenticator / live OTP code active
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => setIs2FAEnabled(!is2FAEnabled)}
          className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
            is2FAEnabled ? 'bg-[#3ECF8E]' : 'bg-[#33343c]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
              is2FAEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </section>

      {/* Login Activity / Active Sessions */}
      <section className="space-y-3">
        <h3 className="font-price text-xs text-[#8B90A0] uppercase tracking-wider px-1">
          Active Login Sessions
        </h3>

        <div className="bg-[#1C1F29] rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {userProfile.activeSessions.map((session) => (
            <div key={session.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#282a31] text-[#ffd7a1] flex items-center justify-center">
                  {session.type === 'mobile' ? (
                    <Smartphone className="w-5 h-5" />
                  ) : (
                    <Laptop className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-sm font-semibold text-[#e2e2ec]">{session.device}</p>
                    {session.isCurrent && (
                      <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full">
                        This Device
                      </span>
                    )}
                  </div>
                  <p className="font-price text-xs text-[#8B90A0]">
                    {session.location} • {session.lastActive}
                  </p>
                </div>
              </div>

              {!session.isCurrent && (
                <button className="text-xs font-price text-[#E8433F] hover:underline">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-[#1C1F29]/60 border border-[#E8433F]/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[#E8433F]">
            <AlertTriangle className="w-4 h-4" />
            <h4 className="font-sans text-sm font-bold">Delete Account & Data</h4>
          </div>
          <p className="font-price text-xs text-[#8B90A0] mt-0.5">
            Permanently delete your Uchiro Store account and wallet balance.
          </p>
        </div>
        <button className="bg-[#E8433F]/20 hover:bg-[#E8433F] text-[#E8433F] hover:text-white border border-[#E8433F]/40 font-price text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0">
          Delete Account
        </button>
      </section>
    </div>
  );
};
