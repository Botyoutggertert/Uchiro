import { FullAppState, Product, Order, Coupon, StoreSettings, UserProfile, SongTrack, VisitorAnalyticsData } from '../types';

export interface BackupMetadata {
  version: string;
  exportedAt: string;
  exportedTimestamp: number;
  storeName: string;
  productsCount: number;
  ordersCount: number;
  couponsCount: number;
  songsCount: number;
  totalCatalogValueUSD: number;
  totalOrdersRevenueUSD: number;
}

export interface StoreBackupPackage {
  _type: 'UCHIRO_STORE_BACKUP';
  version: string;
  exportedAt: string;
  timestamp: number;
  metadata: BackupMetadata;
  data: {
    products: Product[];
    orders: Order[];
    coupons: Coupon[];
    settings: StoreSettings;
    userProfile?: UserProfile;
    songs?: SongTrack[];
    analytics?: VisitorAnalyticsData;
  };
}

export interface ValidationResult {
  valid: boolean;
  metadata?: BackupMetadata;
  backupData?: FullAppState;
  error?: string;
}

/**
 * Downloads full store database as a JSON backup file
 */
export function exportStoreBackup(state: FullAppState, storeName: string = 'Uchiro_Store'): void {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const products = state.products || [];
  const orders = state.orders || [];
  const coupons = state.coupons || [];
  const songs = state.songs || state.settings?.songs || [];

  const totalCatalogValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 1), 0);
  const totalOrdersRevenue = orders.reduce((sum, o) => sum + (o.totalUSD || 0), 0);

  const metadata: BackupMetadata = {
    version: '2.0',
    exportedAt: now.toISOString(),
    exportedTimestamp: now.getTime(),
    storeName: state.settings?.storeName || storeName,
    productsCount: products.length,
    ordersCount: orders.length,
    couponsCount: coupons.length,
    songsCount: songs.length,
    totalCatalogValueUSD: Number(totalCatalogValue.toFixed(2)),
    totalOrdersRevenueUSD: Number(totalOrdersRevenue.toFixed(2)),
  };

  const backupPackage: StoreBackupPackage = {
    _type: 'UCHIRO_STORE_BACKUP',
    version: '2.0',
    exportedAt: now.toISOString(),
    timestamp: now.getTime(),
    metadata,
    data: {
      products,
      orders,
      coupons,
      settings: state.settings,
      userProfile: state.userProfile,
      songs,
      analytics: state.analytics,
    },
  };

  const jsonStr = JSON.stringify(backupPackage, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanStoreName = (state.settings?.storeName || 'uchiro_store').toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${cleanStoreName}_backup_${dateStr}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates any JSON string as a valid Uchiro store backup
 */
export function validateBackupFile(fileContent: string): ValidationResult {
  try {
    const parsed = JSON.parse(fileContent);

    // Support both Wrapped Backup Package and Direct State Object
    let products: Product[] = [];
    let orders: Order[] = [];
    let coupons: Coupon[] = [];
    let settings: StoreSettings | undefined;
    let userProfile: UserProfile | undefined;
    let songs: SongTrack[] = [];
    let analytics: VisitorAnalyticsData | undefined;
    let metadata: BackupMetadata;

    if (parsed._type === 'UCHIRO_STORE_BACKUP' && parsed.data) {
      // Standard structured backup package
      products = Array.isArray(parsed.data.products) ? parsed.data.products : [];
      orders = Array.isArray(parsed.data.orders) ? parsed.data.orders : [];
      coupons = Array.isArray(parsed.data.coupons) ? parsed.data.coupons : [];
      settings = parsed.data.settings;
      userProfile = parsed.data.userProfile;
      songs = Array.isArray(parsed.data.songs) ? parsed.data.songs : [];
      analytics = parsed.data.analytics;
      metadata = parsed.metadata || {
        version: parsed.version || '2.0',
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        exportedTimestamp: parsed.timestamp || Date.now(),
        storeName: settings?.storeName || 'Uchiro Store',
        productsCount: products.length,
        ordersCount: orders.length,
        couponsCount: coupons.length,
        songsCount: songs.length,
        totalCatalogValueUSD: products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 1), 0),
        totalOrdersRevenueUSD: orders.reduce((sum, o) => sum + (o.totalUSD || 0), 0),
      };
    } else if (parsed.products || parsed.orders || parsed.settings) {
      // Direct state database dump
      products = Array.isArray(parsed.products) ? parsed.products : [];
      orders = Array.isArray(parsed.orders) ? parsed.orders : [];
      coupons = Array.isArray(parsed.coupons) ? parsed.coupons : [];
      settings = parsed.settings;
      userProfile = parsed.userProfile;
      songs = Array.isArray(parsed.songs) ? parsed.songs : parsed.settings?.songs || [];
      analytics = parsed.analytics;

      metadata = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedTimestamp: Date.now(),
        storeName: settings?.storeName || 'Imported Store',
        productsCount: products.length,
        ordersCount: orders.length,
        couponsCount: coupons.length,
        songsCount: songs.length,
        totalCatalogValueUSD: products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 1), 0),
        totalOrdersRevenueUSD: orders.reduce((sum, o) => sum + (o.totalUSD || 0), 0),
      };
    } else {
      return {
        valid: false,
        error: 'Unrecognized JSON format. File must contain products, orders, or store settings.',
      };
    }

    if (products.length === 0 && orders.length === 0 && !settings) {
      return {
        valid: false,
        error: 'Backup file is empty (contains no products, orders, or configuration).',
      };
    }

    return {
      valid: true,
      metadata,
      backupData: {
        products,
        orders,
        coupons,
        settings: settings || ({} as StoreSettings),
        userProfile: userProfile || ({} as UserProfile),
        songs,
        analytics: analytics || ({} as VisitorAnalyticsData),
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `JSON Syntax Error: ${err.message || 'Unable to parse file'}`,
    };
  }
}

/**
 * Merges imported store state into current state
 */
export function mergeStoreState(
  currentState: FullAppState,
  importedState: FullAppState
): FullAppState {
  // Merge products by unique ID
  const productMap = new Map<string, Product>();
  (currentState.products || []).forEach((p) => productMap.set(p.id, p));
  (importedState.products || []).forEach((p) => productMap.set(p.id, p));

  // Merge orders by unique ID
  const orderMap = new Map<string, Order>();
  (currentState.orders || []).forEach((o) => orderMap.set(o.id, o));
  (importedState.orders || []).forEach((o) => orderMap.set(o.id, o));

  // Merge coupons by unique code
  const couponMap = new Map<string, Coupon>();
  (currentState.coupons || []).forEach((c) => couponMap.set(c.code.toUpperCase(), c));
  (importedState.coupons || []).forEach((c) => couponMap.set(c.code.toUpperCase(), c));

  // Merge songs by ID or URL
  const songMap = new Map<string, SongTrack>();
  (currentState.songs || []).forEach((s) => songMap.set(s.url || s.id, s));
  (importedState.songs || []).forEach((s) => songMap.set(s.url || s.id, s));

  return {
    products: Array.from(productMap.values()),
    orders: Array.from(orderMap.values()),
    coupons: Array.from(couponMap.values()),
    settings: {
      ...currentState.settings,
      ...importedState.settings,
    },
    userProfile: {
      ...currentState.userProfile,
      ...(importedState.userProfile || {}),
    },
    analytics: currentState.analytics || importedState.analytics,
    songs: Array.from(songMap.values()),
  };
}
