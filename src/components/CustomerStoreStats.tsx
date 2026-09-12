import React, { useState, useEffect } from 'react';
import { Users, ShoppingBag, UserCheck, TrendingUp, Sparkles } from 'lucide-react';
import { Order } from '../types';

interface CustomerStoreStatsProps {
  orders: Order[];
  lang: 'KM' | 'EN';
}

export const CustomerStoreStats: React.FC<CustomerStoreStatsProps> = ({ orders, lang }) => {
  // Dynamic realistic online counter centered at 140
  const [onlineUsers, setOnlineUsers] = useState<number>(140);

  useEffect(() => {
    const interval = setInterval(() => {
      // Subtle organic fluctuation around 140
      setOnlineUsers((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = prev + delta;
        return Math.max(132, Math.min(148, next));
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Total Buy / Completed Orders
  const basePurchases = 1843;
  const totalPurchases = basePurchases + orders.length;

  // Total Registered Accounts
  const baseRegistered = 4321;
  const totalRegistered = baseRegistered + Math.floor(orders.length * 1.5);

  return (
    <section
      id="customer-store-stats-bar"
      className="w-full mt-8 sm:mt-12 mb-2 rounded-2xl bg-gradient-to-r from-[#12141c] via-[#161824] to-[#12141c] border border-white/10 p-3 sm:p-4 shadow-lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Stat 1: User Online Now */}
        <div className="flex items-center gap-3 bg-[#0d0f17]/90 border border-white/5 hover:border-[#3ECF8E]/40 rounded-xl px-3.5 py-2.5 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 text-[#3ECF8E] flex items-center justify-center shrink-0 relative">
            <Users className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#3ECF8E] ring-4 ring-[#0d0f17] animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#3ECF8E] ring-2 ring-[#0d0f17]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline text-lg sm:text-xl text-[#3ECF8E] font-bold tracking-tight">
                {onlineUsers}
              </span>
              <span className="inline-flex items-center text-[9px] font-price font-bold uppercase tracking-wider text-[#3ECF8E] bg-[#3ECF8E]/20 px-1.5 py-0.2 rounded">
                LIVE
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0] truncate">
              {lang === 'KM' ? 'អតិថិជនកំពុង Online (Online Now)' : 'Users Online Now'}
            </p>
          </div>
        </div>

        {/* Stat 2: Total Buy */}
        <div className="flex items-center gap-3 bg-[#0d0f17]/90 border border-white/5 hover:border-[#ffb230]/40 rounded-xl px-3.5 py-2.5 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#ffb230]/15 border border-[#ffb230]/30 text-[#ffb230] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline text-lg sm:text-xl text-[#ffd7a1] font-bold tracking-tight">
                {totalPurchases.toLocaleString()}
              </span>
              <span className="text-[10px] font-price text-[#3ECF8E] font-bold">
                +2FA Instant
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0] truncate">
              {lang === 'KM' ? 'ការបញ្ជាទិញសរុប (Total Buy)' : 'Total Buy / Purchases'}
            </p>
          </div>
        </div>

        {/* Stat 3: Total Register */}
        <div className="flex items-center gap-3 bg-[#0d0f17]/90 border border-white/5 hover:border-[#40b3ff]/40 rounded-xl px-3.5 py-2.5 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#40b3ff]/15 border border-[#40b3ff]/30 text-[#40b3ff] flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline text-lg sm:text-xl text-[#bfe4ff] font-bold tracking-tight">
                {totalRegistered.toLocaleString()}+
              </span>
              <span className="text-[10px] font-price text-[#40b3ff] font-bold">
                Verified
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0] truncate">
              {lang === 'KM' ? 'គណនីបានចុះឈ្មោះ (Total Register)' : 'Total Registered Users'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
