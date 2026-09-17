import React from 'react';
import { StoreSettings } from '../types';
import { ShieldCheck } from 'lucide-react';

interface StoreFooterProps {
  settings: StoreSettings;
  onAdminLoginClick: () => void;
  lang: 'KM' | 'EN';
  setActiveScreen?: (screen: any) => void;
}

export const StoreFooter: React.FC<StoreFooterProps> = ({
  settings,
  lang,
}) => {
  return (
    <footer className="w-full bg-[#0D0E14] border-t border-white/5 pt-8 pb-20 md:pb-10 mt-12 text-[#8B90A0]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-between">
          {/* Brand & Mission */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-gradient-to-br from-[#ffb230] to-[#E8433F] p-0.5 shadow-md">
                <img
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  className="w-full h-full object-cover rounded-[10px]"
                />
              </div>
              <span className="font-headline text-base text-[#ffd7a1] tracking-wider uppercase">
                {settings.storeName}
              </span>
            </div>
            <p className="font-khmer text-xs leading-relaxed text-[#8B90A0] max-w-md">
              {lang === 'KM'
                ? 'ប្រព័ន្ធទិញលក់គណនីស្វ័យប្រវត្តតាមរយៈ KHQR គ្មានកម្រៃសេវា ធានាសុវត្ថិភាពខ្ពស់។'
                : 'Automated digital game marketplace powered by NBC Bakong KHQR instant checkout.'}
            </p>
          </div>

          {/* Payment Partners & Security */}
          <div className="flex flex-col md:items-end gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3ECF8E]" />
              <span className="font-price text-xs text-[#3ECF8E] font-semibold">
                100% Secured KHQR Payment Standard
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 md:justify-end">
              {['Bakong', 'ABA Bank', 'Wing Bank', 'ACLEDA'].map((bank) => (
                <span
                  key={bank}
                  className="font-price text-[11px] bg-[#161822] border border-white/10 text-[#ffd7a1] px-2.5 py-0.5 rounded-md"
                >
                  {bank}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-user text-[#8B90A0]">
          <div>
            © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#3ECF8E] font-medium font-price px-2.5 py-0.5 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[11px]">
              KHQR USD Instant Verification
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
