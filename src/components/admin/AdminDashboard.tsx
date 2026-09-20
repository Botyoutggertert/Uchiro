import React, { useState, useEffect } from 'react';
import { Product, Order, VisitorAnalyticsData, ActiveScreen, Coupon, StoreSettings, UserProfile, SongTrack, FullAppState } from '../../types';
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Clock,
  Boxes,
  PackageCheck,
  Plus,
  QrCode,
  Tag,
  ArrowUpRight,
  Zap,
  RefreshCw,
  Settings,
  Music,
  Bell,
  Volume2,
  Radio,
  Sparkles,
  Bot,
  Send,
  ShieldCheck,
  ArrowRight,
  Database,
  Download,
  Upload,
  FileJson,
  Ticket,
  Users,
} from 'lucide-react';
import { getNotificationPermission, sendTestDesktopNotification, isSoundAlertEnabled } from '../../utils/desktopNotification';
import { AdminBackupModal } from './AdminBackupModal';
import { api } from '../../utils/api';
import { safeStorage } from '../../utils/storage';
import { INITIAL_STORE_SETTINGS } from '../../data/mockData';

interface AdminDashboardProps {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  analytics: VisitorAnalyticsData;
  settings?: StoreSettings;
  userProfile?: UserProfile;
  songs?: SongTrack[];
  setActiveScreen: (screen: ActiveScreen) => void;
  onReleaseAllDrafts: () => void;
  onLogoutAdmin: () => void;
  onImportBackup?: (importedData: FullAppState, mode: 'overwrite' | 'merge') => Promise<boolean>;
  onResetToZero?: () => void;
  onResetData?: (mode: 'zero' | 'starter') => void;
  lang: 'KM' | 'EN';
  storeLogoUrl?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  orders,
  coupons,
  analytics,
  settings,
  userProfile,
  songs,
  setActiveScreen,
  onReleaseAllDrafts,
  onLogoutAdmin,
  onImportBackup,
  onResetToZero,
  onResetData,
  lang,
  storeLogoUrl,
}) => {
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const approvedOrders = orders.filter((o) => o.status === 'delivered');
  const activeProducts = products.filter((p) => !p.isDraft);
  const inStockActiveProducts = activeProducts.filter((p) => p.stock > 0);
  const draftCount = products.filter((p) => p.isDraft).length;
  const totalRevenueUSD = approvedOrders.reduce((acc, curr) => acc + (curr?.totalUSD ?? curr?.product?.price ?? 0), 0);

  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [testSuccess, setTestSuccess] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [ddosStatus, setDdosStatus] = useState<any>(null);
  const [isTogglingUnderAttack, setIsTogglingUnderAttack] = useState(false);

  const fetchDdosStatus = async () => {
    try {
      const res = await api.getDDoSStatus();
      if (res.success) {
        setDdosStatus(res);
      }
    } catch {}
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
    fetchDdosStatus();
    const interval = setInterval(fetchDdosStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleUnderAttack = async () => {
    setIsTogglingUnderAttack(true);
    try {
      const token = safeStorage.getItem('uchiro_admin_token') || undefined;
      const res = await api.toggleUnderAttackMode(token);
      if (res.success) {
        await fetchDdosStatus();
      }
    } catch (e) {
      console.error('Toggle under attack error:', e);
    } finally {
      setIsTogglingUnderAttack(false);
    }
  };

  const handleQuickTest = () => {
    sendTestDesktopNotification(storeLogoUrl, () => setActiveScreen('admin-orders'));
    setTestSuccess(true);
    setTimeout(() => setTestSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Welcome & Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider">
              {lang === 'KM' ? 'ផ្ទាំងគ្រប់គ្រងរដ្ឋបាល' : 'ADMIN DASHBOARD'}
            </h1>
            <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-bold font-price px-2.5 py-0.5 rounded-full border border-[#3ECF8E]/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
              LIVE STORE
            </span>
          </div>
          <p className="font-price text-xs text-[#8B90A0] mt-1">
            {lang === 'KM'
              ? 'ទិដ្ឋភាពទូទៅនៃចំណូល ការបញ្ជាទិញ និងទំនិញក្នុងស្តុក'
              : 'Real-time overview of revenue, order queue, and inventory health'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('store')}
            className="bg-[#3ECF8E]/20 hover:bg-[#3ECF8E]/30 text-[#3ECF8E] border border-[#3ECF8E]/50 font-headline text-xs px-3.5 sm:px-4 py-2 rounded-xl uppercase font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer"
            title="View Live Customer Store"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'មើលហាងទំនិញ' : 'View Store'}</span>
          </button>
          <button
            onClick={() => setActiveScreen('admin-add-item')}
            className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs px-4 py-2 rounded-xl uppercase font-bold chunky-btn-gold shadow-md flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'បន្ថែមទំនិញ' : 'Add Product'}</span>
          </button>
          <button
            onClick={onLogoutAdmin}
            className="bg-[#E8433F]/15 hover:bg-[#E8433F]/25 text-[#E8433F] border border-[#E8433F]/30 font-price text-xs font-bold px-3.5 py-2 rounded-xl transition-colors active:scale-95"
            title="Logout from Admin Panel"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Cloudflare Anti-DDoS & WAF Enterprise Defense Station */}
      <div className="bg-[#121520] border border-[#ffb230]/30 rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffb230]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ffb230]/20 to-[#f59e0b]/10 border border-[#ffb230]/40 text-[#ffb230] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,178,48,0.25)]">
              <ShieldCheck className="w-5 h-5 text-[#ffb230]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline text-base sm:text-lg text-[#ffd7a1] uppercase tracking-wider">
                  {lang === 'KM' ? 'ប្រព័ន្ធការពារ CLOUDFLARE ANTI-DDOS & WAF' : 'CLOUDFLARE ANTI-DDOS & WAF'}
                </h3>
                <span className="bg-[#ffb230]/20 text-[#ffb230] text-[10px] font-bold font-price px-2 py-0.5 rounded-full border border-[#ffb230]/40 uppercase tracking-wider">
                  {ddosStatus?.status || 'ACTIVE SHIELD'}
                </span>
                {ddosStatus?.underAttackMode && (
                  <span className="bg-[#E8433F]/20 text-[#E8433F] text-[10px] font-bold font-price px-2 py-0.5 rounded-full border border-[#E8433F]/40 animate-pulse">
                    🚨 UNDER ATTACK MODE ON
                  </span>
                )}
              </div>
              <p className="font-price text-xs text-[#8B90A0] mt-0.5">
                {lang === 'KM'
                  ? 'ការពារការវាយប្រហារ DDOS, ការលួច Hack ពាក្យសម្ងាត់, Rate Limit ៦០សំណើ/នាទី និង HTTP Fingerprint WAF'
                  : 'Multi-layer rate limiting (60 req/min), suspicious IP mitigation, HTTP fingerprinting & anti-bot challenge'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleToggleUnderAttack}
              disabled={isTogglingUnderAttack}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-headline uppercase tracking-wider font-bold transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5 ${
                ddosStatus?.underAttackMode
                  ? 'bg-[#E8433F] text-white hover:bg-[#ff5a55]'
                  : 'bg-[#1C1F29] hover:bg-[#252835] text-[#ffd7a1] border border-white/10 hover:border-[#ffb230]/40'
              }`}
              title="Toggle Cloudflare 'I'm Under Attack' high-scrutiny defense mode"
            >
              <Zap className={`w-3.5 h-3.5 ${ddosStatus?.underAttackMode ? 'text-white fill-white' : 'text-[#ffb230]'}`} />
              <span>
                {isTogglingUnderAttack
                  ? 'Updating...'
                  : ddosStatus?.underAttackMode
                  ? 'Disable Under Attack'
                  : "Enable 'Under Attack'"}
              </span>
            </button>

            <button
              onClick={fetchDdosStatus}
              className="p-2 rounded-xl bg-[#1C1F29] text-[#8B90A0] hover:text-[#ffd7a1] border border-white/5 hover:border-white/20 transition-colors"
              title="Refresh DDoS statistics"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* DDoS Real-time Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-3.5 border-t border-white/5 font-price">
          <div className="bg-[#0e1017] rounded-xl p-2.5 border border-white/5">
            <div className="text-[10px] text-[#8B90A0] uppercase font-bold">Requests Inspected</div>
            <div className="text-base sm:text-lg font-headline font-bold text-[#e2e2ec] mt-0.5">
              {(ddosStatus?.totalRequestsInspected ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#0e1017] rounded-xl p-2.5 border border-white/5">
            <div className="text-[10px] text-[#8B90A0] uppercase font-bold">Threats / Bad Blocked</div>
            <div className="text-base sm:text-lg font-headline font-bold text-[#3ECF8E] mt-0.5">
              {(ddosStatus?.blockedRequestsCount ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#0e1017] rounded-xl p-2.5 border border-white/5">
            <div className="text-[10px] text-[#8B90A0] uppercase font-bold">Protected Client IPs</div>
            <div className="text-base sm:text-lg font-headline font-bold text-[#ffd7a1] mt-0.5">
              {(ddosStatus?.activeIpsTracked ?? 1).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#0e1017] rounded-xl p-2.5 border border-white/5">
            <div className="text-[10px] text-[#8B90A0] uppercase font-bold">Defense Strategy</div>
            <div className="text-xs sm:text-sm font-headline font-bold text-[#ffb230] mt-1 truncate">
              {ddosStatus?.underAttackMode ? 'AGGRESSIVE (UNDER ATTACK)' : 'AUTOMATED WAF'}
            </div>
          </div>
        </div>
      </div>

      {/* Super Secure Admin Security Shield Banner */}
      <div className="bg-[#10131c] border border-[#3ECF8E]/30 rounded-2xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 text-[#3ECF8E] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-user font-bold text-xs text-[#e2e2ec]">
                {lang === 'KM' ? 'ប្រព័ន្ធសុវត្ថិភាព Admin កម្រិតខ្ពស់' : 'SUPER SECURE ADMIN SESSION'}
              </span>
              <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] font-price text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                ACTIVE
              </span>
            </div>
            <p className="font-price text-[11px] text-[#8B90A0]">
              Anti-Brute Force (5-Attempt Lockout) • Cryptographic Token • IP Defense Protected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="banner-btn-activity-logs"
            onClick={() => setActiveScreen('admin-activity-logs')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 border border-[#3ECF8E]/40 text-[#3ECF8E] text-xs font-bold transition-all shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'កំណត់ហេតុសកម្មភាព (Logs)' : 'Audit Activity Log'}</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-price text-[#ffd7a1]">
            <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
            <span>Encrypted Gateway Active</span>
          </div>
        </div>
      </div>

      {/* High-Level Executive Summary Cards (Top of Dashboard) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Revenue (USD) */}
        <div
          id="summary-card-total-revenue"
          onClick={() => setActiveScreen('admin-orders')}
          className="bg-gradient-to-br from-[#1C1F29] to-[#14161D] border border-white/10 hover:border-[#3ECF8E]/60 rounded-3xl p-5 md:p-6 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 shadow-xl group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#3ECF8E]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#3ECF8E]/10 transition-colors" />

          <div>
            <div className="flex items-center justify-between">
              <span className="font-price text-xs text-[#8B90A0] uppercase font-bold tracking-wider">
                {lang === 'KM' ? 'ចំណូលសរុប (USD)' : 'Total Revenue (USD)'}
              </span>
              <div className="w-10 h-10 rounded-2xl bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4">
              <span className="font-headline text-3xl sm:text-4xl text-[#3ECF8E] font-bold tracking-tight block">
                ${totalRevenueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="font-price text-xs text-[#ffd7a1] font-semibold mt-1 block">
                ≈ {(totalRevenueUSD * 4100).toLocaleString('en-US')} KHR (Bakong)
              </span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between">
            <span className="bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 text-[11px] font-price font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{approvedOrders.length} Completed</span>
            </span>
            <span className="text-[11px] font-price text-[#8B90A0] group-hover:text-[#3ECF8E] flex items-center gap-0.5 transition-colors">
              <span>View Orders</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Card 2: Pending Orders */}
        <div
          id="summary-card-pending-orders"
          onClick={() => setActiveScreen('admin-orders')}
          className={`bg-gradient-to-br from-[#1C1F29] to-[#14161D] border rounded-3xl p-5 md:p-6 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 shadow-xl group relative overflow-hidden ${
            pendingOrders.length > 0
              ? 'border-[#ffb230]/40 hover:border-[#ffb230] shadow-[0_0_20px_rgba(255,178,48,0.1)]'
              : 'border-white/10 hover:border-white/20'
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffb230]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#ffb230]/10 transition-colors" />

          <div>
            <div className="flex items-center justify-between">
              <span className="font-price text-xs text-[#8B90A0] uppercase font-bold tracking-wider">
                {lang === 'KM' ? 'ការបញ្ជាទិញរង់ចាំ' : 'Pending Orders'}
              </span>
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                  pendingOrders.length > 0
                    ? 'bg-[#ffb230]/20 text-[#ffb230] border border-[#ffb230]/40 animate-pulse'
                    : 'bg-white/10 text-[#8B90A0]'
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4">
              <span
                className={`font-headline text-3xl sm:text-4xl font-bold tracking-tight block ${
                  pendingOrders.length > 0 ? 'text-[#ffb230]' : 'text-[#e2e2ec]'
                }`}
              >
                {pendingOrders.length}
              </span>
              <span className="font-price text-xs text-[#8B90A0] mt-1 block">
                {pendingOrders.length > 0
                  ? 'Awaiting KHQR payment review & delivery'
                  : 'All customer orders cleared & delivered'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between">
            <span
              className={`text-[11px] font-price font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                pendingOrders.length > 0
                  ? 'bg-[#ffb230]/20 text-[#ffb230] border-[#ffb230]/40'
                  : 'bg-[#3ECF8E]/20 text-[#3ECF8E] border-[#3ECF8E]/30'
              }`}
            >
              {pendingOrders.length > 0 ? (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>Action Required</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>All Clear</span>
                </>
              )}
            </span>
            <span className="text-[11px] font-price text-[#8B90A0] group-hover:text-[#ffb230] flex items-center gap-0.5 transition-colors">
              <span>Process Queue</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Card 3: Active Products */}
        <div
          id="summary-card-active-products"
          onClick={() => setActiveScreen('admin-items')}
          className="bg-gradient-to-br from-[#1C1F29] to-[#14161D] border border-white/10 hover:border-[#00F0FF]/60 rounded-3xl p-5 md:p-6 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 shadow-xl group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F0FF]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00F0FF]/10 transition-colors" />

          <div>
            <div className="flex items-center justify-between">
              <span className="font-price text-xs text-[#8B90A0] uppercase font-bold tracking-wider">
                {lang === 'KM' ? 'ទំនិញសកម្ម' : 'Active Products'}
              </span>
              <div className="w-10 h-10 rounded-2xl bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Boxes className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-3xl sm:text-4xl text-[#00F0FF] font-bold tracking-tight">
                  {activeProducts.length}
                </span>
                <span className="font-price text-xs text-[#8B90A0]">
                  / {products.length} catalog total
                </span>
              </div>
              <span className="font-price text-xs text-[#8B90A0] mt-1 block">
                {inStockActiveProducts.length} items currently in stock
              </span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between">
            <span className="bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 text-[11px] font-price font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <PackageCheck className="w-3 h-3" />
              <span>{draftCount > 0 ? `${draftCount} Drafts` : 'Catalog Live'}</span>
            </span>
            <span className="text-[11px] font-price text-[#8B90A0] group-hover:text-[#00F0FF] flex items-center gap-0.5 transition-colors">
              <span>Manage Items</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </section>

      {/* Top Banner: Draft Items Waiting (if any) */}
      {draftCount > 0 && (
        <div className="bg-gradient-to-r from-[#ffb230]/20 via-[#ffb230]/10 to-transparent border border-[#ffb230]/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffb230] text-[#291800] flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-headline text-lg text-[#ffd7a1]">
                {draftCount} DRAFT ITEMS WAITING
              </h4>
              <p className="font-price text-xs text-[#8B90A0]">
                Pre-configured game accounts ready for public marketplace.
              </p>
            </div>
          </div>
          <button
            onClick={onReleaseAllDrafts}
            className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs px-5 py-2.5 rounded-xl uppercase font-bold chunky-btn-gold shadow-md shrink-0"
          >
            🚀 RELEASE ALL DRAFTS
          </button>
        </div>
      )}

      {/* Telegram Dual-Bot & Order Dispatch Section Banner */}
      <div className="bg-gradient-to-r from-[#00F0FF]/15 via-[#1C1F29] to-[#6F00BE]/20 border border-[#00F0FF]/30 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 flex items-center justify-center font-bold shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-sm md:text-base text-[#ffd7a1] uppercase">
                {lang === 'KM' ? 'ប្រព័ន្ធ Telegram Bots & ត្រួតពិនិត្យ Username' : 'Telegram Dual-Bot & Profile Inspector'}
              </h3>
              <span className="bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 text-[10px] font-price font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
                Real-Time Orders Alert Ready
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0] mt-0.5">
              {lang === 'KM'
                ? 'Bot #1 ទទួលដំណឹង Order ភ្លាមៗ • Bot #2 សេវាអតិថិជន Mini App • ប្រព័ន្ធ Check Roblox Profile'
                : 'Bot 1: Real-time Order Alerts • Bot 2: Customer Mini App • Live Roblox/Telegram Profile Inspector'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveScreen('admin-bot-config')}
            className="w-full sm:w-auto bg-[#00F0FF] hover:bg-[#33f3ff] text-[#05131A] font-headline text-xs px-5 py-3 rounded-xl uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 shrink-0"
          >
            <Settings className="w-4 h-4" />
            <span>{lang === 'KM' ? 'កំណត់ Telegram Bots' : 'Configure Bots & Scanner'}</span>
          </button>
        </div>
      </div>

      {/* Main Feature Navigation Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setActiveScreen('admin-orders')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#ffb230]/15 text-[#ffb230] group-hover:scale-110 transition-transform flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#e2e2ec] uppercase">
            Orders ({pendingOrders.length})
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-bot-config')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-[#00F0FF]/30 hover:border-[#00F0FF] rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#00F0FF]/20 text-[#00F0FF] group-hover:scale-110 transition-transform flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#00F0FF] uppercase">
            Telegram Bots
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-items')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#6F00BE]/20 text-[#d6b2fc] group-hover:scale-110 transition-transform flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#e2e2ec] uppercase">
            Inventory ({products.length})
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-add-item')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#3ECF8E]/15 text-[#3ECF8E] group-hover:scale-110 transition-transform flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#e2e2ec] uppercase">
            + Add Product
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-settings')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#ffb230]/20 text-[#ffb230] group-hover:scale-110 transition-transform flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#e2e2ec] uppercase">
            KHQR & Settings
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-coupons')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#ffb230]/15 text-[#ffd7a1] group-hover:scale-110 transition-transform flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#e2e2ec] uppercase">
            Coupons ({coupons.length})
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-users')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-[#00F0FF]/30 hover:border-[#00F0FF] rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#00F0FF]/20 text-[#00F0FF] group-hover:scale-110 transition-transform flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#00F0FF] uppercase flex items-center gap-1">
            <span>User Accounts</span>
          </span>
        </button>

        <button
          onClick={() => setActiveScreen('admin-resellers')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-[#ffb230]/30 hover:border-[#ffb230] rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#ffb230]/20 text-[#ffb230] group-hover:scale-110 transition-transform flex items-center justify-center border border-[#ffb230]/30">
            <Ticket className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#ffd7a1] uppercase flex items-center gap-1.5">
            <span>VIP & Vouchers</span>
            <span className="bg-[#ffb230] text-[#291800] text-[9px] font-bold px-1.5 py-0.5 rounded font-price">HOT</span>
          </span>
        </button>

        <button
          id="admin-nav-activity-logs"
          onClick={() => setActiveScreen('admin-activity-logs')}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-[#3ECF8E]/40 hover:border-[#3ECF8E] rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group shadow-md"
        >
          <div className="w-11 h-11 rounded-xl bg-[#3ECF8E]/20 text-[#3ECF8E] group-hover:scale-110 transition-transform flex items-center justify-center border border-[#3ECF8E]/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-headline text-xs text-[#3ECF8E] uppercase flex items-center gap-1.5">
            <span>Activity Log</span>
            <span className="bg-[#3ECF8E] text-[#0d0f15] text-[9px] font-bold px-1.5 py-0.5 rounded font-price">AUDIT</span>
          </span>
        </button>

        <button
          onClick={() => setIsBackupModalOpen(true)}
          className="col-span-2 sm:col-span-2 lg:col-span-6 bg-gradient-to-r from-[#1C1F29] via-[#222633] to-[#1C1F29] hover:border-[#ffb230] border border-[#ffb230]/30 rounded-2xl p-3.5 flex items-center justify-between transition-all active:scale-[0.99] group shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffb230]/20 text-[#ffb230] group-hover:scale-110 transition-transform flex items-center justify-center border border-[#ffb230]/30">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-headline text-sm text-[#ffd7a1] uppercase tracking-wide">
                  {lang === 'KM' ? 'មជ្ឈមណ្ឌលគ្រប់គ្រងទិន្នន័យ & បម្រុងទុក (Export / Import Backup)' : 'Database Backup & Restore Hub'}
                </span>
                <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full uppercase border border-[#3ECF8E]/30">
                  Full Store Control
                </span>
              </div>
              <p className="font-price text-xs text-[#8B90A0]">
                {lang === 'KM'
                  ? 'ទាញយក JSON/CSV Backup ឬ Import ទិន្នន័យផលិតផល Order និងការកំណត់ទាំងអស់'
                  : 'Export complete store JSON/CSV backups, restore from files, or manage database slate'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block bg-[#ffb230] text-[#291800] px-3 py-1.5 rounded-xl font-headline text-xs font-bold uppercase">
              Manage Database
            </span>
            <ArrowRight className="w-4 h-4 text-[#ffb230] group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </section>

      {/* Main Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visitor 7-Day Trend Chart */}
        <div className="lg:col-span-2 bg-[#1C1F29] rounded-2xl p-5 md:p-6 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-price text-xs text-[#8B90A0] uppercase font-bold">
                VISITORS (LAST 7 DAYS)
              </span>
              <h3 className="font-headline text-2xl text-[#ffd7a1] mt-0.5">
                45,280 Visits
              </h3>
            </div>
            <div className="flex items-center gap-1 bg-[#3ECF8E]/20 text-[#3ECF8E] font-price text-xs font-bold px-2.5 py-1 rounded-full border border-[#3ECF8E]/30">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+14.2%</span>
            </div>
          </div>

          {/* Interactive Bar Chart */}
          <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2">
            {[
              { day: 'Mon', count: 4200, height: '55%' },
              { day: 'Tue', count: 5800, height: '70%' },
              { day: 'Wed', count: 5100, height: '62%' },
              { day: 'Thu', count: 6900, height: '85%' },
              { day: 'Fri', count: 8200, height: '95%' },
              { day: 'Sat', count: 7600, height: '90%' },
              { day: 'Sun', count: 8900, height: '100%' },
            ].map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full bg-[#11131a] rounded-lg h-32 flex items-end p-1 relative">
                  <div
                    className="w-full bg-gradient-to-t from-[#ffb230] to-[#ffd7a1] rounded-md transition-all duration-500 group-hover:brightness-125"
                    style={{ height: d.height }}
                  />
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0c0e15] border border-white/10 text-[10px] font-price text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {d.count.toLocaleString()}
                  </span>
                </div>
                <span className="font-price text-xs text-[#8B90A0]">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visitor Insights Side Panel */}
        <div className="bg-[#1C1F29] rounded-2xl p-5 md:p-6 border border-white/10 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-headline text-lg text-[#e2e2ec] uppercase">
              Live Insights
            </h3>
            <span className="flex items-center gap-1 text-[11px] text-[#3ECF8E] font-price font-bold">
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
              Live
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8B90A0] font-sans">Visitors Today</span>
              <span className="font-price text-base font-bold text-[#ffd7a1]">
                {analytics.liveNow.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8B90A0] font-sans">TG Referred</span>
              <span className="font-price text-base font-bold text-[#3ECF8E]">
                {analytics.tgReferred}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8B90A0] font-sans">Top Page</span>
              <span className="font-price text-xs font-bold text-[#e2e2ec] truncate max-w-[140px]">
                {analytics.topPage}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8B90A0] font-sans">Est. USD Sales</span>
              <span className="font-price text-base font-bold text-[#ffb230]">
                ${(totalRevenueUSD || 0).toFixed(2)} USD
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveScreen('admin-analytics')}
              className="flex-1 bg-[#282a31] hover:bg-[#33343c] border border-white/10 text-[#ffd7a1] font-price text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onLogoutAdmin}
              className="bg-[#E8433F]/15 hover:bg-[#E8433F]/25 text-[#E8433F] border border-[#E8433F]/30 font-price text-xs font-bold px-3 py-2.5 rounded-xl transition-colors"
              title="Logout from Admin Panel"
            >
              Logout
            </button>
          </div>
        </div>
      </section>

      {/* Database Backup & Data Management Modal */}
      {isBackupModalOpen && (
        <AdminBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          products={products}
          orders={orders}
          coupons={coupons}
          settings={settings || INITIAL_STORE_SETTINGS}
          userProfile={userProfile}
          songs={songs}
          onImportBackup={onImportBackup || (async () => false)}
          onResetToZero={onResetToZero}
          onResetData={onResetData}
          lang={lang}
        />
      )}
    </div>
  );
};
