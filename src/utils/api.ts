import { Product, Order, UserProfile, Coupon, VisitorAnalyticsData, StoreSettings, SongTrack, RobloxProfile, TopUpSlipRequest, RateLimitAlert, AdminActivityLog } from '../types';
import { safeStorage } from './storage';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_USER_PROFILE,
  INITIAL_COUPONS,
  INITIAL_VISITOR_ANALYTICS,
  INITIAL_STORE_SETTINGS,
  INITIAL_SONGS,
} from '../data/mockData';

/**
 * Dispatches a global event that triggers the RateLimitToast notification anywhere in the application
 */
export function triggerRateLimitAlert(alert: RateLimitAlert): void {
  if (typeof window !== 'undefined') {
    const detail: RateLimitAlert = {
      id: alert.id || `rl-${alert.action}-${Date.now()}`,
      timestamp: alert.timestamp || Date.now(),
      totalDurationSeconds: alert.totalDurationSeconds || alert.retryAfterSeconds || 30,
      ...alert,
    };
    window.dispatchEvent(new CustomEvent('uchiro:rate_limit_alert', { detail }));
  }
}

export interface FullAppState {
  products: Product[];
  orders: Order[];
  userProfile: UserProfile;
  coupons: Coupon[];
  settings: StoreSettings;
  analytics: VisitorAnalyticsData;
  songs?: SongTrack[];
}

export interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
  message?: string;
  messageKhmer?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  error?: string;
}

export interface RateLimitStatus {
  action: string;
  isBlocked: boolean;
  maxRequests: number;
  currentCount: number;
  remaining: number;
  windowMs: number;
  retryAfterSeconds: number;
}

export class RequestRateLimiter {
  private requestHistory: Map<string, number[]> = new Map();
  private blockExpiry: Map<string, number> = new Map();
  private rules: Map<string, RateLimitRule> = new Map();

  constructor() {
    // 1. Rate limit for login endpoints (admin and customer authentication)
    // 5 attempts per 60 seconds. Lockout: 60 seconds if exceeded.
    this.rules.set('login', {
      maxRequests: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
      message: 'Too many login attempts. For security, please wait {seconds}s before trying again.',
      messageKhmer: 'ការព្យាយាមចូលច្រើនដងពេក។ ដើម្បីសុវត្ថិភាព សូមរង់ចាំ {seconds} វិនាទី មុនពេលព្យាយាមម្តងទៀត។',
    });

    // 2. Rate limit for order creation (prevent rapid spam, double orders, and inventory attacks)
    // 5 orders per 60 seconds. Lockout: 30 seconds if exceeded.
    this.rules.set('order_create', {
      maxRequests: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
      message: 'Too many order requests in a short period. Please wait {seconds}s before placing another order.',
      messageKhmer: 'ការបញ្ជាទិញញឹកញាប់ពេក។ សូមរង់ចាំ {seconds} វិនាទី មុនពេលបញ្ជាទិញម្តងទៀត។',
    });

    // 3. Rate limit for user registration
    this.rules.set('register', {
      maxRequests: 4,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
      message: 'Too many registration attempts. Please wait {seconds}s.',
      messageKhmer: 'ការចុះឈ្មោះច្រើនដងពេក។ សូមរង់ចាំ {seconds} វិនាទី។',
    });
  }

  setRule(action: string, rule: Partial<RateLimitRule>): void {
    const existing = this.rules.get(action) || {
      maxRequests: 5,
      windowMs: 60 * 1000,
    };
    this.rules.set(action, { ...existing, ...rule });
  }

  getRule(action: string): RateLimitRule | undefined {
    return this.rules.get(action);
  }

  getRules(): Record<string, RateLimitRule> {
    const res: Record<string, RateLimitRule> = {};
    this.rules.forEach((val, key) => {
      res[key] = { ...val };
    });
    return res;
  }

