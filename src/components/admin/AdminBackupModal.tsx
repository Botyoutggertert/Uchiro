import React, { useState, useRef } from 'react';
import { Product, Order, Coupon, StoreSettings, UserProfile, SongTrack, FullAppState } from '../../types';
import {
  exportStoreBackup,
  validateBackupFile,
  BackupMetadata,
} from '../../utils/backup';
import { exportOrdersToCSV } from '../../utils/csvExport';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Code,
  ShieldCheck,
  Boxes,
  ShoppingBag,
  Tag,
  Save,
  Eye,
  Layers,
  X,
  Sparkles,
} from 'lucide-react';

interface AdminBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  settings: StoreSettings;
  userProfile?: UserProfile;
  songs?: SongTrack[];
  onImportBackup: (importedData: FullAppState, mode: 'overwrite' | 'merge') => Promise<boolean>;
  onResetToZero?: () => void;
  onResetData?: (mode: 'zero' | 'starter') => void;
  lang: 'KM' | 'EN';
}

export const AdminBackupModal: React.FC<AdminBackupModalProps> = ({
  isOpen,
  onClose,
  products,
  orders,
  coupons,
  settings,
  userProfile,
  songs,
  onImportBackup,
  onResetToZero,
  onResetData,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'backup-restore' | 'json-editor' | 'quick-tools'>('backup-restore');
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');

  // File Upload State
  const [importedFileContent, setImportedFileContent] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');
  const [validatedData, setValidatedData] = useState<FullAppState | null>(null);
  const [validatedMeta, setValidatedMeta] = useState<BackupMetadata | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Live JSON Editor State
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [isSavingRawJson, setIsSavingRawJson] = useState(false);
  const [jsonSaveSuccess, setJsonSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Compute current database stats
  const totalCatalogValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 1), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalUSD || 0), 0);

  const currentState: FullAppState = {
    products,
    orders,
    coupons,
    settings,
    userProfile: userProfile || ({} as UserProfile),
    songs: songs || settings.songs || [],
    analytics: {
      liveNow: 142,
      totalVisits: '45.2K',
      visitsGrowth: '+14%',
      uniqueVisitors: '18.9K',
      uniqueGrowth: '+8%',
      avgSession: '4m 12s',
      sessionGrowth: '+22s',
      traffic24h: [],
      devices: { mobile: 74, desktop: 26 },
      locations: [],
      trafficSources: [],
      tgReferred: '78%',
      topPage: 'Blox Fruits Mythical',
    },
  };

  const handleExportJSON = () => {
    exportStoreBackup(currentState, settings.storeName);
  };

  const handleExportCSV = () => {
    exportOrdersToCSV(orders, 'All_Orders');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    setValidationError(null);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportedFileContent(content);

      const result = validateBackupFile(content);
      if (result.valid && result.backupData) {
        setValidatedData(result.backupData);
        setValidatedMeta(result.metadata || null);
        setValidationError(null);
      } else {
        setValidatedData(null);
        setValidatedMeta(null);
        setValidationError(result.error || 'Invalid backup file structure.');
      }
    };
    reader.onerror = () => {
      setValidationError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!validatedData) return;
    setIsImporting(true);
    setValidationError(null);

    try {
      const ok = await onImportBackup(validatedData, importMode);
      if (ok) {
        setImportSuccessMessage(
          importMode === 'overwrite'
            ? `Successfully restored ${validatedData.products?.length || 0} products, ${validatedData.orders?.length || 0} orders, and store settings!`
            : `Successfully merged backup data with existing store state!`
        );
        // Clear staged file after 3s
        setTimeout(() => {
          setValidatedData(null);
          setValidatedMeta(null);
          setImportedFileContent(null);
          setImportedFileName('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }, 3500);
      } else {
        setValidationError('Import failed on server. Please verify backup schema.');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Error occurred while applying backup.');
    } finally {
      setIsImporting(false);
    }
  };

  // Initialize Raw JSON Editor
  const handleOpenJsonEditor = () => {
    setActiveTab('json-editor');
    const dump = {
      products,
      orders,
      coupons,
      settings,
      songs: songs || settings.songs || [],
    };
    setRawJsonText(JSON.stringify(dump, null, 2));
    setJsonSyntaxError(null);
  };

  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      setRawJsonText(JSON.stringify(parsed, null, 2));
      setJsonSyntaxError(null);
    } catch (e: any) {
      setJsonSyntaxError(`Syntax Error: ${e.message}`);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonText);
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const handleSaveRawJson = async () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      setJsonSyntaxError(null);
      setIsSavingRawJson(true);

      const result = validateBackupFile(rawJsonText);
      if (!result.valid || !result.backupData) {
        setJsonSyntaxError(result.error || 'Invalid database structure');
        setIsSavingRawJson(false);
        return;
      }

      const ok = await onImportBackup(result.backupData, 'overwrite');
      if (ok) {
        setJsonSaveSuccess(true);
        setTimeout(() => setJsonSaveSuccess(false), 3000);
      } else {
        setJsonSyntaxError('Server error while saving JSON.');
      }
    } catch (e: any) {
      setJsonSyntaxError(`JSON Syntax Error: ${e.message}`);
    } finally {
      setIsSavingRawJson(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-[#14161D] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-[#1C1F29] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ffb230] to-[#E8433F] text-[#291800] flex items-center justify-center font-bold shadow-[0_0_20px_rgba(255,178,48,0.25)]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-headline text-lg sm:text-xl text-[#ffd7a1] uppercase flex items-center gap-2">
                <span>Store Database & Backup Manager</span>
                <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#3ECF8E]/30">
                  v2.0
                </span>
              </h2>
              <p className="font-price text-xs text-[#8B90A0]">
                Full data control, 1-click JSON backup export & restore, and raw database editor
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#11131a] hover:bg-[#282a31] border border-white/10 text-[#8B90A0] hover:text-white flex items-center justify-center transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#11131a] px-4 sm:px-6 pt-2">
          <button
            onClick={() => setActiveTab('backup-restore')}
            className={`font-headline text-xs uppercase font-bold py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'backup-restore'
                ? 'border-[#ffb230] text-[#ffd7a1]'
                : 'border-transparent text-[#8B90A0] hover:text-[#e2e2ec]'
            }`}
          >
            <Download className="w-4 h-4 text-[#ffb230]" />
            <span>Export & Import Backup</span>
          </button>

          <button
            onClick={handleOpenJsonEditor}
            className={`font-headline text-xs uppercase font-bold py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'json-editor'
                ? 'border-[#00F0FF] text-[#00F0FF]'
                : 'border-transparent text-[#8B90A0] hover:text-[#e2e2ec]'
            }`}
          >
            <Code className="w-4 h-4 text-[#00F0FF]" />
            <span>Raw JSON Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('quick-tools')}
            className={`font-headline text-xs uppercase font-bold py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'quick-tools'
                ? 'border-[#E8433F] text-[#ffd7a1]'
                : 'border-transparent text-[#8B90A0] hover:text-[#e2e2ec]'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-[#E8433F]" />
            <span>Data Wiping & Reset Tools</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: BACKUP & RESTORE */}
          {activeTab === 'backup-restore' && (
            <div className="space-y-6">
              {/* Current Database Overview Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1C1F29] p-4 rounded-2xl border border-white/10">
                <div className="space-y-0.5">
                  <span className="font-price text-[10px] text-[#8B90A0] uppercase font-bold">Catalog Items</span>
                  <div className="font-headline text-xl text-[#00F0FF] font-bold">{products.length} Products</div>
                  <span className="font-price text-[10px] text-[#8B90A0]">${totalCatalogValue.toFixed(2)} Stock</span>
                </div>

                <div className="space-y-0.5">
                  <span className="font-price text-[10px] text-[#8B90A0] uppercase font-bold">Orders Logged</span>
                  <div className="font-headline text-xl text-[#3ECF8E] font-bold">{orders.length} Orders</div>
                  <span className="font-price text-[10px] text-[#8B90A0]">${totalRevenue.toFixed(2)} Revenue</span>
                </div>

                <div className="space-y-0.5">
                  <span className="font-price text-[10px] text-[#8B90A0] uppercase font-bold">Active Coupons</span>
                  <div className="font-headline text-xl text-[#ffd7a1] font-bold">{coupons.length} Promo Codes</div>
                  <span className="font-price text-[10px] text-[#8B90A0]">Discounts & VIP</span>
                </div>

                <div className="space-y-0.5">
                  <span className="font-price text-[10px] text-[#8B90A0] uppercase font-bold">Store Configuration</span>
                  <div className="font-headline text-sm text-[#e2e2ec] font-bold truncate">{settings.storeName}</div>
                  <span className="font-price text-[10px] text-[#3ECF8E]">KHQR & Bots Active</span>
                </div>
              </div>

              {/* SECTION A: EXPORT BACKUP */}
              <div className="bg-[#1C1F29] border border-[#ffb230]/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#ffb230]/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#ffb230]/20 text-[#ffb230] flex items-center justify-center font-bold">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-headline text-base text-[#ffd7a1] uppercase">1. Export Full Store Backup (.JSON)</h3>
                      <p className="font-price text-xs text-[#8B90A0]">
                        Creates a self-contained archive of all inventory items, orders, coupon codes, and store settings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="bg-[#282a31] hover:bg-[#33353e] text-[#d6c4ae] border border-white/10 px-3.5 py-2.5 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 transition-all"
                      title="Download Orders CSV"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#3ECF8E]" />
                      <span>Orders CSV</span>
                    </button>

                    <button
                      onClick={handleExportJSON}
                      className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] px-5 py-2.5 rounded-xl font-headline text-xs uppercase font-bold chunky-btn-gold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      <FileJson className="w-4 h-4" />
                      <span>DOWNLOAD .JSON BACKUP</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-price text-[#8B90A0]">
                  <ShieldCheck className="w-4 h-4 text-[#3ECF8E]" />
                  <span>Backup contains exact snapshots of credentials, product images, timestamps, and customer balances.</span>
                </div>
              </div>

              {/* SECTION B: IMPORT / RESTORE BACKUP */}
              <div className="bg-[#1C1F29] border border-[#00F0FF]/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center font-bold">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline text-base text-[#ffd7a1] uppercase">2. Import & Restore Backup (.JSON)</h3>
                    <p className="font-price text-xs text-[#8B90A0]">
                      Upload a previously exported Uchiro backup file to restore products, orders, and configuration.
                    </p>
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div className="bg-[#11131a] border-2 border-dashed border-white/20 hover:border-[#00F0FF] rounded-2xl p-6 text-center transition-colors">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="backup-file-input"
                  />
                  <label htmlFor="backup-file-input" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center">
                      <FileJson className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-headline text-sm text-[#ffd7a1] uppercase block">
                        {importedFileName ? importedFileName : 'Choose .JSON Backup File or Drag Here'}
                      </span>
                      <span className="font-price text-xs text-[#8B90A0]">Supports Uchiro store v1.0 and v2.0 JSON packages</span>
                    </div>
                  </label>
                </div>

                {/* Validation Success Box */}
                {validatedData && validatedMeta && (
                  <div className="bg-[#11131a] border border-[#3ECF8E]/40 rounded-2xl p-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="font-headline text-xs text-[#3ECF8E] uppercase flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        Valid Backup Package Verified
                      </span>
                      <span className="font-price text-xs text-[#8B90A0]">
                        Exported: {new Date(validatedMeta.exportedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-price">
                      <div className="bg-[#1C1F29] p-2.5 rounded-xl border border-white/5">
                        <span className="text-[#8B90A0] block text-[10px]">Products</span>
                        <span className="text-[#00F0FF] font-bold text-base">{validatedMeta.productsCount}</span>
                      </div>
                      <div className="bg-[#1C1F29] p-2.5 rounded-xl border border-white/5">
                        <span className="text-[#8B90A0] block text-[10px]">Orders</span>
                        <span className="text-[#3ECF8E] font-bold text-base">{validatedMeta.ordersCount}</span>
                      </div>
                      <div className="bg-[#1C1F29] p-2.5 rounded-xl border border-white/5">
                        <span className="text-[#8B90A0] block text-[10px]">Coupons</span>
                        <span className="text-[#ffd7a1] font-bold text-base">{validatedMeta.couponsCount}</span>
                      </div>
                      <div className="bg-[#1C1F29] p-2.5 rounded-xl border border-white/5">
                        <span className="text-[#8B90A0] block text-[10px]">Target Store</span>
                        <span className="text-[#e2e2ec] font-bold text-xs truncate block">{validatedMeta.storeName}</span>
                      </div>
                    </div>

                    {/* Restore Mode Selector */}
                    <div className="pt-2 border-t border-white/5">
                      <label className="font-price text-xs text-[#8B90A0] block font-bold mb-2">Select Restore Action Mode:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImportMode('overwrite')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            importMode === 'overwrite'
                              ? 'bg-[#E8433F]/20 border-[#E8433F] text-[#ffd7a1]'
                              : 'bg-[#1C1F29] border-white/10 text-[#8B90A0]'
                          }`}
                        >
                          <div className="font-headline text-xs uppercase font-bold flex items-center justify-between">
                            <span>1. Full Replace / Overwrite</span>
                            {importMode === 'overwrite' && <Check className="w-3.5 h-3.5 text-[#E8433F]" />}
                          </div>
                          <span className="font-price text-[11px] text-[#8B90A0] block mt-0.5">
                            Completely replaces current inventory and orders with backup.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImportMode('merge')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            importMode === 'merge'
                              ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] text-[#ffd7a1]'
                              : 'bg-[#1C1F29] border-white/10 text-[#8B90A0]'
                          }`}
                        >
                          <div className="font-headline text-xs uppercase font-bold flex items-center justify-between">
                            <span>2. Intelligent Merge</span>
                            {importMode === 'merge' && <Check className="w-3.5 h-3.5 text-[#3ECF8E]" />}
                          </div>
                          <span className="font-price text-[11px] text-[#8B90A0] block mt-0.5">
                            Merges new products and orders without wiping existing ones.
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Execute Button */}
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleExecuteImport}
                      className="w-full bg-[#00F0FF] hover:bg-[#33f3ff] text-[#05131A] font-headline text-sm py-3 rounded-xl uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Restoring Store Database...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          <span>APPLY & RESTORE BACKUP NOW</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Errors & Success Messages */}
                {validationError && (
                  <div className="bg-[#E8433F]/20 border border-[#E8433F]/50 text-[#ffd7a1] p-3 rounded-xl flex items-center gap-2 font-price text-xs">
                    <AlertTriangle className="w-4 h-4 text-[#E8433F] shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {importSuccessMessage && (
                  <div className="bg-[#3ECF8E]/20 border border-[#3ECF8E]/50 text-[#3ECF8E] p-3 rounded-xl flex items-center gap-2 font-price text-xs font-bold animate-[scaleIn_0.2s_ease-out]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{importSuccessMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RAW JSON EDITOR */}
          {activeTab === 'json-editor' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1C1F29] p-4 rounded-2xl border border-white/10">
                <div>
                  <h3 className="font-headline text-base text-[#00F0FF] uppercase">Live JSON Database Inspector</h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    Inspect, format, edit, or copy the exact raw database state directly.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrettifyJson}
                    className="bg-[#282a31] hover:bg-[#33353e] text-[#ffd7a1] border border-white/10 px-3 py-2 rounded-xl text-xs font-price font-bold transition-all"
                  >
                    Format / Prettify
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="bg-[#282a31] hover:bg-[#33353e] text-[#ffd7a1] border border-white/10 px-3 py-2 rounded-xl text-xs font-price font-bold flex items-center gap-1.5 transition-all"
                  >
                    {jsonCopied ? <Check className="w-3.5 h-3.5 text-[#3ECF8E]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{jsonCopied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSavingRawJson}
                    onClick={handleSaveRawJson}
                    className="bg-[#3ECF8E] hover:bg-[#4de19e] text-[#05131A] px-4 py-2 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingRawJson ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

              {jsonSyntaxError && (
                <div className="bg-[#E8433F]/20 border border-[#E8433F]/50 text-[#ffd7a1] p-3 rounded-xl flex items-center gap-2 font-price text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#E8433F] shrink-0" />
                  <span>{jsonSyntaxError}</span>
                </div>
              )}

              {jsonSaveSuccess && (
                <div className="bg-[#3ECF8E]/20 border border-[#3ECF8E]/50 text-[#3ECF8E] p-3 rounded-xl flex items-center gap-2 font-price text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Raw database state successfully parsed, applied, and persisted to disk!</span>
                </div>
              )}

              <textarea
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                rows={18}
                className="w-full bg-[#0c0e15] border border-white/10 rounded-2xl p-4 text-xs font-mono text-[#00F0FF] focus:border-[#00F0FF] outline-none leading-relaxed resize-y selection:bg-[#00F0FF]/30"
                spellCheck={false}
              />
            </div>
          )}

          {/* TAB 3: QUICK TOOLS & WIPING */}
          {activeTab === 'quick-tools' && (
            <div className="space-y-4">
              <div className="bg-[#1C1F29] border border-[#E8433F]/30 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3 text-[#E8433F] border-b border-white/10 pb-3">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <div>
                    <h3 className="font-headline text-base uppercase">Testing & Inventory Reset Tools</h3>
                    <p className="font-price text-xs text-[#8B90A0]">Wipe all items or load pre-made game packages</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onResetToZero) onResetToZero();
                      else if (onResetData) onResetData('zero');
                      onClose();
                    }}
                    className="bg-[#282a31] hover:bg-[#E8433F]/20 text-[#E8433F] border border-[#E8433F]/40 p-4 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-headline text-sm uppercase font-bold">Wipe to 0 Clean State</span>
                      <Trash2 className="w-4 h-4 group-hover:scale-110" />
                    </div>
                    <p className="font-price text-[11px] text-[#8B90A0]">
                      Empties all products & orders to 0. Perfect for fresh catalog testing.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onResetData) onResetData('starter');
                      onClose();
                    }}
                    className="bg-[#282a31] hover:bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40 p-4 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-headline text-sm uppercase font-bold">Load Starter Pack</span>
                      <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                    </div>
                    <p className="font-price text-[11px] text-[#8B90A0]">
                      Restores 10 official game accounts, mythical fruits, and sample orders.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#1C1F29] border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-[#282a31] hover:bg-[#33353e] text-[#e2e2ec] font-headline text-xs px-5 py-2.5 rounded-xl uppercase font-bold transition-colors"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};
