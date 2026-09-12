import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Search,
  Plus,
  Ban,
  CheckCircle,
  Trash2,
  DollarSign,
  ShieldAlert,
  Mail,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Wallet,
  X,
  Check,
  UserCheck,
  MailCheck,
} from 'lucide-react';
import { getAllUsersFirestore, adminAddUserBalance, adminToggleBanUser, adminDeleteUser, FirestoreUserData } from '../../lib/firebase';
import { api } from '../../utils/api';
import { ensureRandomReferralCode } from '../../utils/referral';

interface AdminUsersProps {
  onBack: () => void;
  lang: 'KM' | 'EN';
  currentAdminUid?: string;
  currentUserEmail?: string;
  showToast?: (msg: string) => void;
  onBalanceUpdated?: (userId: string, newBalance: number) => void;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({
  onBack,
  lang,
  currentAdminUid,
  currentUserEmail,
  showToast,
  onBalanceUpdated,
}) => {
  const [users, setUsers] = useState<FirestoreUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add Balance Modal State
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<FirestoreUserData | null>(null);
  const [balanceAmountInput, setBalanceAmountInput] = useState('10');
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  const [balanceSuccessMsg, setBalanceSuccessMsg] = useState('');

  // Ban / Delete Modal State
  const [userToConfirmBan, setUserToConfirmBan] = useState<FirestoreUserData | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('');
  const [userToConfirmDelete, setUserToConfirmDelete] = useState<FirestoreUserData | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Send Welcome Email State
  const [sendingWelcomeEmailUid, setSendingWelcomeEmailUid] = useState<string | null>(null);
  const [welcomeEmailToast, setWelcomeEmailToast] = useState<{ uid: string; success: boolean; message: string } | null>(null);

  const handleSendWelcomeEmail = async (user: FirestoreUserData) => {
    if (!user.email) return;
    setSendingWelcomeEmailUid(user.id);
    try {
      const res = await api.sendWelcomeEmail({
        email: user.email,
        username: user.username || 'player',
        referralCode: ensureRandomReferralCode(user.referralCode),
      });
      setWelcomeEmailToast({
        uid: user.id,
        success: res.success,
        message: res.success
          ? `Welcome email successfully dispatched to ${user.email}!`
          : res.error || 'Failed to dispatch email',
      });
      setTimeout(() => setWelcomeEmailToast(null), 4500);
    } catch (err: any) {
      setWelcomeEmailToast({
        uid: user.id,
        success: false,
        message: err.message || 'Failed to dispatch email',
      });
      setTimeout(() => setWelcomeEmailToast(null), 4500);
    } finally {
      setSendingWelcomeEmailUid(null);
    }
  };

  const fetchUsers = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch from Firestore
      const firestoreUsers = await getAllUsersFirestore();

      // 2. Also fetch from backend server endpoint as fallback/merge
      let serverUsers: FirestoreUserData[] = [];
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          if (data.users && Array.isArray(data.users)) {
            serverUsers = data.users;
          }
        }
      } catch {
        // Continue with firestore
      }

      // Merge and deduplicate by id/email
      const map = new Map<string, FirestoreUserData>();
      firestoreUsers.forEach((u) => {
        if (u.id) map.set(u.id, u);
      });
      serverUsers.forEach((u) => {
        if (u.id && !map.has(u.id)) {
          map.set(u.id, u);
        }
      });

      setUsers(Array.from(map.values()));
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForBalance) return;
    const amount = parseFloat(balanceAmountInput);
    if (isNaN(amount) || amount <= 0) return;

    setIsAddingBalance(true);
    try {
      let newBalance = selectedUserForBalance.balanceUSD + amount;

      // 1. Update in Firestore
      try {
        newBalance = await adminAddUserBalance(selectedUserForBalance.id, amount);
      } catch (fErr) {
        console.warn('Firestore balance update error:', fErr);
      }

      // 2. Also call backend endpoint to persist
      try {
        await fetch('/api/admin/users/add-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUserForBalance.id,
            amountUSD: amount,
          }),
        });
      } catch {
        // ignore
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForBalance.id ? { ...u, balanceUSD: newBalance } : u
        )
      );

      if (onBalanceUpdated) {
        onBalanceUpdated(selectedUserForBalance.id, newBalance);
      }

      setBalanceSuccessMsg(`+$${amount.toFixed(2)} USD successfully added! New balance: $${newBalance.toFixed(2)} USD`);
      setTimeout(() => {
        setSelectedUserForBalance(null);
        setBalanceSuccessMsg('');
        setBalanceAmountInput('10');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to update balance');
    } finally {
      setIsAddingBalance(false);
    }
  };

  const handleConfirmToggleBan = async () => {
    if (!userToConfirmBan) return;
    setIsProcessingAction(true);
    const newBannedState = !userToConfirmBan.isBanned;
    try {
      // Update in Firestore
      try {
        await adminToggleBanUser(userToConfirmBan.id, newBannedState, banReasonInput);
      } catch (fErr) {
        console.warn('Firestore ban error:', fErr);
      }

      // Update in backend
      try {
        await fetch('/api/admin/users/ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userToConfirmBan.id,
            isBanned: newBannedState,
            reason: banReasonInput,
          }),
        });
      } catch {
        // ignore
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userToConfirmBan.id
            ? { ...u, isBanned: newBannedState, bannedReason: banReasonInput }
            : u
        )
      );
      setUserToConfirmBan(null);
      setBanReasonInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to update account ban status');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToConfirmDelete) return;
    setIsProcessingAction(true);
    try {
      // Delete in Firestore
      try {
        await adminDeleteUser(userToConfirmDelete.id);
      } catch (fErr) {
        console.warn('Firestore delete error:', fErr);
      }

      // Delete in backend
      try {
        await fetch('/api/admin/users/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userToConfirmDelete.id }),
        });
      } catch {
        // ignore
      }

      setUsers((prev) => prev.filter((u) => u.id !== userToConfirmDelete.id));
      setUserToConfirmDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      (u.username || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.id || '').toLowerCase().includes(query);

    if (!matchSearch) return false;

    if (statusFilter === 'active') return !u.isBanned;
    if (statusFilter === 'banned') return !!u.isBanned;
    return true;
  });

  const totalBalancesUSD = users.reduce((acc, curr) => acc + (curr.balanceUSD || 0), 0);
  const totalBannedCount = users.filter((u) => u.isBanned).length;

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider">
                {lang === 'KM' ? 'គ្រប់គ្រងគណនី & សមតុល្យ' : 'REGISTERED USERS & WALLETS'}
              </h1>
              <span className="bg-[#00F0FF]/20 text-[#00F0FF] text-[10px] font-price font-bold px-2.5 py-0.5 rounded-full border border-[#00F0FF]/30">
                ADMIN ACCESS
              </span>
            </div>
            <p className="font-price text-xs text-[#8B90A0] mt-0.5">
              {lang === 'KM'
                ? 'មើលបញ្ជីគណនីទាំងអស់ បញ្ចូលលុយ (Add Balance) ផ្អាកគណនី (Ban) ឬលុបគណនី'
                : 'Manage registered user accounts, top-up balances, ban accounts, or delete users'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isRefreshing}
          className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] px-4 py-2 rounded-xl text-xs font-headline uppercase font-bold flex items-center gap-2 transition-all active:scale-95 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{lang === 'KM' ? 'ទាញទិន្នន័យថ្មី' : 'Refresh Users'}</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] font-price text-[#8B90A0] uppercase font-bold">
              Total Accounts
            </span>
            <div className="font-headline text-2xl text-[#ffd7a1] mt-0.5">
              {users.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#ffb230]/15 text-[#ffb230] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] font-price text-[#8B90A0] uppercase font-bold">
              Total Wallets Held
            </span>
            <div className="font-headline text-2xl text-[#3ECF8E] mt-0.5">
              ${totalBalancesUSD.toFixed(2)} USD
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#3ECF8E]/15 text-[#3ECF8E] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] font-price text-[#8B90A0] uppercase font-bold">
              Banned Accounts
            </span>
            <div className="font-headline text-2xl text-[#E8433F] mt-0.5">
              {totalBannedCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E8433F]/15 text-[#E8433F] flex items-center justify-center">
            <Ban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1C1F29] p-3 rounded-2xl border border-white/10">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8B90A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'KM' ? 'ស្វែងរកតាមឈ្មោះ, អ៊ីមែល ឬ ID...' : 'Search users by username, email, or UID...'}
            className="w-full bg-[#11131A] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#8B90A0] focus:border-[#ffb230] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-headline uppercase font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-[#ffb230] text-[#291800]'
                : 'bg-white/5 text-[#8B90A0] hover:text-white'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-headline uppercase font-bold transition-all ${
              statusFilter === 'active'
                ? 'bg-[#3ECF8E] text-[#05131A]'
                : 'bg-white/5 text-[#8B90A0] hover:text-white'
            }`}
          >
            Active ({users.length - totalBannedCount})
          </button>
          <button
            onClick={() => setStatusFilter('banned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-headline uppercase font-bold transition-all ${
              statusFilter === 'banned'
                ? 'bg-[#E8433F] text-white'
                : 'bg-white/5 text-[#8B90A0] hover:text-white'
            }`}
          >
            Banned ({totalBannedCount})
          </button>
        </div>
      </div>

      {/* Users List Table / Cards */}
      {loading ? (
        <div className="text-center py-20 bg-[#1C1F29] rounded-2xl border border-white/10">
          <RefreshCw className="w-8 h-8 text-[#ffb230] animate-spin mx-auto mb-3" />
          <p className="font-price text-xs text-[#8B90A0]">Loading registered accounts...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-[#1C1F29] rounded-2xl border border-white/10 space-y-2">
          <Users className="w-10 h-10 text-[#8B90A0] mx-auto opacity-50" />
          <h3 className="font-headline text-lg text-[#e2e2ec] uppercase">
            No accounts found
          </h3>
          <p className="font-price text-xs text-[#8B90A0]">
            {searchQuery ? 'Try adjusting your search criteria.' : 'Registered users will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isBanned = !!user.isBanned;
            const balance = user.balanceUSD ?? 0;

            return (
              <div
                key={user.id}
                className={`bg-[#1C1F29] border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-md ${
                  isBanned
                    ? 'border-[#E8433F]/40 bg-[#1C1F29]/80 opacity-90'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Left: Avatar & Identity */}
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <img
                      src={
                        user.avatarUrl ||
                        'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80'
                      }
                      alt={user.username}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-sm"
                    />
                    {isBanned && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#E8433F] text-white flex items-center justify-center text-[10px]">
                        <Ban className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline text-base text-[#ffd7a1] font-bold">
                        {user.username || 'User'}
                      </span>
                      {user.role === 'admin' ? (
                        <span className="bg-[#ffb230]/20 text-[#ffb230] border border-[#ffb230]/40 text-[9px] font-price font-bold px-2 py-0.5 rounded-full">
                          ADMIN
                        </span>
                      ) : user.isResellerUnlocked ? (
                        <span className="bg-[#9D4EDD]/20 text-[#D8BBFF] border border-[#9D4EDD]/40 text-[9px] font-price font-bold px-2 py-0.5 rounded-full">
                          RESELLER VIP
                        </span>
                      ) : (
                        <span className="bg-white/5 text-[#8B90A0] text-[9px] font-price font-bold px-2 py-0.5 rounded-full">
                          CUSTOMER
                        </span>
                      )}

                      {isBanned ? (
                        <span className="bg-[#E8433F]/20 text-[#E8433F] border border-[#E8433F]/30 text-[9px] font-price font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Ban className="w-2.5 h-2.5" />
                          <span>BANNED</span>
                        </span>
                      ) : (
                        <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/30 text-[9px] font-price font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserCheck className="w-2.5 h-2.5" />
                          <span>ACTIVE</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#8B90A0] mt-1 flex-wrap font-price">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#ffb230]" />
                        <span>{user.email || 'No email'}</span>
                      </span>
                      <span className="text-white/20">•</span>
                      <span className="text-[10px] text-[#5A5E70] font-mono">
                        UID: {user.id.slice(0, 10)}...
                      </span>
                      {user.createdAt && (
                        <>
                          <span className="text-white/20">•</span>
                          <span className="text-[10px] text-[#5A5E70]">
                            Joined: {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>

                    {isBanned && user.bannedReason && (
                      <p className="text-[11px] text-[#E8433F] mt-1 italic">
                        Ban reason: {user.bannedReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Balance & Admin Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto justify-between border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-price text-[#8B90A0] block uppercase font-bold">
                      Current Wallet
                    </span>
                    <span className="font-headline text-xl text-[#3ECF8E] font-bold tracking-tight">
                      ${balance.toFixed(2)} USD
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* + Add Balance Button */}
                    <button
                      onClick={() => {
                        setSelectedUserForBalance(user);
                        setBalanceAmountInput('10');
                        setBalanceSuccessMsg('');
                      }}
                      className="bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 text-[#3ECF8E] border border-[#3ECF8E]/40 px-3 py-2 rounded-xl text-xs font-headline uppercase font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                      title="Add USD Balance to user wallet"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'KM' ? '+ បញ្ចូលលុយ' : '+ Add Balance'}</span>
                    </button>

                    {/* Send Welcome Email Button */}
                    {user.email && (
                      <button
                        onClick={() => handleSendWelcomeEmail(user)}
                        disabled={sendingWelcomeEmailUid === user.id}
                        className="bg-[#ffb230]/15 hover:bg-[#ffb230]/25 text-[#ffb230] border border-[#ffb230]/40 px-3 py-2 rounded-xl text-xs font-headline uppercase font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer"
                        title={`Send official welcome email to ${user.email}`}
                      >
                        {sendingWelcomeEmailUid === user.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#ffb230]" />
                        ) : (
                          <MailCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{lang === 'KM' ? 'ផ្ញើសារស្វាគមន៍' : 'Welcome Email'}</span>
                      </button>
                    )}

                    {/* Ban / Unban Button */}
                    <button
                      onClick={() => {
                        setUserToConfirmBan(user);
                        setBanReasonInput(user.bannedReason || 'Violation of terms');
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-headline uppercase font-bold flex items-center gap-1.5 transition-all active:scale-95 border ${
                        isBanned
                          ? 'bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 text-[#3ECF8E] border-[#3ECF8E]/40'
                          : 'bg-[#E8433F]/15 hover:bg-[#E8433F]/25 text-[#E8433F] border-[#E8433F]/40'
                      }`}
                      title={isBanned ? 'Unban this account' : 'Ban this account'}
                    >
                      {isBanned ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Unban</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5" />
                          <span>Ban</span>
                        </>
                      )}
                    </button>

                    {/* Delete User Button */}
                    <button
                      onClick={() => setUserToConfirmDelete(user)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-[#E8433F]/20 text-[#8B90A0] hover:text-[#E8433F] border border-white/10 hover:border-[#E8433F]/40 transition-all active:scale-95 cursor-pointer"
                      title="Delete account completely"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Toast Notice for Welcome Email */}
                {welcomeEmailToast && welcomeEmailToast.uid === user.id && (
                  <div
                    className={`w-full mt-2 p-2 rounded-xl text-xs font-price flex items-center gap-2 border animate-fade-in ${
                      welcomeEmailToast.success
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/15 border-red-500/40 text-red-300'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{welcomeEmailToast.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal 1: Add Balance ── */}
      {selectedUserForBalance && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1C1F29] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#3ECF8E]/15 text-[#3ECF8E] flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-lg text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'បញ្ចូលសមតុល្យ USD' : 'ADD BALANCE TO USER'}
                  </h3>
                  <p className="font-price text-xs text-[#8B90A0]">
                    User: <strong className="text-white">{selectedUserForBalance.username}</strong> ({selectedUserForBalance.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserForBalance(null)}
                className="text-[#8B90A0] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {balanceSuccessMsg ? (
              <div className="bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E] p-4 rounded-2xl text-center space-y-2">
                <Check className="w-8 h-8 mx-auto" />
                <p className="font-price text-sm font-bold">{balanceSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleAddBalanceSubmit} className="space-y-4">
                <div className="bg-[#11131A] p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="font-price text-xs text-[#8B90A0]">Current Balance:</span>
                  <span className="font-headline text-lg text-white font-bold">
                    ${(selectedUserForBalance.balanceUSD ?? 0).toFixed(2)} USD
                  </span>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="font-price text-xs text-[#8B90A0] block mb-1.5">
                    Quick Preset Amounts:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['5', '10', '20', '50'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBalanceAmountInput(preset)}
                        className={`py-2 rounded-xl font-headline text-xs font-bold uppercase transition-all ${
                          balanceAmountInput === preset
                            ? 'bg-[#3ECF8E] text-[#05131A] shadow-md scale-105'
                            : 'bg-[#11131A] text-[#d1d5db] hover:text-white border border-white/10'
                        }`}
                      >
                        +${preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Amount Input */}
                <div>
                  <label className="font-price text-xs text-[#8B90A0] block mb-1">
                    Amount to Add (USD):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={balanceAmountInput}
                      onChange={(e) => setBalanceAmountInput(e.target.value)}
                      placeholder="e.g. 25.00"
                      className="w-full bg-[#11131A] border border-white/10 rounded-xl pl-8 pr-4 py-3 text-base font-price text-white font-bold focus:border-[#3ECF8E] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preview Calculation */}
                {parseFloat(balanceAmountInput) > 0 && (
                  <div className="bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 p-3 rounded-xl flex items-center justify-between text-xs font-price">
                    <span className="text-[#8B90A0]">New Total Balance:</span>
                    <span className="text-[#3ECF8E] font-bold text-sm">
                      ${((selectedUserForBalance.balanceUSD ?? 0) + (parseFloat(balanceAmountInput) || 0)).toFixed(2)} USD
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserForBalance(null)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-headline text-xs py-3 rounded-xl uppercase font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingBalance || !parseFloat(balanceAmountInput)}
                    className="flex-1 bg-[#3ECF8E] hover:bg-[#4ff5aa] text-[#05131A] font-headline text-xs py-3 rounded-xl uppercase font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isAddingBalance ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Credit User</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal 2: Ban / Unban Confirmation ── */}
      {userToConfirmBan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1C1F29] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#E8433F]">
              <div className="w-10 h-10 rounded-xl bg-[#E8433F]/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline text-lg text-white uppercase">
                  {userToConfirmBan.isBanned ? 'Unban User Account' : 'Ban User Account'}
                </h3>
                <p className="font-price text-xs text-[#8B90A0]">
                  User: {userToConfirmBan.username} ({userToConfirmBan.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#d1d5db] leading-relaxed font-price">
              {userToConfirmBan.isBanned
                ? 'Are you sure you want to unban this account? The user will immediately regain ability to sign in and make store purchases.'
                : 'Banning this account will immediately revoke access and prevent the customer from logging in or placing orders.'}
            </p>

            {!userToConfirmBan.isBanned && (
              <div>
                <label className="font-price text-xs text-[#8B90A0] block mb-1">
                  Reason for Suspension (Optional):
                </label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="e.g. Chargeback, fraudulent activity, botting..."
                  className="w-full bg-[#11131A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#E8433F] focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToConfirmBan(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-headline text-xs py-2.5 rounded-xl uppercase font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleBan}
                disabled={isProcessingAction}
                className={`flex-1 font-headline text-xs py-2.5 rounded-xl uppercase font-bold transition-all ${
                  userToConfirmBan.isBanned
                    ? 'bg-[#3ECF8E] text-[#05131A]'
                    : 'bg-[#E8433F] text-white shadow-lg'
                }`}
              >
                {isProcessingAction ? 'Processing...' : userToConfirmBan.isBanned ? 'Confirm Unban' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Delete Account Confirmation ── */}
      {userToConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1C1F29] border border-[#E8433F]/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#E8433F]">
              <div className="w-10 h-10 rounded-xl bg-[#E8433F]/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline text-lg text-white uppercase">
                  Delete User Account?
                </h3>
                <p className="font-price text-xs text-[#8B90A0]">
                  User: {userToConfirmDelete.username} ({userToConfirmDelete.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#d1d5db] leading-relaxed font-price">
              ⚠️ <strong>Warning:</strong> This will permanently delete the user document from Firestore and remove the account record. Any remaining balance (${(userToConfirmDelete.balanceUSD ?? 0).toFixed(2)}) will be discarded.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToConfirmDelete(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-headline text-xs py-2.5 rounded-xl uppercase font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isProcessingAction}
                className="flex-1 bg-[#E8433F] hover:bg-[#ff524e] text-white font-headline text-xs py-2.5 rounded-xl uppercase font-bold shadow-lg"
              >
                {isProcessingAction ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
