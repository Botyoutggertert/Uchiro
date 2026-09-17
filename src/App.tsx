import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Product,
  Order,
  UserProfile,
  Coupon,
  VisitorAnalyticsData,
  ActiveScreen,
  CategoryType,
  StoreSettings,
  SongTrack,
  FullAppState,
  ProductSortOption,
} from './types';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_USER_PROFILE,
  INITIAL_COUPONS,
  INITIAL_VISITOR_ANALYTICS,
  INITIAL_STORE_SETTINGS,
  INITIAL_SONGS,
} from './data/mockData';
import { api } from './utils/api';
import { sendOrderDesktopNotification, playOrderAlertChime } from './utils/desktopNotification';
import { getMemberRankInfo, verifyResellerCode } from './utils/memberRank';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { StoreHero } from './components/StoreHero';
import { CustomerStoreStats } from './components/CustomerStoreStats';
import { StoreFooter } from './components/StoreFooter';
import { LiveActivityFeed } from './components/LiveActivityFeed';
import { Leaderboard } from './components/Leaderboard';
import { CategoryGrid } from './components/CategoryGrid';
import { ProductSortDropdown } from './components/ProductSortDropdown';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AccountPhotosModal } from './components/AccountPhotosModal';
import { OrderCompleteScreen } from './components/OrderCompleteScreen';
import { TopUpModal } from './components/TopUpModal';
import { OrderHistoryScreen } from './components/OrderHistoryScreen';
import { UserProfileScreen } from './components/UserProfileScreen';
import { SecuritySettingsScreen } from './components/SecuritySettingsScreen';
import { ReferralScreen } from './components/ReferralScreen';
import { HelpSupportScreen } from './components/HelpSupportScreen';
import { MusicPlayer } from './components/MusicPlayer';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminOrders } from './components/admin/AdminOrders';
import { AdminAddItem } from './components/admin/AdminAddItem';
import { AdminItemsList } from './components/admin/AdminItemsList';
import { AdminAnalytics } from './components/admin/AdminAnalytics';
import { AdminCoupons } from './components/admin/AdminCoupons';
import { AdminSettings } from './components/admin/AdminSettings';
import { AdminStoreBotConfig } from './components/admin/AdminStoreBotConfig';
import { AdminResellerCodes } from './components/admin/AdminResellerCodes';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminActivityLogs } from './components/admin/AdminActivityLogs';
import { AdminRouteGuard } from './components/AdminRouteGuard';
import { AuthModal } from './components/AuthModal';
import { RateLimitToast } from './components/RateLimitToast';
import {
  auth,
  onAuthStateChanged,
  logoutUser,
  getUserFirestoreProfile,
  saveUserFirestoreProfile,
  updateUserFirestoreProfile,
  FirebaseUser,
  FirestoreUserData,
} from './lib/firebase';
import { Search, Flame, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { generateRandomReferralCode, ensureRandomReferralCode } from './utils/referral';
import { updateProductSeo, resetDefaultSeo } from './utils/seo';
import { safeStorage } from './utils/storage';

export const GUEST_USER_PROFILE: UserProfile = {
  username: 'Customer',
  displayName: 'Customer',
  bio: '',
  rank: 'Bronze',
  balanceUSD: 0,
  totalSpentUSD: 0,
  isResellerUnlocked: false,
  referralCode: generateRandomReferralCode(),
  referralBonusPercent: 5,
  referralEarningsUSD: 0,
  referralCount: 0,
  referralHistory: [],
  avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
  email: '',
  phone: '',
  is2FAEnabled: false,
  telegramLinked: false,
  discordLinked: false,
  activeSessions: [],
};

const getInitialUserProfile = (): UserProfile => {
  const savedUser = safeStorage.getItem('uchiro_user_name') || 'Customer';
  const savedRef = ensureRandomReferralCode(safeStorage.getItem('uchiro_user_ref_code') || undefined);
  return {
    ...GUEST_USER_PROFILE,
    username: savedUser,
    displayName: savedUser,
    referralCode: savedRef,
  };
};

export function App() {
  // State loaded from persistent Backend Database (/api/state)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [userProfile, setUserProfile] = useState<UserProfile>(getInitialUserProfile);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [analytics, setAnalytics] = useState<VisitorAnalyticsData>(INITIAL_VISITOR_ANALYTICS);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [songs, setSongs] = useState<SongTrack[]>(INITIAL_SONGS);

  // Keep username and referralCode persistent across reloads and tab changes - never clear them
  useEffect(() => {
    if (userProfile.username && userProfile.username !== 'Customer') {
      safeStorage.setItem('uchiro_user_name', userProfile.username);
    }
    if (userProfile.referralCode) {
      safeStorage.setItem('uchiro_user_ref_code', userProfile.referralCode);
    }
  }, [userProfile.username, userProfile.referralCode]);

  // Firebase Authentication State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialOrdersLoadRef = useRef<boolean>(true);

  // Authentication state for Admin Panel
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return safeStorage.getItem('uchiro_admin_token');
  });

  // Navigation & Modal state
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(() => {
    if (typeof window !== 'undefined') {
      try {
        const path = window.location.pathname.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        // Only enter admin if explicitly requested via path /admin and user has stored admin credentials
        const hasAdminAuth = !!safeStorage.getItem('uchiro_admin_token');
        const isAdminPath = (path === '/admin' || path === '/admin/' || hash === '#admin') && hasAdminAuth;
        if (isAdminPath) {
          return 'admin-dashboard';
        }
      } catch {}
    }
    return 'store';
  });

  // Keep browser URL synchronized with current active screen
  useEffect(() => {
    const isAdmin = activeScreen.startsWith('admin-');
    const path = window.location.pathname.toLowerCase();
    if (isAdmin) {
      if (path !== '/admin' && !path.startsWith('/admin/')) {
        try {
          window.history.pushState(null, '', '/admin');
        } catch {}
      }
    } else {
      if (path === '/admin' || path.startsWith('/admin/')) {
        try {
          window.history.pushState(null, '', '/');
        } catch {}
      }
    }
  }, [activeScreen]);

  // Listen for browser navigation (e.g. typing /admin, clicking back/forward, /login)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const isAdminPath = path === '/admin' || path === '/admin/' || hash === '#admin';

      if (isAdminPath) {
        setActiveScreen((prev) =>
          prev.startsWith('admin-') ? prev : 'admin-dashboard'
        );
      } else if (path === '/login' || path.startsWith('/login')) {
        setIsAuthModalOpen(true);
        setActiveScreen((prev) => (prev.startsWith('admin-') ? 'store' : prev));
      } else if (path === '/' || path === '' || hash === '#store' || hash === '') {
        setActiveScreen('store');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ProductSortOption>('newest');
  const [lang, setLang] = useState<'KM' | 'EN'>('KM');

  // Modals & Selected items
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAccountPhotosProduct, setSelectedAccountPhotosProduct] = useState<Product | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [purchaseIntentProduct, setPurchaseIntentProduct] = useState<Product | null>(null);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupDefaultRefCode, setTopupDefaultRefCode] = useState<string>('');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Deep-linking: Automatically open shared product modal from URL parameters (?product=... or /product/...)
  useEffect(() => {
    if (!products || products.length === 0) return;
    const searchParams = new URLSearchParams(window.location.search);
    let targetProductId =
      searchParams.get('product') ||
      searchParams.get('p') ||
      searchParams.get('item') ||
      searchParams.get('id');

    if (!targetProductId && window.location.pathname.startsWith('/product/')) {
      const parts = window.location.pathname.split('/');
      if (parts[2]) {
        targetProductId = decodeURIComponent(parts[2]);
      }
    }

    if (targetProductId) {
      const matched = products.find(
        (p) => String(p.id).toLowerCase() === String(targetProductId).toLowerCase()
      );
      if (matched) {
        setSelectedProduct(matched);
        updateProductSeo(matched);
      }
    }
  }, [products]);

  // Synchronize dynamic social media meta tags & URL history when a product is opened/closed
  useEffect(() => {
    if (selectedProduct) {
      updateProductSeo(selectedProduct);
      try {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('product') !== selectedProduct.id) {
          window.history.replaceState(
            { modal: 'product', id: selectedProduct.id },
            '',
            `/?product=${encodeURIComponent(selectedProduct.id)}`
          );
        }
      } catch {}
    } else {
      if (!activeScreen.startsWith('admin-')) {
        try {
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.has('product') || searchParams.has('p') || searchParams.has('item')) {
            window.history.replaceState(null, '', '/');
          }
        } catch {}
        resetDefaultSeo();
      }
    }
  }, [selectedProduct, activeScreen]);

  // Synchronize Firebase Authentication state with App State & Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setCurrentUser(fbUser);
      if (fbUser) {
        try {
          const profile = await getUserFirestoreProfile(fbUser.uid);
          if (profile) {
            if (profile.isBanned) {
              await logoutUser();
              setCurrentUser(null);
              showToast(
                lang === 'KM'
                  ? `គណនីរបស់អ្នកត្រូវបានផ្អាក៖ ${profile.bannedReason || 'សូមទាក់ទង Admin'}`
                  : `Account suspended: ${profile.bannedReason || 'Please contact Admin'}`
              );
              return;
            }
            setUserProfile((prev) => {
              const cleanUser = profile.username || prev.username || (profile.email ? profile.email.split('@')[0] : 'Customer');
              const refCode = ensureRandomReferralCode(profile.referralCode || prev.referralCode);
              return {
                ...prev,
                username: cleanUser,
                displayName: profile.username || prev.displayName || cleanUser,
                email: profile.email || prev.email,
                balanceUSD: profile.balanceUSD ?? prev.balanceUSD,
                totalSpentUSD: profile.totalSpentUSD ?? prev.totalSpentUSD,
                referralCode: refCode,
                referralBonusPercent: prev.referralBonusPercent || 5,
                referralEarningsUSD: prev.referralEarningsUSD || 0,
                referralCount: prev.referralCount || 0,
                referralHistory: prev.referralHistory || [],
                isResellerUnlocked: profile.isResellerUnlocked ?? prev.isResellerUnlocked,
                isBanned: profile.isBanned ?? false,
                bannedReason: profile.bannedReason,
                role: profile.role || 'customer',
                avatarUrl: profile.avatarUrl || fbUser.photoURL || prev.avatarUrl,
                firebaseUid: fbUser.uid,
                authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
              };
            });
          } else {
            // New user registration without doc - bootstrap profile in Firestore
            const cleanUser = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : (userProfile.username || 'Customer'));
            const refCode = generateRandomReferralCode();
            const initialDoc: FirestoreUserData = {
              id: fbUser.uid,
              email: fbUser.email || '',
              username: cleanUser,
              avatarUrl: fbUser.photoURL || userProfile.avatarUrl,
              balanceUSD: 0.0,
              totalSpentUSD: 0,
              isResellerUnlocked: false,
              referralCode: refCode,
              role: 'customer',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await saveUserFirestoreProfile(initialDoc);
            setUserProfile((prev) => ({
              ...prev,
              username: initialDoc.username,
              displayName: initialDoc.username,
              email: initialDoc.email,
              balanceUSD: initialDoc.balanceUSD,
              totalSpentUSD: initialDoc.totalSpentUSD,
              referralCode: refCode,
              avatarUrl: initialDoc.avatarUrl || prev.avatarUrl,
              firebaseUid: fbUser.uid,
              authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
            }));
          }
          // Verify Admin status automatically for this user
          const targetEmail = (profile?.email || fbUser.email || '').toLowerCase();
          try {
            const adminCheck = await api.verifyAdminUser(targetEmail, fbUser.uid);
            if (adminCheck.isAdmin && adminCheck.token) {
              setAdminToken(adminCheck.token);
              safeStorage.setItem('uchiro_admin_token', adminCheck.token);
              setUserProfile((prev) => ({ ...prev, role: 'admin' }));
            } else {
              setAdminToken(null);
              safeStorage.removeItem('uchiro_admin_token');
              setUserProfile((prev) => ({ ...prev, role: 'customer' }));
            }
          } catch (admErr) {
            console.warn('Admin status check failed:', admErr);
          }
        } catch (err) {
          console.error('Error syncing Firestore user document:', err);
        }
      } else {
        // Check fallback local authentication in guest mode
        const localAuth = safeStorage.getItem('uchiro_auth_user');
        if (localAuth) {
          try {
            const parsed = JSON.parse(localAuth);
            if (parsed && parsed.email) {
              setCurrentUser(parsed);
              const targetEmail = (parsed.email || '').toLowerCase();
              const adminCheck = await api.verifyAdminUser(targetEmail, parsed.uid);
              if (adminCheck.isAdmin && adminCheck.token) {
                setAdminToken(adminCheck.token);
                safeStorage.setItem('uchiro_admin_token', adminCheck.token);
                setUserProfile((prev) => ({
                  ...prev,
                  username: parsed.displayName || prev.username,
                  email: parsed.email,
                  role: 'admin',
                }));
              }
              return;
            }
          } catch {}
        }

        // Never clear username or referral code when in guest mode
        setUserProfile((prev) => ({
          ...prev,
          firebaseUid: undefined,
          authProvider: undefined,
          role: 'customer',
        }));
        setAdminToken(null);
        safeStorage.removeItem('uchiro_admin_token');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUserLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setAdminToken(null);
      safeStorage.removeItem('uchiro_admin_token');
      safeStorage.removeItem('uchiro_auth_user');
      // Keep username and referral code intact - never clear them!
      setUserProfile((prev) => ({
        ...prev,
        firebaseUid: undefined,
        authProvider: undefined,
        role: 'customer',
      }));
      setActiveScreen((prev) => (['profile', 'my-orders', 'security', 'referral'].includes(prev) ? 'store' : prev.startsWith('admin-') ? 'store' : prev));
      showToast(lang === 'KM' ? 'អ្នកបានចាកចេញដោយជោគជ័យ' : 'Successfully logged out.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleAuthSuccess = async (fbUser: FirebaseUser, profileData?: Partial<UserProfile>) => {
    setCurrentUser(fbUser);
    const effectiveUsername = profileData?.username || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : (userProfile.username || 'Customer'));
    const effectiveRefCode = ensureRandomReferralCode(profileData?.referralCode || userProfile.referralCode);

    const targetEmail = (profileData?.email || fbUser.email || '').toLowerCase();
    let isUserAdmin = profileData?.role === 'admin';
    try {
      const adminCheck = await api.verifyAdminUser(targetEmail, fbUser.uid);
      if (adminCheck.isAdmin && adminCheck.token) {
        isUserAdmin = true;
        setAdminToken(adminCheck.token);
        safeStorage.setItem('uchiro_admin_token', adminCheck.token);
      } else {
        setAdminToken(null);
        safeStorage.removeItem('uchiro_admin_token');
      }
    } catch {}

    setUserProfile((prev) => ({
      ...prev,
      ...(profileData || {}),
      username: effectiveUsername,
      displayName: effectiveUsername,
      referralCode: effectiveRefCode,
      firebaseUid: fbUser.uid,
      authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
      role: isUserAdmin ? 'admin' : 'customer',
    }));
    showToast(
      lang === 'KM'
        ? 'ចូលប្រើប្រាស់ដោយជោគជ័យ! សូមស្វាគមន៍មកកាន់ Uchiro Store'
        : `Welcome back, ${profileData?.username || fbUser.displayName || 'Player'}!`
    );

    // If admin logged in while on admin-login, proceed to dashboard
    if (isUserAdmin && (activeScreen === 'admin-login' || activeScreen.startsWith('admin-'))) {
      setActiveScreen('admin-dashboard');
    }

    // If the user previously clicked to buy an item before signing in, resume checkout immediately
    if (purchaseIntentProduct) {
      const targetProd = purchaseIntentProduct;
      setPurchaseIntentProduct(null);
      setCheckoutProduct(targetProd);
    }
  };

  // Fetch initial full state from backend database on mount
  useEffect(() => {
    async function fetchBackendState() {
      try {
        const fullState = await api.getFullState();
        if (fullState) {
          if (fullState.products) setProducts(fullState.products);
          if (fullState.orders) {
            setOrders(fullState.orders);
            knownOrderIdsRef.current = new Set(fullState.orders.map((o) => o.id));
            if (fullState.orders.length > 0) {
              setLastCompletedOrder(fullState.orders[0]);
            }
          }
          if (fullState.userProfile && auth.currentUser) setUserProfile(fullState.userProfile);
          if (fullState.coupons) setCoupons(fullState.coupons);
          if (fullState.analytics) setAnalytics(fullState.analytics);
          if (fullState.settings) setSettings(fullState.settings);
          if (fullState.songs) setSongs(fullState.songs);
        }
      } catch (err) {
        console.warn('Using local fallback state:', err);
      } finally {
        isInitialOrdersLoadRef.current = false;
      }
    }
    fetchBackendState();
  }, []);

  // Background Order Poller (every 4s) to detect new orders and trigger desktop notifications + chime
  useEffect(() => {
    const pollInterval = window.setInterval(async () => {
      try {
        const remoteOrders = await api.getOrders();
        if (remoteOrders && Array.isArray(remoteOrders)) {
          const newOrdersList: Order[] = [];
          remoteOrders.forEach((ord) => {
            if (!knownOrderIdsRef.current.has(ord.id)) {
              newOrdersList.push(ord);
              knownOrderIdsRef.current.add(ord.id);
            }
          });

          if (newOrdersList.length > 0) {
            setOrders(remoteOrders);

            if (!isInitialOrdersLoadRef.current) {
              const latestOrder = newOrdersList[0];
              // Fire Native Desktop Notification + Chime for Admins
              sendOrderDesktopNotification(
                latestOrder,
                settings.logoUrl,
                () => {
                  setActiveScreen('admin-orders');
                }
              );
            }
          }
        }
      } catch (_) {
        // Ignore network polling interruptions
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [settings.logoUrl]);

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // Order Handlers
  const handleProceedToCheckout = (product: Product) => {
    setSelectedProduct(null);
    if (!currentUser) {
      setPurchaseIntentProduct(product);
      setIsAuthModalOpen(true);
      showToast(
        lang === 'KM'
          ? 'សូមចូលគណនី ឬចុះឈ្មោះជាមុនសិន ដើម្បីទិញទំនិញ'
          : 'Please sign in or create an account to purchase this item'
      );
      return;
    }
    setCheckoutProduct(product);
  };

  const handleCompleteOrder = async (newOrder: Order) => {
    setCheckoutProduct(null);
    setOrders((prev) => [newOrder, ...prev]);
    setLastCompletedOrder(newOrder);
    knownOrderIdsRef.current.add(newOrder.id);

    // Update user lifetime spent, wallet balance (if paid with store balance), and member rank
    const wasPaidWithBalance = newOrder.paymentMethod === 'Balance';
    const userCurrentBal = userProfile?.balanceUSD ?? 0;
    const newBalance = wasPaidWithBalance
      ? Math.max(0, parseFloat((userCurrentBal - (newOrder.totalUSD || 0)).toFixed(2)))
      : userCurrentBal;
    const updatedSpent = (userProfile?.totalSpentUSD || 0) + (newOrder.totalUSD || 0);
    const rankInfo = getMemberRankInfo(updatedSpent);
    const updatedProfile: UserProfile = {
      ...userProfile,
      balanceUSD: newBalance,
      totalSpentUSD: updatedSpent,
      rank: rankInfo.title,
    };
    setUserProfile(updatedProfile);

    // Play chime and send desktop notification
    sendOrderDesktopNotification(newOrder, settings.logoUrl, () => {
      setActiveScreen('admin-orders');
    });

    // Save to Backend Database
    try {
      await api.createOrder(newOrder);
      await api.updateUserProfile({
        balanceUSD: newBalance,
        totalSpentUSD: updatedSpent,
        rank: rankInfo.title,
      });
      if (currentUser) {
        updateUserFirestoreProfile(currentUser.uid, {
          balanceUSD: newBalance,
          totalSpentUSD: updatedSpent,
        }).catch((e) => console.warn('Firestore sync failed:', e));
      }
      // Deduct stock in backend:
      // Rule: accounts waiting or not confirmed still show in store. Only confirmed accounts deduct stock and are hidden.
      // For non-accounts (fruit, gamepass, etc.), deduct stock right away.
      const isAccount =
        newOrder.fulfillmentType === 'account' ||
        newOrder.product?.category === 'account' ||
        newOrder.product?.fulfillmentType === 'account';
      const isConfirmed = newOrder.status === 'delivered';

      if (!isAccount || isConfirmed) {
        await api.updateProduct(newOrder.product.id, {
          stock: Math.max(0, newOrder.product.stock - (newOrder.quantity || 1)),
          isSold: isAccount ? true : (newOrder.product.stock - (newOrder.quantity || 1) <= 0),
        });
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === newOrder.product.id) {
              const nextStock = Math.max(0, p.stock - (newOrder.quantity || 1));
              return {
                ...p,
                stock: nextStock,
                isSold: isAccount ? true : nextStock <= 0,
              };
            }
            return p;
          })
        );
      }

      // Dispatch Telegram Order Alert with Product Name & Buyer Username
      const tgRes = await api.sendTelegramOrderAlert(newOrder);
      if (tgRes) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === newOrder.id
              ? {
                  ...o,
                  telegramDispatched: tgRes.dispatched,
                  telegramDispatchStatus: tgRes.status,
                  telegramDispatchedAt: new Date().toLocaleTimeString(),
                  productName: tgRes.productName || newOrder.product?.title,
                  buyerUsername: tgRes.buyerUsername || newOrder.customerName,
                }
              : o
          )
        );
      }
    } catch (err) {
      console.error('Failed to sync order to server:', err);
    }

    setActiveScreen('order-complete');
  };

  const handleTopUpSuccess = async (amountUSD: number, bonusUSD: number = 0, refCode?: string) => {
    const totalCredited = amountUSD + bonusUSD;
    const updatedBalance = userProfile.balanceUSD + totalCredited;
    const updates: Partial<UserProfile> = {
      balanceUSD: updatedBalance,
    };
    if (refCode) {
      updates.referredBy = refCode;
    }
    setUserProfile((prev) => ({ ...prev, ...updates }));
    try {
      await api.updateUserProfile(updates);
      if (currentUser) {
        updateUserFirestoreProfile(currentUser.uid, {
          balanceUSD: updatedBalance,
        }).catch((e) => console.warn('Firestore balance sync failed:', e));
      }
      if (bonusUSD > 0) {
        showToast(`Added $${amountUSD.toFixed(2)} + $${bonusUSD.toFixed(2)} (5% Referral Bonus) to balance!`);
      } else {
        showToast(`Successfully added $${amountUSD.toFixed(2)} USD to balance!`);
      }
    } catch (err) {
      console.error('Failed to save profile balance:', err);
    }
    setTimeout(() => {
      setIsTopupOpen(false);
    }, 1500);
  };

  const handleOpenTopup = (defaultCode?: string) => {
    if (!currentUser) {
      showToast(
        lang === 'KM'
          ? 'សូមចូលគណនីជាមុនសិន ដើម្បីបញ្ចូលសមតុល្យកាបូប (Sign in required to top up)!'
          : 'Please sign in first to top up your wallet balance!'
      );
      setIsAuthModalOpen(true);
      return;
    }
    if (defaultCode) {
      setTopupDefaultRefCode(defaultCode);
    }
    setIsTopupOpen(true);
  };

  const handleSimulateReferralBonus = async (friendName: string, topUpAmountUSD: number) => {
    const validAmount = Number(topUpAmountUSD) || 0;
    const bonusUSD = parseFloat((validAmount * 0.05).toFixed(2));
    const newReward = {
      id: `ref-${Date.now()}`,
      friendUsername: friendName,
      topUpAmountUSD: validAmount,
      bonusEarnedUSD: bonusUSD,
      date: 'Just now • 5% Bonus Credited',
    };

    const updatedEarnings = (userProfile?.referralEarningsUSD || 0) + bonusUSD;
    const updatedCount = (userProfile?.referralCount || 0) + 1;
    const updatedHistory = [newReward, ...(userProfile?.referralHistory || [])];
    const updatedBalance = (userProfile?.balanceUSD || 0) + bonusUSD;

    const updates: Partial<UserProfile> = {
      balanceUSD: updatedBalance,
      referralEarningsUSD: updatedEarnings,
      referralCount: updatedCount,
      referralHistory: updatedHistory,
    };

    setUserProfile((prev) => ({ ...prev, ...updates }));

    try {
      await api.updateUserProfile(updates);
      showToast(`🎉 Friend ${friendName} topped up $${validAmount.toFixed(2)}! You earned +$${bonusUSD.toFixed(2)} USD (5%)!`);
    } catch (err) {
      console.error('Failed to sync referral bonus:', err);
    }
  };

  // Admin Order Actions
  const handleApproveOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'delivered', slipStatus: 'confirmed' } : o))
    );

    // When an order is confirmed:
    // If it's an account, mark it sold and deduct stock so it is hidden from the store
    if (targetOrder?.product?.id) {
      const isAccount =
        targetOrder.fulfillmentType === 'account' ||
        targetOrder.product.category === 'account' ||
        targetOrder.product.fulfillmentType === 'account';
      if (isAccount) {
        setProducts((prev) =>
          prev.map((p) => (p.id === targetOrder.product.id ? { ...p, stock: 0, isSold: true } : p))
        );
        try {
          await api.updateProduct(targetOrder.product.id, { stock: 0, isSold: true });
        } catch {}
      } else {
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === targetOrder.product.id) {
              const nextStock = Math.max(0, p.stock - (targetOrder.quantity || 1));
              return { ...p, stock: nextStock, isSold: nextStock <= 0 };
            }
            return p;
          })
        );
      }
    }

    try {
      const adminEmail = currentUser?.email || 'youtgg13@gmail.com';
      await api.updateOrderStatus(orderId, 'delivered', adminToken || '', adminEmail);
      showToast('Order approved & credentials released!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'rejected', slipStatus: 'rejected' } : o))
    );

    // If an account was rejected, ensure it is restored to available in the store
    if (targetOrder?.product?.id) {
      const isAccount =
        targetOrder.fulfillmentType === 'account' ||
        targetOrder.product.category === 'account' ||
        targetOrder.product.fulfillmentType === 'account';
      if (isAccount) {
        setProducts((prev) =>
          prev.map((p) => (p.id === targetOrder.product.id ? { ...p, stock: 1, isSold: false } : p))
        );
        try {
          await api.updateProduct(targetOrder.product.id, { stock: 1, isSold: false });
        } catch {}
      }
    }

    try {
      const adminEmail = currentUser?.email || 'youtgg13@gmail.com';
      await api.updateOrderStatus(orderId, 'rejected', adminToken || '', adminEmail);
      showToast('Order rejected.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    // 1. Immediately remove from state
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    // 2. Clear from last completed order if matching
    if (lastCompletedOrder?.id === orderId) {
      setLastCompletedOrder(null);
    }

    try {
      const ok = await api.deleteOrder(orderId, adminToken || '');
      if (ok) {
        showToast(`Order ${orderId} deleted successfully.`);
      } else {
        showToast(`Removed order ${orderId}.`);
      }
    } catch (err) {
      console.error('Failed to delete order:', err);
    }
  };

  const handleDeleteOrdersByStatus = async (status?: string) => {
    setOrders((prev) => (status ? prev.filter((o) => o.status !== status) : []));
    try {
      await api.deleteOrdersByStatus(status, adminToken || '');
      showToast(status ? `Cleared all ${status} orders.` : 'All orders deleted.');
    } catch (err) {
      console.error('Failed to clear orders by status:', err);
    }
  };

  const handleResendTelegramAlert = async (orderId: string) => {
    try {
      const res = await api.resendTelegramOrderAlert(orderId);
      if (res.dispatched) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  telegramDispatched: true,
                  telegramDispatchStatus: 'success',
                  telegramDispatchedAt: new Date().toLocaleTimeString(),
                }
              : o
          )
        );
        showToast(`✅ Alert for ${orderId} successfully dispatched to Telegram!`);
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  telegramDispatched: false,
                  telegramDispatchStatus: 'failed',
                }
              : o
          )
        );
        showToast(`❌ Failed to dispatch Telegram alert for ${orderId}. Check bot settings.`);
      }
    } catch (err) {
      console.error('Failed to resend telegram alert:', err);
      showToast('Error connecting to Telegram dispatch endpoint.');
    }
  };

  // Admin Product Actions
  const handleAddProduct = async (newProduct: Product) => {
    try {
      const saved = await api.createProduct(newProduct, adminToken || '');
      setProducts((prev) => [saved, ...prev]);
      showToast(`Product "${saved.title}" added to store!`);
      setActiveScreen('admin-items');
    } catch (err) {
      console.error('Failed to create product on backend:', err);
      setProducts((prev) => [newProduct, ...prev]);
      setActiveScreen('admin-items');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await api.deleteProduct(productId, adminToken || '');
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast('Product deleted from inventory.');
    } catch (err) {
      console.error('Failed to delete product:', err);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      const adminEmail = currentUser?.email || 'youtgg13@gmail.com';
      const updated = await api.updateProduct(productId, updates, adminToken || '', adminEmail);
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updated } : p)));
      showToast('Product updated successfully!');
    } catch (err) {
      console.error('Failed to update product:', err);
    }
  };

  const handleReleaseAllDrafts = async () => {
    setProducts((prev) => prev.map((p) => ({ ...p, isDraft: false })));
    for (const p of products.filter((x) => x.isDraft)) {
      try {
        await api.updateProduct(p.id, { isDraft: false }, adminToken || '');
      } catch (err) {
        console.error(err);
      }
    }
    showToast('All draft products published to live marketplace!');
  };

  // Admin Settings & BGM Actions
  const handleSaveSettings = async (newSettings: StoreSettings) => {
    setSettings(newSettings);
    try {
      await api.updateSettings(newSettings, adminToken || '');
      showToast('Store & KHQR configuration saved!');
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleSaveSongs = async (newSongs: SongTrack[]) => {
    setSongs(newSongs);
    try {
      await api.updateSongs(newSongs, adminToken || '');
      showToast('Music playlist updated!');
    } catch (err) {
      console.error('Failed to update songs:', err);
    }
  };

  const handleResetToZero = async () => {
    try {
      const resetData = await api.resetToZeroSlate(adminToken || '');
      setProducts(resetData.products || []);
      setOrders(resetData.orders || []);
      showToast('Clean slate initialized! You can now add products from zero.');
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const handleImportBackup = async (importedData: FullAppState, mode: 'overwrite' | 'merge'): Promise<boolean> => {
    try {
      const res = await api.importBackup(importedData, mode);
      const db = res?.data || (res as any)?.database;
      if (db) {
        if (db.products) setProducts(db.products);
        if (db.orders) setOrders(db.orders);
        if (db.coupons) setCoupons(db.coupons);
        if (db.settings) setSettings(db.settings);
        if (db.userProfile) setUserProfile(db.userProfile);
        if (db.songs) setSongs(db.songs);
        if (db.analytics) setAnalytics(db.analytics);
        showToast('Backup restored successfully! All data updated.');
        return true;
      } else {
        if (importedData.products) setProducts(importedData.products);
        if (importedData.orders) setOrders(importedData.orders);
        if (importedData.coupons) setCoupons(importedData.coupons);
        if (importedData.settings) setSettings(importedData.settings);
        if (importedData.userProfile) setUserProfile(importedData.userProfile);
        if (importedData.songs) setSongs(importedData.songs);
        showToast('Backup loaded and applied to store!');
        return true;
      }
    } catch (err) {
      console.error('Failed to import backup:', err);
      showToast('Error importing backup. Please verify JSON file.');
      return false;
    }
  };

  // Admin Coupons Actions
  const handleAddCoupon = async (newCoupon: Coupon) => {
    try {
      const saved = await api.createCoupon(newCoupon, adminToken || '');
      setCoupons((prev) => [saved, ...prev]);
      showToast(`Coupon "${saved.code}" activated!`);
    } catch (err) {
      console.error(err);
      setCoupons((prev) => [newCoupon, ...prev]);
    }
  };

  const handleToggleCoupon = (code: string) => {
    setCoupons((prev) =>
      prev.map((c) => (c.code === code ? { ...c, active: !c.active } : c))
    );
  };

  // Admin Auth handler
  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    safeStorage.setItem('uchiro_admin_token', token);
    setActiveScreen('admin-dashboard');
    showToast('Welcome to Uchiro Admin Suite!');
  };

  const handleAdminLogout = (reason?: string) => {
    const currentToken = adminToken || safeStorage.getItem('uchiro_admin_token');
    if (currentToken) {
      api.adminLogout(currentToken).catch(() => {});
    }
    setAdminToken(null);
    safeStorage.removeItem('uchiro_admin_token');
    safeStorage.removeItem('uchiro_admin_last_active');
    setActiveScreen('store');
    showToast(
      reason || (lang === 'KM' ? 'អ្នកបានចាកចេញពី Admin Portal' : 'Logged out of Admin Portal.')
    );
  };

  // 30-Minute Admin Inactivity Auto-Logout Mechanism
  // Tracks user input events and triggers automatic session termination after 30 minutes of inactivity
  const ADMIN_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const lastAdminActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const currentToken = adminToken || safeStorage.getItem('uchiro_admin_token');
    if (!currentToken) return;

    // Initialize last active timestamp
    const storedLast = safeStorage.getItem('uchiro_admin_last_active');
    const initialTime = storedLast ? parseInt(storedLast, 10) || Date.now() : Date.now();
    lastAdminActivityRef.current = initialTime;
    safeStorage.setItem('uchiro_admin_last_active', String(initialTime));

    let lastRecordThrottle = 0;
    const updateActivity = () => {
      const now = Date.now();
      // Throttle recording to once per second
      if (now - lastRecordThrottle > 1000) {
        lastRecordThrottle = now;
        lastAdminActivityRef.current = now;
        try {
          safeStorage.setItem('uchiro_admin_last_active', String(now));
        } catch {}
      }
    };

    // User interaction events to monitor activity
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, updateActivity, { passive: true });
    });

    // Evaluation timer checks inactivity every 5 seconds
    const inactivityTimer = window.setInterval(() => {
      const activeTok = adminToken || safeStorage.getItem('uchiro_admin_token');
      if (!activeTok) return;

      const storedTime = safeStorage.getItem('uchiro_admin_last_active');
      const effectiveLastTime = storedTime ? parseInt(storedTime, 10) || lastAdminActivityRef.current : lastAdminActivityRef.current;
      const elapsed = Date.now() - effectiveLastTime;

      if (elapsed >= ADMIN_INACTIVITY_TIMEOUT_MS) {
        console.warn('[AdminSecurity] Admin session inactive for 30 minutes. Triggering automatic security logout.');
        // Record audit activity log for auto-logout
        api.logActivity(
          {
            actionType: 'admin_auto_logout',
            entityType: 'auth',
            adminId: userProfile.username || currentUser?.email || 'admin',
            details: 'Admin session automatically terminated after 30 minutes of inactivity.',
            detailsKhmer: 'សម័យគ្រប់គ្រង Admin ត្រូវបានចាកចេញដោយស្វ័យប្រវត្ត ដោយសារមិនមានសកម្មភាពរយៈពេល 30 នាទី។',
            badgeColor: '#F97316',
          },
          activeTok
        ).catch(() => {});

        handleAdminLogout(
          lang === 'KM'
            ? 'សុវត្ថិភាព៖ Admin ត្រូវបានចាកចេញដោយស្វ័យប្រវត្ត ដោយសារមិនមានសកម្មភាពរយៈពេល 30 នាទី'
            : 'Security Alert: Admin session expired due to 30 minutes of inactivity.'
        );
      }
    }, 5000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, updateActivity);
      });
      window.clearInterval(inactivityTimer);
    };
  }, [adminToken, lang, userProfile.username, currentUser?.email]);

  const handleRedeemResellerCode = async (
    code: string
  ): Promise<{ success: boolean; message?: string }> => {
    const isMatch = verifyResellerCode(code);
    if (!isMatch) {
      return {
        success: false,
        message:
          lang === 'KM'
            ? 'កូដ Reseller មិនត្រឹមត្រូវទេ។ សូមទាក់ទង Admin លើ Telegram (@uchirostore) ដើម្បីស្នើសុំកូដ!'
            : 'Invalid Reseller Code. Please contact Admin on Telegram (@uchirostore) to request a valid VIP code!',
      };
    }

    const updates: Partial<UserProfile> = {
      isResellerUnlocked: true,
      rank: 'Reseller VIP',
      resellerRedeemedCode: code.trim().toUpperCase(),
      resellerRedeemedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };

    const newProfile = { ...userProfile, ...updates };
    setUserProfile(newProfile);
    safeStorage.setItem('uchiro_user', JSON.stringify(newProfile));

    try {
      await api.updateUserProfile(updates);
    } catch (err) {
      console.error('Failed to sync user profile:', err);
    }

    showToast(
      lang === 'KM'
        ? '🎉 ឋានៈ Reseller VIP ត្រូវបានបើកដំណើរការ! បញ្ចុះតម្លៃ ២០% គ្រប់មុខទំនិញ!'
        : '🎉 Reseller VIP Rank Unlocked! 20% Auto Discount enabled.'
    );

    return {
      success: true,
      message:
        lang === 'KM'
          ? '🎉 អបអរសាទរ! អ្នកបានបើកដំណើរការឋានៈ Reseller VIP ជោគជ័យហើយ (ទទួលបានការបញ្ចុះតម្លៃ ២០% គ្រប់មុខទំនិញ)!'
          : '🎉 Congratulations! You have successfully unlocked Reseller VIP Rank (20% Auto Discount on all products)!',
    };
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    const safeUsername = (updates.username && updates.username.trim()) || userProfile.username || 'Customer';
    const safeRefCode = ensureRandomReferralCode(userProfile.referralCode || updates.referralCode);
    const updated: UserProfile = {
      ...userProfile,
      ...updates,
      username: safeUsername,
      referralCode: safeRefCode,
    };
    setUserProfile(updated);
    safeStorage.setItem('uchiro_user', JSON.stringify(updated));
    safeStorage.setItem('uchiro_user_name', safeUsername);
    safeStorage.setItem('uchiro_user_ref_code', safeRefCode);

    try {
      await api.updateUserProfile(updates);
      if (currentUser) {
        updateUserFirestoreProfile(currentUser.uid, {
          username: updated.username,
          avatarUrl: updated.avatarUrl,
          referralCode: safeRefCode,
        }).catch((e) => console.warn('Firestore profile sync failed:', e));
      }
      showToast(lang === 'KM' ? '✅ បានកែប្រែព័ត៌មានគណនីជោគជ័យ!' : '✅ Profile updated successfully!');
    } catch (err) {
      console.error('Failed to sync profile update:', err);
    }
  };

  const handleAdminPortalClick = () => {
    if (userProfile?.role === 'admin' || adminToken) {
      setActiveScreen('admin-dashboard');
    } else {
      setIsAuthModalOpen(true);
      showToast(
        lang === 'KM'
          ? 'សូមចូលប្រើប្រាស់តាម Standard Portal (/login) ដោយប្រើគណនី Admin'
          : 'Please sign in via the standard login portal (/login) with an Admin account'
      );
    }
  };

  // Check if current screen is admin-protected
  const isAdminScreen = activeScreen.startsWith('admin-');

  // Customer Store Product Visibility Rule:
  // 1. "every account are waiting or not cofirm it still show in store only it comfirm are hide from store"
  // 2. "but fruit and gamepass ..... not hide it still in store but say sold out"
  const storeVisibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isDraft) return false;

      const isAccount = p.category === 'account' || p.fulfillmentType === 'account';

      if (isAccount) {
        // Has a confirmed delivered order?
        const hasDeliveredOrder = orders.some(
          (o) =>
            (o.product?.id === p.id || o.product?.title === p.title) &&
            o.status === 'delivered' &&
            (o.slipStatus === undefined || o.slipStatus === 'confirmed')
        );

        // Has a waiting / pending order?
        const hasPendingOrder = orders.some(
          (o) =>
            (o.product?.id === p.id || o.product?.title === p.title) &&
            o.status === 'pending'
        );

        // If it's waiting or not confirmed, it MUST STILL SHOW IN STORE!
        if (hasPendingOrder && !hasDeliveredOrder) {
          return true;
        }

        // Only confirmed accounts are hidden from the store!
        if (hasDeliveredOrder || (p.isSold && (typeof p.stock === 'number' ? p.stock <= 0 : true))) {
          return false;
        }

        return true;
      }

      // Non-account items (fruit, gamepass, mm2, blade ball, evade, etc.):
      // "but fruit and gamepass ..... not hide it still in store but say sold out"
      // NEVER hide them from the customer store, even if out of stock!
      // They stay in the store and display "SOLD OUT" (or "NO STOCK").
      return true;
    });
  }, [products, orders]);

  // Filter storeVisibleProducts by category and search query
  const filteredProducts = useMemo(() => {
    return storeVisibleProducts.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.titleKhmer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.descriptionKhmer && p.descriptionKhmer.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [storeVisibleProducts, selectedCategory, searchQuery]);

  // Sorted and filtered store products based on selected sorting option
  const sortedFilteredProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') {
      const priceDiff = a.price - b.price;
      if (priceDiff !== 0) return priceDiff;
    } else if (sortBy === 'price-desc') {
      const priceDiff = b.price - a.price;
      if (priceDiff !== 0) return priceDiff;
    }

    // Default / 'newest' or tie-breaker: Newest First
    if (a.createdAt && b.createdAt) {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
    } else if (a.createdAt && !b.createdAt) {
      return -1;
    } else if (!a.createdAt && b.createdAt) {
      return 1;
    }

    const indexA = products.indexOf(a);
    const indexB = products.indexOf(b);
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    return 0;
  });

  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#0c0e15] text-[#e2e2ec] selection:bg-[#ffb230] selection:text-[#291800] relative flex flex-col justify-between">
      {/* Background Music Ambient System */}
      <MusicPlayer songs={songs} defaultVolume={settings.defaultVolume} />

      {/* Global Rate Limit & Security Alert Toast Component */}
      <RateLimitToast lang={lang} />

      {/* Floating Toast Notification */}
      {notificationMsg && (
        <div className="fixed top-20 right-4 z-[100] bg-[#1C1F29] border border-[#ffb230] text-[#ffd7a1] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 font-price text-xs font-bold animate-[slideDown_0.3s_ease-out]">
          <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Top Application Bar with dynamic branding */}
      <TopAppBar
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        lang={lang}
        setLang={setLang}
        userBalanceUSD={userProfile.balanceUSD}
        pendingOrdersCount={pendingOrdersCount}
        onOpenTopup={() => handleOpenTopup()}
        settings={settings}
        isAdminAuthenticated={!!adminToken}
        onAdminPortalClick={handleAdminPortalClick}
        userProfile={userProfile}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleUserLogout}
      />

      {/* Main View Router */}
      <main className="w-full flex-1">
        {/* Customer Store Front */}
            {activeScreen === 'store' && (
              <div className="max-w-[1280px] mx-auto px-3 sm:px-4 md:px-8 pb-12 pt-14 sm:pt-16 md:pt-20">
                {/* Store Hero Banner with dynamic Logo and Announcement */}
                <StoreHero settings={settings} lang={lang} />

                {/* Category Grid Filter */}
                <CategoryGrid
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  lang={lang}
                  products={storeVisibleProducts}
                />

                {/* Search & Sorting Controls Row */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 mt-5 sm:mt-8 md:mt-10 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-[#ffb230]" />
                    <h2 className="font-headline text-xl sm:text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider">
                      {lang === 'KM' ? 'ទំនិញពេញនិយម (FEATURED ITEMS)' : 'FEATURED ITEMS'}
                    </h2>
                    <span className="font-price text-xs px-2 py-0.5 rounded-full bg-[#ffb230]/15 text-[#ffd7a1] font-bold border border-[#ffb230]/30 ml-1">
                      {sortedFilteredProducts.length}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-60 md:w-64">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={lang === 'KM' ? 'ស្វែងរកគណនី, ផ្លែឈើ...' : 'Search items...'}
                        className="w-full bg-[#1C1F29] border border-white/10 text-[#e2e2ec] rounded-xl pl-10 pr-4 py-2 font-price text-sm focus:outline-none focus:border-[#ffb230]"
                      />
                    </div>

                    {/* Sorting Dropdown */}
                    <ProductSortDropdown
                      sortBy={sortBy}
                      onSortChange={setSortBy}
                      lang={lang}
                    />
                  </div>
                </div>

                {/* Products Grid */}
                {sortedFilteredProducts.length === 0 ? (
                  <div className="text-center py-16 bg-[#14161D] rounded-3xl border border-white/5 space-y-3 px-4">
                    <Sparkles className="w-10 h-10 text-[#8B90A0] mx-auto opacity-50" />
                    <h3 className="font-headline text-xl text-[#e2e2ec] uppercase">
                      {lang === 'KM' ? 'មិនទាន់មានទំនិញក្នុងស្តុកនៅឡើយទេ' : 'No items found'}
                    </h3>
                    <p className="font-price text-xs text-[#8B90A0] max-w-sm mx-auto">
                      {lang === 'KM'
                        ? 'សូមជ្រើសរើសប្រភេទផ្សេង ឬចុចដើម្បីបង្ហាញទំនិញទាំងអស់ក្នុងហាង។'
                        : 'Try searching for something else or reset filters to see all products.'}
                    </p>
                    {(selectedCategory !== 'all' || searchQuery.trim() !== '') && (
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setSelectedCategory('all');
                            setSearchQuery('');
                          }}
                          className="px-4 py-2 rounded-xl bg-[#ffb230] text-[#291800] font-headline text-xs uppercase font-bold hover:bg-[#ffa81e] transition-all active:scale-95 shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{lang === 'KM' ? 'បង្ហាញទំនិញទាំងអស់' : 'Show All Products'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
                    {sortedFilteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={setSelectedProduct}
                        onViewPhotos={(p) => setSelectedAccountPhotosProduct(p)}
                        lang={lang}
                      />
                    ))}
                  </div>
                )}

                {/* Customer Real-time Store Statistics placed at the bottom of the store */}
                <CustomerStoreStats orders={orders} lang={lang} />
              </div>
            )}

            {/* Order Complete Screen with Live 2FA TOTP Generator */}
            {activeScreen === 'order-complete' && lastCompletedOrder && (
              <OrderCompleteScreen
                order={lastCompletedOrder}
                onGoHome={() => setActiveScreen('store')}
                onViewOrders={() => setActiveScreen('my-orders')}
                lang={lang}
              />
            )}

            {/* Customer Order History */}
            {activeScreen === 'my-orders' && (
              <OrderHistoryScreen
                orders={orders}
                onSelectOrder={(order) => {
                  setLastCompletedOrder(order);
                  setActiveScreen('order-complete');
                }}
                onGoHome={() => setActiveScreen('store')}
                lang={lang}
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            )}

            {/* Top-up Balance View */}
            {activeScreen === 'topup' && (
              <div className="pt-14 sm:pt-18">
                <TopUpModal
                  userBalanceUSD={userProfile.balanceUSD}
                  userProfile={userProfile}
                  settings={settings}
                  defaultReferralCode={topupDefaultRefCode}
                  onClose={() => setActiveScreen('store')}
                  onTopUpSuccess={(amt, bonus, refCode) => {
                    handleTopUpSuccess(amt, bonus, refCode);
                    setActiveScreen('store');
                  }}
                  lang={lang}
                  isLoggedIn={!!currentUser}
                  onRequireAuth={() => setIsAuthModalOpen(true)}
                />
              </div>
            )}

            {/* Customer Profile */}
            {activeScreen === 'profile' && (
              <UserProfileScreen
                userProfile={userProfile}
                setActiveScreen={setActiveScreen}
                onOpenTopup={(defaultCode) => {
                  handleOpenTopup(defaultCode);
                }}
                onUpdateProfile={handleUpdateProfile}
                onSimulateReferralBonus={handleSimulateReferralBonus}
                onRedeemResellerCode={handleRedeemResellerCode}
                onGoHome={() => setActiveScreen('store')}
                lang={lang}
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onLogout={handleUserLogout}
              />
            )}

            {/* Referral & Rewards Dedicated Page */}
            {activeScreen === 'referral' && (
              <ReferralScreen
                userProfile={userProfile}
                onOpenTopup={(defaultCode) => {
                  handleOpenTopup(defaultCode);
                }}
                onSimulateReferralBonus={handleSimulateReferralBonus}
                onGoHome={() => setActiveScreen('store')}
                lang={lang}
              />
            )}

            {/* Help & Support Dedicated Knowledge Base Page */}
            {activeScreen === 'help' && (
              <HelpSupportScreen
                settings={settings}
                setActiveScreen={setActiveScreen}
                onGoHome={() => setActiveScreen('store')}
                lang={lang}
              />
            )}

            {/* Security & 2FA Settings */}
            {activeScreen === 'security' && (
              <SecuritySettingsScreen
                userProfile={userProfile}
                onBack={() => setActiveScreen('profile')}
                lang={lang}
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            )}

            {/* RBAC Protected Admin Suite */}
            {isAdminScreen && (
              <AdminRouteGuard
                userRole={userProfile?.role}
                isLoggedIn={!!currentUser || !!adminToken}
                lang={lang}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onRedirectToDashboard={() => {
                  setActiveScreen('store');
                  showToast(
                    lang === 'KM'
                      ? '⚠️ អ្នកគ្មានសិទ្ធិចូលទំព័រ Admin ទេ! បានប្តូរទៅទំព័រដើម។'
                      : '⚠️ Access Denied: Administrator privileges required! Redirected to store.'
                  );
                }}
              >
                {/* Admin Dashboard */}
                {activeScreen === 'admin-dashboard' && (
                  <AdminDashboard
                    products={products}
                    orders={orders}
                    coupons={coupons}
                    analytics={analytics}
                    settings={settings}
                    userProfile={userProfile}
                    songs={songs}
                    setActiveScreen={setActiveScreen}
                    onReleaseAllDrafts={handleReleaseAllDrafts}
                    onLogoutAdmin={handleAdminLogout}
                    onImportBackup={handleImportBackup}
                    onResetToZero={handleResetToZero}
                    lang={lang}
                    storeLogoUrl={settings.logoUrl}
                  />
                )}

                {/* Admin Orders Management */}
                {activeScreen === 'admin-orders' && (
                  <AdminOrders
                    orders={orders}
                    onApproveOrder={handleApproveOrder}
                    onRejectOrder={handleRejectOrder}
                    onDeleteOrder={handleDeleteOrder}
                    onDeleteOrdersByStatus={handleDeleteOrdersByStatus}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                    storeLogoUrl={settings.logoUrl}
                    onResendTelegramAlert={handleResendTelegramAlert}
                  />
                )}

                {/* Admin Add Product with Photo Upload & Credentials */}
                {activeScreen === 'admin-add-item' && (
                  <AdminAddItem
                    onAddProduct={handleAddProduct}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                  />
                )}

                {/* Admin Inventory List (Edit, Delete, Stock control) */}
                {activeScreen === 'admin-items' && (
                  <AdminItemsList
                    products={products}
                    onDeleteProduct={handleDeleteProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onAddProductClick={() => setActiveScreen('admin-add-item')}
                    onGoToStore={() => setActiveScreen('store')}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                  />
                )}

                {/* Admin Store & KHQR API Settings */}
                {activeScreen === 'admin-settings' && (
                  <AdminSettings
                    settings={settings}
                    songs={songs}
                    onSaveSettings={handleSaveSettings}
                    onSaveSongs={handleSaveSongs}
                    onResetToZero={handleResetToZero}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                  />
                )}

                {/* Admin Visitor & Revenue Analytics */}
                {activeScreen === 'admin-analytics' && (
                  <AdminAnalytics
                    analytics={analytics}
                    orders={orders}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                  />
                )}

                {/* Admin Coupons */}
                {activeScreen === 'admin-coupons' && (
                  <AdminCoupons
                    coupons={coupons}
                    onAddCoupon={handleAddCoupon}
                    onToggleCoupon={handleToggleCoupon}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                  />
                )}

                {/* Admin Telegram Dual-Bot & Username Inspector Config */}
                {activeScreen === 'admin-bot-config' && (
                  <AdminStoreBotConfig
                    settings={settings}
                    onSaveSettings={handleSaveSettings}
                    orders={orders}
                    products={products}
                    userProfile={userProfile}
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                  />
                )}

                {/* Admin Reseller & Voucher Codes Management */}
                {activeScreen === 'admin-resellers' && (
                  <AdminResellerCodes
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                    showToast={showToast}
                  />
                )}

                {/* Admin User Accounts Management (List, Add Balance, Ban, Delete) */}
                {activeScreen === 'admin-users' && (
                  <AdminUsers
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                    showToast={showToast}
                    currentUserEmail={currentUser?.email || undefined}
                    onBalanceUpdated={(userId, newBalance) => {
                      if (currentUser && currentUser.uid === userId) {
                        setUserProfile((prev) => ({ ...prev, balanceUSD: newBalance }));
                      }
                    }}
                  />
                )}

                {/* Admin Activity Log & Accountability Audit Trail */}
                {activeScreen === 'admin-activity-logs' && (
                  <AdminActivityLogs
                    onBack={() => setActiveScreen('admin-dashboard')}
                    lang={lang}
                    currentAdminId={userProfile.username || currentUser?.email || 'admin'}
                    adminToken={adminToken}
                  />
                )}
              </AdminRouteGuard>
            )}
      </main>

      {/* Live Purchase / Top-Up Activity Ticker */}
      {!isAdminScreen && <LiveActivityFeed lang={lang} />}

      {/* Top Buyers / Top Top-Up Leaderboard */}
      {!isAdminScreen && <Leaderboard lang={lang} />}

      {/* Customer Store Footer */}
      {!isAdminScreen && (
        <StoreFooter
          settings={settings}
          onAdminLoginClick={handleAdminPortalClick}
          lang={lang}
          setActiveScreen={setActiveScreen}
        />
      )}

      {/* Product Detail Bottom Sheet */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onProceedToCheckout={handleProceedToCheckout}
          onViewPhotos={(p) => setSelectedAccountPhotosProduct(p)}
          lang={lang}
          isLoggedIn={!!currentUser}
        />
      )}

      {/* Account Photo Gallery Modal */}
      {selectedAccountPhotosProduct && (
        <AccountPhotosModal
          product={selectedAccountPhotosProduct}
          isOpen={!!selectedAccountPhotosProduct}
          onClose={() => setSelectedAccountPhotosProduct(null)}
          onBuyNow={(p) => {
            setSelectedAccountPhotosProduct(null);
            handleProceedToCheckout(p);
          }}
          lang={lang}
        />
      )}

      {/* Checkout Modal with Live Official KHQR and Dynamic Store Settings */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          availableCoupons={coupons}
          settings={settings}
          userProfile={userProfile}
          onClose={() => setCheckoutProduct(null)}
          onCompleteOrder={handleCompleteOrder}
          onOpenTopup={() => handleOpenTopup()}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onViewMyOrders={() => {
            setCheckoutProduct(null);
            setActiveScreen('my-orders');
          }}
          isLoggedIn={!!currentUser}
          lang={lang}
        />
      )}

      {/* Top-up Balance Modal */}
      {isTopupOpen && (
        <TopUpModal
          userBalanceUSD={userProfile.balanceUSD}
          userProfile={userProfile}
          settings={settings}
          defaultReferralCode={topupDefaultRefCode}
          onClose={() => {
            setIsTopupOpen(false);
            setTopupDefaultRefCode('');
          }}
          onTopUpSuccess={handleTopUpSuccess}
          lang={lang}
          isLoggedIn={!!currentUser}
          onRequireAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Firebase Authentication Modal (Sign In, Sign Up, Google Link, Reset Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPurchaseIntentProduct(null);
        }}
        lang={lang}
        onAuthSuccess={handleAuthSuccess}
        purchaseIntentProduct={purchaseIntentProduct}
      />

      {/* Bottom Navigation Bar */}
      <BottomNavBar
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        lang={lang}
        pendingOrdersCount={pendingOrdersCount}
      />
    </div>
  );
}

export default App;
