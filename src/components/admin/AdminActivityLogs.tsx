import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  Clock,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  Package,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  ExternalLink,
  Calendar,
  Lock,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AdminActivityLog } from '../../types';
import { api } from '../../utils/api';

interface AdminActivityLogsProps {
  onBack: () => void;
  lang: 'KM' | 'EN';
  currentAdminId?: string;
  adminToken?: string | null;
}

type FilterCategory = 'all' | 'product_delete' | 'order_approve' | 'price_update' | 'product' | 'order' | 'security';

export const AdminActivityLogs: React.FC<AdminActivityLogsProps> = ({
  onBack,
  lang,
  currentAdminId = 'admin',
  adminToken,
}) => {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Fetch logs on mount
  const fetchLogs = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    try {
      const data = await api.getActivityLogs(adminToken || undefined);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClearLogs = async () => {
    setShowClearConfirm(false);
    try {
      await api.clearActivityLogs(adminToken || undefined);
      setLogs([]);
      setActionSuccessMsg(
        lang === 'KM' ? 'បានសម្អាតកំណត់ហេតុសកម្មភាពដោយជោគជ័យ' : 'Activity logs audit trail reset successfully'
      );
      setTimeout(() => setActionSuccessMsg(null), 3000);
      fetchLogs();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  // Export logs to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Date', 'Time', 'Admin ID', 'Action Type', 'Entity Type', 'Entity Title', 'Details', 'Previous Value', 'New Value', 'IP Address'];
    const rows = logs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.date}"`,
      `"${log.time}"`,
      `"${log.adminId || 'admin'}"`,
      `"${log.actionType}"`,
      `"${log.entityType}"`,
      `"${(log.entityTitle || '').replace(/"/g, '""')}"`,
      `"${(log.details || '').replace(/"/g, '""')}"`,
      `"${(log.previousValue || '').replace(/"/g, '""')}"`,
      `"${(log.newValue || '').replace(/"/g, '""')}"`,
      `"${log.ipAddress || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `uchiro_admin_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export logs to JSON
  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const jsonContent = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonContent);
    link.setAttribute('download', `uchiro_admin_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unique Admin IDs for dropdown
  const uniqueAdmins = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.adminId) set.add(l.adminId);
    });
    return Array.from(set);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory === 'product_delete' && log.actionType !== 'product_delete') {
        return false;
      }
      if (selectedCategory === 'order_approve' && log.actionType !== 'order_approve') {
        return false;
      }
      if (selectedCategory === 'price_update' && log.actionType !== 'price_update') {
        return false;
      }
      if (selectedCategory === 'product' && log.entityType !== 'product') {
        return false;
      }
      if (selectedCategory === 'order' && log.entityType !== 'order') {
        return false;
      }
      if (selectedCategory === 'security' && log.entityType !== 'auth' && !log.actionType.includes('admin') && !log.actionType.includes('security')) {
        return false;
      }

      // Admin filter
      if (selectedAdminFilter !== 'all' && log.adminId !== selectedAdminFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesDetail = (log.details || '').toLowerCase().includes(query);
        const matchesKhmer = (log.detailsKhmer || '').toLowerCase().includes(query);
        const matchesAdmin = (log.adminId || '').toLowerCase().includes(query);
        const matchesEntity = (log.entityTitle || '').toLowerCase().includes(query);
        const matchesEntityId = (log.entityId || '').toLowerCase().includes(query);
        const matchesAction = (log.actionType || '').toLowerCase().includes(query);
        return matchesDetail || matchesKhmer || matchesAdmin || matchesEntity || matchesEntityId || matchesAction;
      }

      return true;
    });
  }, [logs, selectedCategory, selectedAdminFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const deletions = logs.filter((l) => l.actionType === 'product_delete' || l.actionType === 'order_delete').length;
    const approvals = logs.filter((l) => l.actionType === 'order_approve').length;
    const priceUpdates = logs.filter((l) => l.actionType === 'price_update').length;
    const securityLogins = logs.filter((l) => l.entityType === 'auth' || l.actionType.includes('admin_login')).length;
    return { total, deletions, approvals, priceUpdates, securityLogins };
  }, [logs]);

  // Relative Time Helper
  const getRelativeTime = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return lang === 'KM' ? 'អម្បាញ់មិញ' : 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return lang === 'KM' ? `${diffMinutes} នាទីមុន` : `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return lang === 'KM' ? `${diffHours} ម៉ោងមុន` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return lang === 'KM' ? `${diffDays} ថ្ងៃមុន` : `${diffDays}d ago`;
  };

  // Badge Render Helper
  const renderActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'product_delete':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444]">
            <Trash2 className="w-3 h-3" />
            {lang === 'KM' ? 'លុបទំនិញ' : 'Product Deleted'}
          </span>
        );
      case 'order_approve':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E]">
            <CheckCircle2 className="w-3 h-3" />
            {lang === 'KM' ? 'អនុម័តការបញ្ជាទិញ' : 'Order Approved'}
          </span>
        );
      case 'order_reject':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444]">
            <XCircle className="w-3 h-3" />
            {lang === 'KM' ? 'បដិសេធការបញ្ជាទិញ' : 'Order Rejected'}
          </span>
        );
      case 'order_delete':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444]">
            <Trash2 className="w-3 h-3" />
            {lang === 'KM' ? 'លុបការបញ្ជាទិញ' : 'Order Deleted'}
          </span>
        );
      case 'price_update':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF]">
            <DollarSign className="w-3 h-3" />
            {lang === 'KM' ? 'កែប្រែតម្លៃ' : 'Price Updated'}
          </span>
        );
      case 'product_create':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E]">
            <Package className="w-3 h-3" />
            {lang === 'KM' ? 'បង្កើតទំនិញថ្មី' : 'Product Created'}
          </span>
        );
      case 'product_update':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B]">
            <Package className="w-3 h-3" />
            {lang === 'KM' ? 'កែប្រែទំនិញ' : 'Product Updated'}
          </span>
        );
      case 'admin_login':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#ffb230]/15 border border-[#ffb230]/40 text-[#ffb230]">
            <Lock className="w-3 h-3" />
            {lang === 'KM' ? 'Admin ចូលប្រើ' : 'Admin Login'}
          </span>
        );
      case 'admin_logout':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#8B90A0]/15 border border-[#8B90A0]/40 text-[#8B90A0]">
            <Lock className="w-3 h-3" />
            {lang === 'KM' ? 'Admin ចាកចេញ' : 'Admin Logout'}
          </span>
        );
      case 'admin_auto_logout':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#F97316]/15 border border-[#F97316]/40 text-[#F97316]">
            <Clock className="w-3 h-3" />
            {lang === 'KM' ? 'ចាកចេញស្វ័យប្រវត្ត (30នាទី)' : 'Auto-Logout (30m)'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/10 text-white/90">
            <Sliders className="w-3 h-3" />
            {actionType.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f15] text-white p-3 sm:p-6 space-y-5 font-headline">
      {/* Toast banner */}
      {actionSuccessMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#121520] border border-[#3ECF8E]/50 text-[#3ECF8E] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121520] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-white/80 hover:text-white"
            title={lang === 'KM' ? 'ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង' : 'Back to Dashboard'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#ffb230]/20 text-[#ffb230] border border-[#ffb230]/30 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {lang === 'KM' ? 'សវនកម្ម & គណនេយ្យភាព' : 'AUDIT TRAIL & ACCOUNTABILITY'}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[#8B90A0]">
                {logs.length} {lang === 'KM' ? 'កំណត់ត្រា' : 'Events'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold mt-1 text-white flex items-center gap-2">
              {lang === 'KM' ? 'កំណត់ហេតុសកម្មភាព Admin (Activity Log)' : 'Administrator Activity Log'}
            </h1>
          </div>
        </div>

        {/* Action Controls: Refresh, Export, Clear */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-all text-white/90 disabled:opacity-50"
            title={lang === 'KM' ? 'ទាញយកឡើងវិញ' : 'Refresh logs'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#ffb230]' : ''}`} />
            <span>{lang === 'KM' ? 'ផ្ទុកឡើងវិញ' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-all text-white/90 disabled:opacity-40"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5 text-[#3ECF8E]" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-all text-white/90 disabled:opacity-40"
            title="Download JSON report"
          >
            <Download className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>JSON</span>
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] text-xs font-medium transition-all disabled:opacity-40"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'សម្អាត' : 'Clear'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Logs */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121520] border border-[#EF4444]/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center gap-3 text-[#EF4444]">
              <div className="p-2.5 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'KM' ? 'បញ្ជាក់ការសម្អាតកំណត់ហេតុ' : 'Clear Activity Logs?'}
                </h3>
                <p className="text-xs text-[#8B90A0]">
                  {lang === 'KM'
                    ? 'តើអ្នកប្រាកដទេថាចង់សម្អាតប្រវត្តិសកម្មភាពទាំងអស់? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។'
                    : 'Are you sure you want to purge all recorded audit logs? This action cannot be undone.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-colors"
              >
                {lang === 'KM' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button
                onClick={handleClearLogs}
                className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#EF4444]/90 text-white text-xs font-semibold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                {lang === 'KM' ? 'យល់ព្រមលុប' : 'Purge All Logs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-price">
        {/* Total Events */}
        <div className="bg-[#121520] border border-white/5 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[#8B90A0] text-xs">
            <span>{lang === 'KM' ? 'សកម្មភាពសរុប' : 'Total Actions'}</span>
            <Shield className="w-4 h-4 text-[#ffb230]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-[10.5px] text-[#8B90A0]">
            {lang === 'KM' ? 'បានកត់ត្រាក្នុងប្រព័ន្ធ' : 'Recorded in audit log'}
          </div>
        </div>

        {/* Product Deletions */}
        <div className="bg-[#121520] border border-white/5 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[#8B90A0] text-xs">
            <span>{lang === 'KM' ? 'ការលុបទំនិញ/កុម្ម៉ង់' : 'Deletions'}</span>
            <Trash2 className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#EF4444]">{stats.deletions}</div>
          <div className="text-[10.5px] text-[#8B90A0]">
            {lang === 'KM' ? 'សកម្មភាពលុបទិន្នន័យ' : 'Destructive operations'}
          </div>
        </div>

        {/* Order Approvals */}
        <div className="bg-[#121520] border border-white/5 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[#8B90A0] text-xs">
            <span>{lang === 'KM' ? 'អនុម័តការបញ្ជាទិញ' : 'Order Approvals'}</span>
            <CheckCircle2 className="w-4 h-4 text-[#3ECF8E]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#3ECF8E]">{stats.approvals}</div>
          <div className="text-[10.5px] text-[#8B90A0]">
            {lang === 'KM' ? 'បានបញ្ជូនទៅអតិថិជន' : 'Credentials released'}
          </div>
        </div>

        {/* Price Updates */}
        <div className="bg-[#121520] border border-white/5 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[#8B90A0] text-xs">
            <span>{lang === 'KM' ? 'កែប្រែតម្លៃទំនិញ' : 'Price Updates'}</span>
            <DollarSign className="w-4 h-4 text-[#00F0FF]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#00F0FF]">{stats.priceUpdates}</div>
          <div className="text-[10.5px] text-[#8B90A0]">
            {lang === 'KM' ? 'ការកែសម្រួលតម្លៃ' : 'Catalog pricing adjusted'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#121520] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B90A0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'KM'
                  ? 'ស្វែងរកតាមឈ្មោះ Admin, សកម្មភាព, ID, ឬឈ្មោះទំនិញ...'
                  : 'Search by Admin ID, item title, order ID, or action description...'
              }
              className="w-full bg-[#181b26] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-[#8B90A0] focus:outline-none focus:border-[#ffb230] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8B90A0] hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Admin ID filter dropdown */}
          {uniqueAdmins.length > 1 && (
            <div className="w-full md:w-56">
              <select
                value={selectedAdminFilter}
                onChange={(e) => setSelectedAdminFilter(e.target.value)}
                className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffb230]"
              >
                <option value="all">{lang === 'KM' ? 'គ្រប់ Admin ទាំងអស់' : 'All Administrators'}</option>
                {uniqueAdmins.map((adm) => (
                  <option key={adm} value={adm}>
                    Admin: {adm}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#ffb230] text-[#121520] font-bold shadow-[0_0_10px_rgba(255,178,48,0.3)]'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            {lang === 'KM' ? 'ទាំងអស់' : 'All Events'} ({logs.length})
          </button>

          <button
            onClick={() => setSelectedCategory('product_delete')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'product_delete'
                ? 'bg-[#EF4444] text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>{lang === 'KM' ? 'លុបទំនិញ' : 'Product Deletions'}</span>
          </button>

          <button
            onClick={() => setSelectedCategory('order_approve')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'order_approve'
                ? 'bg-[#3ECF8E] text-[#121520] font-bold shadow-[0_0_10px_rgba(62,207,142,0.3)]'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{lang === 'KM' ? 'អនុម័តកុម្ម៉ង់' : 'Order Approvals'}</span>
          </button>

          <button
            onClick={() => setSelectedCategory('price_update')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'price_update'
                ? 'bg-[#00F0FF] text-[#121520] font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            <span>{lang === 'KM' ? 'កែប្រែតម្លៃ' : 'Price Updates'}</span>
          </button>

          <button
            onClick={() => setSelectedCategory('product')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'product'
                ? 'bg-white/20 text-white font-bold'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            <Package className="w-3 h-3" />
            <span>{lang === 'KM' ? 'ទំនិញទូទៅ' : 'Products & Catalog'}</span>
          </button>

          <button
            onClick={() => setSelectedCategory('order')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'order'
                ? 'bg-white/20 text-white font-bold'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-3 h-3" />
            <span>{lang === 'KM' ? 'ការបញ្ជាទិញ' : 'Orders'}</span>
          </button>

          <button
            onClick={() => setSelectedCategory('security')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'security'
                ? 'bg-[#ffb230] text-[#121520] font-bold'
                : 'bg-white/5 text-[#8B90A0] hover:bg-white/10 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>{lang === 'KM' ? 'សុវត្ថិភាព & ចូលប្រើ' : 'Security & Logins'}</span>
          </button>
        </div>
      </div>

      {/* Activity Logs Timeline / List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="p-12 text-center text-[#8B90A0] bg-[#121520] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#ffb230]" />
            <p className="text-sm font-medium">
              {lang === 'KM' ? 'កំពុងទាញយកកំណត់ហេតុ...' : 'Loading activity logs...'}
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-[#8B90A0] bg-[#121520] border border-white/5 rounded-2xl space-y-2">
            <Shield className="w-10 h-10 mx-auto text-white/20" />
            <p className="text-sm font-semibold text-white/70">
              {lang === 'KM' ? 'មិនមានសកម្មភាពដែលត្រូវគ្នានឹងការស្វែងរកទេ' : 'No activity logs matching your filter'}
            </p>
            <p className="text-xs text-[#8B90A0]">
              {searchQuery
                ? (lang === 'KM' ? 'សូមសាកល្បងពាក្យគន្លឹះផ្សេងទៀត' : 'Try clearing your search query or changing filters.')
                : (lang === 'KM' ? 'រាល់សកម្មភាពសំខាន់ៗរបស់ Admin នឹងត្រូវបានកត់ត្រានៅទីនេះ' : 'Key administrator actions will appear here automatically.')}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            return (
              <div
                key={log.id}
                className="bg-[#121520] hover:bg-[#161a27] border border-white/5 hover:border-white/15 rounded-2xl p-4 transition-all duration-200 shadow-md font-price space-y-3"
              >
                {/* Top Row: Timestamp, Action Badge, Admin ID */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderActionBadge(log.actionType)}

                    {/* Administrator ID badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/90 text-xs font-semibold">
                      <User className="w-3 h-3 text-[#ffb230]" />
                      <span>Admin ID:</span>
                      <span className="text-[#ffd7a1] font-mono">{log.adminId || 'admin'}</span>
                    </span>

                    {/* Entity Title or ID badge if present */}
                    {log.entityTitle && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1d2232] border border-white/5 text-[#8B90A0] text-[11px]">
                        <span className="text-white/90 font-medium">{log.entityTitle}</span>
                      </span>
                    )}
                  </div>

                  {/* Date, Time and Relative Time */}
                  <div className="flex items-center gap-2 text-[#8B90A0] text-[11px] self-start sm:self-auto">
                    <Clock className="w-3.5 h-3.5 text-[#8B90A0]" />
                    <span>{getRelativeTime(log.timestamp)}</span>
                    <span className="text-white/20">•</span>
                    <span>{log.date} {log.time}</span>
                  </div>
                </div>

                {/* Middle: Details Description */}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white/95 leading-relaxed">
                    {lang === 'KM' && log.detailsKhmer ? log.detailsKhmer : log.details}
                  </p>

                  {/* Previous / New Value changes if recorded */}
                  {(log.previousValue !== undefined || log.newValue !== undefined) && (
                    <div className="flex items-center gap-2 text-xs pt-1">
                      {log.previousValue !== undefined && (
                        <div className="flex items-center gap-1 text-[#8B90A0]">
                          <span>{lang === 'KM' ? 'តម្លៃដើម/ស្ថានភាពមុន:' : 'Previous:'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-white/70 line-through">
                            {log.previousValue}
                          </span>
                        </div>
                      )}
                      {log.previousValue !== undefined && log.newValue !== undefined && (
                        <span className="text-[#8B90A0]">→</span>
                      )}
                      {log.newValue !== undefined && (
                        <div className="flex items-center gap-1 text-[#3ECF8E]">
                          <span className="text-[#8B90A0]">{lang === 'KM' ? 'ថ្មី:' : 'New:'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 font-mono font-bold text-[#3ECF8E]">
                            {log.newValue}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Metadata info (IP address, ID) */}
                <div className="flex items-center justify-between text-[10.5px] text-[#5e6577] border-t border-white/5 pt-2">
                  <span className="font-mono">Log ID: {log.id}</span>
                  {log.ipAddress && (
                    <span className="font-mono">IP: {log.ipAddress}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
