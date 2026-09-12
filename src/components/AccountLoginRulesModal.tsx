import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Key, Smartphone, HelpCircle, X, Check, Lock, Ban, Clock, ExternalLink } from 'lucide-react';

interface AccountLoginRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'KM' | 'EN';
  initialTab?: 'login' | 'rules' | 'refund';
}

export const AccountLoginRulesModal: React.FC<AccountLoginRulesModalProps> = ({
  isOpen,
  onClose,
  lang,
  initialTab = 'login',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'rules' | 'refund'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#14161F] border border-white/15 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-[scaleIn_0.2s_ease-out]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#1A1D28] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center border border-[#ffb230]/30 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline text-base sm:text-lg text-[#ffd7a1] uppercase tracking-wider">
                {lang === 'KM' ? 'របៀប LOGIN & ច្បាប់ទិញគណនី' : 'HOW TO LOGIN & ACCOUNT RULES'}
              </h3>
              <p className="font-price text-[11px] text-[#8B90A0]">
                {lang === 'KM' ? 'លក្ខខណ្ឌធានា ១៤ ថ្ងៃ និងគោលការណ៍មិនបង្វិលប្រាក់' : '14-Day Warranty Rules & No-Refund Policy'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#11131a] hover:bg-white/10 border border-white/10 text-[#8B90A0] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 p-2 bg-[#0E1017] border-b border-white/5 gap-1 text-xs font-price font-bold">
          <button
            onClick={() => setActiveTab('login')}
            className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-[#ffb230] text-[#291800] shadow-md font-extrabold'
                : 'text-[#8B90A0] hover:text-[#cac6bb] hover:bg-white/5'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'របៀប Login' : 'How to Login'}</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-[#ffb230] text-[#291800] shadow-md font-extrabold'
                : 'text-[#8B90A0] hover:text-[#cac6bb] hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'ច្បាប់ធានា ១៤ថ្ងៃ' : '14D Warranty'}</span>
          </button>

          <button
            onClick={() => setActiveTab('refund')}
            className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'refund'
                ? 'bg-[#ffb230] text-[#291800] shadow-md font-extrabold'
                : 'text-[#8B90A0] hover:text-[#cac6bb] hover:bg-white/5'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'No Refund' : 'No Refund'}</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-[#cac6bb]">
          {/* TAB 1: HOW TO LOGIN */}
          {activeTab === 'login' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-[#ffb230]/10 border border-[#ffb230]/30 rounded-2xl p-3.5 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-[#ffb230] shrink-0 mt-0.5" />
                <p className="text-xs text-[#ffd7a1] leading-relaxed">
                  {lang === 'KM'
                    ? 'សូមអនុវត្តតាម ៣ ជំហានខាងក្រោម ដើម្បីចូល Login គណនី Roblox របស់អ្នកដោយសុវត្ថិភាព និងរហ័សបំផុត។'
                    : 'Follow these 3 simple steps to login into your purchased Roblox account securely using 2FA.'}
                </p>
              </div>

              {/* Step 1 */}
              <div className="bg-[#1A1D28] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#ffb230] text-[#291800] font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h4 className="font-headline text-sm text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'បញ្ចូល Username & Password' : 'Enter Username & Password'}
                  </h4>
                </div>
                <p className="text-xs font-price text-[#8B90A0] pl-8 leading-relaxed">
                  {lang === 'KM'
                    ? 'បើកកម្មវិធី Roblox (ទូរសព្ទ ឬ កុំព្យូទ័រ) ហើយវាយបញ្ចូល Username និង Password ដែលទទួលបានលើអេក្រង់វិក្កយបត្រ។'
                    : 'Open Roblox app or web browser and enter the delivered Username and Password from your order receipt.'}
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-[#1A1D28] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#ffb230] text-[#291800] font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h4 className="font-headline text-sm text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'យកកូដ 2FA ផ្ទាល់ (Live 2FA Code)' : 'Use Live 2FA Code from Order Screen'}
                  </h4>
                </div>
                <p className="text-xs font-price text-[#8B90A0] pl-8 leading-relaxed">
                  {lang === 'KM'
                    ? 'ពេល Roblox ទាមទារ 2-Step Verification សូមចុច COPY លេខកូដ ៦ ខ្ទង់ (Live 2FA Code) លើទំព័រវិក្កយបត្រយកទៅ Paste ភ្លាមៗ (កូដផ្លាស់ប្តូររៀងរាល់ ៣០ វិនាទី)។'
                    : 'When Roblox prompts for 2-Step Verification, copy the 6-digit Live 2FA Code directly from your Order page and paste it into Roblox.'}
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-[#1A1D28] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#3ECF8E] text-[#003822] font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h4 className="font-headline text-sm text-[#3ECF8E] uppercase">
                    {lang === 'KM' ? 'ចូលលេងបានជោគជ័យ (Login Success)' : 'Login Completed Successfully'}
                  </h4>
                </div>
                <p className="text-xs font-price text-[#8B90A0] pl-8 leading-relaxed">
                  {lang === 'KM'
                    ? 'បន្ទាប់ពី Login បានជោគជ័យ សូមរក្សាទុក 2FA & Email នៅក្នុងគណនីក្នុងអំឡុងពេលធានា ១៤ ថ្ងៃ (ហាមលុប 2FA/Email ជាដាច់ខាត)។'
                    : 'After logging in, keep the 2FA and registered email intact during the 14-day warranty period to preserve warranty.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: 14-DAY WARRANTY RULES & VOID CONDITIONS */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              {/* Main 14 Days Warranty Banner */}
              <div className="bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-[#3ECF8E] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-headline text-sm text-[#3ECF8E] uppercase font-bold">
                    {lang === 'KM' ? 'ការធានាគណនី ១៤ ថ្ងៃពេញ (14-DAY WARRANTY)' : '14-DAY OFFICIAL ACCOUNT WARRANTY'}
                  </h4>
                  <p className="text-xs font-price text-[#cac6bb] mt-1 leading-relaxed">
                    {lang === 'KM'
                      ? 'គណនីទាំងអស់ទទួលបានការធានារយៈពេល ១៤ ថ្ងៃ ចាប់គិតពីម៉ោងទទួលបានទំនិញជោគជ័យ។'
                      : 'All account purchases come with an official 14-day warranty starting from the moment of delivery.'}
                  </p>
                </div>
              </div>

              {/* CRITICAL VOID RULE: DO NOT DELETE AUTHENTICATOR / EMAIL */}
              <div className="bg-[#E8433F]/15 border-2 border-[#E8433F] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#E8433F] shrink-0 animate-pulse" />
                  <h4 className="font-headline text-sm text-[#ff8e8b] uppercase font-extrabold">
                    {lang === 'KM' ? 'លក្ខខណ្ឌដាច់ខាត៖ ហាមលុប 2FA / EMAIL ក្នុងរយៈពេល ១៤ ថ្ងៃ' : 'CRUCIAL RULE: DO NOT DELETE 2FA / EMAIL DURING 14 DAYS'}
                  </h4>
                </div>
                <div className="text-xs font-price text-[#ffd7a1] space-y-2 leading-relaxed pl-1">
                  <p>
                    {lang === 'KM' ? (
                      <>
                        ⚠️ <strong className="text-white">ប្រសិនបើអ្នកទិញធ្វើការលុប ឬផ្លាស់ប្តូរ Authenticator 2FA ឬ Email ចេញពីគណនីក្នុងអំឡុងពេល ១៤ ថ្ងៃ</strong> នោះ <strong className="text-[#ff8e8b]">ការធានានឹងត្រូវចាត់ទុកជាមោឃៈ (អស់សុពលភាពធានា / NO WARRANTY) ភ្លាមៗ</strong> ដោយមិនមានករណីលើកលែងឡើយ។
                      </>
                    ) : (
                      <>
                        ⚠️ <strong className="text-white">If the buyer deletes or removes the 2FA Authenticator or recovery email during the 14-day warranty period</strong>, <strong className="text-[#ff8e8b]">THE WARRANTY IS IMMEDIATELY VOIDED (NO WARRANTY)</strong> without exception.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* AFTER WARRANTY ENDS: DAY 15+ */}
              <div className="bg-[#1A1D28] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#ffb230]" />
                  <h4 className="font-headline text-sm text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'ក្រោយផុតកំណត់ ១៤ ថ្ងៃ (DAY 15+)' : 'AFTER 14 DAYS WARRANTY ENDS (DAY 15+)'}
                  </h4>
                </div>
                <p className="text-xs font-price text-[#8B90A0] leading-relaxed">
                  {lang === 'KM'
                    ? 'នៅពេលដែលរយៈពេលធានា ១៤ ថ្ងៃបានបញ្ចប់ចប់សព្វគ្រប់ អ្នកទិញអាចលុប ឬប្តូរគ្រប់យ៉ាងតាមចិត្ត (Email, Authenticator 2FA, Password, Phone Number) ដើម្បីគ្រប់គ្រងជាកម្មសិទ្ធិផ្ទាល់ខ្លួន ១០០%។'
                    : 'Once the 14-day warranty period ends, the buyer has 100% full freedom to delete, modify, or change everything (Email, Authenticator 2FA, passwords, phone numbers) for permanent ownership.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: STRICT NO-REFUND POLICY */}
          {activeTab === 'refund' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-[#E8433F]/10 border border-[#E8433F]/30 rounded-2xl p-4 flex items-start gap-3">
                <Ban className="w-6 h-6 text-[#E8433F] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-headline text-sm text-[#ff8e8b] uppercase font-bold">
                    {lang === 'KM' ? 'គោលការណ៍មិនបង្វិលប្រាក់ (STRICT NO REFUND POLICY)' : 'STRICT NO REFUND / NO MONEY BACK POLICY'}
                  </h4>
                  <p className="text-xs font-price text-[#ffd7a1] mt-1 leading-relaxed">
                    {lang === 'KM'
                      ? 'ទំនិញឌីជីថលទាំងអស់ដែលបានបញ្ជាទិញ និងដឹកជញ្ជូនរួច មិនអាចដូរយកលុយវិញបានឡើយ។'
                      : 'All digital products once purchased and delivered cannot be returned or refunded.'}
                  </p>
                </div>
              </div>

              <div className="bg-[#1A1D28] border border-white/10 rounded-2xl p-4 space-y-3 text-xs font-price text-[#8B90A0] leading-relaxed">
                <p className="text-[#e2e2ec] font-bold">
                  {lang === 'KM'
                    ? 'មុខទំនិញខាងក្រោមមិនអាចបង្វិលប្រាក់វិញបានទេ (Non-Refundable Items)៖'
                    : 'The following digital products cannot get money back under any circumstance:'}
                </p>

                <ul className="list-disc pl-5 space-y-1.5 text-[#cac6bb]">
                  <li><strong>Roblox Accounts:</strong> {lang === 'KM' ? 'គណនីគ្រប់ប្រភេទ (Max Level, V4, Starter)' : 'All accounts (Max Level, Awakened, Starters)'}</li>
                  <li><strong>Gamepasses:</strong> {lang === 'KM' ? 'កាដូ Gamepass គ្រប់ប្រភេទ' : 'All Gamepass gifts sent to Roblox username'}</li>
                  <li><strong>Blox Fruits:</strong> {lang === 'KM' ? 'ផ្លែឈើ Physical & Permanent Fruits' : 'Physical & Permanent Fruit in-game trades'}</li>
                  <li><strong>MM2 Items:</strong> {lang === 'KM' ? 'អាវុធ MM2 Harvester / Corrupt Set' : 'MM2 weapons and item sets'}</li>
                  <li><strong>Blade Ball & Evade:</strong> {lang === 'KM' ? 'ដាវ Blade Ball និងកញ្ចប់ Evade' : 'Blade Ball swords and Evade items'}</li>
                </ul>

                <div className="pt-2 border-t border-white/5 text-[11px] text-[#ffd7a1]">
                  {lang === 'KM'
                    ? 'ប្រសិនបើមានបញ្ហាបច្ចេកទេសលើគណនីក្នុងអំឡុងពេល ១៤ ថ្ងៃ សូមទាក់ទង Admin តាម Telegram (@Noreakyout) ដើម្បីទទួលបានការជួយដោះស្រាយ ឬប្តូរគណនីថ្មីស្របតាមលក្ខខណ្ឌធានា។'
                    : 'For technical account issues within the 14-day warranty period, contact Admin on Telegram (@Noreakyout) for support under warranty terms.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-white/10 bg-[#1A1D28] flex items-center justify-between gap-3">
          <a
            href="https://t.me/Noreakyout"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-price text-[#229ED9] hover:underline"
          >
            <span>Admin Telegram @Noreakyout</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] px-6 py-2.5 rounded-xl font-headline text-xs uppercase font-bold chunky-btn-gold transition-all active:scale-95"
          >
            {lang === 'KM' ? 'ខ្ញុំបានយល់ព្រម (I UNDERSTAND)' : 'I UNDERSTAND & AGREE'}
          </button>
        </div>
      </div>
    </div>
  );
};
