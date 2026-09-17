import React, { useState } from 'react';
import { Order } from '../types';
import { Search, CheckCircle2, Clock, ShieldCheck, ArrowLeft, KeyRound, ChevronRight, XCircle, MessageCircle, Gift, FileDown, Lock, LogIn } from 'lucide-react';
import { generateReceiptPdf } from '../utils/generateReceiptPdf';
import { FirebaseUser } from '../lib/firebase';

interface OrderHistoryScreenProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onGoHome: () => void;
  lang: 'KM' | 'EN';
  currentUser?: FirebaseUser | null;
  onOpenAuth?: () => void;
}

export const OrderHistoryScreen: React.FC<OrderHistoryScreenProps> = ({
  orders,
  onSelectOrder,
  onGoHome,
  lang,
  currentUser,
  onOpenAuth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'delivered' | 'pending'>('all');

  // If logged out, require login to see orders
  if (!currentUser) {
    return (
      <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-3 sm:px-4 md:px-8 max-w-lg mx-auto flex flex-col gap-5 sm:gap-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={onGoHome}
            className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shadow-md"
            title="Back to Store"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-headline text-xl sm:text-2xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
            {lang === 'KM' ? 'ប្រវត្តិការបញ្ជាទិញ' : 'ORDER HISTORY'}
          </h1>
        </div>

        <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-[#ffb230]/20 to-[#ffb230]/5 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230] mb-4 shadow-[0_0_25px_rgba(255,178,48,0.2)]">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="font-headline font-bold text-xl sm:text-2xl text-[#e2e2ec] mb-2 tracking-wide">
            {lang === 'KM' ? 'សូមចូលគណនីដើម្បីមើលការបញ្ជាទិញ' : 'Sign In to View Orders'}
          </h2>

          <p className="text-xs sm:text-sm text-[#8B90A0] font-price leading-relaxed max-w-sm mb-6">
            {lang === 'KM'
              ? 'ព័ត៌មានលម្អិតអំពីការបញ្ជាទិញ គណនីហ្គេម និងកូដសម្ងាត់ ត្រូវបានការពារសម្រាប់តែម្ចាស់គណនីប៉ុណ្ណោះ។'
              : 'Your order receipts, delivered game credentials, and digital item keys are protected and require you to sign in.'}
          </p>

          <div className="w-full flex flex-col gap-2.5">
            <button
              id="orders-login-gate-btn"
              onClick={onOpenAuth}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#ffb230] to-[#ff9e00] hover:from-[#ffbe4d] hover:to-[#ffb230] text-[#291800] font-headline font-extrabold text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,178,48,0.35)] transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{lang === 'KM' ? 'ចូលប្រើប្រាស់គណនី' : 'Sign In to View Orders'}</span>
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

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeFilter === 'all') return matchesSearch;
    return matchesSearch && order.status === activeFilter;
  });

  return (
    <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-3 sm:px-4 md:px-8 max-w-4xl mx-auto flex flex-col gap-5 sm:gap-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onGoHome}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
          ORDER HISTORY
        </h1>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by order #, item name..."
            className="w-full bg-[#1C1F29] border border-white/10 text-[#e2e2ec] rounded-xl pl-10 pr-4 py-2.5 font-price text-sm focus:outline-none focus:border-[#ffb230]"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl font-price text-xs font-bold transition-all ${
              activeFilter === 'all'
                ? 'bg-[#ffb230] text-[#291800] chunky-btn-gold'
                : 'bg-[#1C1F29] text-[#cac6bb] border border-white/10 hover:border-white/25'
            }`}
          >
            All ({orders.length})
          </button>
          <button
            onClick={() => setActiveFilter('delivered')}
            className={`px-4 py-2 rounded-xl font-price text-xs font-bold transition-all ${
              activeFilter === 'delivered'
                ? 'bg-[#3ECF8E] text-[#003822] chunky-btn-success'
                : 'bg-[#1C1F29] text-[#cac6bb] border border-white/10 hover:border-white/25'
            }`}
          >
            Delivered ({orders.filter((o) => o.status === 'delivered').length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-4 py-2 rounded-xl font-price text-xs font-bold transition-all ${
              activeFilter === 'pending'
                ? 'bg-[#ffb230] text-[#291800] chunky-btn-gold'
                : 'bg-[#1C1F29] text-[#cac6bb] border border-white/10 hover:border-white/25'
            }`}
          >
            Pending ({orders.filter((o) => o.status === 'pending').length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex flex-col gap-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-[#14161D] rounded-3xl border border-white/5 space-y-3">
            <Clock className="w-12 h-12 text-[#8B90A0] mx-auto opacity-50" />
            <h3 className="font-headline text-xl text-[#e2e2ec] uppercase">
              No orders found
            </h3>
            <p className="font-price text-xs text-[#8B90A0]">
              Browse the store and make your first instant KHQR purchase!
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isDelivered = order.status === 'delivered';
            const isPending = order.status === 'pending';

            return (
              <article
                key={order.id}
                className={`rounded-2xl border transition-all overflow-hidden flex flex-col md:flex-row ${
                  isDelivered
                    ? 'bg-[#1C1F29] border-white/10 hover:border-[#ffb230]/40 shadow-lg'
                    : order.status === 'rejected'
                    ? 'bg-[#1C1F29]/60 border-[#E8433F]/30 opacity-75'
                    : 'bg-[#14161D] border-[#ffb230]/30 border-dashed'
                }`}
              >
                {/* Status Column */}
                <div
                  className={`p-3 md:w-36 flex md:flex-col items-center justify-between md:justify-center gap-1 border-b md:border-b-0 md:border-r ${
                    isDelivered
                      ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/20 text-[#3ECF8E]'
                      : order.status === 'rejected'
                      ? 'bg-[#E8433F]/10 border-[#E8433F]/20 text-[#E8433F]'
                      : 'bg-[#ffb230]/10 border-[#ffb230]/20 text-[#ffb230]'
                  }`}
                >
                  <div className="flex items-center gap-1 font-price text-xs font-bold uppercase">
                    {isDelivered ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : order.status === 'rejected' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    <span>{order.status}</span>
                  </div>
                  <span className="font-price text-[11px] text-[#8B90A0]">
                    {order.date}, {order.time}
                  </span>
                </div>

                {/* Main Content Area */}
                <div className="p-4 md:p-5 flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={order.product.image}
                      alt={order.product.title}
                      className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                    <div>
                      <h3 className="font-headline text-lg text-[#e2e2ec] leading-tight">
                        {order.product.title}
                      </h3>
                      <p className="font-price text-xs text-[#8B90A0] mt-0.5">
                        Order <span className="text-[#ffd7a1] font-bold">{order.id}</span> • KHQR Paid
                      </p>
                    </div>
                  </div>

                  {/* Pricing and Action Button */}
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    <div className="flex flex-col sm:items-end">
                      <span className="font-price text-xl font-bold text-[#ffb230]">
                        ${(order.totalUSD ?? order.product?.price ?? 0).toFixed(2)} USD
                      </span>
                      <span className="font-price text-[10px] text-[#8B90A0]">
                        {order.quantity} item
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDelivered && (
                        <button
                          onClick={() => generateReceiptPdf(order)}
                          title="Download PDF Receipt (Paid)"
                          className="p-2.5 rounded-xl bg-[#282a31] hover:bg-[#ffb230] text-[#ffd7a1] hover:text-[#291800] border border-white/10 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                        >
                          <FileDown className="w-4 h-4 text-[#ffb230] group-hover:text-[#291800]" />
                          <span className="hidden sm:inline font-price text-[11px]">{lang === 'KM' ? 'វិក្កយបត្រ' : 'Receipt'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => onSelectOrder(order)}
                        className={`font-headline text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                          isDelivered
                            ? 'bg-[#ffb230] text-[#291800] chunky-btn-gold font-bold'
                            : 'bg-[#282a31] text-[#e2e2ec] hover:bg-[#33343c] border border-white/10'
                        }`}
                      >
                        {isDelivered ? (
                          order.fulfillmentType === 'trade' ? (
                            <>
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Contact Admin</span>
                            </>
                          ) : order.fulfillmentType === 'gift' ? (
                            <>
                              <Gift className="w-3.5 h-3.5" />
                              <span>Gift Info</span>
                            </>
                          ) : (
                            <>
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Get Credentials</span>
                            </>
                          )
                        ) : (
                          <span>View Details</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
