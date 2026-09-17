import React, { useState } from 'react';
import { Order } from '../../types';
import {
  Check,
  X,
  ArrowLeft,
  ZoomIn,
  Clock,
  User,
  Bell,
  Volume2,
  Radio,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Package,
  Gamepad2,
  AlertCircle,
  Sparkles,
  Download,
  FileSpreadsheet,
  Trash2,
  Receipt,
} from 'lucide-react';
import { getNotificationPermission, sendTestDesktopNotification } from '../../utils/desktopNotification';
import { api } from '../../utils/api';
import { exportOrdersToCSV } from '../../utils/csvExport';
import { generateReceiptPdf } from '../../utils/generateReceiptPdf';

interface AdminOrdersProps {
  orders: Order[];
  onApproveOrder: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onDeleteOrdersByStatus?: (status?: string) => void;
  onBack: () => void;
  lang: 'KM' | 'EN';
  storeLogoUrl?: string;
  onResendTelegramAlert?: (orderId: string) => Promise<void> | void;
}

// Helper component for rich color-coded status badges
const OrderStatusBadge: React.FC<{ status: Order['status']; lang: 'KM' | 'EN'; size?: 'sm' | 'md' }> = ({
  status,
  lang,
  size = 'md',
}) => {
  if (status === 'delivered') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-user font-bold rounded-full uppercase tracking-wider border shadow-sm ${
          size === 'sm'
            ? 'px-2.5 py-0.5 text-[10px]'
            : 'px-3 py-1 text-xs'
        } bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
        <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-emerald-400' : 'w-3.5 h-3.5 text-emerald-400'} />
        <span>{lang === 'KM' ? 'បានប្រគល់រួចរាល់' : 'Delivered'}</span>
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-user font-bold rounded-full uppercase tracking-wider border shadow-sm ${
          size === 'sm'
            ? 'px-2.5 py-0.5 text-[10px]'
            : 'px-3 py-1 text-xs'
        } bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_#EF4444]" />
        <XCircle className={size === 'sm' ? 'w-3 h-3 text-red-400' : 'w-3.5 h-3.5 text-red-400'} />
        <span>{lang === 'KM' ? 'បានបដិសេធ' : 'Rejected'}</span>
      </span>
    );
  }

  // Pending status
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-user font-bold rounded-full uppercase tracking-wider border shadow-sm ${
        size === 'sm'
          ? 'px-2.5 py-0.5 text-[10px]'
          : 'px-3 py-1 text-xs'
      } bg-amber-500/15 text-amber-400 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.2)]`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shadow-[0_0_6px_#F59E0B]" />
      <Clock className={size === 'sm' ? 'w-3 h-3 text-amber-400' : 'w-3.5 h-3.5 text-amber-400'} />
      <span>{lang === 'KM' ? 'រង់ចាំផ្ទៀងផ្ទាត់' : 'Pending'}</span>
    </span>
  );
};

export const AdminOrders: React.FC<AdminOrdersProps> = ({
  orders,
  onApproveOrder,
  onRejectOrder,
  onDeleteOrder,
  onDeleteOrdersByStatus,
  onBack,
  lang,
  storeLogoUrl,
  onResendTelegramAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [completedSubFilter, setCompletedSubFilter] = useState<'all' | 'delivered' | 'rejected'>('all');
  const [telegramFilter, setTelegramFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [resendingMap, setResendingMap] = useState<Record<string, boolean>>({});
  const [localFeedback, setLocalFeedback] = useState<{ [id: string]: string }>({});
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const handleExportCSV = (exportScope: 'current' | 'all') => {
    const dataToExport = exportScope === 'current' ? displayedOrders : orders;
    const scopeLabel = exportScope === 'current' ? `${activeTab}_filtered` : 'all';
    exportOrdersToCSV(dataToExport, `${scopeLabel}_orders`);
    setExportFeedback(`Exported ${dataToExport.length} orders to CSV`);
    setTimeout(() => setExportFeedback(null), 3500);
  };

  const handleQuickTest = () => {
    sendTestDesktopNotification(storeLogoUrl);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleResend = async (order: Order) => {
    setResendingMap((prev) => ({ ...prev, [order.id]: true }));
    try {
      if (onResendTelegramAlert) {
        await onResendTelegramAlert(order.id);
      } else {
        const res = await api.resendTelegramOrderAlert(order.id);
        if (res.dispatched) {
          order.telegramDispatched = true;
          order.telegramDispatchStatus = 'success';
          setLocalFeedback((prev) => ({ ...prev, [order.id]: '✅ Alert Dispatched to Telegram' }));
        } else {
          setLocalFeedback((prev) => ({ ...prev, [order.id]: '❌ Telegram Alert Failed. Check Token' }));
        }
      }
      setLocalFeedback((prev) => ({ ...prev, [order.id]: '✅ Dispatched to Telegram!' }));
      setTimeout(() => {
        setLocalFeedback((prev) => {
          const copy = { ...prev };
          delete copy[order.id];
          return copy;
        });
      }, 4000);
    } catch (e) {
      setLocalFeedback((prev) => ({ ...prev, [order.id]: '❌ Dispatch error' }));
    } finally {
      setResendingMap((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const rejectedOrders = orders.filter((o) => o.status === 'rejected');
  const completedOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'rejected');

  const baseOrders = activeTab === 'pending'
    ? pendingOrders
    : completedSubFilter === 'delivered'
    ? deliveredOrders
    : completedSubFilter === 'rejected'
    ? rejectedOrders
    : completedOrders;

  const displayedOrders = baseOrders.filter((order) => {
    const isDispatched = order.telegramDispatched === true || order.telegramDispatchStatus === 'success';
    if (telegramFilter === 'sent') return isDispatched;
    if (telegramFilter === 'failed') return !isDispatched;
    return true;
  });

  const totalSentCount = orders.filter((o) => o.telegramDispatched === true || o.telegramDispatchStatus === 'success').length;
  const totalFailedCount = orders.length - totalSentCount;

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center flex-1">
          <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider">
            {lang === 'KM' ? 'ការគ្រប់គ្រងការបញ្ជាទិញ' : 'ORDER MANAGEMENT'}
          </h1>
          <p className="font-price text-xs text-[#8B90A0]">
            {lang === 'KM' ? 'ផ្ទៀងផ្ទាត់ការទូទាត់ KHQR និងតាមដាន Telegram Alert' : 'Live KHQR Verification & Telegram Dispatch Tracking'}
          </p>
        </div>

        {/* Quick Export to CSV in Header */}
        <button
          id="btn-export-orders-csv"
          onClick={() => handleExportCSV('all')}
          className="bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 text-[#3ECF8E] border border-[#3ECF8E]/40 font-price text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-sm"
          title="Export all orders to CSV for bookkeeping"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* Export Success Feedback Notification */}
      {exportFeedback && (
        <div className="bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E] rounded-2xl px-4 py-3 text-xs font-price font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{exportFeedback}</span>
          </div>
          <span className="text-[11px] text-[#8B90A0]">Ready for Excel / Google Sheets</span>
        </div>
      )}

      {/* Telegram Real-time Alert & Desktop Watcher Status Bar */}
      <div className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-price text-xs font-bold text-[#e2e2ec]">
                Telegram Bot Alerts Status
              </span>
              <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-bold font-price px-2 py-0.5 rounded-full border border-[#3ECF8E]/30 flex items-center gap-1">
                <span>✅ {totalSentCount} Sent</span>
              </span>
              {totalFailedCount > 0 && (
                <span className="bg-[#E8433F]/20 text-[#E8433F] text-[10px] font-bold font-price px-2 py-0.5 rounded-full border border-[#E8433F]/30 flex items-center gap-1">
                  <span>❌ {totalFailedCount} Failed</span>
                </span>
              )}
            </div>
            <p className="font-price text-[11px] text-[#8B90A0]">
              Alerts deliver Product Name & Buyer Username directly to @uchirostore / Admin bot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleQuickTest}
            className="flex-1 sm:flex-initial bg-[#11131a] hover:bg-[#282a31] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] font-headline text-[11px] px-3 py-1.5 rounded-xl uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-1"
          >
            <Radio className={`w-3.5 h-3.5 ${testSent ? 'text-[#3ECF8E] animate-ping' : 'text-[#ffb230]'}`} />
            <span>{testSent ? 'Chime Played 🔔' : 'Test Chime'}</span>
          </button>
        </div>
      </div>

      {/* Main Tabs (Pending / Completed) & Telegram Filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs with Color Badges */}
          <div className="flex bg-[#1C1F29] p-1.5 rounded-2xl border border-white/10 flex-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-user text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-gradient-to-r from-[#ffb230] to-[#f59e0b] text-[#291800] chunky-btn-gold shadow-lg ring-1 ring-[#ffb230]/50'
                  : 'text-[#8B90A0] hover:text-[#ffd7a1]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                activeTab === 'pending'
                  ? 'bg-black/25 text-[#291800]'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {pendingOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-user text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'completed'
                  ? 'bg-gradient-to-r from-[#3ECF8E] to-[#10B981] text-[#003822] chunky-btn-success shadow-lg ring-1 ring-[#3ECF8E]/50'
                  : 'text-[#8B90A0] hover:text-[#ffd7a1]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Completed</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                activeTab === 'completed'
                  ? 'bg-black/25 text-[#003822]'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {completedOrders.length}
              </span>
            </button>
          </div>

          {/* Telegram Dispatch Filter Chips */}
          <div className="flex items-center gap-1.5 bg-[#1C1F29] p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setTelegramFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-user font-bold transition-all ${
                telegramFilter === 'all'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-[#8B90A0] hover:text-[#cac6bb]'
              }`}
            >
              All ({baseOrders.length})
            </button>
            <button
              onClick={() => setTelegramFilter('sent')}
              className={`px-3 py-2 rounded-xl text-xs font-user font-bold transition-all flex items-center gap-1 ${
                telegramFilter === 'sent'
                  ? 'bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40'
                  : 'text-[#8B90A0] hover:text-[#3ECF8E]'
              }`}
            >
              <span>✅ Sent</span>
            </button>
            <button
              onClick={() => setTelegramFilter('failed')}
              className={`px-3 py-2 rounded-xl text-xs font-user font-bold transition-all flex items-center gap-1 ${
                telegramFilter === 'failed'
                  ? 'bg-[#E8433F]/20 text-[#E8433F] border border-[#E8433F]/40'
                  : 'text-[#8B90A0] hover:text-[#E8433F]'
              }`}
            >
              <span>❌ Failed</span>
            </button>
          </div>
        </div>

        {/* Sub-status filter pills when in Completed tab */}
        {activeTab === 'completed' && (
          <div className="flex items-center gap-2 bg-[#14161D] p-2 rounded-xl border border-white/5 overflow-x-auto">
            <span className="text-xs font-user text-[#8B90A0] font-medium pl-1 shrink-0">
              Filter Status:
            </span>
            <button
              onClick={() => setCompletedSubFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-user font-bold transition-all shrink-0 ${
                completedSubFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'text-[#8B90A0] hover:text-white bg-white/5'
              }`}
            >
              All Completed ({completedOrders.length})
            </button>
            <button
              onClick={() => setCompletedSubFilter('delivered')}
              className={`px-2.5 py-1 rounded-lg text-xs font-user font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                completedSubFilter === 'delivered'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-emerald-400/70 hover:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Delivered ({deliveredOrders.length})</span>
            </button>
            <button
              onClick={() => setCompletedSubFilter('rejected')}
              className={`px-2.5 py-1 rounded-lg text-xs font-user font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                completedSubFilter === 'rejected'
                  ? 'bg-red-500/25 text-red-300 border border-red-500/40 shadow-sm'
                  : 'text-red-400/70 hover:text-red-400 bg-red-500/10 border border-red-500/20'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Rejected ({rejectedOrders.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Orders List Header & Batch Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <span className="font-price text-xs text-[#8B90A0]">
          Showing <span className="text-[#ffd7a1] font-bold">{displayedOrders.length}</span> of{' '}
          <span className="text-[#e2e2ec] font-bold">{orders.length}</span> total transactions
        </span>

        <div className="flex items-center gap-2">
          {activeTab === 'completed' && completedOrders.length > 0 && onDeleteOrdersByStatus && (
            <button
              onClick={() => {
                if (window.confirm(`Clear all ${completedOrders.length} completed & rejected orders from record?`)) {
                  onDeleteOrdersByStatus('delivered');
                  onDeleteOrdersByStatus('rejected');
                  setExportFeedback(`Cleared ${completedOrders.length} completed orders`);
                  setTimeout(() => setExportFeedback(null), 3500);
                }
              }}
              className="bg-[#E8433F]/15 hover:bg-[#E8433F]/25 text-[#E8433F] border border-[#E8433F]/30 font-price text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Delete all delivered/rejected orders from history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History ({completedOrders.length})</span>
            </button>
          )}

          <button
            onClick={() => handleExportCSV('current')}
            disabled={displayedOrders.length === 0}
            className="bg-[#1C1F29] hover:bg-[#282a31] disabled:opacity-40 disabled:pointer-events-none text-[#ffd7a1] hover:text-[#ffb230] border border-white/10 font-price text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Download CSV for currently filtered orders"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#3ECF8E]" />
            <span>Export View ({displayedOrders.length})</span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex flex-col gap-4">
        {displayedOrders.length === 0 ? (
          <div className="text-center py-16 bg-[#14161D] rounded-3xl border border-white/5 space-y-3">
            <Check className="w-12 h-12 text-[#3ECF8E] mx-auto opacity-60" />
            <h3 className="font-headline text-xl text-[#e2e2ec] uppercase">
              No orders found
            </h3>
            <p className="font-price text-xs text-[#8B90A0]">
              No transactions match the selected filter tabs.
            </p>
          </div>
        ) : (
          displayedOrders.map((order) => {
            const isPending = order.status === 'pending';
            const isDelivered = order.status === 'delivered';
            const isRejected = order.status === 'rejected';
            const isDispatched = order.telegramDispatched === true || order.telegramDispatchStatus === 'success';
            const isResending = resendingMap[order.id] || false;
            const feedbackText = localFeedback[order.id];

            const displayProductName = order.product?.title || order.productName || 'Game Item / Account';
            const displayBuyerUsername = order.buyerUsername || order.recipientRobloxUsername || order.customerName || 'Guest Buyer';

            // Distinct border and background styling per status
            const cardBorderClass = isPending
              ? 'border-amber-500/35 hover:border-amber-500/55 bg-[#1C1F29]/95 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
              : isDelivered
              ? 'border-emerald-500/25 hover:border-emerald-500/40 bg-[#1C1F29] shadow-[0_0_15px_rgba(16,185,129,0.05)]'
              : 'border-red-500/25 hover:border-red-500/40 bg-[#1C1F29]/90';

            return (
              <div
                key={order.id}
                className={`border rounded-2xl p-5 flex flex-col gap-4 shadow-lg transition-all ${cardBorderClass}`}
              >
                {/* Order Top Line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isPending
                        ? 'bg-amber-500/20 text-amber-400'
                        : isDelivered
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-user font-bold text-sm text-[#e2e2ec]">
                          {order.customerName}
                        </span>
                        <span className="font-mono text-xs text-[#ffd7a1] bg-[#11131a] px-2 py-0.5 rounded-lg border border-white/5 font-semibold">
                          {order.id}
                        </span>
                      </div>
                      <span className="font-price text-xs text-[#8B90A0]">
                        {order.date}, {order.time}
                      </span>
                    </div>
                  </div>

                  {/* Badges: Telegram Alert Status Icon & Color-Coded Order Status */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Telegram Dispatch Status Icon Pill */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-price font-bold border transition-colors ${
                        isDispatched
                          ? 'bg-[#3ECF8E]/15 text-[#3ECF8E] border-[#3ECF8E]/30'
                          : 'bg-[#E8433F]/15 text-[#E8433F] border-[#E8433F]/30'
                      }`}
                      title={
                        isDispatched
                          ? `Dispatched successfully to Telegram alert channel (${order.telegramDispatchedAt || 'Recorded'})`
                          : 'Telegram dispatch failed or pending. Click Resend to dispatch now.'
                      }
                    >
                      {isDispatched ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#3ECF8E]" />
                          <span>✅ Telegram Sent</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 shrink-0 text-[#E8433F]" />
                          <span>❌ Telegram Failed</span>
                        </>
                      )}
                    </div>

                    {/* Color-Coded Order Status Badge (Green / Red / Orange) */}
                    <OrderStatusBadge status={order.status} lang={lang} />

                    {/* Delete Order Quick Action */}
                    {onDeleteOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete order ${order.id}?`)) {
                            onDeleteOrder(order.id);
                            setExportFeedback(`Deleted order ${order.id}`);
                            setTimeout(() => setExportFeedback(null), 3000);
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-[#E8433F]/15 hover:bg-[#E8433F]/30 text-[#E8433F] border border-[#E8433F]/30 flex items-center justify-center transition-all active:scale-95 shrink-0"
                        title="Delete this order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Explicit Product Name & Buyer Username Highlight Box */}
                <div className="bg-[#14161D] rounded-xl p-3.5 border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2.5">
                    <Package className="w-4 h-4 text-[#ffb230] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-price text-[11px] text-[#8B90A0] uppercase tracking-wider block">
                        Product Name:
                      </span>
                      <span className="font-headline text-sm text-[#e2e2ec] font-bold block leading-snug">
                        {displayProductName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Gamepad2 className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-price text-[11px] text-[#8B90A0] uppercase tracking-wider block">
                        Buyer Username:
                      </span>
                      <span className="font-mono text-sm text-[#00F0FF] font-bold block">
                        @{displayBuyerUsername.replace(/^@/, '')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Product & Payment Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  {/* Product Thumbnail & Details */}
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <img
                      src={order.product?.image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150'}
                      alt={displayProductName}
                      className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                    <div>
                      <p className="font-price text-xs text-[#8B90A0]">
                        Total Amount: <span className="text-[#ffb230] font-bold text-sm">${(order.totalUSD ?? order.product?.price ?? 0).toFixed(2)} USD</span>
                      </p>
                      <p className="font-price text-[11px] text-[#3ECF8E]">
                        Payment: {order.paymentMethod || 'KHQR'} (Bakong / ABA)
                      </p>
                      <div className="font-price text-[11px] text-[#8B90A0] mt-1">
                        <span className="text-[#8B90A0]">Fulfillment: </span>
                        <span className="text-[#ffd7a1] uppercase font-bold">{order.fulfillmentType}</span>
                        {order.recipientRobloxUsername && (
                          <div className="mt-1 flex items-center gap-1.5 bg-[#11131a] p-1.5 rounded-lg border border-white/5 inline-flex">
                            {order.recipientRobloxProfile?.avatarUrl && (
                              <img
                                src={order.recipientRobloxProfile.avatarUrl}
                                alt={order.recipientRobloxUsername}
                                className="w-5 h-5 rounded-md object-cover border border-[#3ECF8E]"
                              />
                            )}
                            <span className="text-[#00F0FF] font-bold font-mono">
                              @{order.recipientRobloxUsername.replace(/^@/, '')}
                            </span>
                            <a
                              href={`https://www.roblox.com/search/users?keyword=${encodeURIComponent(order.recipientRobloxUsername.replace(/^@/, ''))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#8B90A0] hover:text-[#00F0FF] text-[10px] ml-1 underline"
                            >
                              Roblox Profile ↗
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment Slip Thumbnail & Telegram Retry Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    {order.paymentSlipUrl && (
                      <div className="flex items-center gap-2 bg-[#11131a] p-2 rounded-xl border border-white/5">
                        <span className="font-price text-[10px] text-[#8B90A0]">Slip:</span>
                        <div
                          onClick={() => setSelectedSlipUrl(order.paymentSlipUrl!)}
                          className="relative group cursor-pointer w-12 h-12 rounded-lg overflow-hidden border border-[#ffb230]/40"
                        >
                          <img
                            src={order.paymentSlipUrl}
                            alt="Slip"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {/* Receipt PDF Download Button */}
                      {(order.status === 'delivered' || (order.status as string) === 'completed') && (
                        <button
                          type="button"
                          onClick={() => generateReceiptPdf(order)}
                          className="font-headline text-[11px] px-3 py-1.5 rounded-xl uppercase font-bold transition-all flex items-center gap-1.5 border border-[#3ECF8E]/30 bg-[#3ECF8E]/10 hover:bg-[#3ECF8E]/20 text-[#3ECF8E] active:scale-95"
                          title="Download official PDF invoice & receipt"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      )}

                      {/* Resend Telegram Alert Button */}
                      <button
                        type="button"
                        onClick={() => handleResend(order)}
                        disabled={isResending}
                        className={`font-headline text-[11px] px-3 py-1.5 rounded-xl uppercase font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                          isDispatched
                            ? 'bg-[#11131a] hover:bg-[#282a31] text-[#ffd7a1] border-white/10 hover:border-[#ffb230]'
                            : 'bg-[#E8433F]/20 hover:bg-[#E8433F]/30 text-[#E8433F] border-[#E8433F]/40 animate-bounce'
                        }`}
                        title="Re-dispatch Telegram order notification payload with Product Name & Buyer Username"
                      >
                        {isResending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{isDispatched ? 'Resend Alert' : 'Retry Dispatch'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Local Feedback Toast if triggered */}
                {feedbackText && (
                  <div className="bg-[#11131a] rounded-xl p-2 border border-[#3ECF8E]/30 text-xs font-price text-[#3ECF8E] flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{feedbackText}</span>
                  </div>
                )}

                {/* Action Buttons for Pending Orders */}
                {isPending && (
                  <div className="flex gap-3 pt-2 border-t border-white/5">
                    <button
                      onClick={() => onRejectOrder(order.id)}
                      className="flex-1 bg-[#282a31] hover:bg-[#E8433F]/20 text-[#E8433F] border border-[#E8433F]/40 font-headline text-sm py-2.5 rounded-xl uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span className="font-khmer font-bold">{lang === 'KM' ? 'បដិសេធ' : 'Reject'}</span>
                    </button>

                    <button
                      onClick={() => onApproveOrder(order.id)}
                      className="flex-2 bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-sm py-2.5 rounded-xl uppercase tracking-wider font-bold chunky-btn-gold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span className="font-khmer font-bold">
                        {lang === 'KM' ? 'អនុម័ត & ប្រគល់គណនី' : 'Approve & Deliver'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Slip Zoom Modal */}
      {selectedSlipUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setSelectedSlipUrl(null)}
        >
          <div className="relative max-w-sm w-full bg-[#1C1F29] rounded-2xl p-4 border border-white/20 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="font-headline text-base text-[#ffd7a1]">
                PAYMENT RECEIPT (KHQR)
              </span>
              <button
                onClick={() => setSelectedSlipUrl(null)}
                className="text-[#8B90A0] hover:text-white"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedSlipUrl}
              alt="Payment Slip Full"
              className="w-full h-auto max-h-[70vh] object-contain rounded-xl border border-white/10"
            />
            <p className="text-center font-price text-xs text-[#8B90A0] mt-3">
              Verified with Cambodian Banking System
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

