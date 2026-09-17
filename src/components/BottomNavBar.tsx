import React from 'react';
import { ActiveScreen } from '../types';
import { ShoppingBag, Receipt, User, QrCode, LayoutDashboard, Boxes, Ticket, Users, PackagePlus, Gift, HelpCircle } from 'lucide-react';

interface BottomNavBarProps {
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  lang: 'KM' | 'EN';
  pendingOrdersCount: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeScreen,
  setActiveScreen,
  lang,
  pendingOrdersCount,
}) => {
  const isAdminMode = activeScreen.startsWith('admin-');

  if (isAdminMode) {
    return (
      <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-2xl bg-[#14161D]/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.6)] flex justify-around items-center h-20 px-2 pb-safe md:hidden gpu-accelerated">
        {/* Admin Home */}
        <button
          onClick={() => setActiveScreen('admin-dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[52px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeScreen === 'admin-dashboard'
              ? 'bg-[#ffb230]/20 text-[#ffb230] font-bold border border-[#ffb230]/30 -translate-y-1'
              : 'text-[#8B90A0] hover:text-[#ffd7a1]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="font-price text-[10px] uppercase font-bold">Home</span>
        </button>

        {/* Admin Orders */}
        <button
          onClick={() => setActiveScreen('admin-orders')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[52px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer relative ${
            activeScreen === 'admin-orders'
              ? 'bg-[#ffb230]/20 text-[#ffb230] font-bold border border-[#ffb230]/30 -translate-y-1'
              : 'text-[#8B90A0] hover:text-[#ffd7a1]'
          }`}
        >
          <ShoppingBag className="w-5 h-5 mb-0.5" />
          <span className="font-price text-[10px] uppercase font-bold">Orders</span>
          {pendingOrdersCount > 0 && (
            <span className="absolute top-1 right-1 bg-[#E8433F] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        {/* Admin Items / Add Item */}
        <button
          onClick={() => setActiveScreen('admin-add-item')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[52px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeScreen === 'admin-add-item' || activeScreen === 'admin-items'
              ? 'bg-[#ffb230] text-[#291800] font-bold shadow-[0_0_15px_rgba(255,178,48,0.4)] -translate-y-2'
              : 'text-[#8B90A0] hover:text-[#ffd7a1]'
          }`}
        >
          <PackagePlus className="w-5 h-5 mb-0.5" />
          <span className="font-price text-[10px] uppercase font-bold">+ Add Item</span>
        </button>

        {/* Admin Visitors Analytics */}
        <button
          onClick={() => setActiveScreen('admin-analytics')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[52px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeScreen === 'admin-analytics'
              ? 'bg-[#ffb230]/20 text-[#ffb230] font-bold border border-[#ffb230]/30 -translate-y-1'
              : 'text-[#8B90A0] hover:text-[#ffd7a1]'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="font-price text-[10px] uppercase font-bold">Visitors</span>
        </button>

        {/* Exit to Customer Store */}
        <button
          onClick={() => setActiveScreen('store')}
          className="flex flex-col items-center justify-center py-1.5 px-2.5 min-w-[52px] min-h-[44px] rounded-xl text-[#3ECF8E] hover:text-white transition-all active:scale-95 cursor-pointer bg-[#3ECF8E]/15 border border-[#3ECF8E]/30"
        >
          <ShoppingBag className="w-5 h-5 mb-0.5 text-[#3ECF8E]" />
          <span className="font-price text-[10px] uppercase font-bold text-[#3ECF8E]">Store</span>
        </button>
      </nav>
    );
  }

  // Customer Bottom Navigation
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-2xl bg-[#14161D]/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_25px_rgba(0,0,0,0.6)] flex justify-around items-center h-20 px-1 pb-safe md:hidden gpu-accelerated">
      {/* Store */}
      <button
        onClick={() => setActiveScreen('store')}
        className={`flex flex-col items-center justify-center py-1.5 px-2.5 min-w-[48px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
          activeScreen === 'store'
            ? 'bg-[#ffb230] text-[#291800] font-bold shadow-[0_2px_10px_rgba(255,178,48,0.4)] -translate-y-1'
            : 'text-[#8B90A0] hover:text-[#ffd7a1]'
        }`}
      >
        <ShoppingBag className="w-5 h-5 mb-0.5" />
        <span className="font-khmer text-[10px] font-bold">{lang === 'KM' ? 'ទំនិញ' : 'Store'}</span>
      </button>

      {/* Top-up */}
      <button
        onClick={() => setActiveScreen('topup')}
        className={`flex flex-col items-center justify-center py-1.5 px-2.5 min-w-[48px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
          activeScreen === 'topup'
            ? 'bg-[#ffb230] text-[#291800] font-bold shadow-[0_2px_10px_rgba(255,178,48,0.4)] -translate-y-1'
            : 'text-[#8B90A0] hover:text-[#ffd7a1]'
        }`}
      >
        <QrCode className="w-5 h-5 mb-0.5" />
        <span className="font-khmer text-[10px] font-bold">{lang === 'KM' ? 'បញ្ចូលលុយ' : 'Top-Up'}</span>
      </button>

      {/* Orders */}
      <button
        onClick={() => setActiveScreen('my-orders')}
        className={`flex flex-col items-center justify-center py-1.5 px-2.5 min-w-[48px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
          activeScreen === 'my-orders'
            ? 'bg-[#ffb230] text-[#291800] font-bold shadow-[0_2px_10px_rgba(255,178,48,0.4)] -translate-y-1'
            : 'text-[#8B90A0] hover:text-[#ffd7a1]'
        }`}
      >
        <Receipt className="w-5 h-5 mb-0.5" />
        <span className="font-khmer text-[10px] font-bold">{lang === 'KM' ? 'Orders' : 'Orders'}</span>
      </button>

      {/* Refer & Earn */}
      <button
        onClick={() => setActiveScreen('referral')}
        className={`flex flex-col items-center justify-center py-1.5 px-2.5 min-w-[48px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer relative ${
          activeScreen === 'referral'
            ? 'bg-[#ffb230] text-[#291800] font-bold shadow-[0_2px_10px_rgba(255,178,48,0.4)] -translate-y-1'
            : 'text-[#8B90A0] hover:text-[#ffd7a1]'
        }`}
      >
        <Gift className="w-5 h-5 mb-0.5 text-[#3ECF8E]" />
        <span className="font-khmer text-[10px] font-bold">{lang === 'KM' ? 'ណែនាំ' : 'Refer'}</span>
        <span className="absolute -top-1 right-1.5 bg-[#3ECF8E] text-[#003822] text-[8px] font-price font-bold px-1 rounded-full">
          5%
        </span>
      </button>

      {/* Profile / Account */}
      <button
        onClick={() => setActiveScreen('profile')}
        className={`flex flex-col items-center justify-center py-1.5 px-2.5 min-w-[48px] min-h-[44px] rounded-xl transition-all active:scale-95 cursor-pointer ${
          activeScreen === 'profile' || activeScreen === 'security' || activeScreen === 'help'
            ? 'bg-[#ffb230] text-[#291800] font-bold shadow-[0_2px_10px_rgba(255,178,48,0.4)] -translate-y-1'
            : 'text-[#8B90A0] hover:text-[#ffd7a1]'
        }`}
      >
        <User className="w-5 h-5 mb-0.5" />
        <span className="font-khmer text-[10px] font-bold">{lang === 'KM' ? 'គណនី' : 'Account'}</span>
      </button>
    </nav>
  );
};