  check(action: string, lang: 'KM' | 'EN' = 'EN'): RateLimitResult {
    const now = Date.now();
    const rule = this.rules.get(action) || {
      maxRequests: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
      message: 'Rate limit exceeded. Please wait {seconds}s.',
      messageKhmer: 'លើសកម្រិតកំណត់។ សូមរង់ចាំ {seconds} វិនាទី។',
    };

    // Check if under an active lockout block
    const blockedUntil = this.blockExpiry.get(action) || 0;
    if (now < blockedUntil) {
      const remainingSeconds = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
      const template = (lang === 'KM' && rule.messageKhmer) ? rule.messageKhmer : (rule.message || 'Rate limit exceeded. Please wait {seconds}s.');
      const error = template.replace('{seconds}', String(remainingSeconds));
      triggerRateLimitAlert({
        id: `rl-${action}-${now}`,
        action,
        retryAfterSeconds: remainingSeconds,
        totalDurationSeconds: Math.ceil((rule.blockDurationMs || 30000) / 1000),
        message: rule.message ? rule.message.replace('{seconds}', String(remainingSeconds)) : error,
        messageKhmer: rule.messageKhmer ? rule.messageKhmer.replace('{seconds}', String(remainingSeconds)) : undefined,
        reason: 'Temporary Security Lockout Active',
        timestamp: now,
      });
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: remainingSeconds,
        error,
      };
    }

    // Filter past timestamps outside current sliding window
    const timestamps = (this.requestHistory.get(action) || []).filter(
      (ts) => now - ts < rule.windowMs
    );

    if (timestamps.length >= rule.maxRequests) {
      const blockDuration = rule.blockDurationMs || rule.windowMs;
      const unblockAt = now + blockDuration;
      this.blockExpiry.set(action, unblockAt);
      const remainingSeconds = Math.ceil(blockDuration / 1000);
      const template = (lang === 'KM' && rule.messageKhmer) ? rule.messageKhmer : (rule.message || 'Rate limit exceeded. Please wait {seconds}s.');
      const error = template.replace('{seconds}', String(remainingSeconds));
      triggerRateLimitAlert({
        id: `rl-${action}-${now}`,
        action,
        retryAfterSeconds: remainingSeconds,
        totalDurationSeconds: remainingSeconds,
        message: rule.message ? rule.message.replace('{seconds}', String(remainingSeconds)) : error,
        messageKhmer: rule.messageKhmer ? rule.messageKhmer.replace('{seconds}', String(remainingSeconds)) : undefined,
        reason: 'Request Frequency Threshold Exceeded',
        timestamp: now,
      });
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: remainingSeconds,
        error,
      };
    }

    return {
      allowed: true,
      remaining: rule.maxRequests - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  record(action: string, lang: 'KM' | 'EN' = 'EN'): RateLimitResult {
    const checkResult = this.check(action, lang);
    if (!checkResult.allowed) {
      return checkResult;
    }

    const now = Date.now();
    const rule = this.rules.get(action) || {
      maxRequests: 10,
      windowMs: 60 * 1000,
    };

    const timestamps = (this.requestHistory.get(action) || []).filter(
      (ts) => now - ts < rule.windowMs
    );
    timestamps.push(now);
    this.requestHistory.set(action, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, rule.maxRequests - timestamps.length),
      retryAfterSeconds: 0,
    };
  }

  setBlock(action: string, durationSeconds: number): void {
    const unblockAt = Date.now() + durationSeconds * 1000;
    this.blockExpiry.set(action, unblockAt);
  }

  reset(action: string): void {
    this.requestHistory.delete(action);
    this.blockExpiry.delete(action);
  }

  resetAll(): void {
    this.requestHistory.clear();
    this.blockExpiry.clear();
  }

  getStatus(action: string): RateLimitStatus | null {
    const now = Date.now();
    const rule = this.rules.get(action);
    if (!rule) return null;

    const blockedUntil = this.blockExpiry.get(action) || 0;
    const isBlocked = now < blockedUntil;
    const retryAfterSeconds = isBlocked ? Math.ceil((blockedUntil - now) / 1000) : 0;
    const timestamps = (this.requestHistory.get(action) || []).filter(
      (ts) => now - ts < rule.windowMs
    );

    return {
      action,
      isBlocked,
      maxRequests: rule.maxRequests,
      currentCount: timestamps.length,
      remaining: Math.max(0, rule.maxRequests - timestamps.length),
      windowMs: rule.windowMs,
      retryAfterSeconds,
    };
  }
}

export class ApiUtility {
  public readonly rateLimiter = new RequestRateLimiter();

