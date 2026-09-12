export type CategoryType = 'all' | 'account' | 'fruit' | 'gamepass' | 'evade' | 'mm2' | 'blade-ball';

export type FulfillmentType = 'account' | 'gift' | 'trade';

export type ProductSortOption = 'newest' | 'price-asc' | 'price-desc';

export interface Product {
  id: string;
  title: string;
  titleKhmer: string;
  category: CategoryType;
  price: number; // in USD
  priceUSD?: number; // alias for USD price
  stock: number;
  image: string;
  badge?: '14D' | '7D' | '30D' | 'NEW' | 'LEGENDARY' | null;
  isShimmer?: boolean;
  description: string;
  descriptionKhmer: string;
  deliveryType: 'automatic' | 'manual';
  fulfillmentType: FulfillmentType; // 'account' (Auto + Warranty) | 'gift' (Roblox username 15-30mn) | 'trade' (In-game trade / Admin Contact)
  warrantyDays?: number; // ONLY for account
  tradeInstructions?: string; // For fruit / mm2 / blade ball in-game trade
  autoDeliveryPayload?: {
    username?: string;
    password?: string;
    authenticatorKey?: string;
    secretScript?: string;
    instructionsKhmer?: string;
  };
  galleryImages?: string[];
  accountSpecs?: {
    levelRank?: string;
    meleeSkills?: string;
    emailSecurity?: string;
    phonePin?: string;
  };
  isFeatured?: boolean;
  isDraft?: boolean;
  isSold?: boolean;
  createdAt?: string;
}

export interface Order {
  id: string; // e.g. '#ORD-8829'
  customerName: string;
  date: string;
  time: string;
  timestamp: number;
  product: Product;
  quantity: number;
  totalUSD: number;
  status: 'pending' | 'delivered' | 'rejected';
  paymentMethod: 'KHQR' | 'Balance';
  fulfillmentType: FulfillmentType;
  recipientRobloxUsername?: string; // For Gift / Gamepass
  recipientRobloxProfile?: RobloxProfile; // Checked & verified Roblox profile
  paymentSlipUrl?: string;
  slipStatus?: 'none' | 'verifying' | 'admin_review' | 'confirmed' | 'rejected';
  khqrPayload?: string;
  credentialsDelivered?: {
    username: string;
    password: string;
    authenticatorKey: string;
    live2faSeed: string;
    deliveryTime: string;
    warrantyDurationDays?: number;
  };
  discountApplied?: {
    code: string;
    discountPercent: number;
    amountSavedUSD: number;
  };
  rankDiscountApplied?: {
    rankTier: string;
    rankTitle: string;
    discountPercent: number;
    amountSavedUSD: number;
  };
  transactionRef?: string;
  md5Hash?: string;
  apiConfirmedAt?: string;
  apiSource?: string;
  telegramDispatched?: boolean;
  telegramDispatchStatus?: 'success' | 'failed';
  telegramDispatchedAt?: string;
  buyerUsername?: string;
  productName?: string;
}

export interface Transaction {
  id: string;
  type: 'topup' | 'purchase' | 'refund';
  title: string;
  amountUSD: number;
  date: string;
  status: 'success' | 'pending' | 'failed';
  icon: string;
  orderId?: string;
}

export interface TopUpSlipRequest {
  id: string;
  customerUsername: string;
  amountUSD: number;
  bonusUSD: number;
  totalCreditUSD: number;
  status: 'pending' | 'delivered' | 'rejected';
  slipUrl?: string;
  date: string;
  time: string;
  timestamp: number;
  md5?: string;
  billNumber?: string;
  referralCode?: string;
  telegramDispatched?: boolean;
}

export interface UserSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  type: 'mobile' | 'desktop';
}

export interface ReferralReward {
  id: string;
  friendUsername: string;
  topUpAmountUSD: number;
  bonusEarnedUSD: number;
  date: string;
}

export interface UserProfile {
  username: string;
  displayName?: string;
  bio?: string;
  rank: string;
  balanceUSD: number;
  totalSpentUSD?: number;
  isResellerUnlocked?: boolean;
  resellerRedeemedCode?: string;
  resellerRedeemedAt?: string;
  referralCode?: string;
  referralBonusPercent?: number; // default 5%
  referralEarningsUSD?: number;
  referralCount?: number;
  referredBy?: string;
  referralHistory?: ReferralReward[];
  avatarUrl: string;
  email: string;
  phone: string;
  is2FAEnabled: boolean;
  telegramLinked: boolean;
  discordLinked: boolean;
  firebaseUid?: string;
  authProvider?: 'google' | 'password' | 'guest';
  isBanned?: boolean;
  bannedReason?: string;
  role?: 'customer' | 'reseller' | 'admin';
  activeSessions: UserSession[];
}

export interface Coupon {
  code: string;
  discountPercent: number;
  active: boolean;
  usageCount: number;
  description: string;
  expiresAt?: string; // Optional expiry date (ISO format or YYYY-MM-DD)
}

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration?: string;
}

