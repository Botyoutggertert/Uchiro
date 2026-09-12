import React from 'react';
import { StoreSettings } from '../types';
import { Send, ShieldCheck, Zap } from 'lucide-react';

interface StoreHeroProps {
  settings: StoreSettings;
  lang: 'KM' | 'EN';
}

export const StoreHero: React.FC<StoreHeroProps> = ({ settings, lang }) => {
  const telegramUrl = settings.telegramUrl || 'https://t.me/uchirostore';

  return (
    <section className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl mt-2 md:mt-3 border border-white/10 shadow-xl bg-gradient-to-b from-[#14161F] via-[#10121A] to-[#0A0B0E] p-4 sm:p-6 md:p-8">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#ffb230]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-[#3ECF8E]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6">
        {/* Left: Store Logo & Brand Name */}
        <div className="flex items-center gap-3.5 sm:gap-4 text-center sm:text-left">
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#ffb230] to-[#E8433F] p-0.5 shadow-[0_0_20px_rgba(255,178,48,0.3)] shrink-0">
            <img
              src={settings.logoUrl}
              alt={settings.storeName}
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl bg-gradient-to-r from-[#ffd7a1] via-[#ffb230] to-[#ffddb2] bg-clip-text text-transparent tracking-wider uppercase">
                {lang === 'KM' && settings.storeNameKhmer ? settings.storeNameKhmer : settings.storeName}
              </h1>
              <span className="inline-flex items-center gap-1 bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 text-[10px] font-price font-bold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
                ONLINE
              </span>
            </div>

            <p className="font-khmer text-xs sm:text-sm text-[#cac6bb] mt-0.5">
              {lang === 'KM'
                ? 'ហាងលក់គណនី Roblox & ផ្លែឈើ Mythical សុវត្ថិភាពខ្ពស់'
                : 'Roblox Accounts, Mythical Fruits & Fast 2FA Delivery'}
            </p>
          </div>
        </div>

        {/* Right: Telegram Channel Slice / Action */}
        <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/40 text-[#40b3ff] hover:text-white px-4 py-2.5 rounded-xl font-price text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 group"
          >
            <Send className="w-4 h-4 text-[#0088cc] group-hover:scale-110 transition-transform" />
            <span>Telegram: @uchirostore</span>
          </a>
        </div>
      </div>
    </section>
  );
};