  // Helper rate limiting accessors
  checkRateLimit(action: string, lang: 'KM' | 'EN' = 'EN'): RateLimitResult {
    return this.rateLimiter.check(action, lang);
  }

  recordRateLimit(action: string, lang: 'KM' | 'EN' = 'EN'): RateLimitResult {
    return this.rateLimiter.record(action, lang);
  }

  resetRateLimit(action: string): void {
    this.rateLimiter.reset(action);
  }

  getRateLimitStatus(action: string): RateLimitStatus | null {
    return this.rateLimiter.getStatus(action);
  }

  setRateLimitRule(action: string, rule: Partial<RateLimitRule>): void {
    this.rateLimiter.setRule(action, rule);
  }

  getRateLimitRules(): Record<string, RateLimitRule> {
    return this.rateLimiter.getRules();
  }

  triggerRateLimitAlert(alert: RateLimitAlert): void {
    triggerRateLimitAlert(alert);
  }

  async getSecurityStatus(): Promise<{
    success: boolean;
    ip?: string;
    isBlocked?: boolean;
    remainingSeconds?: number;
    threatScore?: number;
    stats?: any;
  }> {
    try {
      const res = await fetch('/api/security/status');
      return await res.json();
    } catch {
      return { success: false };
    }
  }

  async getFullState(): Promise<FullAppState> {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            products: json.data.products || INITIAL_PRODUCTS,
            orders: json.data.orders || INITIAL_ORDERS,
            userProfile: json.data.userProfile || INITIAL_USER_PROFILE,
            coupons: json.data.coupons || INITIAL_COUPONS,
            settings: json.data.settings || INITIAL_STORE_SETTINGS,
            analytics: json.data.analytics || INITIAL_VISITOR_ANALYTICS,
            songs: json.data.settings?.songs || INITIAL_SONGS,
          };
        }
      }
    } catch (e) {
      console.warn('API /api/state unavailable, using local cache:', e);
    }

    // Fallback to local storage
    return {
      products: safeStorage.getJSON('uchiro_products', INITIAL_PRODUCTS),
      orders: safeStorage.getJSON('uchiro_orders', INITIAL_ORDERS),
      userProfile: safeStorage.getJSON('uchiro_user', INITIAL_USER_PROFILE),
      coupons: safeStorage.getJSON('uchiro_coupons', INITIAL_COUPONS),
      settings: safeStorage.getJSON('uchiro_settings', INITIAL_STORE_SETTINGS),
      analytics: INITIAL_VISITOR_ANALYTICS,
      songs: INITIAL_SONGS,
    };
  }

  async fetchFullState(): Promise<FullAppState> {
    return this.getFullState();
  }

  async createProduct(product: Product, token?: string): Promise<Product> {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (data.success && data.product) {
        return data.product;
      }
    } catch (e) {
      console.error('Failed to create product:', e);
    }
    return product;
  }

  async addProduct(product: Product): Promise<boolean> {
    const p = await this.createProduct(product);
    return !!p;
  }

  async updateProduct(id: string, updates: Partial<Product>, token?: string, adminId?: string): Promise<Product> {
    const effectiveAdminId = adminId || 'youtgg13@gmail.com';
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': effectiveAdminId,
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ ...updates, adminId: effectiveAdminId }),
      });
      const data = await res.json();
      if (data.success && data.product) {
        return data.product;
      }
    } catch (e) {
      console.error('Failed to update product:', e);
    }
    return { id, ...updates } as Product;
  }

  async deleteProduct(id: string, token?: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async resetToZeroSlate(token?: string): Promise<{ products: Product[]; orders: Order[] }> {
    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ mode: 'zero' }),
      });
      if (res.ok) {
        return { products: [], orders: [] };
      }
    } catch (e) {
      console.error(e);
    }
    return { products: [], orders: [] };
  }

  async resetData(mode: 'zero' | 'starter'): Promise<boolean> {
    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async exportBackup(): Promise<any> {
    try {
      const res = await fetch('/api/backup/export');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API /api/backup/export failed, fallback to local state:', e);
    }
    return null;
  }

  async importBackup(
    backupData: any,
    mode: 'overwrite' | 'merge' = 'overwrite'
  ): Promise<{ success: boolean; message?: string; stats?: any; data?: FullAppState }> {
    try {
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, backupData }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {
      console.error('Failed to import backup:', e);
      return { success: false, message: e.message || 'Import failed' };
    }
    return { success: false, message: 'Server responded with an error' };
  }

  async saveAllDatabase(data: Partial<FullAppState>): Promise<{ success: boolean; data?: FullAppState }> {
    try {
      const res = await fetch('/api/database/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to save all database state:', e);
    }
    return { success: false };
  }

  async getActivityLogs(token?: string): Promise<AdminActivityLog[]> {
    try {
      const res = await fetch('/api/activity-logs', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.logs)) {
          safeStorage.setItem('uchiro_activity_logs', JSON.stringify(json.logs));
          return json.logs;
        }
      }
    } catch (e) {
      console.warn('API /api/activity-logs unavailable, using local cache:', e);
    }
    const cached = safeStorage.getItem('uchiro_activity_logs');
    return cached ? JSON.parse(cached) : [];
  }

  async logActivity(entry: Partial<AdminActivityLog>, token?: string): Promise<AdminActivityLog | null> {
    try {
      const res = await fetch('/api/activity-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
          'x-admin-id': entry.adminId || 'admin',
        },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.log) {
          return json.log;
        }
      }
    } catch (e) {
      console.error('Failed to log activity to backend:', e);
    }

    // Local fallback
    const now = new Date();
    const fallback: AdminActivityLog = {
      id: `act_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      adminId: entry.adminId || 'admin',
      adminEmail: entry.adminEmail,
      actionType: entry.actionType || 'admin_action',
      entityType: entry.entityType || 'system',
      entityId: entry.entityId,
      entityTitle: entry.entityTitle,
      details: entry.details || 'Admin action recorded',
      detailsKhmer: entry.detailsKhmer,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      badgeColor: entry.badgeColor,
    };
    try {
      const cached = safeStorage.getItem('uchiro_activity_logs');
      const list = cached ? JSON.parse(cached) : [];
      safeStorage.setItem('uchiro_activity_logs', JSON.stringify([fallback, ...list].slice(0, 300)));
    } catch {}
    return fallback;
  }

  async clearActivityLogs(token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/activity-logs', {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (res.ok) {
        safeStorage.removeItem('uchiro_activity_logs');
        return true;
      }
    } catch (e) {
      console.error('Failed to clear activity logs:', e);
    }
    safeStorage.removeItem('uchiro_activity_logs');
    return true;
  }

  async getOrders(): Promise<Order[]> {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.orders)) {
          return json.orders;
        }
      }
    } catch (e) {
      console.warn('API /api/orders unavailable, using cache:', e);
    }
    return safeStorage.getJSON('uchiro_orders', INITIAL_ORDERS);
  }

  async createOrder(order: Order): Promise<boolean> {
    // 1. Check rate limit on API utility class
    const check = this.rateLimiter.check('order_create');
    if (!check.allowed) {
      console.warn(`[ApiUtility] Order creation blocked by client rate limiter: ${check.error}`);
      return false;
    }

    this.rateLimiter.record('order_create');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const cooldown = data.remainingSeconds || 30;
        this.rateLimiter.setBlock('order_create', cooldown);
        triggerRateLimitAlert({
          id: `rl-ord-srv-${Date.now()}`,
          action: 'order_create',
          retryAfterSeconds: cooldown,
          totalDurationSeconds: cooldown,
          message: data.error || 'Order creation rate limit exceeded. Please wait.',
          messageKhmer: `កម្រិតនៃការបញ្ជាទិញត្រូវបានលើស។ សូមរង់ចាំ ${cooldown} វិនាទី។`,
          reason: data.reason || 'Order Frequency Protection Active',
          timestamp: Date.now(),
        });
        console.warn('[ApiUtility] Server returned 429 Too Many Requests for order creation');
        return false;
      }

      return res.ok;
    } catch {
      return false;
    }
  }

  async createOrderWithResult(order: Order): Promise<{
    success: boolean;
    order?: Order;
    error?: string;
    rateLimited?: boolean;
    retryAfter?: number;
  }> {
    const check = this.rateLimiter.check('order_create');
    if (!check.allowed) {
      return {
        success: false,
        error: check.error || 'Too many order requests. Please wait before creating another order.',
        rateLimited: true,
        retryAfter: check.retryAfterSeconds,
      };
    }

    this.rateLimiter.record('order_create');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const cooldown = data.remainingSeconds || 30;
        this.rateLimiter.setBlock('order_create', cooldown);
        triggerRateLimitAlert({
          id: `rl-ord-srv-${Date.now()}`,
          action: 'order_create',
          retryAfterSeconds: cooldown,
          totalDurationSeconds: cooldown,
          message: data.error || 'Order creation rate limit exceeded. Please wait.',
          messageKhmer: `កម្រិតនៃការបញ្ជាទិញត្រូវបានលើស។ សូមរង់ចាំ ${cooldown} វិនាទី។`,
          reason: data.reason || 'Order Frequency Protection Active',
          timestamp: Date.now(),
        });
        return {
          success: false,
          error: data.error || 'Order creation rate limit exceeded. Please wait.',
          rateLimited: true,
          retryAfter: cooldown,
        };
      }

      if (res.ok && data.success) {
        return { success: true, order: data.order || order };
      }
      return { success: false, error: data?.error || 'Failed to create order' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error creating order' };
    }
  }

  async sendTelegramOrderAlert(order: Order): Promise<{
    success: boolean;
    dispatched: boolean;
    status: 'success' | 'failed';
    textPreview?: string;
    productName?: string;
    buyerUsername?: string;
  }> {
    try {
      const res = await fetch('/api/telegram/send-order-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to send telegram order alert:', e);
    }
    return { success: false, dispatched: false, status: 'failed' };
  }

  async resendTelegramOrderAlert(orderId: string): Promise<{
    success: boolean;
    dispatched: boolean;
    status: 'success' | 'failed';
    order?: Order;
  }> {
    try {
      const res = await fetch(`/api/telegram/resend-order-alert/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to resend telegram alert:', e);
    }
    return { success: false, dispatched: false, status: 'failed' };
  }

  async submitPaymentSlip(payload: {
    type: 'order' | 'topup';
    orderData?: any;
    topupData?: any;
    slipBase64?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    orderId?: string;
    topupId?: string;
    slipUrl?: string;
    telegramDispatched?: boolean;
    error?: string;
    rateLimited?: boolean;
    retryAfter?: number;
  }> {
    if (payload.type === 'order') {
      const check = this.rateLimiter.check('order_create');
      if (!check.allowed) {
        return {
          success: false,
          error: check.error || 'Too many order submissions. Please wait a moment before trying again.',
          rateLimited: true,
          retryAfter: check.retryAfterSeconds,
        };
      }
      this.rateLimiter.record('order_create');
    }

    try {
      const res = await fetch('/api/slips/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 429) {
        const cooldown = data.remainingSeconds || 30;
        this.rateLimiter.setBlock('order_create', cooldown);
        return {
          success: false,
          error: data.error || 'Too many submissions. Please wait before retrying.',
          rateLimited: true,
          retryAfter: cooldown,
        };
      }
      return data;
    } catch (e: any) {
      console.error('Failed to submit slip:', e);
      return { success: false, error: e.message || 'Network error submitting slip' };
    }
  }

  async getTopUpRequests(): Promise<TopUpSlipRequest[]> {
    try {
      const res = await fetch('/api/topup-requests');
      if (res.ok) {
        const data = await res.json();
        return data.topupRequests || [];
      }
    } catch (e) {
      console.warn('Failed to fetch top-up requests:', e);
    }
    return [];
  }

  async approveTopUpRequest(id: string): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const res = await fetch(`/api/topup-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async rejectTopUpRequest(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/topup-requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'delivered' | 'rejected',
    token?: string,
    adminId?: string
  ): Promise<boolean> {
    const effectiveAdminId = adminId || 'youtgg13@gmail.com';
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': effectiveAdminId,
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ status, adminId: effectiveAdminId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async deleteOrder(orderId: string, token?: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to delete order:', e);
      return false;
    }
  }

  async deleteOrdersByStatus(status?: string, token?: string): Promise<boolean> {
    try {
      const url = status ? `/api/orders?status=${encodeURIComponent(status)}` : '/api/orders';
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to delete orders by status:', e);
      return false;
    }
  }

  async updateSettings(settings: StoreSettings, token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async updateSongs(songs: SongTrack[], token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ songs }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async createCoupon(coupon: Coupon, token?: string): Promise<Coupon> {
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(coupon),
      });
      const data = await res.json();
      if (data.success && data.coupon) {
        return data.coupon;
      }
    } catch (e) {
      console.error(e);
    }
    return coupon;
  }

  async addCoupon(coupon: Coupon): Promise<boolean> {
    const c = await this.createCoupon(coupon);
    return !!c;
  }

  async toggleCoupon(code: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/coupons/${code}/toggle`, {
        method: 'PUT',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async topUpBalance(amountUSD: number): Promise<boolean> {
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUSD }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async adminLogin(
    username: string,
    password: string,
    securityPin?: string
  ): Promise<{
    success: boolean;
    token?: string;
    error?: string;
    rateLimited?: boolean;
    retryAfter?: number;
    remainingSeconds?: number;
    username?: string;
  }> {
    // 1. Check rate limit on API utility class
    const check = this.rateLimiter.check('login');
    if (!check.allowed) {
      return {
        success: false,
        error: check.error || 'Too many login attempts. Please wait before trying again.',
        rateLimited: true,
        retryAfter: check.retryAfterSeconds,
        remainingSeconds: check.retryAfterSeconds,
      };
    }

    this.rateLimiter.record('login');

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, securityPin }),
      });
      const data = await res.json();

      if (res.status === 429 || data.locked) {
        const cooldown = data.remainingSeconds || 300;
        this.rateLimiter.setBlock('login', cooldown);
        triggerRateLimitAlert({
          id: `rl-adm-srv-${Date.now()}`,
          action: 'admin_login',
          retryAfterSeconds: cooldown,
          totalDurationSeconds: cooldown,
          message: data.error || 'Too many login attempts. Security lockout active.',
          messageKhmer: `ការប៉ុនប៉ងចូលជា Admin ច្រើនដងពេក។ ប្រព័ន្ធការពារបានចាក់សោរ ${cooldown} វិនាទី។`,
          reason: 'Admin Security Lockout Active',
          timestamp: Date.now(),
        });
        return {
          success: false,
          error: data.error || 'Too many login attempts. Security lockout active.',
          rateLimited: true,
          retryAfter: cooldown,
          remainingSeconds: cooldown,
        };
      }

      if (data.success) {
        // Reset rate limiter on successful authentication
        this.rateLimiter.reset('login');
      }

      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'Login failed' };
    }
  }

  async adminLogout(token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/admin-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async uploadImage(fileOrBase64: string): Promise<string> {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: fileOrBase64 }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    } catch (e) {
      console.error('Image upload failed:', e);
    }
    return fileOrBase64;
  }

  async checkRobloxProfile(username: string): Promise<{ success: boolean; profile?: RobloxProfile; error?: string; source?: string }> {
    try {
      const res = await fetch('/api/roblox/check-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error checking Roblox profile' };
    }
  }

  // Reseller / Voucher Codes API
  async getResellerCodes(): Promise<any[]> {
    try {
      const res = await fetch('/api/reseller-codes');
      if (res.ok) {
        const data = await res.json();
        return data.resellerCodes || [];
      }
    } catch (e) {
      console.error('Failed to fetch reseller codes:', e);
    }
    return [];
  }

  async createResellerCode(codeData: any): Promise<{ success: boolean; code?: any; error?: string }> {
    try {
      const res = await fetch('/api/reseller-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codeData),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to create reseller code' };
    }
  }

  async deleteResellerCode(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/reseller-codes/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async toggleResellerCode(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/reseller-codes/${id}/toggle`, { method: 'PUT' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async redeemCode(
    code: string,
    username?: string
  ): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    amountUSD?: number;
    newBalance?: number;
    isResellerUnlocked?: boolean;
    rank?: string;
    type?: string;
    userProfile?: UserProfile;
  }> {
    try {
      const res = await fetch('/api/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, username }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error redeeming code' };
    }
  }

  // KHQR & Bakong Payment Gateway
  async generateKHQR(options: {
    amount: number;
    currency?: 'USD' | 'KHR';
    billNumber?: string;
    storeLabel?: string;
    terminalLabel?: string;
    merchantName?: string;
    merchantCity?: string;
    bakongAccountId?: string;
  }): Promise<{
    success: boolean;
    qrString: string;
    md5: string;
    deepLink: string;
    qrDataUrl: string;
    billNumber: string;
    amount: number;
    currency: string;
    bakongAccountId: string;
  }> {
    try {
      const res = await fetch('/api/khqr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend /api/khqr/generate failed:', e);
    }
    return {
      success: false,
      qrString: '',
      md5: '',
      deepLink: '',
      qrDataUrl: '',
      billNumber: options.billNumber || '',
      amount: options.amount,
      currency: options.currency || 'USD',
      bakongAccountId: options.bakongAccountId || '',
    };
  }

  async checkKHQRPayment(params: {
    md5?: string;
    billNumber?: string;
    amountUSD?: number;
    referralCode?: string;
    buyerUsername?: string;
    orderId?: string;
    confirmMode?: 'auto' | 'manual' | 'instant_confirm';
  }): Promise<{
    success: boolean;
    paid: boolean;
    status: 'PAID' | 'WAITING' | 'PENDING' | 'FAILED' | 'EXPIRED';
    type?: 'topup' | 'order';
    totalCreditedUSD?: number;
    newBalance?: number;
    message?: string;
    apiSource?: string;
    transactionData?: any;
  }> {
    try {
      const res = await fetch('/api/khqr/check-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Bakong check payment error:', e);
    }
    return {
      success: false,
      paid: false,
      status: 'WAITING',
      message: 'Checking transaction status...',
    };
  }

  async testBakongConnection(params?: {
    bakongAccountId?: string;
    khqrApiKey?: string;
  } | string): Promise<{
    success: boolean;
    bakongAccountId?: string;
    apiStatus?: string;
    message?: string;
    hasToken?: boolean;
    error?: string;
  }> {
    try {
      const payload = typeof params === 'string'
        ? { khqrApiKey: params }
        : (params || {});
      const res = await fetch('/api/khqr/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error connecting to Bakong' };
    }
  }

  // Referral Validation & Processing
  async validateReferralCode(
    code: string,
    currentUsername?: string
  ): Promise<{
    valid: boolean;
    error?: string;
    friendBonusPercent?: number;
    referrerBonusPercent?: number;
    message?: string;
  }> {
    try {
      const url = `/api/referral/validate/${encodeURIComponent(code)}?currentUsername=${encodeURIComponent(currentUsername || '')}`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Referral validation failed:', e);
    }
    return { valid: false, error: 'Could not validate referral code' };
  }

  async checkAccountExists(identifier: string): Promise<{
    success: boolean;
    exists: boolean;
    email?: string;
    username?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Check account error:', e);
    }
    return { success: false, exists: false, error: 'Failed to verify account' };
  }

  async processReferralTopup(
    amountUSD: number,
    referralCode?: string,
    buyerUsername?: string
  ): Promise<{
    success: boolean;
    friendBonusUSD?: number;
    referrerBonusUSD?: number;
    userProfile?: UserProfile;
  }> {
    try {
      const res = await fetch('/api/referral/process-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUSD, referralCode, buyerUsername }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Process referral topup error:', e);
    }
    return { success: false };
  }

  async sendWelcomeEmail(payload: {
    email: string;
    username: string;
    referralCode?: string;
  }): Promise<{
    success: boolean;
    sent?: boolean;
    deliveryMode?: string;
    messageId?: string;
    recipient?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (e: any) {
      console.warn('Auto send welcome email failed:', e);
      return { success: false, error: e.message };
    }
  }

  async getSentEmails(): Promise<{
    success: boolean;
    count: number;
    emails: any[];
  }> {
    try {
      const res = await fetch('/api/admin/sent-emails');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to get sent emails:', e);
    }
    return { success: false, count: 0, emails: [] };
  }

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        return data.userProfile || null;
      }
    } catch (e) {
      console.error('Failed to get user profile:', e);
    }
    return null;
  }

  async getTopupRequests(): Promise<{
    success: boolean;
    topupRequests: any[];
  }> {
    try {
      const res = await fetch('/api/topup-requests');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to get topup requests:', e);
    }
    return { success: false, topupRequests: [] };
  }

  async approveTopupRequest(id: string): Promise<{
    success: boolean;
    topup?: any;
    newBalance?: number;
    error?: string;
  }> {
    try {
      const res = await fetch(`/api/topup-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async rejectTopupRequest(id: string): Promise<{
    success: boolean;
    topup?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(`/api/topup-requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Fallback registration when Firebase Email/Password provider throws operation-not-allowed
  async registerUserFallback(data: {
    email: string;
    password: string;
    username: string;
    referralCode?: string;
  }): Promise<{
    success: boolean;
    user?: any;
    error?: string;
    rateLimited?: boolean;
    retryAfter?: number;
  }> {
    const check = this.rateLimiter.check('register');
    if (!check.allowed) {
      return {
        success: false,
        error: check.error || 'Too many registration attempts. Please wait before trying again.',
        rateLimited: true,
        retryAfter: check.retryAfterSeconds,
      };
    }
    this.rateLimiter.record('register');

    try {
      const res = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.status === 429 || result.rateLimited) {
        const cooldown = result.remainingSeconds || 60;
        this.rateLimiter.setBlock('register', cooldown);
        return {
          success: false,
          error: result.error || 'Too many registration attempts. Please wait.',
          rateLimited: true,
          retryAfter: cooldown,
        };
      }
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Fallback login when Firebase Email/Password provider throws operation-not-allowed
  async loginUserFallback(data: {
    identifier: string;
    password: string;
  }): Promise<{
    success: boolean;
    user?: any;
    error?: string;
    rateLimited?: boolean;
    retryAfter?: number;
    remainingSeconds?: number;
  }> {
    // 1. Check rate limit on API utility class
    const check = this.rateLimiter.check('login');
    if (!check.allowed) {
      return {
        success: false,
        error: check.error || 'Too many login attempts. Please wait before trying again.',
        rateLimited: true,
        retryAfter: check.retryAfterSeconds,
        remainingSeconds: check.retryAfterSeconds,
      };
    }

    this.rateLimiter.record('login');

    try {
      const res = await fetch('/api/auth/login-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (res.status === 429 || result.locked || result.rateLimited) {
        const cooldown = result.remainingSeconds || 60;
        this.rateLimiter.setBlock('login', cooldown);
        triggerRateLimitAlert({
          id: `rl-usr-srv-${Date.now()}`,
          action: 'login',
          retryAfterSeconds: cooldown,
          totalDurationSeconds: cooldown,
          message: result.error || 'Too many login attempts. Access temporarily restricted.',
          messageKhmer: `ការប៉ុនប៉ងចូលគណនីច្រើនដងពេក។ សូមរង់ចាំ ${cooldown} វិនាទី។`,
          reason: 'User Account Brute-Force Lockout',
          timestamp: Date.now(),
        });
        return {
          success: false,
          error: result.error || 'Too many login attempts. Access temporarily restricted.',
          rateLimited: true,
          retryAfter: cooldown,
          remainingSeconds: cooldown,
        };
      }

      if (result.success) {
        // Reset rate limiter on valid login
        this.rateLimiter.reset('login');
      }

      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Verify whether currently logged in customer account is an authorized administrator
  async verifyAdminUser(email: string, uid?: string): Promise<{
    success: boolean;
    isAdmin: boolean;
    role: string;
    token?: string;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/auth/verify-admin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, uid }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, isAdmin: false, role: 'customer' };
    }
  }

  // Get Cloudflare Anti-DDoS and WAF status
  async getDDoSStatus(): Promise<{
    success: boolean;
    status: string;
    protectionMode: string;
    underAttackMode: boolean;
    totalRequestsInspected: number;
    blockedRequestsCount: number;
    activeIpsTracked: number;
    cloudflareEngine: any;
  }> {
    try {
      const res = await fetch('/api/security/ddos-status');
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        status: 'OFFLINE',
        protectionMode: 'STANDARD',
        underAttackMode: false,
        totalRequestsInspected: 0,
        blockedRequestsCount: 0,
        activeIpsTracked: 0,
        cloudflareEngine: null,
      };
    }
  }

  // Toggle Cloudflare Under-Attack Mode
  async toggleUnderAttackMode(token?: string): Promise<{
    success: boolean;
    underAttackMode?: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/security/toggle-under-attack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ token }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

export const api = new ApiUtility();

export const Api = api;
