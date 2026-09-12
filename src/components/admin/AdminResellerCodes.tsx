import React, { useState, useEffect } from 'react';
import { ResellerRedeemCode } from '../../types';
import { api } from '../../utils/api';
import {
  Ticket,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Zap,
  Users,
  Coins,
  Calendar,
  AlertCircle,
  Eye,
  X,
  Layers,
  ArrowLeft,
  DollarSign,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminResellerCodesProps {
  onBack: () => void;
  lang: 'KM' | 'EN';
  showToast: (msg: string) => void;
}

export const AdminResellerCodes: React.FC<AdminResellerCodesProps> = ({
  onBack,
  lang,
  showToast,
}) => {
  const [codes, setCodes] = useState<ResellerRedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'balance' | 'reseller_rank' | 'both'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Code Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'balance' | 'reseller_rank' | 'both'>('balance');
  const [formValueUSD, setFormValueUSD] = useState<number>(10.0);
  const [formResellerName, setFormResellerName] = useState('');
  const [formMaxUses, setFormMaxUses] = useState<number>(1);
  const [formNote, setFormNote] = useState('');

  // Bulk Generator State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkCount, setBulkCount] = useState<number>(5);

  // Redemptions History Modal
  const [inspectCode, setInspectCode] = useState<ResellerRedeemCode | null>(null);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const data = await api.getResellerCodes();
      setCodes(data);
    } catch (err) {
      console.error('Failed to fetch reseller codes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const generateRandomCode = (type: 'balance' | 'reseller_rank' | 'both', prefix = 'UCH') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (type === 'reseller_rank') {
      return `VIP-RESELLER-${rand}`;
    }
    if (type === 'both') {
      return `MEGA-RESELLER-${rand}`;
    }
    return `${prefix}-GIFT-${rand}`;
  };

  const handleOpenCreateModal = (bulk = false) => {
    setIsBulkMode(bulk);
    setFormCode(generateRandomCode(formType));
    setFormType('balance');
    setFormValueUSD(10.0);
    setFormResellerName('');
    setFormMaxUses(1);
    setFormNote('');
    setShowCreateModal(true);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Copied code: ${text}`);
    try {
      confetti({ particleCount: 20, spread: 40, origin: { y: 0.6 } });
    } catch {}
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = async (id: string) => {
    const target = codes.find((c) => c.id === id);
    if (!target) return;

    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c))
    );

    try {
      await api.toggleResellerCode(id);
      showToast(`Code ${target.isActive ? 'deactivated' : 'activated'}`);
    } catch (err) {
      console.error('Failed to toggle code:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this redeem code?')) return;

    setCodes((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.deleteResellerCode(id);
      showToast('Reseller code deleted');
    } catch (err) {
      console.error('Failed to delete code:', err);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isBulkMode) {
        // Generate multiple codes
        const count = Math.min(Math.max(1, bulkCount), 50);
        const createdList = [];

        for (let i = 0; i < count; i++) {
          const generated = generateRandomCode(formType, (formResellerName || 'UCH').slice(0, 3).toUpperCase());
          const newCode: Partial<ResellerRedeemCode> = {
            code: generated,
            type: formType,
            valueUSD: formType === 'reseller_rank' ? 0 : Number(formValueUSD) || 0,
            resellerName: formResellerName.trim() || 'Official Reseller Batch',
            maxUses: Number(formMaxUses) || 1,
            usedCount: 0,
            usedBy: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            note: formNote.trim() || `Bulk batch of ${count} codes`,
          };
          const res = await api.createResellerCode(newCode);
          if (res.success && res.code) {
            createdList.push(res.code);
          }
        }

        showToast(`🎉 Successfully created ${createdList.length} Reseller Codes!`);
      } else {
        const cleanCode = formCode.trim().toUpperCase();
        if (!cleanCode) return;

        const newCode: Partial<ResellerRedeemCode> = {
          code: cleanCode,
          type: formType,
          valueUSD: formType === 'reseller_rank' ? 0 : Number(formValueUSD) || 0,
          resellerName: formResellerName.trim() || 'Official Partner',
          maxUses: Number(formMaxUses) || 1,
          usedCount: 0,
          usedBy: [],
          isActive: true,
          createdAt: new Date().toISOString(),
          note: formNote.trim(),
        };

        const res = await api.createResellerCode(newCode);
        if (res.success) {
          showToast(`🎉 Code ${cleanCode} created successfully!`);
        } else {
          showToast(res.error || 'Failed to create code');
        }
      }

      setShowCreateModal(false);
      fetchCodes();
    } catch (err) {
      console.error('Error creating reseller code:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCodes = codes.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.resellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.note && c.note.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === 'all' || c.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalValueUSD = codes.reduce((acc, c) => acc + (c.valueUSD || 0) * (c.maxUses || 1), 0);
  const totalClaimedValueUSD = codes.reduce(
    (acc, c) => acc + (c.valueUSD || 0) * (c.usedCount || 0),
    0
  );
  const activeCount = codes.filter((c) => c.isActive).length;

  return (
    <div className="min-h-screen pt-20 pb-32 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-headline text-xl sm:text-2xl md:text-3xl text-[#ffd7a1] uppercase flex items-center gap-2">
              <Ticket className="w-6 h-6 text-[#ffb230]" />
              <span>{lang === 'KM' ? 'គ្រប់គ្រងកូដ Reseller & Voucher' : 'Reseller Codes & Vouchers'}</span>
            </h1>
            <p className="text-xs font-price text-[#8B90A0]">
              Create gift cards, wallet balance vouchers, and VIP Reseller 20% discount rank codes for your partners.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenCreateModal(true)}
            className="bg-[#1C1F29] hover:bg-[#282a31] text-[#ffd7a1] border border-white/15 px-3.5 py-2 rounded-xl text-xs font-headline font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95 shadow-md"
          >
            <Layers className="w-4 h-4 text-[#ffb230]" />
            <span>Bulk Batch</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal(false)}
            className="bg-[#ffb230] hover:bg-[#ffc259] text-[#291800] px-4 py-2 rounded-xl text-xs font-headline font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95 shadow-lg shadow-[#ffb230]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Code</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[11px] font-price text-[#8B90A0] uppercase flex items-center justify-between">
            <span>Total Codes</span>
            <Ticket className="w-3.5 h-3.5 text-[#ffb230]" />
          </span>
          <p className="font-headline text-2xl text-white">{codes.length}</p>
          <span className="text-[10px] font-price text-[#3ECF8E]">{activeCount} Active</span>
        </div>

        <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[11px] font-price text-[#8B90A0] uppercase flex items-center justify-between">
            <span>Total Value</span>
            <DollarSign className="w-3.5 h-3.5 text-[#3ECF8E]" />
          </span>
          <p className="font-headline text-2xl text-[#3ECF8E]">${totalValueUSD.toFixed(2)}</p>
          <span className="text-[10px] font-price text-[#8B90A0]">Combined pool</span>
        </div>

        <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[11px] font-price text-[#8B90A0] uppercase flex items-center justify-between">
            <span>Claimed Value</span>
            <Coins className="w-3.5 h-3.5 text-[#00F0FF]" />
          </span>
          <p className="font-headline text-2xl text-[#00F0FF]">${totalClaimedValueUSD.toFixed(2)}</p>
          <span className="text-[10px] font-price text-[#8B90A0]">Deposited to balances</span>
        </div>

        <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[11px] font-price text-[#8B90A0] uppercase flex items-center justify-between">
            <span>VIP Rank Codes</span>
            <Sparkles className="w-3.5 h-3.5 text-[#FF007A]" />
          </span>
          <p className="font-headline text-2xl text-[#FF007A]">
            {codes.filter((c) => c.type === 'reseller_rank' || c.type === 'both').length}
          </p>
          <span className="text-[10px] font-price text-[#8B90A0]">20% Discount Rank</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141622] p-3 rounded-2xl border border-white/10">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code name, reseller partner, notes..."
            className="w-full bg-[#1C1F29] text-[#e2e2ec] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-price focus:outline-none focus:border-[#ffb230]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'balance', 'reseller_rank', 'both'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-price font-bold uppercase transition-all whitespace-nowrap ${
                filterType === type
                  ? 'bg-[#ffb230] text-[#291800] shadow-sm'
                  : 'bg-[#1C1F29] text-[#8B90A0] hover:text-white border border-white/5'
              }`}
            >
              {type === 'all'
                ? 'All Codes'
                : type === 'balance'
                ? 'Balance Vouchers'
                : type === 'reseller_rank'
                ? 'VIP Rank (20%)'
                : 'Mega Bundles'}
            </button>
          ))}
          <button
            onClick={fetchCodes}
            className="p-2 bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 text-[#8B90A0] hover:text-white rounded-xl transition-all"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Codes Table / Grid */}
      {filteredCodes.length === 0 ? (
        <div className="bg-[#1C1F29] rounded-3xl p-10 text-center border border-white/10 space-y-3">
          <Ticket className="w-12 h-12 text-[#8B90A0] mx-auto opacity-50" />
          <h3 className="font-headline text-lg text-[#e2e2ec] uppercase">No Reseller Codes Found</h3>
          <p className="text-xs font-price text-[#8B90A0] max-w-sm mx-auto">
            {searchQuery
              ? 'No codes matched your search query. Try clearing filters.'
              : 'You have not created any reseller or gift codes yet. Click the create button above to start!'}
          </p>
          <button
            onClick={() => handleOpenCreateModal(false)}
            className="bg-[#ffb230] hover:bg-[#ffc259] text-[#291800] px-5 py-2.5 rounded-xl text-xs font-headline font-bold uppercase"
          >
            Create First Code
          </button>
        </div>
      ) : (
        <div className="bg-[#141622] rounded-3xl border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-price">
              <thead className="bg-[#10121A] text-[#8B90A0] uppercase border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Code</th>
                  <th className="py-3.5 px-4 font-bold">Type & Perks</th>
                  <th className="py-3.5 px-4 font-bold">Reseller / Partner</th>
                  <th className="py-3.5 px-4 font-bold text-center">Usage</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#e2e2ec]">
                {filteredCodes.map((code) => {
                  const isClaimedOut = code.maxUses > 0 && code.usedCount >= code.maxUses;
                  return (
                    <tr key={code.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Code + Copy Button */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#ffd7a1] tracking-wider select-all bg-[#10121A] px-2.5 py-1 rounded-lg border border-white/10">
                            {code.code}
                          </span>
                          <button
                            onClick={() => handleCopy(code.code, code.id)}
                            className="p-1 rounded-lg text-[#8B90A0] hover:text-[#ffd7a1] transition-colors"
                            title="Copy code"
                          >
                            {copiedId === code.id ? (
                              <Check className="w-4 h-4 text-[#3ECF8E]" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {code.note && (
                          <p className="text-[10px] text-[#8B90A0] mt-0.5 max-w-[200px] truncate">
                            {code.note}
                          </p>
                        )}
                      </td>

                      {/* Type & Perks */}
                      <td className="py-3.5 px-4">
                        {code.type === 'balance' && (
                          <span className="inline-flex items-center gap-1 bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <DollarSign className="w-3 h-3" />
                            <span>+${Number(code.valueUSD || 0).toFixed(2)} USD Balance</span>
                          </span>
                        )}

                        {code.type === 'reseller_rank' && (
                          <span className="inline-flex items-center gap-1 bg-[#FF007A]/15 text-[#FF007A] border border-[#FF007A]/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <Sparkles className="w-3 h-3" />
                            <span>VIP Reseller Rank (20% Off)</span>
                          </span>
                        )}

                        {code.type === 'both' && (
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-[#FF007A]/20 to-[#00F0FF]/20 text-[#ffd7a1] border border-[#ffb230]/40 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <Zap className="w-3 h-3 text-[#ffb230]" />
                            <span>+${Number(code.valueUSD || 0).toFixed(2)} & VIP Rank</span>
                          </span>
                        )}
                      </td>

                      {/* Reseller Name */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white">{code.resellerName}</span>
                        <span className="text-[10px] text-[#8B90A0] block">
                          Created {new Date(code.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                            isClaimedOut
                              ? 'bg-[#ff5752]/20 text-[#ff5752]'
                              : code.usedCount > 0
                              ? 'bg-[#ffb230]/20 text-[#ffb230]'
                              : 'bg-white/5 text-[#8B90A0]'
                          }`}
                        >
                          {code.usedCount} / {code.maxUses || '∞'}
                        </span>
                        {isClaimedOut && (
                          <span className="text-[9px] text-[#ff5752] block uppercase font-bold mt-0.5">
                            Fully Claimed
                          </span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(code.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                            code.isActive
                              ? 'bg-[#3ECF8E]/15 text-[#3ECF8E] border-[#3ECF8E]/40 hover:bg-[#3ECF8E]/25'
                              : 'bg-[#ff5752]/15 text-[#ff5752] border-[#ff5752]/40 hover:bg-[#ff5752]/25'
                          }`}
                        >
                          {code.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {code.usedBy && code.usedBy.length > 0 && (
                            <button
                              onClick={() => setInspectCode(code)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-[#00F0FF] rounded-lg transition-colors"
                              title="View Redemptions"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(code.id)}
                            className="p-1.5 bg-white/5 hover:bg-[#ff5752]/20 text-[#8B90A0] hover:text-[#ff5752] rounded-lg transition-colors"
                            title="Delete Code"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Code Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C1F29] border border-white/15 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-headline text-lg text-[#ffd7a1] uppercase flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#ffb230]" />
                <span>{isBulkMode ? 'Bulk Generate Reseller Codes' : 'Create Reseller Redeem Code'}</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#8B90A0] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCode} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="text-xs font-price text-[#8B90A0] block mb-1.5">
                  Code Reward Type:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('balance');
                      if (!isBulkMode) setFormCode(generateRandomCode('balance'));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-price font-bold transition-all ${
                      formType === 'balance'
                        ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] text-[#3ECF8E]'
                        : 'bg-[#10121A] border-white/10 text-[#8B90A0] hover:text-white'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 mx-auto mb-1" />
                    <span>Balance Deposit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('reseller_rank');
                      if (!isBulkMode) setFormCode(generateRandomCode('reseller_rank'));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-price font-bold transition-all ${
                      formType === 'reseller_rank'
                        ? 'bg-[#FF007A]/20 border-[#FF007A] text-[#FF007A]'
                        : 'bg-[#10121A] border-white/10 text-[#8B90A0] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 mx-auto mb-1" />
                    <span>VIP Rank (20%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('both');
                      if (!isBulkMode) setFormCode(generateRandomCode('both'));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-price font-bold transition-all ${
                      formType === 'both'
                        ? 'bg-[#ffb230]/20 border-[#ffb230] text-[#ffb230]'
                        : 'bg-[#10121A] border-white/10 text-[#8B90A0] hover:text-white'
                    }`}
                  >
                    <Zap className="w-4 h-4 mx-auto mb-1" />
                    <span>Mega Bundle</span>
                  </button>
                </div>
              </div>

              {/* Code String (if single) or Batch Count (if bulk) */}
              {!isBulkMode ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-price text-[#8B90A0]">Code String:</label>
                    <button
                      type="button"
                      onClick={() => setFormCode(generateRandomCode(formType))}
                      className="text-[10px] text-[#ffb230] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Randomize</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. UCHIRO-GIFT-50"
                    className="w-full bg-[#10121A] text-[#ffd7a1] font-mono font-bold border border-white/15 rounded-xl px-3.5 py-2.5 text-xs uppercase focus:outline-none focus:border-[#ffb230]"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-price text-[#8B90A0] block mb-1">
                    Number of Codes to Generate:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value) || 5)}
                    className="w-full bg-[#10121A] text-white border border-white/15 rounded-xl px-3.5 py-2 text-xs font-price focus:outline-none focus:border-[#ffb230]"
                  />
                </div>
              )}

              {/* Value USD (if balance or both) */}
              {(formType === 'balance' || formType === 'both') && (
                <div>
                  <label className="text-xs font-price text-[#8B90A0] block mb-1">
                    Balance Value to Credit ($ USD):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-price text-[#3ECF8E] font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      required
                      value={formValueUSD}
                      onChange={(e) => setFormValueUSD(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#10121A] text-[#3ECF8E] font-bold border border-white/15 rounded-xl pl-7 pr-3.5 py-2.5 text-xs font-price focus:outline-none focus:border-[#3ECF8E]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Reseller Name */}
                <div>
                  <label className="text-xs font-price text-[#8B90A0] block mb-1">
                    Partner / Reseller Name:
                  </label>
                  <input
                    type="text"
                    value={formResellerName}
                    onChange={(e) => setFormResellerName(e.target.value)}
                    placeholder="e.g. Reseller Sokha"
                    className="w-full bg-[#10121A] text-white border border-white/15 rounded-xl px-3 py-2 text-xs font-price focus:outline-none focus:border-[#ffb230]"
                  />
                </div>

                {/* Max Uses */}
                <div>
                  <label className="text-xs font-price text-[#8B90A0] block mb-1">
                    Max Redemptions:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#10121A] text-white border border-white/15 rounded-xl px-3 py-2 text-xs font-price focus:outline-none focus:border-[#ffb230]"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-price text-[#8B90A0] block mb-1">Internal Note (Optional):</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="e.g. For VIP Telegram Giveaway"
                  className="w-full bg-[#10121A] text-[#8B90A0] border border-white/15 rounded-xl px-3 py-2 text-xs font-price focus:outline-none focus:border-[#ffb230]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-headline font-bold text-[#8B90A0] hover:text-white uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#ffb230] hover:bg-[#ffc259] text-[#291800] px-5 py-2.5 rounded-xl text-xs font-headline font-bold uppercase transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Generating...' : isBulkMode ? `Generate ${bulkCount} Codes` : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Code Redemptions Modal */}
      {inspectCode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C1F29] border border-white/15 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="font-mono font-bold text-sm text-[#ffd7a1]">{inspectCode.code}</span>
                <p className="text-[11px] text-[#8B90A0]">Redemptions History</p>
              </div>
              <button
                onClick={() => setInspectCode(null)}
                className="text-[#8B90A0] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {inspectCode.usedBy && inspectCode.usedBy.length > 0 ? (
                inspectCode.usedBy.map((u, idx) => (
                  <div
                    key={idx}
                    className="bg-[#10121A] p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs font-price"
                  >
                    <div>
                      <span className="font-bold text-white block">@{u.username}</span>
                      <span className="text-[10px] text-[#8B90A0]">
                        {new Date(u.redeemedAt).toLocaleString()}
                      </span>
                    </div>
                    {u.amountUSD ? (
                      <span className="text-[#3ECF8E] font-bold">+${u.amountUSD.toFixed(2)} USD</span>
                    ) : (
                      <span className="text-[#FF007A] font-bold">VIP Rank</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#8B90A0] text-center py-4">No users have claimed this code yet.</p>
              )}
            </div>

            <button
              onClick={() => setInspectCode(null)}
              className="w-full bg-[#282a31] hover:bg-[#ffb230] hover:text-[#291800] text-white py-2.5 rounded-xl text-xs font-headline font-bold uppercase transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