export interface StoreSettings {
  storeName: string;
  storeNameKhmer: string;
  logoUrl: string;
  faviconUrl?: string;
  announcement: string;
  tagline?: string;
  aboutStore?: string;
  telegramUrl: string; // Channel e.g. https://t.me/uchirostore
  telegramAdminUrl: string; // Admin e.g. https://t.me/Noreakyout
  discordUrl: string;
  supportPhone: string; // e.g. +855 16866125
  workingHours?: string;
  exchangeRateKHR?: number; // e.g. 4100
  // Telegram Bot Integration Config
  telegramBotToken?: string;
  telegramAdminChatId?: string;
  telegramChannelId?: string;
  orderAlertsEnabled?: boolean;
  topupAlertsEnabled?: boolean;
  lowStockAlertsEnabled?: boolean;
  alertSoundEnabled?: boolean;
  // Bot 2: Customer & Verification Bot
  verificationBotToken?: string;
  verificationBotUsername?: string;
  verificationBotEnabled?: boolean;
  autoCheckRobloxProfile?: boolean;
  miniAppUrl?: string;
  // KHQR Merchant Details & API Configuration
  bakongAccountId: string;
  merchantName: string;
  merchantCity: string;
  acquiringBank?: string;
  khqrApiKey: string;
  webhookUrl: string;
  autoApproveKHQR: boolean;
  // Background Music
  bgMusicEnabled: boolean;
  bgMusicAutoplay: boolean;
  bgMusicLoop: boolean;
  defaultVolume?: number;
  songs: SongTrack[];
  // Display & Inventory Preferences
  hideSoldOutProducts?: boolean;
  // Admin credentials
  adminUsername: string;
  adminPasswordHash?: string;
  adminSecurityPin?: string;
  adminEmail?: string;
}

export interface VisitorAnalyticsData {
  liveNow: number;
  totalVisits: string;
  visitsGrowth: string;
  uniqueVisitors: string;
  uniqueGrowth: string;
  avgSession: string;
  sessionGrowth: string;
  traffic24h: { time: string; count: number }[];
  devices: { mobile: number; desktop: number };
  locations: { name: string; nameKhmer: string; percentage: number }[];
  trafficSources: { name: string; percentage: number }[];
  tgReferred: string;
  topPage: string;
}

export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  accountAgeYears?: number;
  createdDate?: string;
  verifiedBadge?: boolean;
  has2FA?: boolean;
  tradeEligible?: boolean;
  riskLevel?: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  levelEstimate?: number;
  inventorySummary?: string[];
  totalSpentStoreUSD?: number;
  storeTier?: string;
}

export interface ResellerRedeemCode {
  id: string;
  code: string;
  type: 'balance' | 'reseller_rank' | 'both';
  valueUSD: number;
  resellerName: string;
  maxUses: number;
  usedCount: number;
  usedBy: {
    username: string;
    redeemedAt: string;
    amountUSD?: number;
  }[];
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  note?: string;
}

export type ActiveScreen = 
  | 'store'
  | 'product-modal'
  | 'checkout'
  | 'order-complete'
  | 'my-orders'
  | 'topup'
  | 'transactions'
  | 'profile'
  | 'referral'
  | 'help'
  | 'security'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-orders'
  | 'admin-items'
  | 'admin-add-item'
  | 'admin-analytics'
  | 'admin-coupons'
  | 'admin-settings'
  | 'admin-users'
  | 'admin-bot-config'
  | 'admin-music'
  | 'admin-resellers'
  | 'admin-activity-logs';

export interface AdminActivityLog {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  adminId: string;
  adminEmail?: string;
  actionType:
    | 'product_delete'
    | 'product_create'
    | 'product_update'
    | 'price_update'
    | 'order_approve'
    | 'order_reject'
    | 'order_delete'
    | 'settings_update'
    | 'coupon_add'
    | 'coupon_toggle'
    | 'user_balance_update'
    | 'user_ban'
    | 'reseller_code_create'
    | 'system_backup_restore'
    | 'admin_login'
    | 'admin_logout'
    | 'admin_auto_logout'
    | string;
  entityType: 'product' | 'order' | 'settings' | 'coupon' | 'user' | 'system' | 'auth' | string;
  entityId?: string;
  entityTitle?: string;
  details: string;
  detailsKhmer?: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  badgeColor?: string;
}

export interface FullAppState {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  settings: StoreSettings;
  userProfile?: UserProfile;
  songs?: SongTrack[];
  analytics?: VisitorAnalyticsData;
  resellerCodes?: ResellerRedeemCode[];
}

export interface RateLimitAlert {
  id: string;
  action: 'login' | 'order_create' | 'admin_login' | 'register' | 'payment_slip' | string;
  retryAfterSeconds: number;
  totalDurationSeconds?: number;
  message?: string;
  messageKhmer?: string;
  reason?: string;
  timestamp: number;
}
