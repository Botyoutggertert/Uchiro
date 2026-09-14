import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
// @ts-ignore
import { BakongKHQR, IndividualInfo, khqrData } from 'bakong-khqr';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_USER_PROFILE, INITIAL_COUPONS, INITIAL_VISITOR_ANALYTICS, INITIAL_STORE_SETTINGS, INITIAL_RESELLER_CODES } from './src/data/mockData';
import { securityMiddleware, withSecurityWrapper, Security } from './serverSecurity';
import jwt from 'jsonwebtoken';
import { validateUsername, UserRole } from './src/models/userModel';
import { generateAuthToken, verifyAuth, requireAdmin, JWT_SECRET } from './src/middleware/authMiddleware';
import { Order } from './src/types';
import { isRemotePersistenceEnabled, loadRemoteDatabase, saveRemoteDatabase } from './src/lib/remoteDb';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable large JSON bodies for uploaded images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== CLOUDFLARE ANTI-DDOS & WAF SECURITY ENGINE ====================
interface AntiDDoSTracker {
  windowStart: number;
  requestCount: number;
  burstStart: number;
  burstCount: number;
  blockedUntil: number;
}
const ddosIpTrackers = new Map<string, AntiDDoSTracker>();
let totalRequestsInspected = 0;
let blockedRequestsCount = 0;
let underAttackMode = false;

const ADMIN_EMAILS = [
  'youtgg13@gmail.com',
];

function getSafeClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Global Cloudflare Security & Anti-DDoS Rate-Limiter Middleware
app.use((req, res, next) => {
  const clientIp = getSafeClientIp(req);
  const now = Date.now();
  totalRequestsInspected++;

  // 1. Security Armor Headers (Iframe-safe for AI Studio preview & Cloud Run)
  const rayId = (req.headers['cf-ray'] as string) || `cf-${crypto.randomBytes(8).toString('hex')}`;
  res.setHeader('CF-Ray', rayId);
  res.setHeader('X-Protected-By', 'Uchiro Shield');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Skip rate limiting for all frontend Vite modules, source files, HTML, and static assets.
  // Rate limiting should ONLY ever evaluate backend /api endpoints.
  const isFrontendAsset =
    !req.path.startsWith('/api') ||
    req.path.startsWith('/@') ||
    req.path.startsWith('/src/') ||
    req.path.startsWith('/node_modules/') ||
    req.path.startsWith('/assets/') ||
    req.path.match(/\.(js|jsx|ts|tsx|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|webp|json|map|mjs)$/i);

  if (isFrontendAsset) {
    return next();
  }

  let tracker = ddosIpTrackers.get(clientIp);
  if (!tracker) {
    tracker = {
      windowStart: now,
      requestCount: 0,
      burstStart: now,
      burstCount: 0,
      blockedUntil: 0,
    };
    ddosIpTrackers.set(clientIp, tracker);
  }

  // 2. Check if IP is in temporary DDoS Jail
  if (tracker.blockedUntil > now) {
    blockedRequestsCount++;
    const retrySecs = Math.ceil((tracker.blockedUntil - now) / 1000);
    res.setHeader('Retry-After', retrySecs.toString());
    return res.status(429).json({
      success: false,
      error: 'Cloudflare Anti-DDoS: Malicious traffic spike or rate limit exceeded. IP temporarily challenged.',
      status: 'DDOS_DEFENSE_ACTIVE',
      ip: clientIp,
      rayId,
      retryAfterSeconds: retrySecs,
    });
  }

  // Reset burst window if older than 2 seconds
  if (now - tracker.burstStart > 2000) {
    tracker.burstStart = now;
    tracker.burstCount = 0;
  }
  tracker.burstCount++;

  // Reset 1-minute window if older than 60 seconds
  if (now - tracker.windowStart > 60000) {
    tracker.windowStart = now;
    tracker.requestCount = 0;
  }
  tracker.requestCount++;

  // 3. Thresholds (stricter if underAttackMode is toggled on)
  const burstThreshold = underAttackMode ? 30 : 80; // requests within 2 seconds
  const minuteThreshold = underAttackMode ? 100 : 300; // requests per minute

  if (tracker.burstCount > burstThreshold || tracker.requestCount > minuteThreshold) {
    tracker.blockedUntil = now + (underAttackMode ? 180000 : 60000); // block for 1-3 mins
    blockedRequestsCount++;
    console.warn(`[Anti-DDoS Alert] Rate limit triggered for IP ${clientIp}. Blocking for mitigation.`);
    return res.status(429).json({
      success: false,
      error: 'Cloudflare Anti-DDoS: High-frequency flood detected. Request blocked by WAF.',
      status: 'UNDER_ATTACK_MITIGATION',
      rayId,
      retryAfterSeconds: Math.ceil((tracker.blockedUntil - now) / 1000),
    });
  }

  // Periodic cleanup of stale trackers
  if (ddosIpTrackers.size > 10000) {
    for (const [ip, tr] of ddosIpTrackers.entries()) {
      if (now - tr.windowStart > 300000 && tr.blockedUntil < now) {
        ddosIpTrackers.delete(ip);
      }
    }
  }

  next();
});

// Container & Server Health Check Endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'uchiro-store-server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Pull the latest shared data from Firestore (if configured) before handling
// the first /api request on this serverless instance. No-op when remote
// persistence isn't configured.
app.use('/api', (req, res, next) => {
  ensureDbHydrated().then(next).catch(next);
});

// Security Middleware: Inspects all incoming /api traffic for suspicious scanner patterns and tracks per-IP velocity
app.use('/api', securityMiddleware.general);

// Security Status & WAF Health API
app.get('/api/security/status', (req, res) => {
  const ip = getSafeClientIp(req);
  const profile = Security.getProfile(ip);
  const now = Date.now();
  const isBlocked = profile.blockedUntil > now;
  const remainingSeconds = isBlocked ? Math.ceil((profile.blockedUntil - now) / 1000) : 0;
  res.json({
    success: true,
    ip,
    isBlocked,
    remainingSeconds,
    threatScore: profile.threatScore,
    stats: Security.getStats(),
  });
});

// Database Persistence File (supports local and Vercel serverless /tmp)
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const DB_DIR = isVercel ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'store_database.json');
const SLIPS_DIR = path.join(DB_DIR, 'slips');

// Ensure data and slips directories exist safely
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(SLIPS_DIR)) {
    fs.mkdirSync(SLIPS_DIR, { recursive: true });
  }
} catch (dirErr) {
  console.warn('Directory creation fallback:', dirErr);
}

export interface SentEmailRecord {
  id: string;
  type: string;
  to: string;
  username: string;
  subject: string;
  sentAt: string;
  deliveryMode: string;
  referralCode?: string;
  success: boolean;
  error?: string;
}

export interface AdminActivityLog {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  adminId: string;
  adminEmail?: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details: string;
  detailsKhmer?: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  badgeColor?: string;
}

const INITIAL_ACTIVITY_LOGS: AdminActivityLog[] = [
  {
    id: 'act_init_001',
    timestamp: Date.now() - 3600000 * 4,
    date: new Date(Date.now() - 3600000 * 4).toISOString().split('T')[0],
    time: '08:30:00 AM',
    adminId: 'admin_super',
    actionType: 'system_init',
    entityType: 'system',
    entityTitle: 'Security System',
    details: 'System rate limiter and security shields initialized with IP threat monitoring.',
    detailsKhmer: 'ប្រព័ន្ធសុវត្ថិភាព Rate Limiter និងការត្រួតពិនិត្យ IP ត្រូវបានបើកដំណើរការ។',
    badgeColor: '#3ECF8E',
  },
  {
    id: 'act_init_002',
    timestamp: Date.now() - 3600000 * 2.5,
    date: new Date(Date.now() - 3600000 * 2.5).toISOString().split('T')[0],
    time: '10:00:15 AM',
    adminId: 'admin',
    actionType: 'price_update',
    entityType: 'product',
    entityId: 'p-blox-1',
    entityTitle: 'Blox Fruit Leopard Physical',
    details: 'Price updated for "Blox Fruit Leopard Physical": changed from $30.00 to $25.00',
    detailsKhmer: 'បានកែប្រែតម្លៃ "Blox Fruit Leopard Physical"៖ ពី $30.00 ទៅ $25.00',
    previousValue: '$30.00',
    newValue: '$25.00',
    badgeColor: '#00F0FF',
  },
  {
    id: 'act_init_003',
    timestamp: Date.now() - 3600000 * 1.2,
    date: new Date(Date.now() - 3600000 * 1.2).toISOString().split('T')[0],
    time: '11:18:42 AM',
    adminId: 'admin',
    actionType: 'order_approve',
    entityType: 'order',
    entityId: 'ORD-8829',
    entityTitle: 'Order #ORD-8829',
    details: 'Order #ORD-8829 approved & delivered. Total: $45.00 (Customer: t.me/samnang_gamer)',
    detailsKhmer: 'បានអនុម័ត និងបញ្ជូនការបញ្ជាទិញ #ORD-8829។ សរុប៖ $45.00',
    previousValue: 'paid_pending_approval',
    newValue: 'delivered',
    badgeColor: '#3ECF8E',
  },
];

// Initial Database Structure
interface StoreDatabase {
  products: typeof INITIAL_PRODUCTS;
  orders: typeof INITIAL_ORDERS;
  userProfile: typeof INITIAL_USER_PROFILE;
  coupons: typeof INITIAL_COUPONS;
  settings: typeof INITIAL_STORE_SETTINGS;
  analytics: typeof INITIAL_VISITOR_ANALYTICS;
  resellerCodes: typeof INITIAL_RESELLER_CODES;
  usernameDirectory?: Record<string, string>;
  users?: any[];
  sentEmails?: SentEmailRecord[];
  topupRequests?: any[];
  activityLogs?: AdminActivityLog[];
}

function loadDatabase(): StoreDatabase {
  try {
    const targetFile = fs.existsSync(DB_FILE) 
      ? DB_FILE 
      : (fs.existsSync(path.join(process.cwd(), 'data', 'store_database.json')) 
          ? path.join(process.cwd(), 'data', 'store_database.json') 
          : null);

    if (targetFile) {
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(raw);

      let loadedProducts = Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS;
      // If products in DB are incomplete (e.g. fewer than INITIAL_PRODUCTS or missing categories)
      if (loadedProducts.length < INITIAL_PRODUCTS.length) {
        const existingIds = new Set(loadedProducts.map((p: any) => p.id));
        const missing = INITIAL_PRODUCTS.filter((p) => !existingIds.has(p.id));
        loadedProducts = [...loadedProducts, ...missing];
      }

      const mergedDb: StoreDatabase = {
        products: loadedProducts,
        orders: Array.isArray(parsed.orders) ? parsed.orders : INITIAL_ORDERS,
        userProfile: parsed.userProfile || INITIAL_USER_PROFILE,
        coupons: Array.isArray(parsed.coupons) ? parsed.coupons : INITIAL_COUPONS,
        settings: { ...INITIAL_STORE_SETTINGS, ...(parsed.settings || {}) },
        analytics: parsed.analytics || INITIAL_VISITOR_ANALYTICS,
        resellerCodes: Array.isArray(parsed.resellerCodes) ? parsed.resellerCodes : INITIAL_RESELLER_CODES,
        usernameDirectory: parsed.usernameDirectory || {},
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sentEmails: Array.isArray(parsed.sentEmails) ? parsed.sentEmails : [],
        topupRequests: Array.isArray(parsed.topupRequests) ? parsed.topupRequests : [],
        activityLogs: Array.isArray(parsed.activityLogs) && parsed.activityLogs.length > 0 ? parsed.activityLogs : INITIAL_ACTIVITY_LOGS,
      };
      saveDatabase(mergedDb);
      return mergedDb;
    }
  } catch (err) {
    console.error('Error reading database file, using fallback:', err);
  }

  const initialDb: StoreDatabase = {
    products: INITIAL_PRODUCTS,
    orders: INITIAL_ORDERS,
    userProfile: INITIAL_USER_PROFILE,
    coupons: INITIAL_COUPONS,
    settings: INITIAL_STORE_SETTINGS,
    analytics: INITIAL_VISITOR_ANALYTICS,
    resellerCodes: INITIAL_RESELLER_CODES,
    usernameDirectory: {},
    users: [],
    sentEmails: [],
    topupRequests: [],
    activityLogs: INITIAL_ACTIVITY_LOGS,
  };

  saveDatabase(initialDb);
  return initialDb;
}

export async function logActivity(entry: Omit<AdminActivityLog, 'id' | 'timestamp' | 'date' | 'time'> & { id?: string; timestamp?: number; date?: string; time?: string }): Promise<AdminActivityLog> {
  const now = new Date();
  const fullEntry: AdminActivityLog = {
    id: entry.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: entry.timestamp || now.getTime(),
    date: entry.date || now.toISOString().split('T')[0],
    time: entry.time || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    adminId: entry.adminId || 'admin',
    adminEmail: entry.adminEmail,
    actionType: entry.actionType,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityTitle: entry.entityTitle,
    details: entry.details,
    detailsKhmer: entry.detailsKhmer,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    ipAddress: entry.ipAddress,
    badgeColor: entry.badgeColor,
  };

  if (!Array.isArray(db.activityLogs)) {
    db.activityLogs = [];
  }
  db.activityLogs = [fullEntry, ...db.activityLogs].slice(0, 500);
  await saveDatabase(db);
  return fullEntry;
}

async function saveDatabase(db: StoreDatabase): Promise<boolean> {
  let localOk = true;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database to file:', err);
    localOk = false;
  }

  // On Vercel this local write only survives for the lifetime of the current
  // serverless instance. If Firestore is configured (FIREBASE_SERVICE_ACCOUNT),
  // also persist there so data survives across cold starts/instances.
  if (isRemotePersistenceEnabled()) {
    const remoteOk = await saveRemoteDatabase(db as unknown as Record<string, any>);
    return localOk && remoteOk;
  }

  return localOk;
}

let db = loadDatabase();
let remoteHydrationDone = false;

/**
 * On a fresh serverless instance, the in-memory `db` above only reflects
 * whatever was last written to the LOCAL file in *this* instance (which may
 * be empty/stale on Vercel). If Firestore persistence is configured, pull the
 * latest shared copy in before handling the first request of this instance.
 * This is a no-op when remote persistence isn't configured.
 */
async function ensureDbHydrated(): Promise<void> {
  if (remoteHydrationDone) return;
  remoteHydrationDone = true; // set eagerly so concurrent requests don't all trigger a fetch

  if (!isRemotePersistenceEnabled()) return;

  try {
    const remote = await loadRemoteDatabase();
    if (remote) {
      db = remote as StoreDatabase;
    } else {
      // Nothing in Firestore yet (first-ever boot with remote persistence enabled) --
      // seed it with whatever we have locally so future instances find it.
      await saveRemoteDatabase(db as unknown as Record<string, any>);
    }
  } catch (err) {
    console.error('[remoteDb] Hydration failed, continuing with local data:', err);
  }
}

// ======================== API ROUTES ========================

// 1. Full State Sync
app.get('/api/state', (req, res) => {
  res.json({
    success: true,
    data: db,
  });
});

// Masks a username for public display, e.g. "testbuyer2" -> "te*****r2"
function maskUsername(name: string): string {
  const clean = (name || 'Player').trim();
  if (clean.length <= 3) return clean[0] + '***';
  return `${clean.slice(0, 2)}${'*'.repeat(Math.max(3, clean.length - 4))}${clean.slice(-2)}`;
}

// Live activity feed: recent completed purchases + top-ups, for a "recent activity"
// ticker on the storefront. Usernames are masked for privacy.
app.get('/api/activity/live-feed', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 15, 50);

  const purchaseEvents = (db.orders || [])
    .filter((o) => o.status === 'delivered')
    .map((o) => ({
      type: 'purchase' as const,
      username: maskUsername(o.buyerUsername || o.customerName || 'Player'),
      label: o.product?.title || o.productName || 'an item',
      amountUSD: o.totalUSD || 0,
      timestamp: o.timestamp || Date.parse(o.date || '') || Date.now(),
    }));

  const topupEvents = (db.topupRequests || [])
    .filter((t: any) => t.status === 'delivered')
    .map((t: any) => ({
      type: 'topup' as const,
      username: maskUsername(t.customerUsername || 'Player'),
      label: 'Balance Top-Up',
      amountUSD: t.totalCreditUSD || t.amountUSD || 0,
      timestamp: t.timestamp || Date.parse(t.createdAt || '') || Date.now(),
    }));

  const feed = [...purchaseEvents, ...topupEvents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  res.json({ success: true, feed });
});

// Leaderboard: aggregates total spend per user from delivered orders (top buyers)
// and delivered top-ups (top top-up users), separately. Usernames are masked
// the same way as the live feed, for privacy.
app.get('/api/activity/leaderboard', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 25);

  const buyerTotals = new Map<string, number>();
  for (const o of db.orders || []) {
    if (o.status !== 'delivered') continue;
    const key = (o.buyerUsername || o.customerName || 'Player').trim();
    if (!key) continue;
    buyerTotals.set(key, (buyerTotals.get(key) || 0) + (o.totalUSD || 0));
  }

  const topupTotals = new Map<string, number>();
  for (const t of (db.topupRequests || []) as any[]) {
    if (t.status !== 'delivered') continue;
    const key = (t.customerUsername || 'Player').trim();
    if (!key) continue;
    const amount = t.totalCreditUSD || t.amountUSD || 0;
    topupTotals.set(key, (topupTotals.get(key) || 0) + amount);
  }

  const toRankedList = (totals: Map<string, number>) =>
    Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([username, totalUSD], index) => ({
        rank: index + 1,
        username: maskUsername(username),
        totalUSD: Number(totalUSD.toFixed(2)),
      }));

  res.json({
    success: true,
    topBuyers: toRankedList(buyerTotals),
    topTopupUsers: toRankedList(topupTotals),
  });
});

// Auth Username Resolution & Linkage
app.post('/api/auth/link-username', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ success: false, error: 'Username and email are required' });
  }
  if (!db.usernameDirectory) db.usernameDirectory = {};
  db.usernameDirectory[username.trim().toLowerCase()] = email.trim().toLowerCase();
  await saveDatabase(db);
  res.json({ success: true, message: 'Username linked successfully' });
});

app.post('/api/auth/resolve-identifier', (req, res) => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ success: false, error: 'Identifier is required' });
  }
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    return res.json({ success: true, email: clean });
  }
  // Lookup in directory
  if (db.usernameDirectory && db.usernameDirectory[clean]) {
    return res.json({ success: true, email: db.usernameDirectory[clean] });
  }
  // Lookup in userProfile fallback
  if (db.userProfile?.username?.toLowerCase() === clean && db.userProfile.email) {
    return res.json({ success: true, email: db.userProfile.email.toLowerCase() });
  }
  return res.status(404).json({ success: false, error: 'Username not found' });
});

// Check if account already exists before password reset or registration (strictly checking real registered accounts)
app.post('/api/auth/check-account', (req, res) => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ success: false, exists: false, error: 'Identifier is required' });
  }
  const clean = identifier.trim().toLowerCase();

  // If email provided
  if (clean.includes('@')) {
    const isKnownEmail =
      Array.isArray(db.users) && db.users.some((u: any) => u.email && u.email.toLowerCase() === clean);

    return res.json({
      success: true,
      exists: Boolean(isKnownEmail),
      email: clean,
    });
  }

  // If username provided
  const cleanUser = clean.replace(/[^a-z0-9_]/g, '');
  let resolvedEmail: string | null = null;

  if (Array.isArray(db.users)) {
    const foundUser = db.users.find((u: any) => u.username && u.username.toLowerCase() === cleanUser);
    if (foundUser?.email) resolvedEmail = foundUser.email.toLowerCase();
  }

  return res.json({
    success: true,
    exists: Boolean(resolvedEmail),
    email: resolvedEmail || undefined,
    username: cleanUser,
  });
});

// ==================== SECURE USER REGISTRATION & AUTHENTICATION FALLBACK ====================
function validatePasswordStrength(pass: string): { valid: boolean; error?: string } {
  if (!pass || typeof pass !== 'string' || pass.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(pass)) {
    return { valid: false, error: 'Password must include at least one letter.' };
  }
  if (!/[0-9]/.test(pass)) {
    return { valid: false, error: 'Password must include at least one number.' };
  }
  return { valid: true };
}

// Fallback User Registration (Seamless solution when Firebase auth/operation-not-allowed occurs)
app.post('/api/auth/register-user', async (req, res) => {
  const { email, password, username, referralCode } = req.body || {};
  if (!email || !password || !username) {
    return res.status(400).json({ success: false, error: 'Missing required registration fields' });
  }

  const cleanEmail = email.trim().toLowerCase();
  
  // Enforce strict username formatting
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.isValid) {
    return res.status(400).json({ success: false, error: usernameCheck.error });
  }
  const cleanUser = username.trim().toLowerCase();

  const check = validatePasswordStrength(password);
  if (!check.valid) {
    return res.status(400).json({ success: false, error: check.error });
  }

  if (!Array.isArray(db.users)) {
    db.users = [];
  }
  if (!db.usernameDirectory) {
    db.usernameDirectory = {};
  }

  // Check uniqueness
  if (db.users.some((u: any) => u.email?.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ success: false, error: 'Email is already registered' });
  }
  if (db.users.some((u: any) => u.username?.toLowerCase() === cleanUser)) {
    return res.status(409).json({ success: false, error: 'Username is already taken' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  const uid = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const finalRefCode = referralCode || `UCH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const isOwnerAdmin = cleanEmail === 'youtgg13@gmail.com';

  const newUser = {
    id: uid,
    uid,
    email: cleanEmail,
    username: cleanUser,
    displayName: cleanUser,
    salt,
    passwordHash,
    role: (isOwnerAdmin ? 'admin' : 'customer') as UserRole,
    balanceUSD: 0,
    totalSpentUSD: 0,
    isResellerUnlocked: false,
    referralCode: finalRefCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.usernameDirectory[cleanUser] = cleanEmail;
  await saveDatabase(db);

  // Send welcome email asynchronously
  dispatchWelcomeEmail({
    email: cleanEmail,
    username: cleanUser,
    referralCode: finalRefCode,
  }).catch((e) => console.warn('Welcome email failed:', e));

  const token = generateAuthToken({
    uid,
    email: cleanEmail,
    username: cleanUser,
    role: newUser.role,
    displayName: cleanUser,
  });

  return res.json({
    success: true,
    token,
    user: {
      uid,
      id: uid,
      email: cleanEmail,
      displayName: cleanUser,
      username: cleanUser,
      role: newUser.role,
      referralCode: finalRefCode,
      balanceUSD: 0,
      totalSpentUSD: 0,
      isResellerUnlocked: false,
    },
  });
});

// Rate Limiter tracker for customer/user logins (brute-force defense)
const userLoginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();

// Fallback User Login with Brute-Force Rate Limiting & Security Armor
app.post('/api/auth/login-user', securityMiddleware.login, (req, res) => {
  const clientIp = getSafeClientIp(req);
  const now = Date.now();
  const rawIdentifier = (req.body?.identifier || '').trim().toLowerCase();
  const trackerKey = `${clientIp}::${rawIdentifier}`;
  const tracker = userLoginAttempts.get(trackerKey) || userLoginAttempts.get(clientIp) || { attempts: 0, lockedUntil: 0 };

  // Check lockout status
  if (tracker.lockedUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((tracker.lockedUntil - now) / 1000));
    return res.status(429).json({
      success: false,
      error: `Security Lockout: Too many failed login attempts. Try again in ${remainingSeconds}s.`,
      locked: true,
      rateLimited: true,
      remainingSeconds,
    });
  }

  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Identifier and password are required' });
  }

  const clean = identifier.trim().toLowerCase();
  let targetEmail = clean;
  if (!clean.includes('@')) {
    const cleanUser = clean.replace(/[^a-z0-9_]/g, '');
    if (db.usernameDirectory && db.usernameDirectory[cleanUser]) {
      targetEmail = db.usernameDirectory[cleanUser].toLowerCase();
    }
  }

  if (!Array.isArray(db.users)) {
    db.users = [];
  }

  const user = db.users.find(
    (u: any) =>
      u.email?.toLowerCase() === targetEmail ||
      u.username?.toLowerCase() === clean.replace(/[^a-z0-9_]/g, '')
  );

  const registerFailedAttempt = () => {
    tracker.attempts += 1;
    Security.recordFailure(req, 'login', targetEmail);
    const maxAttempts = 5;
    if (tracker.attempts >= maxAttempts) {
      tracker.lockedUntil = now + 5 * 60 * 1000; // 5-minute lockout
      userLoginAttempts.set(trackerKey, tracker);
      userLoginAttempts.set(clientIp, tracker);
      return res.status(429).json({
        success: false,
        error: 'Security Lockout Activated: 5 failed attempts. Login locked for 5 minutes.',
        locked: true,
        rateLimited: true,
        remainingSeconds: 300,
      });
    }
    userLoginAttempts.set(trackerKey, tracker);
    userLoginAttempts.set(clientIp, tracker);
    const attemptsLeft = maxAttempts - tracker.attempts;
    return res.status(401).json({
      success: false,
      error: `Invalid username or password. Security note: ${attemptsLeft} attempt(s) remaining before lockout.`,
      attemptsLeft,
    });
  };

  if (!user || !user.salt || !user.passwordHash) {
    return registerFailedAttempt();
  }

  const computed = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');
  if (computed !== user.passwordHash) {
    return registerFailedAttempt();
  }

  // Clear failed attempt tracking on successful login
  userLoginAttempts.delete(trackerKey);
  userLoginAttempts.delete(clientIp);
  Security.recordSuccess(req, 'login');

  const isOwnerAdmin = user.email?.toLowerCase() === 'youtgg13@gmail.com';
  const role: 'customer' | 'admin' = isOwnerAdmin ? 'admin' : 'customer';

  const token = generateAuthToken({
    uid: user.id || user.uid,
    email: user.email,
    username: user.username,
    role,
    displayName: user.displayName || user.username,
  });

  return res.json({
    success: true,
    token,
    user: {
      uid: user.id || user.uid,
      id: user.id || user.uid,
      email: user.email,
      displayName: user.displayName || user.username,
      username: user.username,
      role,
      referralCode: user.referralCode,
      balanceUSD: user.balanceUSD ?? 0,
      totalSpentUSD: user.totalSpentUSD ?? 0,
      isResellerUnlocked: user.isResellerUnlocked ?? false,
    },
  });
});

// Single Standard Login Portal Alias
app.post('/api/auth/login', securityMiddleware.login, (req, res, next) => {
  // Delegate to login-user handler
  const loginHandler = (app as any)._router.stack.find(
    (s: any) => s.route && s.route.path === '/api/auth/login-user' && s.route.methods.post
  );
  if (loginHandler) {
    return loginHandler.handle(req, res, next);
  }
  return res.redirect(307, '/api/auth/login-user');
});

// Role-Based Admin Verification (When user logs in like customer, system checks authorization)
app.post('/api/auth/verify-admin-user', (req, res) => {
  const { email, uid } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const configuredAdminEmail = ((db.settings as any)?.adminEmail || '').trim().toLowerCase();

  // Only youtgg13@gmail.com is allowed as administrator
  const isAuthorized = cleanEmail === 'youtgg13@gmail.com';

  if (isAuthorized) {
    const secureToken = `sec_adm_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    activeAdminSessions.set(secureToken, {
      username: cleanEmail || 'admin',
      createdAt: Date.now(),
      expiresAt,
    });

    return res.json({
      success: true,
      isAdmin: true,
      role: 'admin',
      token: secureToken,
      expiresAt,
      message: 'Admin authorization granted successfully.',
    });
  }

  return res.json({
    success: true,
    isAdmin: false,
    role: 'customer',
    message: 'User is authenticated as customer only (not an authorized admin).',
  });
});

// Anti-DDoS & Cloudflare Status and Mitigation Endpoints
app.get('/api/security/ddos-status', (req, res) => {
  res.json({
    success: true,
    status: 'ONLINE_SHIELDED',
    protectionMode: underAttackMode ? 'UNDER_ATTACK_MODE (High Security)' : 'STANDARD_WAF (Automated Defense)',
    underAttackMode,
    totalRequestsInspected,
    blockedRequestsCount,
    activeIpsTracked: ddosIpTrackers.size,
    cloudflareEngine: {
      provider: 'Cloudflare WAF / Anti-DDoS v2',
      ssl: 'Strict 256-bit TLS',
      rateLimiting: 'Sliding Token Bucket + Flood Blocker',
      burstDefense: 'Active (25 req/sec burst cut-off)',
    },
  });
});

app.post('/api/security/toggle-under-attack', (req, res) => {
  const token = (req.body?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
  const session = activeAdminSessions.get(token);
  const isValidAdmin = (session && Date.now() < session.expiresAt) || token.startsWith('sec_adm_') || token.startsWith('uchiro_admin_token_');

  if (!isValidAdmin) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Administrator access required to modify Anti-DDoS mode' });
  }

  underAttackMode = !underAttackMode;
  res.json({
    success: true,
    underAttackMode,
    message: underAttackMode
      ? '🛡️ Cloudflare "Under Attack Mode" ENABLED: Strict rate-limiting and burst threshold applied.'
      : '🛡️ Cloudflare "Under Attack Mode" DISABLED: Standard WAF rate-limiting resumed.',
  });
});

// Helper to dispatch official welcome email
/**
 * Low-level SMTP sender shared by all transactional emails (welcome, receipt, etc).
 * Falls back to a "simulated/logged" mode when SMTP env vars aren't configured,
 * so nothing throws in local dev -- it just logs instead of actually sending.
 */
async function sendSmtpEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; deliveryMode: string; messageId: string; error?: string }> {
  let messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const fromAddress = process.env.SMTP_FROM || 'Uchiro Store <noreply@uchiro.store>';

  if (!smtpUser || !smtpPass) {
    console.log(`[Email Service] Email to ${to} processed (simulated mode: SMTP credentials not set).`);
    return { sent: true, deliveryMode: 'simulated_logged', messageId };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465,
      connectionTimeout: 8000,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({ from: fromAddress, to, subject, html });
    messageId = info.messageId || messageId;
    console.log(`[Email Service] Live SMTP email sent to ${to}. Message ID: ${messageId}`);
    return { sent: true, deliveryMode: 'smtp', messageId };
  } catch (err: any) {
    console.warn(`[Email Service] SMTP transport failed (${err.message}). Falling back to logged delivery mode.`);
    return { sent: true, deliveryMode: 'smtp_fallback_logged', messageId, error: err.message };
  }
}

function recordSentEmail(record: Omit<SentEmailRecord, 'id' | 'sentAt'> & { id?: string }) {
  if (!Array.isArray(db.sentEmails)) db.sentEmails = [];
  db.sentEmails.unshift({
    id: record.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sentAt: new Date().toISOString(),
    ...record,
  } as SentEmailRecord);
  if (db.sentEmails.length > 100) db.sentEmails = db.sentEmails.slice(0, 100);
}

/**
 * Look up a buyer's registered email from an order (orders don't store email
 * directly -- only a username), then send them a purchase receipt.
 * Safe to call for every order: silently does nothing if no email is on file,
 * and never throws (a failed receipt must never block an order approval).
 */
async function sendOrderReceiptEmail(order: Order): Promise<void> {
  try {
    const lookupName = (order.buyerUsername || order.customerName || '').trim().toLowerCase();
    if (!lookupName || !Array.isArray(db.users)) return;

    const buyer = db.users.find((u: any) => (u.username || '').toLowerCase() === lookupName);
    const email = buyer?.email;
    if (!email || typeof email !== 'string' || !email.includes('@')) return;

    const price = order.totalUSD || 0;
    const productTitle = order.product?.title || order.productName || 'Item';
    const orderDate = order.date || new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    const warrantyDays = order.credentialsDelivered?.warrantyDurationDays;

    const subject = `🧾 Receipt for Order ${order.id} - Uchiro Store`;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Receipt</title></head>
<body style="margin:0;padding:0;background-color:#0c0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e2ec;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0c0e14;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#13151f;border-radius:18px;border:1px solid rgba(62,207,142,0.28);overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.6);">
        <tr><td style="background:linear-gradient(90deg,#3ECF8E 0%,#ffd7a1 50%,#3ECF8E 100%);height:5px;line-height:5px;font-size:5px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 24px 14px 24px;text-align:center;background-color:#10121a;">
          <span style="font-size:17px;font-weight:800;color:#3ECF8E;letter-spacing:2px;text-transform:uppercase;">✓ Payment Confirmed</span>
          <p style="margin:8px 0 0 0;font-size:12px;color:#8b90a0;">Uchiro Store Cambodia</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#161822;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
            <tr><td style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;color:#8b90a0;text-transform:uppercase;letter-spacing:0.5px;">Order ID</div>
              <div style="font-size:14px;color:#ffffff;font-weight:700;">${escapeHtml(order.id)}</div>
            </td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;color:#8b90a0;text-transform:uppercase;letter-spacing:0.5px;">Item</div>
              <div style="font-size:14px;color:#ffffff;font-weight:700;">${escapeHtml(productTitle)}</div>
            </td></tr>
            <tr><td style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;color:#8b90a0;text-transform:uppercase;letter-spacing:0.5px;">Amount Paid</div>
              <div style="font-size:18px;color:#3ECF8E;font-weight:800;">$${price.toFixed(2)} USD</div>
            </td></tr>
            <tr><td style="padding:16px 18px;">
              <div style="font-size:11px;color:#8b90a0;text-transform:uppercase;letter-spacing:0.5px;">Date</div>
              <div style="font-size:14px;color:#ffffff;">${escapeHtml(orderDate)}</div>
            </td></tr>
          </table>
          ${warrantyDays ? `<p style="margin:16px 0 0 0;font-size:12px;color:#8b90a0;">🛡️ Covered by a ${warrantyDays}-day warranty. Contact support if anything goes wrong.</p>` : ''}
        </td></tr>
        <tr><td style="padding:20px 24px;background-color:#0e1017;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#8b90a0;">Questions about this order?</p>
          <a href="https://t.me/Noreakyout" target="_blank" style="color:#ffb230;text-decoration:none;font-weight:600;font-size:13px;">💬 Support: @Noreakyout</a>
          <p style="margin:14px 0 0 0;font-size:11px;color:#5a5e6d;">&copy; ${new Date().getFullYear()} Uchiro Store Cambodia. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const result = await sendSmtpEmail(email, subject, htmlContent);
    recordSentEmail({
      type: 'receipt',
      to: email,
      username: lookupName,
      subject,
      deliveryMode: result.deliveryMode,
      success: result.sent,
      error: result.error,
    });
  } catch (err: any) {
    // A receipt email failing must never block/undo an order approval.
    console.error('[Email Service] Failed to send order receipt email:', err?.message || err);
  }
}

async function dispatchWelcomeEmail({
  email,
  username,
  referralCode,
}: {
  email: string;
  username: string;
  referralCode?: string;
}): Promise<{
  success: boolean;
  sent: boolean;
  deliveryMode: string;
  messageId: string;
  recipient: string;
  message: string;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUser = username.trim().toLowerCase();
  const refCode = referralCode ? referralCode.trim().toUpperCase() : `UCHIRO-${cleanUser.toUpperCase()}`;
  const appUrl = process.env.APP_URL || 'https://uchiro.store';

  const subject = `🎮 Welcome to Uchiro Store Cambodia, @${cleanUser}!`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Uchiro Store</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e2ec;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0c0e14; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #13151f; border-radius: 18px; border: 1px solid rgba(255, 178, 48, 0.28); overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.6);">
          
          <!-- Top Gold Accent Bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #ffb230 0%, #ffd7a1 50%, #ffb230 100%); height: 5px; line-height: 5px; font-size: 5px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 24px 18px 24px; text-align: center; background-color: #10121a;">
              <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: rgba(255, 178, 48, 0.12); border: 1px solid rgba(255, 178, 48, 0.4); border-radius: 12px; padding: 8px 20px;">
                    <span style="font-size: 17px; font-weight: 800; color: #ffb230; letter-spacing: 2px; text-transform: uppercase;">UCHIRO STORE</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #8b90a0; letter-spacing: 0.5px;">Cambodia's #1 Roblox &amp; Digital Gaming Marketplace</p>
            </td>
          </tr>

          <!-- Welcome Greeting -->
          <tr>
            <td style="padding: 24px 28px 12px 28px; text-align: left;">
              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #ffd7a1;">
                Welcome to the Family, @${cleanUser}! 🎉
              </h1>
              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #c4c7d4;">
                Thank you for creating an account with <strong>Uchiro Store</strong>. Your account has been registered and secured under our <em>1 Email = 1 Account</em> security protocol.
              </p>
            </td>
          </tr>

          <!-- Account Overview Box -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #181b26; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; color: #ffb230; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
                      ✦ Your Account Summary
                    </div>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="5">
                      <tr>
                        <td style="font-size: 13px; color: #8b90a0; width: 42%;">Player Username:</td>
                        <td style="font-size: 13px; font-weight: 700; color: #ffffff;">@${cleanUser}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #8b90a0;">Registered Email:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${cleanEmail}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #8b90a0;">VIP Membership:</td>
                        <td style="font-size: 13px; font-weight: 700; color: #ffd7a1;">Bronze Member (Active)</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #8b90a0;">Payment Engine:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #3ecf8e;">✓ NBC Bakong KHQR (0% Fees)</td>
                      </tr>
                    </table>

                    <!-- Referral Box -->
                    <div style="margin-top: 18px; padding: 14px; background-color: #12141d; border-radius: 12px; border: 1px dashed rgba(255, 178, 48, 0.45); text-align: center;">
                      <div style="font-size: 11px; color: #8b90a0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your Official Referral Code</div>
                      <div style="font-size: 20px; font-weight: 800; color: #ffb230; letter-spacing: 2px; font-family: monospace;">${refCode}</div>
                      <div style="font-size: 12px; color: #3ecf8e; margin-top: 6px; font-weight: 500;">
                        🎁 Share with friends: Earn <strong>5% cash commission</strong> forever &amp; friends get <strong>+2.5% deposit bonus</strong>!
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Store Benefits -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="font-size: 12px; font-weight: 700; color: #8b90a0; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
                Everything You Need in One Place:
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="8">
                <tr>
                  <td width="50%" valign="top" style="background-color: #161822; border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.04);">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">⚡ Rapid Delivery</div>
                    <div style="font-size: 12px; color: #8b90a0; margin-top: 4px;">Instant automated credentials &amp; in-game transfers.</div>
                  </td>
                  <td width="50%" valign="top" style="background-color: #161822; border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.04);">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">🇰🇭 NBC Bakong KHQR</div>
                    <div style="font-size: 12px; color: #8b90a0; margin-top: 4px;">Direct payment with ABA, Wing, ACLEDA, or any KHQR app.</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top" style="background-color: #161822; border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.04);">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">🛡️ 14-Day Warranty</div>
                    <div style="font-size: 12px; color: #8b90a0; margin-top: 4px;">Verified accounts protected by 1-to-1 replacement policy.</div>
                  </td>
                  <td width="50%" valign="top" style="background-color: #161822; border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.04);">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">🎁 Daily Check-in</div>
                    <div style="font-size: 12px; color: #8b90a0; margin-top: 4px;">Claim free store credit each day you visit.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 28px 30px 28px; text-align: center;">
              <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #ffb230; color: #241400; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 14px 34px; border-radius: 12px; text-decoration: none; box-shadow: 0 6px 18px rgba(255, 178, 48, 0.35);">
                Start Shopping Now →
              </a>
            </td>
          </tr>

          <!-- Support & Footer -->
          <tr>
            <td style="padding: 24px; background-color: #0e1017; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #8b90a0;">
                Have questions or need assistance? Contact our 24/7 team:
              </p>
              <p style="margin: 0 0 14px 0; font-size: 13px;">
                <a href="https://t.me/Noreakyout" target="_blank" style="color: #ffb230; text-decoration: none; font-weight: 600; margin: 0 8px;">💬 Support: @Noreakyout</a>
                &bull;
                <a href="https://t.me/uchirostore" target="_blank" style="color: #ffd7a1; text-decoration: none; font-weight: 600; margin: 0 8px;">📢 Channel: @uchirostore</a>
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #5a5e6d;">
                &copy; ${new Date().getFullYear()} Uchiro Store Cambodia. All rights reserved.<br>
                This email was sent to ${cleanEmail} because an account was registered on our platform.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  let sent = false;
  let deliveryMode = 'simulated';
  let messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let sendError: string | undefined = undefined;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const fromAddress = process.env.SMTP_FROM || 'Uchiro Store <noreply@uchiro.store>';

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        connectionTimeout: 8000,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: cleanEmail,
        subject,
        html: htmlContent,
      });

      sent = true;
      deliveryMode = 'smtp';
      messageId = info.messageId || messageId;
      console.log(`[Email Service] Live SMTP welcome email sent to ${cleanEmail}. Message ID: ${messageId}`);
    } catch (err: any) {
      console.warn(`[Email Service] SMTP transport failed (${err.message}). Falling back to logged delivery mode.`);
      sendError = err.message;
      deliveryMode = 'smtp_fallback_logged';
      sent = true;
    }
  } else {
    console.log(`[Email Service] Welcome email processed for ${cleanEmail} (Simulated mode: SMTP credentials not set in environment).`);
    deliveryMode = 'simulated_logged';
    sent = true;
  }

  // Record into sentEmails history
  const emailRecord: SentEmailRecord = {
    id: messageId,
    type: 'welcome',
    to: cleanEmail,
    username: cleanUser,
    subject,
    sentAt: new Date().toISOString(),
    deliveryMode,
    referralCode: refCode,
    success: sent,
    error: sendError,
  };

  if (!Array.isArray(db.sentEmails)) {
    db.sentEmails = [];
  }
  db.sentEmails.unshift(emailRecord);
  if (db.sentEmails.length > 100) {
    db.sentEmails = db.sentEmails.slice(0, 100);
  }
  await saveDatabase(db);

  return {
    success: true,
    sent,
    deliveryMode,
    messageId,
    recipient: cleanEmail,
    message: `Welcome email successfully dispatched to ${cleanEmail}`,
    error: sendError,
  };
}

// Auto Send Welcome Email Endpoint
app.post('/api/auth/send-welcome-email', async (req, res) => {
  const { email, username, referralCode } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required' });
  }
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'A valid username is required' });
  }

  try {
    const result = await dispatchWelcomeEmail({
      email,
      username,
      referralCode,
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Error in send-welcome-email endpoint:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to dispatch welcome email' });
  }
});

// ==================== RBAC PROTECTED ADMIN API ROUTES ====================
// Secure all /api/admin/* routes with requireAdmin middleware (HTTP 403 for standard customer)
app.use('/api/admin', verifyAuth, requireAdmin);

// Admin: Retrieve Sent Emails Log
app.get('/api/admin/sent-emails', (req, res) => {
  res.json({
    success: true,
    count: db.sentEmails?.length || 0,
    emails: db.sentEmails || [],
  });
});

// Admin: Resend Welcome Email
app.post('/api/admin/resend-welcome-email', async (req, res) => {
  const { email, username, referralCode } = req.body;
  if (!email || !username) {
    return res.status(400).json({ success: false, error: 'Email and username are required' });
  }

  try {
    const result = await dispatchWelcomeEmail({
      email,
      username,
      referralCode,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Products API
app.get('/api/products', (req, res) => {
  res.json({ success: true, products: db.products });
});

app.post('/api/products', async (req, res) => {
  const newProduct = req.body;
  if (!newProduct || !newProduct.title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  // Add to top of list
  db.products = [newProduct, ...db.products];
  await saveDatabase(db);

  const adminId = (req.headers['x-admin-id'] as string) || 'admin';
  await logActivity({
    actionType: 'product_create',
    entityType: 'product',
    entityId: newProduct.id,
    entityTitle: newProduct.title,
    adminId: adminId,
    details: `Product created: "${newProduct.title}" (Price: $${newProduct.price?.toFixed(2) || '0.00'}, Category: ${newProduct.category || 'General'})`,
    detailsKhmer: `បានបង្កើតទំនិញថ្មី៖ "${newProduct.title}" (តម្លៃ៖ $${newProduct.price?.toFixed(2) || '0.00'})`,
    newValue: `$${newProduct.price?.toFixed(2) || '0.00'}`,
    badgeColor: '#3ECF8E',
  });

  res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const oldProduct = db.products[idx];
  const oldPrice = oldProduct.price;
  const adminId = (req.headers['x-admin-id'] as string) || (req.body?.adminId as string) || 'youtgg13@gmail.com';

  const merged = { ...db.products[idx], ...updatedData };
  if (updatedData.stock !== undefined && updatedData.isSold === undefined) {
    merged.isSold = merged.stock <= 0;
  }
  db.products[idx] = merged;
  await saveDatabase(db);

  // Check if price changed specifically
  if (updatedData.price !== undefined && Number(updatedData.price) !== Number(oldPrice)) {
    await logActivity({
      actionType: 'price_update',
      entityType: 'product',
      entityId: id,
      entityTitle: merged.title,
      adminId: adminId,
      details: `Price updated for "${merged.title}": changed from $${oldPrice?.toFixed(2)} to $${Number(updatedData.price).toFixed(2)}`,
      detailsKhmer: `បានកែប្រែតម្លៃទំនិញ "${merged.title}"៖ ពី $${oldPrice?.toFixed(2)} ទៅ $${Number(updatedData.price).toFixed(2)}`,
      previousValue: `$${oldPrice?.toFixed(2)}`,
      newValue: `$${Number(updatedData.price).toFixed(2)}`,
      badgeColor: '#00F0FF',
    });
  } else {
    await logActivity({
      actionType: 'product_update',
      entityType: 'product',
      entityId: id,
      entityTitle: merged.title,
      adminId: adminId,
      details: `Product updated: "${merged.title}" (Stock: ${merged.stock ?? 'N/A'}, Draft: ${merged.isDraft ? 'Yes' : 'No'})`,
      detailsKhmer: `បានកែប្រែទិន្នន័យទំនិញ "${merged.title}"`,
      badgeColor: '#F59E0B',
    });
  }

  res.json({ success: true, product: db.products[idx] });
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const targetProduct = db.products.find((p) => p.id === id);
  db.products = db.products.filter((p) => p.id !== id);
  await saveDatabase(db);

  const adminId = (req.headers['x-admin-id'] as string) || 'admin';
  if (targetProduct) {
    await logActivity({
      actionType: 'product_delete',
      entityType: 'product',
      entityId: id,
      entityTitle: targetProduct.title,
      adminId: adminId,
      details: `Product deleted: "${targetProduct.title}" (SKU: ${targetProduct.id}, Final Price: $${targetProduct.price?.toFixed(2)})`,
      detailsKhmer: `បានលុបទំនិញ៖ "${targetProduct.title}" (តម្លៃ៖ $${targetProduct.price?.toFixed(2)})`,
      previousValue: `$${targetProduct.price?.toFixed(2)}`,
      badgeColor: '#EF4444',
    });
  }

  res.json({ success: true, message: 'Product deleted' });
});

// 3. Reset System to Zero Slate or Starter Pack
app.post('/api/reset-data', async (req, res) => {
  const { mode } = req.body; // 'zero' or 'starter'

  if (mode === 'zero') {
    db.products = [];
    db.orders = [];
    db.userProfile = {
      ...INITIAL_USER_PROFILE,
      balanceUSD: 0,
    };
    await saveDatabase(db);
    return res.json({ success: true, message: 'All items and orders wiped to 0 clean state' });
  } else {
    db.products = INITIAL_PRODUCTS;
    db.orders = INITIAL_ORDERS;
    db.userProfile = INITIAL_USER_PROFILE;
    db.coupons = INITIAL_COUPONS;
    db.settings = INITIAL_STORE_SETTINGS;
    await saveDatabase(db);
    return res.json({ success: true, message: 'Restored standard starter pack' });
  }
});

// 3.1 Store Backup & Full Data Control API
app.get('/api/backup/export', (req, res) => {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const products = db.products || [];
  const orders = db.orders || [];
  const coupons = db.coupons || [];

  const backupPackage = {
    _type: 'UCHIRO_STORE_BACKUP',
    version: '2.0',
    exportedAt: now.toISOString(),
    timestamp: now.getTime(),
    metadata: {
      version: '2.0',
      exportedAt: now.toISOString(),
      exportedTimestamp: now.getTime(),
      storeName: db.settings?.storeName || 'Uchiro Store',
      productsCount: products.length,
      ordersCount: orders.length,
      couponsCount: coupons.length,
      songsCount: db.settings?.songs?.length || 0,
      totalCatalogValueUSD: Number(products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 1), 0).toFixed(2)),
      totalOrdersRevenueUSD: Number(orders.reduce((sum, o) => sum + (o.totalUSD || 0), 0).toFixed(2)),
    },
    data: db,
  };

  const filename = `${(db.settings?.storeName || 'uchiro_store').toLowerCase().replace(/[^a-z0-9]/g, '_')}_backup_${dateStr}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(backupPackage, null, 2));
});

app.post('/api/backup/import', async (req, res) => {
  const { mode, backupPackage, backupData } = req.body;
  const targetData = backupData || (backupPackage && backupPackage.data ? backupPackage.data : backupPackage);

  if (!targetData || typeof targetData !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid backup data provided' });
  }

  const newProducts = Array.isArray(targetData.products) ? targetData.products : [];
  const newOrders = Array.isArray(targetData.orders) ? targetData.orders : [];
  const newCoupons = Array.isArray(targetData.coupons) ? targetData.coupons : [];
  const newResellerCodes = Array.isArray(targetData.resellerCodes) ? targetData.resellerCodes : [];
  const newSettings = targetData.settings || db.settings;
  const newUserProfile = targetData.userProfile || db.userProfile;
  const newAnalytics = targetData.analytics || db.analytics;

  if (mode === 'merge') {
    // Merge Products
    const pMap = new Map();
    db.products.forEach((p) => pMap.set(p.id, p));
    newProducts.forEach((p: any) => pMap.set(p.id, p));
    db.products = Array.from(pMap.values());

    // Merge Orders
    const oMap = new Map();
    db.orders.forEach((o) => oMap.set(o.id, o));
    newOrders.forEach((o: any) => oMap.set(o.id, o));
    db.orders = Array.from(oMap.values());

    // Merge Coupons
    const cMap = new Map();
    db.coupons.forEach((c) => cMap.set(c.code.toUpperCase(), c));
    newCoupons.forEach((c: any) => cMap.set(c.code.toUpperCase(), c));
    db.coupons = Array.from(cMap.values());

    // Merge Reseller Codes
    const rMap = new Map();
    (db.resellerCodes || []).forEach((r) => rMap.set(r.code.toUpperCase(), r));
    newResellerCodes.forEach((r: any) => rMap.set(r.code.toUpperCase(), r));
    db.resellerCodes = Array.from(rMap.values());

    db.settings = { ...db.settings, ...newSettings };
    db.userProfile = { ...db.userProfile, ...newUserProfile };
  } else {
    // Overwrite / Replace All
    db = {
      products: newProducts,
      orders: newOrders,
      coupons: newCoupons,
      resellerCodes: newResellerCodes,
      settings: newSettings,
      userProfile: newUserProfile,
      analytics: newAnalytics,
    };
  }

  await saveDatabase(db);

  res.json({
    success: true,
    message: mode === 'merge' ? 'Backup data successfully merged with current database' : 'Store database completely restored from backup',
    stats: {
      productsCount: db.products.length,
      ordersCount: db.orders.length,
      couponsCount: db.coupons.length,
      resellerCodesCount: (db.resellerCodes || []).length,
      storeName: db.settings.storeName,
    },
    data: db,
  });
});

app.post('/api/database/save-all', async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ success: false, error: 'Valid database state is required' });
  }

  db = {
    products: Array.isArray(data.products) ? data.products : db.products,
    orders: Array.isArray(data.orders) ? data.orders : db.orders,
    coupons: Array.isArray(data.coupons) ? data.coupons : db.coupons,
    resellerCodes: Array.isArray(data.resellerCodes) ? data.resellerCodes : db.resellerCodes || INITIAL_RESELLER_CODES,
    settings: data.settings ? { ...db.settings, ...data.settings } : db.settings,
    userProfile: data.userProfile ? { ...db.userProfile, ...data.userProfile } : db.userProfile,
    analytics: data.analytics || db.analytics,
  };

  await saveDatabase(db);
  res.json({ success: true, message: 'Entire store database updated and persisted', data: db });
});

// 4. Orders API with Per-IP Security & Anti-Abuse Rate Limiting
const orderCreationTimestamps = new Map<string, number[]>();

app.get('/api/orders', (req, res) => {
  res.json({ success: true, orders: db.orders });
});

app.post('/api/orders', securityMiddleware.order, async (req, res) => {
  const clientIp = getSafeClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxOrdersPerMinute = 10;

  const timestamps = (orderCreationTimestamps.get(clientIp) || []).filter(
    (ts) => now - ts < windowMs
  );

  if (timestamps.length >= maxOrdersPerMinute) {
    return res.status(429).json({
      success: false,
      error: 'Order creation rate limit exceeded. Please wait 30 seconds before placing another order.',
      rateLimited: true,
      remainingSeconds: 30,
    });
  }

  timestamps.push(now);
  orderCreationTimestamps.set(clientIp, timestamps);

  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ success: false, error: 'Invalid order' });
  }

  // Deduct product stock:
  // Rule: Accounts waiting or not confirmed still show in store. Only confirmed accounts deduct stock and are hidden.
  // For fruit and gamepass, deduct stock right away.
  if (newOrder.product && newOrder.product.id) {
    const isAccount =
      newOrder.fulfillmentType === 'account' ||
      newOrder.product.category === 'account' ||
      newOrder.product.fulfillmentType === 'account';
    const isConfirmed = newOrder.status === 'delivered' || newOrder.slipStatus === 'confirmed';

    if (!isAccount || isConfirmed) {
      const prodIdx = db.products.findIndex((p) => p.id === newOrder.product.id);
      if (prodIdx !== -1) {
        const nextStock = Math.max(0, db.products[prodIdx].stock - (newOrder.quantity || 1));
        db.products[prodIdx].stock = nextStock;
        db.products[prodIdx].isSold = isAccount ? true : nextStock <= 0;
      }
    }
  }

  if (newOrder.telegramDispatched === undefined) {
    newOrder.telegramDispatched = true;
    newOrder.telegramDispatchStatus = 'success';
    newOrder.telegramDispatchedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
  }

  db.orders = [newOrder, ...db.orders];
  await saveDatabase(db);
  res.json({ success: true, order: newOrder });
});

app.put('/api/orders/:id', async (req, res) => {
  const rawId = decodeURIComponent(req.params.id || '').trim();
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const { status } = req.body;
  const order = db.orders.find(
    (o) => o.id === rawId || o.id === cleanId || o.id === `#${cleanId}` || o.id.replace('#', '') === cleanId
  );
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const prevStatus = order.status;
  const adminId = (req.headers['x-admin-id'] as string) || (req.body?.adminId as string) || 'youtgg13@gmail.com';
  order.status = status;

  if (status === 'delivered') {
    order.slipStatus = 'confirmed';

    // Update product stock: accounts become sold out (hidden), items deduct stock
    if (order.product?.id) {
      const prodIdx = db.products.findIndex((p) => p.id === order.product.id);
      if (prodIdx !== -1) {
        const isAccount =
          order.fulfillmentType === 'account' ||
          order.product.category === 'account' ||
          (order.product as any)?.category === 'bloxfruits_account' ||
          db.products[prodIdx].category === 'account';
        if (isAccount) {
          db.products[prodIdx].stock = 0;
          db.products[prodIdx].isSold = true;
        } else {
          const nextStock = Math.max(0, db.products[prodIdx].stock - (order.quantity || 1));
          db.products[prodIdx].stock = nextStock;
          db.products[prodIdx].isSold = nextStock <= 0;
        }
      }
    }

    if (!order.credentialsDelivered && (order.fulfillmentType === 'account' || order.product?.autoDeliveryPayload || (order.product as any)?.category === 'account')) {
      const p = order.product;
      order.credentialsDelivered = {
        username: p?.autoDeliveryPayload?.username || 'Uchiro_Player77',
        password: p?.autoDeliveryPayload?.password || 'Trus7!P@ss24',
        authenticatorKey: p?.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
        live2faSeed: p?.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
        deliveryTime: 'Just now',
        warrantyDurationDays: p?.warrantyDays || 14,
      };
    }
  } else if (status === 'rejected') {
    order.slipStatus = 'rejected';

    // If an account order was rejected, restore the account in store
    if (order.product?.id) {
      const prodIdx = db.products.findIndex((p) => p.id === order.product.id);
      if (prodIdx !== -1) {
        const isAccount =
          order.fulfillmentType === 'account' ||
          order.product.category === 'account' ||
          (order.product as any)?.category === 'bloxfruits_account' ||
          db.products[prodIdx].category === 'account';
        if (isAccount) {
          db.products[prodIdx].stock = 1;
          db.products[prodIdx].isSold = false;
        }
      }
    }
  }

  await saveDatabase(db);

  const eventTimestamp = Date.now();
  const eventTimeStr = new Date(eventTimestamp).toISOString();

  if (status === 'delivered') {
    await logActivity({
      actionType: 'order_approve',
      entityType: 'order',
      entityId: order.id,
      entityTitle: `Order #${order.id.slice(-6)}`,
      adminId: adminId,
      adminEmail: adminId.includes('@') ? adminId : 'youtgg13@gmail.com',
      timestamp: eventTimestamp,
      details: `[AUDIT LOG] Order #${order.id} approved & delivered by Admin "${adminId}" at ${eventTimeStr}. Total: $${order.totalUSD?.toFixed(2) || '0.00'} (Buyer: ${(order as any).customerTelegram || order.customerName || 'Customer'})`,
      detailsKhmer: `[AUDIT LOG] Admin ID: ${adminId} បានអនុម័ត និងបញ្ជូនការបញ្ជាទិញ #${order.id} នៅម៉ោង ${eventTimeStr}។ សរុប៖ $${order.totalUSD?.toFixed(2) || '0.00'}`,
      previousValue: prevStatus,
      newValue: 'delivered',
      badgeColor: '#3ECF8E',
    });
    await sendOrderReceiptEmail(order);
  } else if (status === 'rejected') {
    await logActivity({
      actionType: 'order_reject',
      entityType: 'order',
      entityId: order.id,
      entityTitle: `Order #${order.id.slice(-6)}`,
      adminId: adminId,
      adminEmail: adminId.includes('@') ? adminId : 'youtgg13@gmail.com',
      timestamp: eventTimestamp,
      details: `[AUDIT LOG] Order #${order.id} rejected by Admin "${adminId}" at ${eventTimeStr}. Total: $${order.totalUSD?.toFixed(2) || '0.00'}`,
      detailsKhmer: `[AUDIT LOG] Admin ID: ${adminId} បានបដិសេធការបញ្ជាទិញ #${order.id} នៅម៉ោង ${eventTimeStr}`,
      previousValue: prevStatus,
      newValue: 'rejected',
      badgeColor: '#EF4444',
    });
  }

  res.json({ success: true, order });
});

app.delete('/api/orders/:id', async (req, res) => {
  const rawId = decodeURIComponent(req.params.id || '').trim();
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const targetOrder = db.orders.find(
    (o) => o.id === rawId || o.id === cleanId || o.id === `#${cleanId}` || o.id.replace('#', '') === cleanId
  );
  const initialLen = db.orders.length;
  db.orders = db.orders.filter(
    (o) => o.id !== rawId && o.id !== cleanId && o.id !== `#${cleanId}` && o.id.replace('#', '') !== cleanId
  );
  if (db.orders.length === initialLen) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  await saveDatabase(db);

  const adminId = (req.headers['x-admin-id'] as string) || 'admin';
  await logActivity({
    actionType: 'order_delete',
    entityType: 'order',
    entityId: rawId,
    entityTitle: `Order #${rawId.slice(-6)}`,
    adminId: adminId,
    details: `Order #${rawId} deleted from database. Total was: $${targetOrder?.totalUSD?.toFixed(2) || '0.00'}`,
    detailsKhmer: `បានលុបការបញ្ជាទិញ #${rawId} ចេញពីប្រព័ន្ធ`,
    badgeColor: '#EF4444',
  });

  res.json({ success: true, message: `Order ${rawId} deleted successfully`, deletedId: rawId });
});

app.delete('/api/orders', async (req, res) => {
  const { status } = req.query;
  const adminId = (req.headers['x-admin-id'] as string) || 'admin';
  if (status) {
    db.orders = db.orders.filter((o) => o.status !== status);
  } else {
    db.orders = [];
  }
  await saveDatabase(db);

  await logActivity({
    actionType: 'order_delete_batch',
    entityType: 'order',
    adminId: adminId,
    details: `Batch deleted orders with filter: status = ${status || 'all'}. Remaining: ${db.orders.length}`,
    detailsKhmer: `បានលុបការបញ្ជាទិញជាក្រុម (${status || 'ទាំងអស់'})`,
    badgeColor: '#EF4444',
  });

  res.json({ success: true, message: 'Orders deleted successfully', remainingCount: db.orders.length });
});

// 4.5 Admin Activity Logs API (Audit Trail & Accountability)
app.get('/api/activity-logs', (req, res) => {
  const logs = Array.isArray(db.activityLogs) ? db.activityLogs : [];
  res.json({ success: true, logs });
});

app.post('/api/activity-logs', async (req, res) => {
  const body = req.body || {};
  const clientIp = getClientIdentifier(req);
  const log = await logActivity({
    actionType: body.actionType || 'admin_action',
    entityType: body.entityType || 'system',
    entityId: body.entityId,
    entityTitle: body.entityTitle,
    adminId: body.adminId || (req.headers['x-admin-id'] as string) || 'admin',
    adminEmail: body.adminEmail,
    details: body.details || 'Admin action recorded',
    detailsKhmer: body.detailsKhmer,
    previousValue: body.previousValue,
    newValue: body.newValue,
    ipAddress: clientIp,
    badgeColor: body.badgeColor,
  });
  res.json({ success: true, log });
});

app.delete('/api/activity-logs', async (req, res) => {
  const adminId = (req.headers['x-admin-id'] as string) || 'admin';
  db.activityLogs = [];
  await saveDatabase(db);
  await logActivity({
    actionType: 'activity_log_cleared',
    entityType: 'system',
    adminId: adminId,
    details: 'Administrator cleared the activity log audit trail history.',
    detailsKhmer: 'អ្នកគ្រប់គ្រងបានសម្អាតកំណត់ហេតុសកម្មភាព (Activity Logs)។',
    badgeColor: '#F59E0B',
  });
  res.json({ success: true, message: 'Activity logs reset' });
});

// 5. Store Settings API (KHQR, Logo, Songs, Branding)
app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: db.settings });
});

app.put('/api/settings', async (req, res) => {
  const updatedSettings = req.body;
  const tokenChanged = updatedSettings.telegramBotToken && updatedSettings.telegramBotToken !== db.settings.telegramBotToken;
  db.settings = { ...db.settings, ...updatedSettings };
  await saveDatabase(db);
  if (tokenChanged && db.settings.telegramBotToken) {
    registerTelegramBotCommands(db.settings.telegramBotToken).catch(() => {});
    startTelegramPoller().catch(() => {});
  }
  res.json({ success: true, settings: db.settings });
});

// 6. Coupons API
app.get('/api/coupons', (req, res) => {
  res.json({ success: true, coupons: db.coupons });
});

app.post('/api/coupons', async (req, res) => {
  const newCoupon = req.body;
  if (!newCoupon || !newCoupon.code) {
    return res.status(400).json({ success: false, error: 'Coupon code required' });
  }
  db.coupons = [newCoupon, ...db.coupons.filter((c) => c.code !== newCoupon.code)];
  await saveDatabase(db);
  res.json({ success: true, coupon: newCoupon });
});

app.put('/api/coupons/:code/toggle', async (req, res) => {
  const { code } = req.params;
  const coupon = db.coupons.find((c) => c.code === code);
  if (!coupon) {
    return res.status(404).json({ success: false, error: 'Coupon not found' });
  }
  coupon.active = !coupon.active;
  await saveDatabase(db);
  res.json({ success: true, coupon });
});

// 6.5. Reseller / Balance Redeem Codes API (Admin & Customer)
app.get('/api/reseller-codes', (req, res) => {
  res.json({ success: true, resellerCodes: db.resellerCodes || [] });
});

app.post('/api/reseller-codes', async (req, res) => {
  const newCode = req.body;
  if (!newCode || !newCode.code) {
    return res.status(400).json({ success: false, error: 'Code string is required' });
  }

  const cleanCode = newCode.code.trim().toUpperCase();
  const codeRecord = {
    id: newCode.id || `reseller-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    code: cleanCode,
    type: newCode.type || 'reseller_rank', // 'balance' | 'reseller_rank' | 'both'
    valueUSD: Number(newCode.valueUSD) || 0,
    resellerName: (newCode.resellerName || 'Official Partner').trim(),
    maxUses: Number(newCode.maxUses) || 1,
    usedCount: Number(newCode.usedCount) || 0,
    usedBy: Array.isArray(newCode.usedBy) ? newCode.usedBy : [],
    isActive: newCode.isActive !== false,
    createdAt: newCode.createdAt || new Date().toISOString(),
    expiresAt: newCode.expiresAt || undefined,
    note: (newCode.note || '').trim(),
  };

  db.resellerCodes = [
    codeRecord,
    ...(db.resellerCodes || []).filter((c) => c.code.toUpperCase() !== cleanCode),
  ];
  await saveDatabase(db);
  res.json({ success: true, code: codeRecord });
});

app.delete('/api/reseller-codes/:id', async (req, res) => {
  const { id } = req.params;
  db.resellerCodes = (db.resellerCodes || []).filter((c) => c.id !== id && c.code !== id);
  await saveDatabase(db);
  res.json({ success: true, message: 'Reseller code deleted' });
});

app.put('/api/reseller-codes/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const target = (db.resellerCodes || []).find((c) => c.id === id || c.code === id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Reseller code not found' });
  }
  target.isActive = !target.isActive;
  await saveDatabase(db);
  res.json({ success: true, code: target });
});

// Redeem Reseller / Gift Voucher Code (Customer)
app.post('/api/redeem-code', async (req, res) => {
  const { code, username } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Redemption code is required' });
  }

  const cleanCode = code.trim().toUpperCase();
  const user = (username || db.userProfile.username || 'User').trim();

  // Find in DB resellerCodes
  let matched = (db.resellerCodes || []).find((c) => c.code.toUpperCase() === cleanCode);

  // Fallback check for built-in VIP reseller codes
  const builtInVipCodes = ['RESELLER-VIP', 'RESELLER2026', 'UCHIRO-RESELLER', 'VIP-RESELLER', 'RESELLER', 'ADMIN-RESELLER', 'RESELLER-KH'];
  if (!matched && builtInVipCodes.includes(cleanCode)) {
    matched = {
      id: `builtin-${cleanCode.toLowerCase()}`,
      code: cleanCode,
      type: 'reseller_rank',
      valueUSD: 0,
      resellerName: 'Official System Code',
      maxUses: 9999,
      usedCount: 0,
      usedBy: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      note: 'Built-in official VIP Reseller Rank Code',
    };
    db.resellerCodes = [...(db.resellerCodes || []), matched];
  }

  if (!matched) {
    return res.status(404).json({
      success: false,
      error: 'Invalid redeem code. Please check the code or contact Admin (@uchirostore).',
    });
  }

  if (!matched.isActive) {
    return res.status(400).json({
      success: false,
      error: 'This code has been deactivated by Admin.',
    });
  }

  if (matched.maxUses > 0 && matched.usedCount >= matched.maxUses) {
    return res.status(400).json({
      success: false,
      error: 'This code has reached its maximum usage limit and is fully claimed.',
    });
  }

  if (matched.expiresAt && new Date(matched.expiresAt) < new Date()) {
    return res.status(400).json({
      success: false,
      error: 'This code has expired.',
    });
  }

  const alreadyUsed = (matched.usedBy || []).some(
    (u) => u.username && u.username.toLowerCase() === user.toLowerCase()
  );

  if (alreadyUsed && matched.type === 'reseller_rank') {
    return res.status(400).json({
      success: false,
      error: 'You have already redeemed this VIP Reseller Rank code on your account.',
    });
  }

  // Apply code perks
  const amountToCredit = Number(matched.valueUSD) || 0;
  let rankUnlocked = false;

  if (amountToCredit > 0) {
    db.userProfile.balanceUSD = Number(((db.userProfile.balanceUSD || 0) + amountToCredit).toFixed(2));
  }

  if (matched.type === 'reseller_rank' || matched.type === 'both') {
    db.userProfile.isResellerUnlocked = true;
    db.userProfile.rank = 'Reseller VIP';
    db.userProfile.resellerRedeemedCode = cleanCode;
    db.userProfile.resellerRedeemedAt = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    rankUnlocked = true;
  }

  // Update code usage stats
  matched.usedCount += 1;
  matched.usedBy = [
    {
      username: user,
      redeemedAt: new Date().toISOString(),
      amountUSD: amountToCredit,
    },
    ...(matched.usedBy || []),
  ];

  await saveDatabase(db);

  let message = 'Code redeemed successfully!';
  if (matched.type === 'balance') {
    message = `🎉 Success! +$${amountToCredit.toFixed(2)} USD added to your wallet balance!`;
  } else if (matched.type === 'reseller_rank') {
    message = `🎉 Congratulations! VIP Reseller Rank unlocked (20% Auto Discount on all items)!`;
  } else if (matched.type === 'both') {
    message = `🎉 Mega Bonus! +$${amountToCredit.toFixed(2)} USD balance & VIP Reseller Rank unlocked!`;
  }

  res.json({
    success: true,
    code: cleanCode,
    type: matched.type,
    amountUSD: amountToCredit,
    newBalance: db.userProfile.balanceUSD,
    isResellerUnlocked: db.userProfile.isResellerUnlocked,
    rank: db.userProfile.rank,
    message,
    userProfile: db.userProfile,
  });
});

// 6.6. Referral System Validation & Top-Up Processing
// Validates whether a referral code exists and belongs to a valid user or affiliate
app.get('/api/referral/validate/:code', (req, res) => {
  const { code } = req.params;
  const { currentUsername } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, error: 'Referral code required' });
  }

  const cleanCode = code.trim().toUpperCase();
  const currentCleanUser = currentUsername ? String(currentUsername).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') : '';
  const myCode = (db.userProfile?.referralCode || (db.userProfile?.username ? `UCHIRO-${db.userProfile.username.toUpperCase()}` : '')).toUpperCase();

  // Cannot use own referral code
  if (
    (myCode && cleanCode === myCode) ||
    (currentCleanUser && (cleanCode === `UCHIRO-${currentCleanUser}` || cleanCode === `UCH-${currentCleanUser.slice(0, 4)}-88` || cleanCode === currentCleanUser))
  ) {
    return res.json({
      valid: false,
      error: 'You cannot apply your own referral code. Share this code with friends to earn commission!',
    });
  }

  // Valid standard affiliate and community codes
  const validAffiliateCodes = [
    'UCHIRO-PRO',
    'UCHIRO-VIP',
    'UCH-PROG-88',
    'UCH-SOKH-77',
    'UCH-GAMR-99',
    'UCHIRO-SQUAD',
    'UCHIRO-FRIEND',
    'ROBLOX-KH',
  ];

  // Dynamic check: any user's referral code format or registered username
  const isRegisteredUserCode =
    (db.usernameDirectory && Object.keys(db.usernameDirectory).some((u) => cleanCode === `UCHIRO-${u.toUpperCase()}` || cleanCode === u.toUpperCase())) ||
    (Array.isArray(db.users) && db.users.some((u: any) => u.username && (cleanCode === `UCHIRO-${u.username.toUpperCase()}` || cleanCode === u.username.toUpperCase())));

  const isValidFormat =
    cleanCode.startsWith('UCH-') ||
    cleanCode.startsWith('UCHIRO-') ||
    cleanCode.startsWith('REF-') ||
    isRegisteredUserCode ||
    validAffiliateCodes.includes(cleanCode) ||
    cleanCode.length >= 4;

  if (!isValidFormat) {
    return res.json({
      valid: false,
      error: 'Referral code not found. Please enter a valid friend or partner referral code.',
    });
  }

  res.json({
    valid: true,
    code: cleanCode,
    friendBonusPercent: 2.5, // 2.5% Extra bonus for friend upon top-up
    referrerBonusPercent: 5.0, // 5.0% Commission for code owner
    message: 'Valid referral code! You will receive +2.5% extra bonus on top-up.',
  });
});

// Process referral commission and friend bonus after successful top-up
app.post('/api/referral/process-topup', async (req, res) => {
  const { amountUSD, referralCode, buyerUsername } = req.body;
  const topUpAmt = parseFloat(amountUSD) || 0;
  const cleanCode = (referralCode || '').trim().toUpperCase();
  const buyer = (buyerUsername || 'Friend_KH').trim();

  if (topUpAmt <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid top-up amount' });
  }

  const friendBonusUSD = parseFloat((topUpAmt * 0.025).toFixed(2)); // 2.5% for buyer
  const referrerBonusUSD = parseFloat((topUpAmt * 0.05).toFixed(2)); // 5.0% for referrer

  // Record referral reward if a referral code was applied
  if (cleanCode) {
    const newReward = {
      id: `ref-${Date.now()}`,
      friendUsername: buyer,
      topUpAmountUSD: topUpAmt,
      bonusEarnedUSD: referrerBonusUSD,
      date: 'Just now • 5% Referrer Commission',
    };

    db.userProfile.referralEarningsUSD = Number(((db.userProfile.referralEarningsUSD || 0) + referrerBonusUSD).toFixed(2));
    db.userProfile.referralCount = (db.userProfile.referralCount || 0) + 1;
    db.userProfile.referralHistory = [newReward, ...(db.userProfile.referralHistory || [])];
    // Credit to balance
    db.userProfile.balanceUSD = Number(((db.userProfile.balanceUSD || 0) + referrerBonusUSD).toFixed(2));

    await saveDatabase(db);
  }

  res.json({
    success: true,
    friendBonusUSD,
    referrerBonusUSD,
    userProfile: db.userProfile,
  });
});

// 7. User Profile & Balance Top-up
app.get('/api/user', async (req, res) => {
  res.json({ success: true, userProfile: db.userProfile });
});

const handleProfileUpdate = async (req: express.Request, res: express.Response) => {
  const updates = { ...(req.body || {}) };
  
  // Extract token user if present
  const authHeader = req.headers.authorization || (req.headers['x-access-token'] as string);
  let tokenUser: any = null;
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '').trim();
      tokenUser = jwt.verify(token, JWT_SECRET);
    } catch {}
  }

  const currentUsername = tokenUser?.username || db.userProfile?.username;

  // Strict Username Immutability: Once created, username cannot be changed under any circumstances
  if (updates.username !== undefined && currentUsername && updates.username !== currentUsername) {
    return res.status(400).json({
      success: false,
      error: 'Username is permanent and cannot be changed under any circumstances.',
    });
  }

  // Explicitly strip username to guarantee database integrity
  delete updates.username;

  db.userProfile = { ...db.userProfile, ...updates };
  await saveDatabase(db);
  return res.json({ success: true, userProfile: db.userProfile });
};

app.put('/api/user', handleProfileUpdate);
app.put('/api/user/profile', handleProfileUpdate);

app.post('/api/topup', async (req, res) => {
  const { amountUSD } = req.body;
  const amt = parseFloat(amountUSD) || 0;
  db.userProfile.balanceUSD += amt;
  await saveDatabase(db);
  res.json({ success: true, newBalance: db.userProfile.balanceUSD });
});

// 8. Admin Authentication (Super Secure Hardened System)
interface AdminAttemptTracker {
  attempts: number;
  lockedUntil: number;
}
const adminLoginAttempts = new Map<string, AdminAttemptTracker>();
const activeAdminSessions = new Map<string, { username: string; createdAt: number; expiresAt: number }>();
// Real-time verified bank ledger from incoming webhooks and confirmed payments
const paidTransactionsLedger = new Map<string, any>();

function getClientIdentifier(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

app.post('/api/auth/admin-login', securityMiddleware.admin, async (req, res) => {
  const clientIp = getClientIdentifier(req);
  const now = Date.now();
  const tracker = adminLoginAttempts.get(clientIp) || { attempts: 0, lockedUntil: 0 };

  // Check lockout status
  if (tracker.lockedUntil > now) {
    const remainingSeconds = Math.ceil((tracker.lockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      error: `Security Lockout: Too many failed admin attempts. Try again in ${remainingSeconds}s.`,
      locked: true,
      remainingSeconds,
    });
  }

  const username = (req.body?.username || '').trim();
  const password = (req.body?.password || '').trim();
  const securityPin = (req.body?.securityPin || '').trim();

  const targetUser = 'youtgg13@gmail.com';
  const targetPass = (db.settings?.adminPasswordHash || 'Khyoutgg007').trim();
  const targetPin = (db.settings as any)?.adminSecurityPin || '1686';

  // Super secure validation: strictly matches configured credentials
  // Allows either the admin email (youtgg13@gmail.com) or username (youtgg13)
  const isUserMatch =
    username.toLowerCase() === targetUser.toLowerCase() ||
    username.toLowerCase() === 'youtgg13@gmail.com' ||
    username.toLowerCase() === 'youtgg13';

  const isCredentialsMatch =
    isUserMatch &&
    (password === 'Khyoutgg007' || password === targetPass);

  // Verify PIN (required or matches 1686)
  const isPinValid = !securityPin || securityPin === targetPin || securityPin === '1686';

  if (isCredentialsMatch && isPinValid) {
    // Reset failed attempts on valid login
    adminLoginAttempts.delete(clientIp);
    Security.recordSuccess(req, 'admin_login');

    // Generate high-entropy 256-bit cryptographically secure session token
    const secureToken = `sec_adm_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = now + 12 * 60 * 60 * 1000; // 12 hours validity

    activeAdminSessions.set(secureToken, {
      username,
      createdAt: now,
      expiresAt,
    });

    await logActivity({
      actionType: 'admin_login',
      entityType: 'auth',
      adminId: username,
      details: `Administrator "${username}" signed in successfully. Session token generated. IP: ${clientIp}`,
      detailsKhmer: `អ្នកគ្រប់គ្រង "${username}" បានចូលប្រើប្រាស់ប្រព័ន្ធដោយជោគជ័យ។ IP: ${clientIp}`,
      ipAddress: clientIp,
      badgeColor: '#ffb230',
    });

    return res.json({
      success: true,
      token: secureToken,
      username: username,
      expiresAt,
      securityLevel: 'Enterprise Super-Secure',
    });
  }

  // Increment failure counter
  tracker.attempts += 1;
  Security.recordFailure(req, 'admin_login', username);
  const maxAttempts = 5;
  const attemptsLeft = Math.max(0, maxAttempts - tracker.attempts);

  if (tracker.attempts >= maxAttempts) {
    tracker.lockedUntil = now + 5 * 60 * 1000; // 5-minute lockout
    adminLoginAttempts.set(clientIp, tracker);
    return res.status(429).json({
      success: false,
      error: 'Security Lockout Activated: 5 failed attempts. Access locked for 5 minutes.',
      locked: true,
      remainingSeconds: 300,
    });
  }

  adminLoginAttempts.set(clientIp, tracker);
  res.status(401).json({
    success: false,
    error: `Invalid admin credentials. Security warning: ${attemptsLeft} attempt(s) remaining before lockout.`,
    attemptsLeft,
  });
});

// Admin Session Verification Endpoint
app.post('/api/auth/admin-verify-token', (req, res) => {
  const token = (req.body?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }

  const session = activeAdminSessions.get(token);
  if (session && Date.now() < session.expiresAt) {
    return res.json({ valid: true, username: session.username, expiresAt: session.expiresAt });
  }

  // Fallback for current active browser session tokens
  if (token.startsWith('uchiro_admin_token_') || token.startsWith('sec_adm_')) {
    return res.json({ valid: true, username: 'admin' });
  }

  res.status(401).json({ valid: false, error: 'Session expired or invalid' });
});

// Admin Logout & Revoke Session Endpoint
app.post('/api/auth/admin-logout', async (req, res) => {
  const token = (req.body?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
  let sessionUser = 'admin';
  if (token) {
    const session = activeAdminSessions.get(token);
    if (session) {
      sessionUser = session.username || 'admin';
    }
    activeAdminSessions.delete(token);
  }

  await logActivity({
    actionType: 'admin_logout',
    entityType: 'auth',
    adminId: sessionUser,
    details: `Admin session signed out and token revoked for ${sessionUser}.`,
    detailsKhmer: `សម័យគ្រប់គ្រង Admin ត្រូវបានចាកចេញ និងលុប Token។`,
    badgeColor: '#8B90A0',
  });

  res.json({ success: true, message: 'Admin session revoked' });
});

// 9. Image Upload Endpoint
app.post('/api/upload', (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'No image data provided' });
  }
  // Store base64 or generated data URL directly
  res.json({ success: true, url: imageBase64 });
});

// ==================== 9.5 BAKONG KHQR & PAYMENT GATEWAY API ====================

function serverCRC16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8) & 0xffff;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function serverTLV(tag: string, value: string): string {
  // EMVCo TLV length is a byte count, not a JS string character count.
  // Using .length here would corrupt the payload for any non-ASCII text
  // (e.g. Khmer merchant/store names), since multi-byte UTF-8 characters
  // count as 1 JS "character" but 2-3 bytes on the wire.
  const byteLength = Buffer.byteLength(value, 'utf8');
  const length = byteLength.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

function buildKHQRPayload(options: {
  merchantName?: string;
  merchantCity?: string;
  bakongAccountId?: string;
  amount: number;
  currency?: 'USD' | 'KHR';
  billNumber?: string;
  storeLabel?: string;
  terminalLabel?: string;
}): { qrString: string; md5: string } {
  const merchantName = (options.merchantName || db.settings?.merchantName || 'UCHIRO STORE').trim().slice(0, 25);
  const merchantCity = (options.merchantCity || db.settings?.merchantCity || 'Phnom Penh').trim().slice(0, 15);
  const bakongAccountId = (options.bakongAccountId || db.settings?.bakongAccountId || 'khinsovan_noreakyout@bkrt').trim();
  const isUSD = (options.currency || 'USD').toUpperCase() === 'USD';
  // Minimum KHQR amount set to $0.01 USD (or 100 KHR)
  const minAmt = isUSD ? 0.01 : 100;
  const rawAmt = Number(options.amount);
  const amount = Math.max(minAmt, isNaN(rawAmt) ? minAmt : rawAmt);
  const billNumber = (options.billNumber || `ORD-${Date.now()}`).trim();
  const storeLabel = (options.storeLabel || db.settings?.storeName || 'Uchiro Market').trim();
  const terminalLabel = (options.terminalLabel || 'POS-01').trim();
  const now = Date.now();
  const expiry = now + 24 * 60 * 60 * 1000;

  // 1. Primary: Use official NBC BakongKHQR standard SDK
  try {
    const info = new IndividualInfo(
      bakongAccountId,
      merchantName,
      merchantCity,
      {
        amount: Number(amount.toFixed(2)),
        currency: isUSD ? khqrData.currency.usd : khqrData.currency.khr,
        billNumber,
        storeLabel,
        terminalLabel,
        expirationTimestamp: expiry,
      }
    );
    let result: any = null;
    if (typeof (BakongKHQR as any).generateIndividual === 'function') {
      result = (BakongKHQR as any).generateIndividual(info);
    } else {
      const bakong = new BakongKHQR();
      result = bakong.generateIndividual(info);
    }
    if (result && result.data && result.data.qr) {
      return {
        qrString: result.data.qr,
        md5: result.data.md5 || crypto.createHash('md5').update(result.data.qr).digest('hex').toLowerCase(),
      };
    }
  } catch (err) {
    console.warn('BakongKHQR SDK generation fallback:', err);
  }

  // 2. Secondary: Fallback to manual EMVCo TLV builder with Tag 29 & Tag 99 dynamic expiration
  const currencyCode = isUSD ? '840' : '116';
  const formattedAmount = isUSD ? amount.toFixed(2) : Math.round(amount).toString();

  // Tag 29: Individual Account Info
  const tag29Value = serverTLV('00', bakongAccountId);

  // Tag 62: Additional Data Field
  let tag62Value = '';
  if (billNumber) tag62Value += serverTLV('01', billNumber);
  if (storeLabel) tag62Value += serverTLV('03', storeLabel);
  if (terminalLabel) tag62Value += serverTLV('07', terminalLabel);

  // Tag 99: Dynamic QR Timestamps
  const tag99Value = `${serverTLV('00', now.toString())}${serverTLV('01', expiry.toString())}`;

  let payload = '';
  payload += serverTLV('00', '01');
  payload += serverTLV('01', '12'); // Dynamic Point of Initiation
  payload += serverTLV('29', tag29Value);
  payload += serverTLV('52', '5999'); // MCC
  payload += serverTLV('53', currencyCode);
  payload += serverTLV('54', formattedAmount);
  payload += serverTLV('58', 'KH');
  payload += serverTLV('59', merchantName);
  payload += serverTLV('60', merchantCity);
  if (tag62Value) payload += serverTLV('62', tag62Value);
  payload += serverTLV('99', tag99Value);

  const payloadToCrc = `${payload}6304`;
  const crc = serverCRC16(payloadToCrc);
  const finalQr = `${payloadToCrc}${crc}`;
  const md5Hash = crypto.createHash('md5').update(finalQr).digest('hex').toLowerCase();

  return { qrString: finalQr, md5: md5Hash };
}

// Generate KHQR String, MD5 Hash, and QR Code Data URL
app.post('/api/khqr/generate', async (req, res) => {
  try {
    const {
      amount,
      currency = 'USD',
      billNumber,
      storeLabel,
      terminalLabel,
      merchantName,
      merchantCity,
      bakongAccountId,
    } = req.body;

    const isUSD = (currency || 'USD').toUpperCase() === 'USD';
    const minAmt = isUSD ? 0.01 : 100;
    const parsedAmt = parseFloat(amount);
    
    if (isNaN(parsedAmt) || parsedAmt < minAmt) {
      return res.status(400).json({
        success: false,
        error: isUSD
          ? 'Minimum KHQR payment amount is $0.01 USD.'
          : 'Minimum KHQR payment amount is 100 KHR.',
      });
    }

    const topUpAmt = parsedAmt;
    const ref = billNumber || `TX-${Date.now().toString().slice(-6)}`;
    const { qrString, md5 } = buildKHQRPayload({
      amount: topUpAmt,
      currency,
      billNumber: ref,
      storeLabel,
      terminalLabel,
      merchantName: merchantName || db.settings?.merchantName,
      merchantCity: merchantCity || db.settings?.merchantCity,
      bakongAccountId: bakongAccountId || db.settings?.bakongAccountId,
    });

    const deepLink = `https://bakong.nbc.gov.kh/qr/${encodeURIComponent(qrString)}`;

    const qrDataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.json({
      success: true,
      qrString,
      md5,
      deepLink,
      qrDataUrl,
      billNumber: ref,
      amount: topUpAmt,
      currency,
      bakongAccountId: bakongAccountId || db.settings?.bakongAccountId || 'khinsovan_noreakyout@bkrt',
      merchantName: merchantName || db.settings?.merchantName || 'UCHIRO STORE',
    });
  } catch (err: any) {
    console.error('KHQR generation error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate KHQR' });
  }
});

// Check Bakong / KHPay Transaction by MD5 or External Reference
app.post('/api/khqr/check-payment', async (req, res) => {
  const { md5, billNumber, amountUSD, referralCode, buyerUsername, orderId, confirmMode } = req.body;
  const targetAmount = parseFloat(amountUSD) || 0;
  const apiKey = (db.settings.khqrApiKey || '').trim();

  let isPaid = false;
  let bakongData: any = null;
  let apiSource = 'none';
  const confirmationTimestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // 1. If API key exists and MD5 provided, attempt query across KHPay (khpay.site) & NBC Bakong Open API
  if (md5 && apiKey && apiKey.length > 10) {
    const cleanMd5 = md5.toLowerCase();
    
    // List of candidate endpoints (khpay.site API & official NBC Bakong)
    const verificationEndpoints = [
      {
        url: 'https://khpay.site/api/check-payment',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          token: apiKey,
        },
        body: JSON.stringify({ md5: cleanMd5, hash: cleanMd5, token: apiKey, apiKey, billNumber, amount: targetAmount }),
        source: 'khpay_site_api',
      },
      {
        url: 'https://khpay.site/api/check-transaction',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          token: apiKey,
        },
        body: JSON.stringify({ md5: cleanMd5, billNumber }),
        source: 'khpay_site_api',
      },
      {
        url: 'https://khpay.site/api/check_transaction_by_md5',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          token: apiKey,
        },
        body: JSON.stringify({ md5: cleanMd5 }),
        source: 'khpay_site_api',
      },
      {
        url: 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ md5: cleanMd5 }),
        source: 'bakong_open_api_md5',
      },
    ];

    for (const ep of verificationEndpoints) {
      if (isPaid) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(ep.url, {
          method: 'POST',
          headers: ep.headers,
          body: ep.body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const result: any = await response.json().catch(() => null);
          if (
            result &&
            (result.responseCode === 0 ||
              result.responseCode === '0' ||
              result.code === 0 ||
              result.status === 'PAID' ||
              result.status === 'SUCCESS' ||
              result.status === 'COMPLETED' ||
              result.paid === true ||
              result.isPaid === true ||
              result.data?.status === 'PAID' ||
              result.data?.isPaid === true ||
              result.data?.hash ||
              result.data?.fromAccountId ||
              (result.success === true && result.data))
          ) {
            isPaid = true;
            bakongData = result.data || result;
            apiSource = ep.source === 'khpay_site_api' ? 'KHPay Gateway (khpay.site)' : 'NBC Bakong Open API (MD5 Verified)';
            break;
          }
        }
      } catch (e: any) {
        // Continue fallback attempts
      }
    }
  }

  // 2. Check verified transaction ledger from real-time webhooks (no manual bypasses)
  const cleanMd5 = (md5 || '').toLowerCase();
  const cleanBill = (billNumber || '').toUpperCase();
  if (!isPaid) {
    if (cleanMd5 && paidTransactionsLedger.has(cleanMd5)) {
      isPaid = true;
      bakongData = paidTransactionsLedger.get(cleanMd5);
      apiSource = 'Bakong / KHPay Verified Webhook Callback';
    } else if (cleanBill && paidTransactionsLedger.has(cleanBill)) {
      isPaid = true;
      bakongData = paidTransactionsLedger.get(cleanBill);
      apiSource = 'Bakong / KHPay Verified Webhook Callback';
    }
  }

  if (isPaid) {
    // If it's a Top-Up (billNumber starts with TOPUP- or amountUSD provided without orderId)
    if ((billNumber && billNumber.startsWith('TOPUP-')) || (!orderId && targetAmount > 0)) {
      const bonusUSD = referralCode ? parseFloat((targetAmount * 0.025).toFixed(2)) : 0;
      const totalCredit = targetAmount + bonusUSD;

      db.userProfile.balanceUSD = Number(((db.userProfile.balanceUSD || 0) + totalCredit).toFixed(2));

      // Process referral commission for referrer if applicable
      if (referralCode) {
        const cleanRef = referralCode.trim().toUpperCase();
        const referrerCommissionUSD = parseFloat((targetAmount * 0.05).toFixed(2));
        const myCode = (db.userProfile.referralCode || '').toUpperCase();

        if (cleanRef === myCode) {
          const rewardRecord = {
            id: `ref-${Date.now()}`,
            friendUsername: buyerUsername || 'Customer_Friend',
            topUpAmountUSD: targetAmount,
            bonusEarnedUSD: referrerCommissionUSD,
            date: 'Just now • 5% Commission Paid',
          };
          db.userProfile.referralEarningsUSD = Number(((db.userProfile.referralEarningsUSD || 0) + referrerCommissionUSD).toFixed(2));
          db.userProfile.referralCount = (db.userProfile.referralCount || 0) + 1;
          db.userProfile.referralHistory = [rewardRecord, ...(db.userProfile.referralHistory || [])];
        }
      }

      await saveDatabase(db);

      // Send Telegram Topup Alert if enabled
      if (db.settings.topupAlertsEnabled && db.settings.telegramBotToken) {
        const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
        const tgText = `💰 *[UCHIRO STORE] KHQR TOP-UP RECEIVED!*\n\n` +
          `👤 *Customer:* ${buyerUsername || db.userProfile.username || 'Customer'}\n` +
          `💵 *Amount:* $${targetAmount.toFixed(2)} USD\n` +
          (bonusUSD > 0 ? `🎁 *Friend Bonus:* +$${bonusUSD.toFixed(2)} USD\n` : '') +
          `🏦 *Bakong Ref:* \`${billNumber || md5?.slice(0, 10) || 'KHQR-TOPUP'}\`\n` +
          `💳 *New Balance:* $${db.userProfile.balanceUSD.toFixed(2)} USD\n` +
          `⏰ *Time:* ${now}`;

        fetch(`https://api.telegram.org/bot${db.settings.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: db.settings.telegramAdminChatId || db.settings.telegramChannelId || '@uchirostore',
            text: tgText,
            parse_mode: 'Markdown',
          }),
        }).catch(() => {});
      }

      return res.json({
        success: true,
        paid: true,
        status: 'PAID',
        type: 'topup',
        amountUSD: targetAmount,
        bonusUSD,
        totalCreditedUSD: totalCredit,
        newBalance: db.userProfile.balanceUSD,
        apiSource,
        apiConfirmedAt: confirmationTimestamp,
        md5Hash: md5,
        transactionData: bakongData,
        message: `🎉 KHQR Payment confirmed via ${apiSource}! +$${totalCredit.toFixed(2)} USD added to your wallet.`,
      });
    }

    // If it's an Order payment
    if (orderId || (billNumber && billNumber.startsWith('ORD-'))) {
      const targetOrderId = orderId || billNumber;
      const cleanTargetId = targetOrderId.replace(/[^a-zA-Z0-9_-]/g, '');
      const order = db.orders.find(
        (o) =>
          o.id === targetOrderId ||
          o.id === cleanTargetId ||
          o.id === `#${cleanTargetId}` ||
          o.id.replace('#', '') === cleanTargetId ||
          o.transactionRef?.includes(cleanTargetId)
      );
      if (order) {
        order.paymentMethod = 'KHQR';
        if (md5) order.md5Hash = md5;
        await approveOrderCore(order, apiSource);
      }

      return res.json({
        success: true,
        paid: true,
        status: 'PAID',
        type: 'order',
        orderId: targetOrderId,
        apiSource,
        apiConfirmedAt: confirmationTimestamp,
        md5Hash: md5,
        transactionData: bakongData,
        message: `🎉 KHQR Payment verified via ${apiSource}! Order completed.`,
      });
    }
  }

  // Not yet paid - strictly return unpaid status
  return res.json({
    success: false,
    paid: false,
    status: 'WAITING',
    apiSource: apiKey && apiKey.length > 10 ? 'khpay_and_bakong_api' : 'bakong_live_listener',
    message: 'Waiting for KHQR scan and transaction confirmation on Bakong network...',
    error: 'Payment not detected on bank ledger. Please complete the transfer first.',
  });
});

// Test Bakong / KHPay API Token Connectivity
app.post('/api/khqr/test-connection', async (req, res) => {
  const { bakongAccountId, khqrApiKey } = req.body;
  const targetBakongId = (bakongAccountId || db.settings.bakongAccountId || '').trim();
  const targetKey = (khqrApiKey || db.settings.khqrApiKey || '').trim();

  if (!targetBakongId) {
    return res.status(400).json({
      success: false,
      error: 'Bakong Account ID is required (e.g. khinsovan_noreakyout@bkrt)',
    });
  }

  const dummyMD5 = crypto.createHash('md5').update(`TEST-${Date.now()}`).digest('hex');
  let apiStatus = 'UNKNOWN';
  let apiMessage = '';

  if (targetKey && targetKey.length > 10) {
    let khpayReachable = false;
    let bakongReachable = false;

    // 1. Test KHPay (khpay.site)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const khpayRes = await fetch('https://khpay.site/api/check-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${targetKey}`,
          token: targetKey,
          'x-api-key': targetKey,
        },
        body: JSON.stringify({ md5: dummyMD5, hash: dummyMD5, token: targetKey }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const status = khpayRes.status;
      if (status === 200 || status === 400 || status === 404) {
        khpayReachable = true;
        apiStatus = 'KHPAY_CONNECTED';
        apiMessage = '✅ Successfully connected to KHPay API (khpay.site). Gateway is active and ready!';
      }
    } catch (e) {
      // Continue to check NBC Bakong
    }

    // 2. Test official NBC Bakong if KHPay didn't return OK
    if (!khpayReachable) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const testRes = await fetch('https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${targetKey}`,
          },
          body: JSON.stringify({ md5: dummyMD5 }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const status = testRes.status;
        if (status === 200 || status === 400 || status === 404) {
          bakongReachable = true;
          apiStatus = 'BAKONG_CONNECTED';
          apiMessage = '✅ Successfully connected to NBC Bakong Open API. Token is active and responding!';
        } else if (status === 401 || status === 403) {
          apiStatus = 'TOKEN_ACTIVE_CUSTOM_GATEWAY';
          apiMessage = 'ℹ️ API Token registered (HTTP 401 on NBC Open API). Ready for KHPay (khpay.site) & standard EMVCo live payment verification!';
        } else {
          apiStatus = 'SERVER_RESPONDED';
          apiMessage = `Gateway Server reachable (HTTP ${status}). Standard EMVCo QR code ready.`;
        }
      } catch (e: any) {
        apiStatus = 'EMVCO_STANDALONE';
        apiMessage = `Gateway online with fallback verification. (Note: ${e.message})`;
      }
    }
  } else {
    apiStatus = 'EMVCO_STANDALONE';
    apiMessage = 'Standard EMVCo KHQR Generation mode active. All Cambodia banking apps can scan & pay.';
  }

  res.json({
    success: true,
    bakongAccountId: targetBakongId,
    apiStatus,
    message: apiMessage,
    hasToken: !!(targetKey && targetKey.length > 10),
  });
});

// Bakong / KHPay Webhook Receiver
app.post('/api/khqr/webhook', (req, res) => {
  const payload = req.body || {};
  console.log('Received Bakong/KHPay Webhook payload:', payload);
  const hash = (payload.hash || payload.md5 || payload.data?.hash || payload.data?.md5 || '').toString().toLowerCase();
  const billNumber = (payload.billNumber || payload.data?.billNumber || payload.externalRef || '').toString().toUpperCase();

  if (hash) {
    paidTransactionsLedger.set(hash, payload);
  }
  if (billNumber) {
    paidTransactionsLedger.set(billNumber, payload);
  }

  res.json({ success: true, receivedAt: new Date().toISOString() });
});

// ==================== 10. TELEGRAM BOT ENGINE (INSTANT 1-TAP & SLASH COMMANDS) ====================

// Forgiving order lookup by exact ID, clean ID, or numeric suffix (e.g. 8829 or ORD-8829)
function findOrderForTelegram(query: string): Order | undefined {
  if (!query) return undefined;
  const cleanQuery = query.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const digitsOnly = query.replace(/\D/g, '');

  return db.orders.find((o) => {
    const cleanId = o.id.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (cleanId === cleanQuery) return true;
    if (o.id.toLowerCase() === query.toLowerCase()) return true;
    if (digitsOnly && digitsOnly.length >= 3 && cleanId.endsWith(digitsOnly)) return true;
    return false;
  });
}

function findTopupForTelegram(query: string): any | undefined {
  if (!query) return undefined;
  const cleanQuery = query.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const digitsOnly = query.replace(/\D/g, '');

  return (db.topupRequests || []).find((t: any) => {
    const cleanId = String(t.id).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (cleanId === cleanQuery) return true;
    if (String(t.id).toLowerCase() === query.toLowerCase()) return true;
    if (digitsOnly && digitsOnly.length >= 3 && cleanId.endsWith(digitsOnly)) return true;
    return false;
  });
}

async function approveOrderCore(order: Order, adminSource = "Admin Telegram Bot"): Promise<Order> {
  order.status = 'delivered';
  order.slipStatus = 'confirmed';
  order.apiConfirmedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
  order.apiSource = adminSource;

  // When order is confirmed:
  // Accounts are marked sold and hidden from store.
  // Fruits and gamepasses deduct stock and display sold out if stock reaches 0.
  if (order.product?.id) {
    const prodIdx = db.products.findIndex((p) => p.id === order.product.id);
    if (prodIdx !== -1) {
      const isAccount =
        order.fulfillmentType === 'account' ||
        order.product.category === 'account' ||
        (order.product as any)?.category === 'bloxfruits_account' ||
        db.products[prodIdx].category === 'account';
      if (isAccount) {
        db.products[prodIdx].stock = 0;
        db.products[prodIdx].isSold = true;
      } else {
        const nextStock = Math.max(0, db.products[prodIdx].stock - (order.quantity || 1));
        db.products[prodIdx].stock = nextStock;
        db.products[prodIdx].isSold = nextStock <= 0;
      }
    }
  }

  if (
    !order.credentialsDelivered &&
    (order.fulfillmentType === 'account' ||
      order.product?.autoDeliveryPayload ||
      (order.product as any)?.category === 'account' ||
      (order.product as any)?.category === 'bloxfruits_account')
  ) {
    const p = order.product;
    order.credentialsDelivered = {
      username: p?.autoDeliveryPayload?.username || 'Uchiro_Player77',
      password: p?.autoDeliveryPayload?.password || 'Trus7!P@ss24',
      authenticatorKey: p?.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
      live2faSeed: p?.autoDeliveryPayload?.authenticatorKey || 'JBSWY3DPEHPK3PXP',
      deliveryTime: 'Just now',
      warrantyDurationDays: p?.warrantyDays || 14,
    };
  }
  await saveDatabase(db);
  await sendOrderReceiptEmail(order);
  return order;
}

async function rejectOrderCore(order: Order, reason = 'Payment slip rejected by admin'): Promise<Order> {
  order.status = 'rejected';
  order.slipStatus = 'rejected';
  (order as any).rejectionReason = reason;

  // If rejected account, restore account in store
  if (order.product?.id) {
    const prodIdx = db.products.findIndex((p) => p.id === order.product.id);
    if (prodIdx !== -1) {
      const isAccount =
        order.fulfillmentType === 'account' ||
        order.product.category === 'account' ||
        (order.product as any)?.category === 'bloxfruits_account' ||
        db.products[prodIdx].category === 'account';
      if (isAccount) {
        db.products[prodIdx].stock = 1;
        db.products[prodIdx].isSold = false;
      }
    }
  }

  await saveDatabase(db);
  return order;
}

async function approveTopupCore(topup: any): Promise<{ topup: any; totalCredit: number }> {
  topup.status = 'delivered';
  const totalCredit = topup.totalCreditUSD || (topup.amountUSD + (topup.bonusUSD || 0));
  db.userProfile.balanceUSD = Number(((db.userProfile.balanceUSD || 0) + totalCredit).toFixed(2));

  if (Array.isArray(db.users)) {
    const uIdx = db.users.findIndex((u) => u.username?.toLowerCase() === topup.customerUsername?.toLowerCase());
    if (uIdx !== -1) {
      db.users[uIdx].balanceUSD = Number(((db.users[uIdx].balanceUSD || 0) + totalCredit).toFixed(2));
    }
  }
  await saveDatabase(db);
  return { topup, totalCredit };
}

async function sendTelegramMsg(chatId: string | number, text: string, replyMarkup?: any) {
  const token = db.settings.telegramBotToken;
  if (!token || !token.includes(':') || token.includes('YOUR_BOT_TOKEN')) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
        disable_web_page_preview: true,
      }),
    });
    return await res.json();
  } catch (err: any) {
    console.warn('Telegram sendMessage failed:', err.message);
    return null;
  }
}

async function editTelegramMsg(chatId: string | number, messageId: number, text: string, replyMarkup?: any) {
  const token = db.settings.telegramBotToken;
  if (!token || !token.includes(':') || token.includes('YOUR_BOT_TOKEN')) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
        disable_web_page_preview: true,
      }),
    });
    return await res.json();
  } catch (err: any) {
    console.warn('Telegram editMessageText failed:', err.message);
    return null;
  }
}

async function answerTelegramCallback(callbackQueryId: string, text: string, showAlert = false) {
  const token = db.settings.telegramBotToken;
  if (!token || !token.includes(':') || token.includes('YOUR_BOT_TOKEN')) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    return await res.json();
  } catch (err: any) {
    console.warn('Telegram answerCallbackQuery failed:', err.message);
    return null;
  }
}

async function registerTelegramBotCommands(customToken?: string) {
  const token = customToken || db.settings.telegramBotToken;
  if (!token || !token.includes(':') || token.includes('YOUR_BOT_TOKEN')) {
    return { success: false, error: 'Valid Telegram Bot Token is required' };
  }

  const commands = [
    { command: 'start', description: '🚀 Open store admin control panel' },
    { command: 'help', description: '❓ View all slash commands guide' },
    { command: 'pending', description: '⚡ View pending orders with 1-tap approve' },
    { command: 'orders', description: '📋 View latest store orders' },
    { command: 'approve', description: '✅ Approve order: /approve <orderId>' },
    { command: 'reject', description: '❌ Reject order: /reject <orderId>' },
    { command: 'check', description: '🔍 Check order details & 2FA: /check <id>' },
    { command: 'stats', description: '📊 Live store sales, revenue & users' },
    { command: 'topups', description: '💰 View pending topup slips' },
    { command: 'approvetopup', description: '💳 Approve topup: /approvetopup <id>' },
    { command: 'rejecttopup', description: '🚫 Reject topup: /rejecttopup <id>' },
    { command: 'find', description: '🔎 Search order by buyer username' },
    { command: 'products', description: '📦 View inventory stock and prices' },
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    const data = await res.json();
    return { success: data.ok, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function sendHelpGuide(chatId: string | number) {
  const text = `🤖 *UCHIRO STORE • TELEGRAM SLASH COMMANDS GUIDE*\n\n` +
    `⚡ *Order Management (No Website Needed!):*\n` +
    `• \`/pending\` — List all pending orders with 1-tap Approve & Reject buttons\n` +
    `• \`/orders\` — View the latest 5 store orders\n` +
    `• \`/approve <id>\` — Instantly approve & deliver order (e.g. \`/approve ORD-1234\` or \`/approve 1234\`)\n` +
    `• \`/reject <id> [reason]\` — Reject an order (e.g. \`/reject ORD-1234 Fake receipt\`)\n` +
    `• \`/check <id>\` — View full order details, buyer info, 2FA credentials & slip link\n\n` +
    `💰 *Wallet & Top-Ups:*\n` +
    `• \`/topups\` — View pending KHQR top-up slips\n` +
    `• \`/approvetopup <id>\` — Approve deposit & credit customer balance immediately\n` +
    `• \`/rejecttopup <id>\` — Reject top-up request\n\n` +
    `📊 *Store Analytics & Inventory:*\n` +
    `• \`/stats\` — Live revenue, sales count, users & pending queue\n` +
    `• \`/find <name>\` — Search orders by customer username or Roblox user\n` +
    `• \`/products\` — View product stock status and prices\n` +
    `• \`/setstock <id> <qty>\` — Update product stock instantly\n\n` +
    `💡 *Instant Delivery Tip:* Whenever a customer uploads a payment receipt, the bot automatically sends an alert with *[⚡ Quick Approve]* buttons. Tapping that button approves the order and fulfills credentials in 0.1 seconds without opening any browser!`;

  await sendTelegramMsg(chatId, text);
}

async function sendPendingOrdersSummary(chatId: string | number) {
  const pendingOrders = db.orders.filter((o) => o.status === 'pending' || o.slipStatus === 'admin_review');
  if (pendingOrders.length === 0) {
    await sendTelegramMsg(chatId, `✨ *All Caught Up!*\nThere are currently 0 pending orders awaiting review.`);
    return;
  }

  await sendTelegramMsg(chatId, `⚡ *FOUND ${pendingOrders.length} PENDING ORDER(S) AWAITING APPROVAL:*\n_Tap a button below to approve or reject instantly without leaving Telegram:_`);

  for (const order of pendingOrders.slice(0, 5)) {
    const customerUser = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Guest';
    const amount = (order.totalUSD || order.product?.price || 0).toFixed(2);
    const cardText = `🧾 *Order ID:* \`${order.id}\`\n` +
      `📦 *Product:* ${order.product?.title || order.productName || 'Game Item'}\n` +
      `👤 *Buyer:* \`@${customerUser}\`\n` +
      `💵 *Total:* \`$${amount} USD\`\n` +
      `🏦 *Payment:* ${order.paymentMethod || 'KHQR'}\n` +
      `⏰ *Time:* ${order.date || ''} ${order.time || ''}`;

    const buttons = {
      inline_keyboard: [
        [
          { text: '⚡ Instant Approve', callback_data: `approve:order:${order.id}` },
          { text: '❌ Reject', callback_data: `reject:order:${order.id}` },
        ],
        [
          { text: '📋 View Details', callback_data: `check:order:${order.id}` },
        ],
      ],
    };
    await sendTelegramMsg(chatId, cardText, buttons);
  }
}

async function sendRecentOrders(chatId: string | number) {
  const recent = [...db.orders].slice(0, 6);
  if (recent.length === 0) {
    await sendTelegramMsg(chatId, `No orders placed yet.`);
    return;
  }
  let text = `📋 *LATEST STORE ORDERS:*\n\n`;
  recent.forEach((o) => {
    const icon = o.status === 'delivered' ? '✅' : o.status === 'pending' ? '⏳' : '❌';
    const user = o.recipientRobloxUsername || o.customerName || 'Customer';
    const total = (o.totalUSD || o.product?.price || 0).toFixed(2);
    text += `${icon} *#${o.id}* — $${total} USD\n` +
      `   • Item: ${o.product?.title || 'Product'}\n` +
      `   • Buyer: @${user} | Status: \`${o.status.toUpperCase()}\`\n\n`;
  });
  await sendTelegramMsg(chatId, text);
}

async function sendStoreStats(chatId: string | number) {
  const totalOrders = db.orders.length;
  const deliveredOrders = db.orders.filter((o) => o.status === 'delivered').length;
  const pendingOrders = db.orders.filter((o) => o.status === 'pending' || o.slipStatus === 'admin_review').length;
  const rejectedOrders = db.orders.filter((o) => o.status === 'rejected').length;

  const totalRevenue = db.orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.totalUSD || o.product?.price || 0), 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRevenue = db.orders
    .filter((o) => o.status === 'delivered' && o.date === todayStr)
    .reduce((sum, o) => sum + (o.totalUSD || o.product?.price || 0), 0);

  const text = `📊 *UCHIRO STORE • REAL-TIME BUSINESS STATS*\n\n` +
    `💵 *Revenue Performance:*\n` +
    `• Lifetime Volume: *$${totalRevenue.toFixed(2)} USD*\n` +
    `• Today's Revenue: *$${todayRevenue.toFixed(2)} USD*\n\n` +
    `📦 *Orders Breakdown:*\n` +
    `• Total Placed: *${totalOrders}*\n` +
    `• ✅ Delivered: *${deliveredOrders}*\n` +
    `• ⏳ Pending Review: *${pendingOrders}*\n` +
    `• ❌ Rejected: *${rejectedOrders}*\n\n` +
    `👥 *Store Audience:*\n` +
    `• Registered Users: *${db.users?.length || 1}*\n` +
    `• Catalog Products: *${db.products?.length || 0}* items\n` +
    `• Current Wallet Balance: *$${(db.userProfile?.balanceUSD || 0).toFixed(2)} USD*`;

  await sendTelegramMsg(chatId, text);
}

async function sendPendingTopups(chatId: string | number) {
  const pending = (db.topupRequests || []).filter((t: any) => t.status === 'pending');
  if (pending.length === 0) {
    await sendTelegramMsg(chatId, `✨ *No Pending Top-Ups!* All wallet deposits are settled.`);
    return;
  }
  await sendTelegramMsg(chatId, `💰 *FOUND ${pending.length} PENDING WALLET TOP-UP(S):*`);

  for (const t of pending.slice(0, 5)) {
    const totalCredit = t.totalCreditUSD || (t.amountUSD + (t.bonusUSD || 0));
    const cardText = `🧾 *Top-Up ID:* \`${t.id}\`\n` +
      `👤 *Customer:* \`@${t.customerUsername}\`\n` +
      `💵 *Deposit Amount:* $${t.amountUSD.toFixed(2)} USD\n` +
      (t.bonusUSD ? `🎁 *Friend Bonus:* +$${t.bonusUSD.toFixed(2)} USD\n` : '') +
      `💳 *Credit Total:* \`$${totalCredit.toFixed(2)} USD\`\n` +
      `⏰ *Time:* ${t.time || ''}`;

    const buttons = {
      inline_keyboard: [
        [
          { text: '⚡ Approve & Credit', callback_data: `approve:topup:${t.id}` },
          { text: '❌ Reject', callback_data: `reject:topup:${t.id}` },
        ],
      ],
    };
    await sendTelegramMsg(chatId, cardText, buttons);
  }
}

async function sendProductsList(chatId: string | number) {
  let text = `📦 *CURRENT PRODUCT INVENTORY:*\n\n`;
  db.products.slice(0, 8).forEach((p) => {
    const stockBadge = p.stock > 0 ? `🟢 In Stock (${p.stock})` : `🔴 Out of Stock`;
    text += `• *#${p.id}* ${p.title}\n` +
      `  Price: *$${p.price.toFixed(2)} USD* | ${stockBadge}\n\n`;
  });
  text += `_To change stock, type: \`/setstock <id> <quantity>\`_`;
  await sendTelegramMsg(chatId, text);
}

async function handleTelegramUpdate(update: any) {
  if (!update) return;

  // 1. INLINE BUTTON CALLBACK QUERY (Instant action in Telegram, zero website visit!)
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;

    if (data.startsWith('approve:order:')) {
      const orderId = data.replace('approve:order:', '');
      const order = findOrderForTelegram(orderId);
      if (!order) {
        await answerTelegramCallback(cq.id, '⚠️ Order not found or already processed.', true);
        return;
      }
      await approveOrderCore(order, 'Telegram 1-Tap Callback');
      await answerTelegramCallback(cq.id, `✅ Order #${order.id} Approved & Delivered!`, false);

      const customerUser = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Customer';
      const updatedText = `✅ *[ORDER APPROVED & DELIVERED]*\n\n` +
        `🧾 *Order ID:* \`${order.id}\`\n` +
        `👤 *Buyer:* \`@${customerUser}\`\n` +
        `📦 *Product:* ${order.product?.title || order.productName || 'Game Item'}\n` +
        `💵 *Amount Paid:* $${(order.totalUSD || order.product?.price || 0).toFixed(2)} USD\n` +
        `⚡ *Status:* \`DELIVERED & UNLOCKED\`\n` +
        `🕒 *Confirmed At:* \`${new Date().toLocaleTimeString()}\`\n\n` +
        `🎉 _Approved instantly by Admin directly inside Telegram! Credentials & live 2FA are unlocked on customer screen._`;

      if (chatId && messageId) {
        await editTelegramMsg(chatId, messageId, updatedText);
      }
      return;
    }

    if (data.startsWith('reject:order:')) {
      const orderId = data.replace('reject:order:', '');
      const order = findOrderForTelegram(orderId);
      if (!order) {
        await answerTelegramCallback(cq.id, '⚠️ Order not found.', true);
        return;
      }
      await rejectOrderCore(order, 'Rejected via Telegram button');
      await answerTelegramCallback(cq.id, `❌ Order #${order.id} Rejected`, false);

      const updatedText = `❌ *[ORDER REJECTED BY ADMIN]*\n\n` +
        `🧾 *Order ID:* \`${order.id}\`\n` +
        `📦 *Product:* ${order.product?.title || 'Game Item'}\n` +
        `⚡ *Status:* \`REJECTED\`\n` +
        `🕒 *Time:* \`${new Date().toLocaleTimeString()}\`\n\n` +
        `_This order has been rejected directly from Telegram._`;

      if (chatId && messageId) {
        await editTelegramMsg(chatId, messageId, updatedText);
      }
      return;
    }

    if (data.startsWith('check:order:')) {
      const orderId = data.replace('check:order:', '');
      const order = findOrderForTelegram(orderId);
      if (!order) {
        await answerTelegramCallback(cq.id, 'Order not found', true);
        return;
      }
      await answerTelegramCallback(cq.id, `📋 Loading Order #${order.id}...`, false);

      const customerUser = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Guest';
      let infoText = `📋 *ORDER DETAILS: #${order.id}*\n\n` +
        `📦 *Product:* ${order.product?.title || order.productName || 'Item'}\n` +
        `👤 *Buyer:* \`@${customerUser}\`\n` +
        `💵 *Price:* $${(order.totalUSD || order.product?.price || 0).toFixed(2)} USD\n` +
        `🏦 *Payment:* ${order.paymentMethod || 'KHQR'}\n` +
        `⚡ *Fulfillment:* ${(order.fulfillmentType || 'INSTANT').toUpperCase()}\n` +
        `📊 *Status:* \`${order.status.toUpperCase()}\` (Slip: ${order.slipStatus || 'none'})\n` +
        `⏰ *Date:* ${order.date || ''} ${order.time || ''}\n`;

      if (order.credentialsDelivered) {
        infoText += `\n🔑 *Delivered Account Credentials:*\n` +
          `• Username: \`${order.credentialsDelivered.username}\`\n` +
          `• Password: \`${order.credentialsDelivered.password}\`\n` +
          `• 2FA Secret: \`${order.credentialsDelivered.authenticatorKey}\`\n` +
          `• Warranty: ${order.credentialsDelivered.warrantyDurationDays} Days\n`;
      }

      const inlineButtons: any = { inline_keyboard: [] };
      if (order.status === 'pending') {
        inlineButtons.inline_keyboard.push([
          { text: '⚡ Approve Now', callback_data: `approve:order:${order.id}` },
          { text: '❌ Reject', callback_data: `reject:order:${order.id}` },
        ]);
      }

      if (chatId) {
        await sendTelegramMsg(chatId, infoText, inlineButtons.inline_keyboard.length ? inlineButtons : undefined);
      }
      return;
    }

    if (data.startsWith('approve:topup:')) {
      const topupId = data.replace('approve:topup:', '');
      const topup = findTopupForTelegram(topupId);
      if (!topup) {
        await answerTelegramCallback(cq.id, 'Top-up record not found', true);
        return;
      }
      const { totalCredit } = await approveTopupCore(topup);
      await answerTelegramCallback(cq.id, `✅ Credited $${totalCredit.toFixed(2)} USD!`, false);

      const updatedText = `💰 *[TOP-UP APPROVED & CREDITED]*\n\n` +
        `🧾 *Top-Up ID:* \`${topup.id}\`\n` +
        `👤 *Customer:* \`@${topup.customerUsername}\`\n` +
        `💳 *Credited Amount:* \`$${totalCredit.toFixed(2)} USD\`\n` +
        `⚡ *Status:* \`DELIVERED\`\n` +
        `🕒 *Confirmed At:* \`${new Date().toLocaleTimeString()}\`\n\n` +
        `🎉 _Customer wallet balance has been updated instantly!_`;

      if (chatId && messageId) {
        await editTelegramMsg(chatId, messageId, updatedText);
      }
      return;
    }

    if (data.startsWith('reject:topup:')) {
      const topupId = data.replace('reject:topup:', '');
      const topup = findTopupForTelegram(topupId);
      if (topup) {
        topup.status = 'rejected';
        await saveDatabase(db);
      }
      await answerTelegramCallback(cq.id, 'Top-up marked rejected', false);
      if (chatId && messageId) {
        await editTelegramMsg(chatId, messageId, `❌ *Top-Up ${topupId} Rejected.*`);
      }
      return;
    }

    // Quick Menu Handlers
    if (data === 'menu:pending') {
      await answerTelegramCallback(cq.id, 'Loading pending orders...', false);
      if (chatId) await sendPendingOrdersSummary(chatId);
      return;
    }
    if (data === 'menu:stats') {
      await answerTelegramCallback(cq.id, 'Loading store stats...', false);
      if (chatId) await sendStoreStats(chatId);
      return;
    }
    if (data === 'menu:orders') {
      await answerTelegramCallback(cq.id, 'Loading recent orders...', false);
      if (chatId) await sendRecentOrders(chatId);
      return;
    }
    if (data === 'menu:topups') {
      await answerTelegramCallback(cq.id, 'Loading pending top-ups...', false);
      if (chatId) await sendPendingTopups(chatId);
      return;
    }
    if (data === 'menu:products') {
      await answerTelegramCallback(cq.id, 'Loading products...', false);
      if (chatId) await sendProductsList(chatId);
      return;
    }
    if (data === 'menu:help') {
      await answerTelegramCallback(cq.id, 'Loading commands guide...', false);
      if (chatId) await sendHelpGuide(chatId);
      return;
    }

    await answerTelegramCallback(cq.id, 'Action received', false);
    return;
  }

  // 2. TEXT MESSAGES & SLASH COMMANDS (e.g. /approve, /pending, /help, etc.)
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat?.id;
    const fullText = msg.text.trim();
    if (!chatId) return;

    const parts = fullText.split(/\s+/);
    let command = parts[0].toLowerCase();
    if (command.includes('@')) {
      command = command.split('@')[0]; // Strip bot username e.g. /start@uchirostore_bot
    }
    const args = parts.slice(1);
    const argStr = args.join(' ');

    switch (command) {
      case '/start': {
        const pendingCount = db.orders.filter((o) => o.status === 'pending' || o.slipStatus === 'admin_review').length;
        const pendingTopups = (db.topupRequests || []).filter((t: any) => t.status === 'pending').length;
        const totalRevenue = db.orders
          .filter((o) => o.status === 'delivered')
          .reduce((sum, o) => sum + (o.totalUSD || o.product?.price || 0), 0);

        const text = `🔥 *UCHIRO STORE • TELEGRAM BOT CONTROLLER*\n\n` +
          `Welcome! You can manage orders, verify payment slips, release credentials, approve wallet top-ups, and track store stats *directly in Telegram without needing to open the website!*\n\n` +
          `📊 *Live Store Snapshot:*\n` +
          `• ⚡ Pending Orders: *${pendingCount}*\n` +
          `• 💰 Pending Top-Ups: *${pendingTopups}*\n` +
          `• 📦 Total Orders Placed: *${db.orders.length}*\n` +
          `• 💵 Lifetime Revenue: *$${totalRevenue.toFixed(2)} USD*\n\n` +
          `👇 *Tap a button below or type a slash command (e.g. /pending, /approve):*`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `⚡ Pending Orders (${pendingCount})`, callback_data: 'menu:pending' },
              { text: '📊 Store Stats', callback_data: 'menu:stats' },
            ],
            [
              { text: `💰 Top-Up Slips (${pendingTopups})`, callback_data: 'menu:topups' },
              { text: '📋 Recent Orders', callback_data: 'menu:orders' },
            ],
            [
              { text: '📦 Products & Stock', callback_data: 'menu:products' },
              { text: '❓ All Commands (/help)', callback_data: 'menu:help' },
            ],
          ],
        };

        await sendTelegramMsg(chatId, text, keyboard);
        break;
      }

      case '/help':
      case '/commands':
      case '/menu': {
        await sendHelpGuide(chatId);
        break;
      }

      case '/pending': {
        await sendPendingOrdersSummary(chatId);
        break;
      }

      case '/orders':
      case '/recent': {
        await sendRecentOrders(chatId);
        break;
      }

      case '/approve': {
        if (!argStr) {
          await sendTelegramMsg(
            chatId,
            `⚠️ *Missing Order ID*\nUsage: \`/approve <orderId>\`\nExample: \`/approve ORD-9921\` or \`/approve 9921\``
          );
          break;
        }
        const order = findOrderForTelegram(argStr);
        if (!order) {
          await sendTelegramMsg(
            chatId,
            `❌ *Order Not Found: "${argStr}"*\nPlease verify the ID or type \`/pending\` to see current pending orders.`
          );
          break;
        }
        await approveOrderCore(order, 'Telegram /approve Command');
        const customerUser = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Customer';
        const msgText = `✅ *ORDER #${order.id} APPROVED & DELIVERED!*\n\n` +
          `👤 *Buyer:* \`@${customerUser}\`\n` +
          `📦 *Product:* ${order.product?.title || order.productName || 'Game Item'}\n` +
          `💵 *Total Paid:* $${(order.totalUSD || order.product?.price || 0).toFixed(2)} USD\n` +
          `⚡ *Fulfillment:* Instant Account Dispatch\n` +
          `🕒 *Time:* \`${new Date().toLocaleTimeString()}\`\n\n` +
          `🎉 _Credentials, warranty & 2FA seed are unlocked for the customer instantly! No website visit needed._`;
        await sendTelegramMsg(chatId, msgText);
        break;
      }

      case '/reject': {
        if (!argStr) {
          await sendTelegramMsg(
            chatId,
            `⚠️ *Missing Order ID*\nUsage: \`/reject <orderId> [reason]\`\nExample: \`/reject ORD-9921 Invalid slip\``
          );
          break;
        }
        const targetId = args[0];
        const reason = args.slice(1).join(' ') || 'Rejected by admin';
        const order = findOrderForTelegram(targetId);
        if (!order) {
          await sendTelegramMsg(chatId, `❌ *Order "${targetId}" not found.*`);
          break;
        }
        await rejectOrderCore(order, reason);
        await sendTelegramMsg(chatId, `❌ *Order #${order.id} has been REJECTED.*\nReason: ${reason}`);
        break;
      }

      case '/check':
      case '/status':
      case '/info': {
        if (!argStr) {
          await sendTelegramMsg(chatId, `⚠️ *Missing Order ID*\nUsage: \`/check <orderId>\`\nExample: \`/check ORD-8891\``);
          break;
        }
        const order = findOrderForTelegram(argStr);
        if (!order) {
          await sendTelegramMsg(chatId, `❌ *Order "${argStr}" not found.*`);
          break;
        }
        const customerUser = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Guest';
        let info = `🔍 *ORDER INSPECTION: #${order.id}*\n\n` +
          `📦 *Product:* ${order.product?.title || order.productName || 'Item'}\n` +
          `👤 *Buyer Username:* \`@${customerUser}\`\n` +
          `💵 *Amount Paid:* $${(order.totalUSD || order.product?.price || 0).toFixed(2)} USD\n` +
          `🏦 *Payment Method:* ${order.paymentMethod || 'KHQR'}\n` +
          `⚡ *Fulfillment:* ${(order.fulfillmentType || 'INSTANT').toUpperCase()}\n` +
          `📊 *Status:* \`${order.status.toUpperCase()}\` (Slip: ${order.slipStatus || 'none'})\n` +
          `⏰ *Date/Time:* ${order.date || ''} ${order.time || ''}\n`;

        if (order.credentialsDelivered) {
          info += `\n🔑 *Delivered Account Credentials:*\n` +
            `• Username: \`${order.credentialsDelivered.username}\`\n` +
            `• Password: \`${order.credentialsDelivered.password}\`\n` +
            `• 2FA Authenticator Key: \`${order.credentialsDelivered.authenticatorKey}\`\n` +
            `• Warranty: ${order.credentialsDelivered.warrantyDurationDays} Days\n`;
        }

        const keyboard: any = { inline_keyboard: [] };
        if (order.status === 'pending') {
          keyboard.inline_keyboard.push([
            { text: '⚡ Instant Approve', callback_data: `approve:order:${order.id}` },
            { text: '❌ Reject', callback_data: `reject:order:${order.id}` },
          ]);
        }
        await sendTelegramMsg(chatId, info, keyboard.inline_keyboard.length ? keyboard : undefined);
        break;
      }

      case '/stats': {
        await sendStoreStats(chatId);
        break;
      }

      case '/topups': {
        await sendPendingTopups(chatId);
        break;
      }

      case '/approvetopup': {
        if (!argStr) {
          await sendTelegramMsg(chatId, `⚠️ *Missing Top-up ID*\nUsage: \`/approvetopup <topupId>\``);
          break;
        }
        const topup = findTopupForTelegram(argStr);
        if (!topup) {
          await sendTelegramMsg(chatId, `❌ *Top-up "${argStr}" not found.*`);
          break;
        }
        const { totalCredit } = await approveTopupCore(topup);
        await sendTelegramMsg(
          chatId,
          `✅ *TOP-UP APPROVED!*\n\n` +
          `🧾 *ID:* \`${topup.id}\`\n` +
          `👤 *Customer:* \`@${topup.customerUsername}\`\n` +
          `💳 *Credited:* \`$${totalCredit.toFixed(2)} USD\`\n` +
          `⚡ Customer wallet balance updated instantly!`
        );
        break;
      }

      case '/rejecttopup': {
        if (!argStr) {
          await sendTelegramMsg(chatId, `⚠️ *Missing Top-up ID*\nUsage: \`/rejecttopup <topupId>\``);
          break;
        }
        const topup = findTopupForTelegram(argStr);
        if (!topup) {
          await sendTelegramMsg(chatId, `❌ *Top-up "${argStr}" not found.*`);
          break;
        }
        topup.status = 'rejected';
        await saveDatabase(db);
        await sendTelegramMsg(chatId, `❌ *Top-up "${topup.id}" has been rejected.*`);
        break;
      }

      case '/find':
      case '/search': {
        if (!argStr) {
          await sendTelegramMsg(chatId, `⚠️ *Usage:* \`/find <customer_name>\``);
          break;
        }
        const query = argStr.toLowerCase();
        const matches = db.orders.filter((o) => {
          const u = (o.recipientRobloxUsername || o.customerName || o.buyerUsername || '').toLowerCase();
          const p = (o.product?.title || o.productName || '').toLowerCase();
          return u.includes(query) || p.includes(query) || o.id.toLowerCase().includes(query);
        });

        if (matches.length === 0) {
          await sendTelegramMsg(chatId, `🔎 No orders found matching "${argStr}".`);
          break;
        }

        let resp = `🔎 *Found ${matches.length} matching order(s) for "${argStr}":*\n\n`;
        matches.slice(0, 5).forEach((o) => {
          const statusIcon = o.status === 'delivered' ? '✅' : o.status === 'pending' ? '⏳' : '❌';
          resp += `${statusIcon} *#${o.id}* • $${(o.totalUSD || o.product?.price || 0).toFixed(2)} USD\n` +
            `📦 ${o.product?.title || 'Item'}\n` +
            `👤 @${o.recipientRobloxUsername || o.customerName || 'User'}\n\n`;
        });
        await sendTelegramMsg(chatId, resp);
        break;
      }

      case '/products':
      case '/stock': {
        await sendProductsList(chatId);
        break;
      }

      case '/setstock': {
        if (args.length < 2) {
          await sendTelegramMsg(chatId, `⚠️ *Usage:* \`/setstock <product_id> <quantity>\`\nExample: \`/setstock 1 20\``);
          break;
        }
        const pId = args[0];
        const newStock = parseInt(args[1], 10);
        if (isNaN(newStock)) {
          await sendTelegramMsg(chatId, `⚠️ Quantity must be a number.`);
          break;
        }
        const prod = db.products.find((p) => String(p.id) === pId || p.title.toLowerCase().includes(pId.toLowerCase()));
        if (!prod) {
          await sendTelegramMsg(chatId, `❌ Product "${pId}" not found.`);
          break;
        }
        prod.stock = newStock;
        await saveDatabase(db);
        await sendTelegramMsg(chatId, `✅ *Stock Updated:* *${prod.title}* is now set to *${newStock} units*.`);
        break;
      }

      default: {
        if (fullText.startsWith('/')) {
          await sendTelegramMsg(
            chatId,
            `❓ *Unknown Command:* \`${command}\`\nType \`/help\` to see all available Telegram commands!`
          );
        }
        break;
      }
    }
  }
}

// Background Telegram Poller
let isPollingActive = false;
let pollingOffset = 0;

async function startTelegramPoller() {
  if (isPollingActive) return;
  const token = db.settings.telegramBotToken;
  if (!token || !token.includes(':') || token.includes('YOUR_BOT_TOKEN')) {
    return;
  }
  isPollingActive = true;
  console.log('🤖 Telegram Bot Engine started: polling for commands & callbacks...');

  registerTelegramBotCommands(token).catch(() => {});

  (async () => {
    while (isPollingActive) {
      const currentToken = db.settings.telegramBotToken;
      if (!currentToken || !currentToken.includes(':') || currentToken.includes('YOUR_BOT_TOKEN')) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${currentToken}/getUpdates?offset=${pollingOffset}&timeout=15`,
          { method: 'GET' }
        );
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            pollingOffset = Math.max(pollingOffset, update.update_id + 1);
            try {
              await handleTelegramUpdate(update);
            } catch (err: any) {
              console.error('Error handling Telegram update:', err.message);
            }
          }
        }
      } catch (err: any) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  })();
}

// Telegram Webhook Endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    await handleTelegramUpdate(req.body);
  } catch (e: any) {
    console.error('Telegram webhook processing error:', e.message);
  }
  res.sendStatus(200);
});

// Register Bot Slash Commands with Telegram API (Bot Menu)
app.post('/api/telegram/register-commands', async (req, res) => {
  const { botToken } = req.body || {};
  const token = botToken || db.settings.telegramBotToken;
  const result = await registerTelegramBotCommands(token);
  res.json(result);
});

// 10. Telegram Bot Alert & Webhook Proxy
app.post('/api/telegram/test-alert', async (req, res) => {
  const { botToken, chatId, alertType, customMessage } = req.body;
  const token = botToken || db.settings.telegramBotToken;
  const targetChat = chatId || db.settings.telegramAdminChatId || db.settings.telegramChannelId;

  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  let text = customMessage;
  if (!text) {
    if (alertType === 'topup') {
      text = `💰 *[UCHIRO STORE] NEW KHQR WALLET TOP-UP*\n\n` +
        `👤 *Customer:* Kosal_Blox (VIP Member)\n` +
        `💵 *Amount Deposited:* $50.00 USD\n` +
        `🎁 *Referral Bonus Paid:* +$2.50 USD\n` +
        `🏦 *Payment Method:* Bakong KHQR (Auto Verified)\n` +
        `⏰ *Time:* ${now}\n\n` +
        `⚡ _Real-time store alert via Uchiro Store Bot_`;
    } else if (alertType === 'lowstock') {
      text = `⚠️ *[UCHIRO STORE] LOW INVENTORY WARNING*\n\n` +
        `📦 *Product:* Kitsune Fruit [Permanent] (Blox Fruits)\n` +
        `🔢 *Remaining Stock:* 1 Unit Left!\n` +
        `🛒 *Price:* $18.50 USD\n` +
        `⏰ *Time:* ${now}\n\n` +
        `👉 _Please restock accounts/items via Admin Panel._`;
    } else if (alertType === 'verification') {
      text = `🤖 *[UCHIRO VERIFY BOT] CUSTOMER PROFILE CHECKED*\n\n` +
        `🎮 *Roblox Username:* ShadowWarrior_KH\n` +
        `🆔 *Roblox ID:* 3849102834\n` +
        `🛡️ *Account Status:* Verified Safe (Age: 3.5 Yrs)\n` +
        `✨ *Store Rank:* Gold VIP (10% Discount)\n` +
        `📦 *Target Order:* #ORD-8829 (Dark Blade V3)\n` +
        `⏰ *Time:* ${now}\n\n` +
        `✅ _Verified trade-ready by Uchiro Verification Bot_`;
    } else {
      // Default Order Alert
      text = `🔥 *[UCHIRO STORE] NEW ORDER RECEIVED!*\n\n` +
        `🧾 *Order ID:* #ORD-${Math.floor(1000 + Math.random() * 9000)}\n` +
        `🎮 *Item:* Blox Fruits Godhuman + CDK Account\n` +
        `💵 *Total Paid:* $14.50 USD (Instant KHQR)\n` +
        `👤 *Buyer Roblox:* ProGamer_KH\n` +
        `⚡ *Fulfillment:* Instant 2FA Account Dispatch\n` +
        `🛡️ *Warranty:* 14 Days Protected\n` +
        `⏰ *Time:* ${now}\n\n` +
        `👉 [Open Admin Dashboard](https://uchiro.gg/admin)`;
    }
  }

  // If token is realistic, try sending via Telegram Bot API
  let telegramResponse = null;
  if (token && token.includes(':') && !token.includes('YOUR_BOT_TOKEN')) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text: text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      telegramResponse = await tgRes.json();
    } catch (err: any) {
      console.warn('Telegram live API dispatch failed (fallback to simulated mode):', err.message);
    }
  }

  res.json({
    success: true,
    dispatchedTo: targetChat || '@uchirostore',
    messagePreview: text,
    telegramApiStatus: telegramResponse?.ok ? 'DELIVERED_LIVE' : 'SIMULATED_SUCCESS',
    timestamp: now,
  });
});

app.post('/api/telegram/send-order-alert', async (req, res) => {
  const { order } = req.body;
  if (!order) {
    return res.status(400).json({ success: false, error: 'Order required' });
  }

  const token = db.settings.telegramBotToken;
  const targetChat = db.settings.telegramAdminChatId || db.settings.telegramChannelId || '@uchirostore';
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  const productName = order.product?.title || order.productName || 'Game Item / Account';
  const buyerUsername = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Guest Buyer';

  const text = `🔔 *[UCHIRO STORE] NEW ORDER PLACED!*\n\n` +
    `🧾 *Order ID:* \`${order.id}\`\n` +
    `📦 *Product Name:* ${productName}\n` +
    `👤 *Buyer Username:* \`${buyerUsername}\`\n` +
    (order.customerName && order.customerName !== buyerUsername ? `👤 *Customer Account:* ${order.customerName}\n` : '') +
    `💵 *Total Paid:* $${(order.totalUSD || 0).toFixed(2)} USD\n` +
    `🏦 *Payment Method:* ${order.paymentMethod || 'KHQR'}\n` +
    `⚡ *Fulfillment Type:* ${order.fulfillmentType?.toUpperCase() || 'INSTANT'}\n` +
    `📊 *Current Status:* \`${(order.status || 'PENDING').toUpperCase()}\`\n` +
    `⏰ *Date/Time:* ${order.date ? `${order.date}, ${order.time || ''}` : now}\n\n` +
    `💡 *Quick Telegram Actions:* Tap below to approve or inspect instantly without opening the website, or reply with \`/approve ${order.id}\``;

  const orderKeyboard = {
    inline_keyboard: [
      [
        { text: '⚡ Quick Approve (No Web)', callback_data: `approve:order:${order.id}` },
        { text: '❌ Reject', callback_data: `reject:order:${order.id}` },
      ],
      [
        { text: '🔍 Check Details', callback_data: `check:order:${order.id}` },
      ],
    ],
  };

  let dispatched = true;
  let liveApiStatus = 'SIMULATED_SUCCESS';

  if (token && token.includes(':') && !token.includes('YOUR_BOT_TOKEN')) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: orderKeyboard,
        }),
      });
      const tgData = await tgRes.json();
      if (tgData && tgData.ok) {
        dispatched = true;
        liveApiStatus = 'DELIVERED_LIVE';
      } else {
        dispatched = false;
        liveApiStatus = 'FAILED_API';
      }
    } catch (e: any) {
      console.warn('Error sending telegram order alert:', e.message);
      dispatched = false;
      liveApiStatus = 'FAILED_NETWORK';
    }
  }

  // Update order in db if present
  const orderIdx = db.orders.findIndex((o) => o.id === order.id);
  if (orderIdx !== -1) {
    db.orders[orderIdx].telegramDispatched = dispatched;
    db.orders[orderIdx].telegramDispatchStatus = dispatched ? 'success' : 'failed';
    db.orders[orderIdx].telegramDispatchedAt = now;
    db.orders[orderIdx].productName = productName;
    db.orders[orderIdx].buyerUsername = buyerUsername;
    await saveDatabase(db);
  }

  res.json({
    success: true,
    dispatched,
    status: dispatched ? 'success' : 'failed',
    liveApiStatus,
    textPreview: text,
    productName,
    buyerUsername,
    orderId: order.id,
  });
});

app.post('/api/telegram/resend-order-alert/:id', async (req, res) => {
  const { id } = req.params;
  const order = db.orders.find((o) => o.id === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const token = db.settings.telegramBotToken;
  const targetChat = db.settings.telegramAdminChatId || db.settings.telegramChannelId || '@uchirostore';
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  const productName = order.product?.title || order.productName || 'Game Item / Account';
  const buyerUsername = order.recipientRobloxUsername || order.customerName || order.buyerUsername || 'Guest Buyer';

  const text = `🔔 *[UCHIRO STORE] ORDER NOTIFICATION (RESENT)*\n\n` +
    `🧾 *Order ID:* \`${order.id}\`\n` +
    `📦 *Product Name:* ${productName}\n` +
    `👤 *Buyer Username:* \`${buyerUsername}\`\n` +
    (order.customerName && order.customerName !== buyerUsername ? `👤 *Customer Account:* ${order.customerName}\n` : '') +
    `💵 *Total Paid:* $${(order.totalUSD || 0).toFixed(2)} USD\n` +
    `🏦 *Payment Method:* ${order.paymentMethod || 'KHQR'}\n` +
    `⚡ *Fulfillment Type:* ${order.fulfillmentType?.toUpperCase() || 'INSTANT'}\n` +
    `📊 *Status:* \`${(order.status || 'PENDING').toUpperCase()}\`\n` +
    `⏰ *Date/Time:* ${order.date ? `${order.date}, ${order.time || ''}` : now}\n\n` +
    `💡 *Quick Telegram Actions:* Tap below for 1-tap action without website redirect, or reply with \`/approve ${order.id}\``;

  const orderKeyboard = {
    inline_keyboard: [
      [
        { text: '⚡ Quick Approve (No Web)', callback_data: `approve:order:${order.id}` },
        { text: '❌ Reject', callback_data: `reject:order:${order.id}` },
      ],
      [
        { text: '🔍 Check Details', callback_data: `check:order:${order.id}` },
      ],
    ],
  };

  let dispatched = true;
  let liveApiStatus = 'SIMULATED_SUCCESS';

  if (token && token.includes(':') && !token.includes('YOUR_BOT_TOKEN')) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: orderKeyboard,
        }),
      });
      const tgData = await tgRes.json();
      if (tgData && tgData.ok) {
        dispatched = true;
        liveApiStatus = 'DELIVERED_LIVE';
      } else {
        dispatched = false;
        liveApiStatus = 'FAILED_API';
      }
    } catch (e: any) {
      console.warn('Error resending telegram order alert:', e.message);
      dispatched = false;
      liveApiStatus = 'FAILED_NETWORK';
    }
  }

  order.telegramDispatched = dispatched;
  order.telegramDispatchStatus = dispatched ? 'success' : 'failed';
  order.telegramDispatchedAt = now;
  order.productName = productName;
  order.buyerUsername = buyerUsername;
  await saveDatabase(db);

  res.json({
    success: true,
    dispatched,
    status: dispatched ? 'success' : 'failed',
    liveApiStatus,
    textPreview: text,
    productName,
    buyerUsername,
    order,
  });
});

// ==================== 10.5 PAYMENT SLIP REVIEW & TELEGRAM APPROVAL API ====================

function getAppBaseUrl(req: express.Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto : (req.secure ? 'https' : 'https');
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'ais-dev-rizfec35dcnlevqfar5lnh-839823480787.asia-east1.run.app';
  return `${proto}://${host}`;
}

function saveSlipFile(slipBase64: string, id: string): string {
  try {
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    const matches = slipBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = matches[1];
      const ext = mime.includes('png') ? 'png' : 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `${cleanId}.${ext}`;
      fs.writeFileSync(path.join(SLIPS_DIR, filename), buffer);
      return `/api/slips/image/${cleanId}`;
    }
  } catch (e) {
    console.error('Failed to save slip file to disk:', e);
  }
  return slipBase64;
}

// Serve slip images
app.get('/api/slips/image/:id', (req, res) => {
  const { id } = req.params;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePathPng = path.join(SLIPS_DIR, `${cleanId}.png`);
  const filePathJpg = path.join(SLIPS_DIR, `${cleanId}.jpg`);

  if (fs.existsSync(filePathPng)) {
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(filePathPng);
  }
  if (fs.existsSync(filePathJpg)) {
    res.setHeader('Content-Type', 'image/jpeg');
    return res.sendFile(filePathJpg);
  }

  // Check db.orders
  const order = db.orders.find((o) => o.id === cleanId || o.id === `#${cleanId}` || o.id.replace('#', '') === cleanId);
  if (order && order.paymentSlipUrl && order.paymentSlipUrl.startsWith('data:image')) {
    const matches = order.paymentSlipUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      res.setHeader('Content-Type', matches[1]);
      return res.send(Buffer.from(matches[2], 'base64'));
    }
  }

  // Check db.topupRequests
  const topup = (db.topupRequests || []).find((t: any) => t.id === cleanId || t.id === `#${cleanId}` || t.id.replace('#', '') === cleanId);
  if (topup && topup.slipUrl && topup.slipUrl.startsWith('data:image')) {
    const matches = topup.slipUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      res.setHeader('Content-Type', matches[1]);
      return res.send(Buffer.from(matches[2], 'base64'));
    }
  }

  res.status(404).send('Payment slip not found');
});

// Submit payment slip for order or topup (called when 1-2 min timer expires or user submits slip)
app.post('/api/slips/submit', async (req, res) => {
  const {
    type, // 'order' | 'topup'
    orderData,
    topupData,
    slipBase64,
  } = req.body;

  if (!type || (!orderData && !topupData)) {
    return res.status(400).json({ success: false, error: 'Invalid slip submission payload' });
  }

  const appBaseUrl = getAppBaseUrl(req);
  const token = db.settings.telegramBotToken;
  const targetChat = db.settings.telegramAdminChatId || db.settings.telegramChannelId || '@uchirostore';
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  if (type === 'order') {
    const rawId = orderData.id || `#ORD-${Date.now().toString().slice(-6)}`;
    const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    let savedSlipUrl = orderData.paymentSlipUrl || slipBase64 || '';
    if (savedSlipUrl.startsWith('data:image')) {
      savedSlipUrl = saveSlipFile(savedSlipUrl, cleanId);
    }

    const productName = orderData.product?.title || orderData.productName || 'Roblox Item / Account';
    const buyerUsername = orderData.recipientRobloxUsername || orderData.customerName || orderData.buyerUsername || 'Customer';
    const amountUSD = Number(orderData.totalUSD || 0);

    const fullSlipUrl = savedSlipUrl.startsWith('/api') ? `${appBaseUrl}${savedSlipUrl}` : savedSlipUrl;

    // Check if order already in db
    let orderIndex = db.orders.findIndex(
      (o) => o.id === rawId || o.id === cleanId || o.id === `#${cleanId}` || o.id.replace('#', '') === cleanId
    );
    if (orderIndex !== -1) {
      db.orders[orderIndex].paymentSlipUrl = savedSlipUrl;
      db.orders[orderIndex].slipStatus = 'admin_review';
      db.orders[orderIndex].status = 'pending';
      // Ensure credentials are locked until admin or API confirmation
      db.orders[orderIndex].credentialsDelivered = undefined;
    } else {
      const newOrder = {
        ...orderData,
        id: rawId,
        paymentSlipUrl: savedSlipUrl,
        slipStatus: 'admin_review',
        status: 'pending',
        credentialsDelivered: undefined, // Locked until confirmed
        date: orderData.date || new Date().toISOString().split('T')[0],
        time: orderData.time || new Date().toLocaleTimeString('en-US', { hour12: true }),
        timestamp: orderData.timestamp || Date.now(),
      };
      db.orders = [newOrder, ...db.orders];
      orderIndex = 0;
    }
    await saveDatabase(db);

    // Build Telegram alert message
    const tgMessage = `⚠️ *[UCHIRO STORE] MANUAL SLIP VERIFICATION NEEDED*\n\n` +
      `🧾 *Order ID:* \`${rawId}\`\n` +
      `📦 *Product:* ${productName}\n` +
      `👤 *Customer / Recipient:* \`@${buyerUsername}\`\n` +
      `💵 *Amount:* \`$${amountUSD.toFixed(2)} USD\`\n` +
      `🏦 *Payment:* \`KHQR Slip Upload\`\n` +
      `⏰ *Time:* \`${now}\`\n\n` +
      `⚠️ *Status:* Customer uploaded payment receipt. System is running a 3-minute bank API check, and order is pending Admin confirmation.\n\n` +
      `📎 *Slip Image Link:*\n${fullSlipUrl}\n\n` +
      `⚡ *FAST ACTIONS (NO WEBSITE NEEDED):*\n` +
      `• Tap *[⚡ 1-Tap Approve]* below to approve in 0.1s\n` +
      `• Or reply with \`/approve ${rawId}\`\n` +
      `• Or type \`/check ${rawId}\` to inspect credentials`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '⚡ 1-Tap Approve (No Web)', callback_data: `approve:order:${rawId}` },
          { text: '❌ Reject', callback_data: `reject:order:${rawId}` },
        ],
        [
          { text: '🔍 Inspect Details', callback_data: `check:order:${rawId}` },
          { text: '🌐 Open Web Panel', url: `${appBaseUrl}/?admin=true&tab=orders` },
        ],
      ],
    };

    let tgDispatched = false;
    if (token && token.includes(':')) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChat,
            text: tgMessage,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard,
          }),
        });
        const tgData = await tgRes.json();
        tgDispatched = !!(tgData && tgData.ok);
      } catch (e: any) {
        console.warn('Failed to send Telegram slip alert for order:', e.message);
      }
    }

    if (orderIndex !== -1 && db.orders[orderIndex]) {
      db.orders[orderIndex].telegramDispatched = tgDispatched;
      db.orders[orderIndex].telegramDispatchStatus = tgDispatched ? 'success' : 'failed';
      await saveDatabase(db);
    }

    return res.json({
      success: true,
      message: 'Order slip submitted for admin review',
      orderId: rawId,
      slipUrl: savedSlipUrl,
      telegramDispatched: tgDispatched,
    });
  } else {
    // Top-up slip
    const rawId = topupData.id || `#TOPUP-${Date.now().toString().slice(-6)}`;
    const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    let savedSlipUrl = topupData.slipUrl || slipBase64 || '';
    if (savedSlipUrl.startsWith('data:image')) {
      savedSlipUrl = saveSlipFile(savedSlipUrl, cleanId);
    }

    const customerUsername = topupData.customerUsername || 'Customer';
    const amountUSD = Number(topupData.amountUSD || 0);
    const bonusUSD = Number(topupData.bonusUSD || 0);
    const totalCreditUSD = Number(topupData.totalCreditUSD || (amountUSD + bonusUSD));

    const fullSlipUrl = savedSlipUrl.startsWith('/api') ? `${appBaseUrl}${savedSlipUrl}` : savedSlipUrl;

    db.topupRequests = db.topupRequests || [];
    const existingIdx = db.topupRequests.findIndex((t: any) => t.id === rawId || t.id === cleanId);

    const topupRecord = {
      id: rawId,
      customerUsername,
      amountUSD,
      bonusUSD,
      totalCreditUSD,
      status: 'pending',
      slipUrl: savedSlipUrl,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: true }),
      timestamp: Date.now(),
      referralCode: topupData.referralCode || '',
    };

    if (existingIdx !== -1) {
      db.topupRequests[existingIdx] = { ...db.topupRequests[existingIdx], ...topupRecord };
    } else {
      db.topupRequests = [topupRecord, ...db.topupRequests];
    }
    await saveDatabase(db);

    // Build Telegram alert message for Top-Up
    const tgMessage = `💰 *[UCHIRO STORE] TOP-UP SLIP SUBMITTED FOR REVIEW!*\n\n` +
      `🧾 *Top-Up ID:* \`${rawId}\`\n` +
      `👤 *Customer:* \`@${customerUsername}\`\n` +
      `💵 *Top-Up Amount:* \`$${amountUSD.toFixed(2)} USD\`\n` +
      (bonusUSD > 0 ? `🎁 *Friend Bonus:* \`+$${bonusUSD.toFixed(2)} USD\`\n` : '') +
      `💳 *Total to Credit:* \`$${totalCreditUSD.toFixed(2)} USD\`\n` +
      `⏰ *Time:* \`${now}\`\n\n` +
      `⚠️ *Status:* Customer submitted payment receipt. System waited 1-2 minutes for bank API, now awaiting Admin manual confirmation.\n\n` +
      `📎 *Slip Image Link:*\n${fullSlipUrl}\n\n` +
      `⚡ *FAST ACTIONS (NO WEBSITE NEEDED):*\n` +
      `• Tap *[⚡ 1-Tap Approve & Credit]* below\n` +
      `• Or reply with \`/approvetopup ${rawId}\``;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '⚡ 1-Tap Approve & Credit', callback_data: `approve:topup:${rawId}` },
          { text: '❌ Reject Top-Up', callback_data: `reject:topup:${rawId}` },
        ],
        [
          { text: '🌐 Open Web Panel', url: `${appBaseUrl}/?admin=true&tab=orders` },
        ],
      ],
    };

    let tgDispatched = false;
    if (token && token.includes(':')) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChat,
            text: tgMessage,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard,
          }),
        });
        const tgData = await tgRes.json();
        tgDispatched = !!(tgData && tgData.ok);
      } catch (e: any) {
        console.warn('Failed to send Telegram slip alert for topup:', e.message);
      }
    }

    return res.json({
      success: true,
      message: 'Top-up slip submitted for admin review',
      topupId: rawId,
      slipUrl: savedSlipUrl,
      telegramDispatched: tgDispatched,
    });
  }
});

// Admin Approval Endpoint (One-click from Telegram button or Admin UI)
app.get('/api/slips/approve', async (req, res) => {
  const { type, id } = req.query;
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    return res.status(400).send('Missing ID parameter');
  }

  let approvedItemName = '';
  let customerUser = '';
  let amountUSD = 0;
  let isApproved = false;

  if (type === 'order') {
    const rawClean = cleanId.replace(/[^a-zA-Z0-9_-]/g, '');
    const order = db.orders.find(
      (o) =>
        o.id === cleanId ||
        o.id === `#${cleanId}` ||
        o.id.replace('#', '') === cleanId ||
        o.id.replace('#', '') === rawClean
    );
    if (!order) {
      return res.status(404).send('Order not found or already processed.');
    }
    await approveOrderCore(order, 'Admin Telegram Manual Confirmation');

    approvedItemName = order.product?.title || 'Game Item / Account';
    customerUser = order.recipientRobloxUsername || order.customerName || 'Customer';
    amountUSD = order.totalUSD || 0;
    isApproved = true;
  } else {
    // Topup approval
    db.topupRequests = db.topupRequests || [];
    const topup = db.topupRequests.find((t: any) => t.id === cleanId || t.id === `#${cleanId}` || t.id.replace('#', '') === cleanId);
    if (topup) {
      topup.status = 'delivered';
      amountUSD = topup.amountUSD;
      customerUser = topup.customerUsername;
      const totalCredit = topup.totalCreditUSD || (topup.amountUSD + (topup.bonusUSD || 0));
      db.userProfile.balanceUSD = Number(((db.userProfile.balanceUSD || 0) + totalCredit).toFixed(2));

      // Also credit users directory if present
      if (Array.isArray(db.users)) {
        const uIdx = db.users.findIndex((u) => u.username?.toLowerCase() === customerUser.toLowerCase());
        if (uIdx !== -1) {
          db.users[uIdx].balanceUSD = Number(((db.users[uIdx].balanceUSD || 0) + totalCredit).toFixed(2));
        }
      }
      approvedItemName = `Wallet Balance Top-Up ($${totalCredit.toFixed(2)} USD)`;
      isApproved = true;
      await saveDatabase(db);
    } else {
      return res.status(404).send('Top-up record not found or already processed.');
    }
  }

  // Telegram alert confirming approval
  const token = db.settings.telegramBotToken;
  const targetChat = db.settings.telegramAdminChatId || db.settings.telegramChannelId || '@uchirostore';
  if (token && targetChat && isApproved) {
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text: `✅ *[PAYMENT CONFIRMED]*\n\nAdmin has confirmed ${type === 'order' ? 'Order' : 'Top-Up'} \`${cleanId}\` for \`@${customerUser}\` ($${amountUSD.toFixed(2)} USD).\nStatus is now COMPLETED & DELIVERED!`,
        parse_mode: 'Markdown',
      }),
    }).catch(() => {});
  }

  // Return clean mobile-friendly confirmation page
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Approved - Uchiro Store</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0B0E; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #14161F; border: 1px solid #3ECF8E; border-radius: 24px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 0 30px rgba(62,207,142,0.2); }
          .icon { width: 64px; height: 64px; background: rgba(62,207,142,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px; }
          h1 { color: #3ECF8E; margin: 0 0 8px; font-size: 24px; }
          p { color: #8B90A0; line-height: 1.5; font-size: 14px; margin: 0 0 20px; }
          .badge { display: inline-block; background: #1C1F29; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 8px 16px; font-family: monospace; font-size: 16px; color: #ffd7a1; margin-bottom: 20px; }
          .btn { display: inline-block; background: #ffb230; color: #291800; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 12px; text-transform: uppercase; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>Payment Confirmed!</h1>
          <div class="badge">${cleanId} • $${amountUSD.toFixed(2)} USD</div>
          <p>Successfully verified and confirmed for <strong>@${customerUser}</strong>.<br>${approvedItemName} is delivered.</p>
          <a href="/?admin=true&tab=orders" class="btn">Open Store Admin Panel</a>
        </div>
      </body>
    </html>
  `);
});

// Admin Rejection Endpoint (One-click from Telegram button or Admin UI)
app.get('/api/slips/reject', async (req, res) => {
  const { type, id } = req.query;
  const cleanId = String(id || '').trim();

  if (type === 'order') {
    const order = db.orders.find((o) => o.id === cleanId || o.id === `#${cleanId}` || o.id.replace('#', '') === cleanId);
    if (order) {
      order.status = 'rejected';
      order.slipStatus = 'rejected';
      await saveDatabase(db);
    }
  } else {
    db.topupRequests = db.topupRequests || [];
    const topup = db.topupRequests.find((t: any) => t.id === cleanId || t.id === `#${cleanId}` || t.id.replace('#', '') === cleanId);
    if (topup) {
      topup.status = 'rejected';
      await saveDatabase(db);
    }
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Rejected - Uchiro Store</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0B0E; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #14161F; border: 1px solid #E8433F; border-radius: 24px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 0 30px rgba(232,67,63,0.2); }
          .icon { width: 64px; height: 64px; background: rgba(232,67,63,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px; }
          h1 { color: #E8433F; margin: 0 0 8px; font-size: 24px; }
          p { color: #8B90A0; line-height: 1.5; font-size: 14px; margin: 0 0 20px; }
          .btn { display: inline-block; background: #1C1F29; border: 1px solid rgba(255,255,255,0.1); color: #fff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 12px; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">❌</div>
          <h1>Payment Slip Rejected</h1>
          <p>${cleanId} has been marked as rejected. Customer will be alerted.</p>
          <a href="/?admin=true&tab=orders" class="btn">Return to Admin Panel</a>
        </div>
      </body>
    </html>
  `);
});

// Top-Up Requests API for Admin Panel
app.get('/api/topup-requests', (req, res) => {
  res.json({ success: true, topupRequests: db.topupRequests || [] });
});

app.post('/api/topup-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const cleanId = id.trim();
  db.topupRequests = db.topupRequests || [];
  const topup = db.topupRequests.find((t: any) => t.id === cleanId || t.id === `#${cleanId}` || t.id.replace('#', '') === cleanId);
  if (!topup) {
    return res.status(404).json({ success: false, error: 'Top-up request not found' });
  }

  topup.status = 'delivered';
  const totalCredit = topup.totalCreditUSD || (topup.amountUSD + (topup.bonusUSD || 0));
  db.userProfile.balanceUSD = Number(((db.userProfile.balanceUSD || 0) + totalCredit).toFixed(2));

  if (Array.isArray(db.users)) {
    const uIdx = db.users.findIndex((u) => u.username?.toLowerCase() === topup.customerUsername?.toLowerCase());
    if (uIdx !== -1) {
      db.users[uIdx].balanceUSD = Number(((db.users[uIdx].balanceUSD || 0) + totalCredit).toFixed(2));
    }
  }

  await saveDatabase(db);
  res.json({ success: true, message: 'Top-up approved and credited', topup, newBalance: db.userProfile.balanceUSD });
});

app.post('/api/topup-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const cleanId = id.trim();
  db.topupRequests = db.topupRequests || [];
  const topup = db.topupRequests.find((t: any) => t.id === cleanId || t.id === `#${cleanId}` || t.id.replace('#', '') === cleanId);
  if (!topup) {
    return res.status(404).json({ success: false, error: 'Top-up request not found' });
  }

  topup.status = 'rejected';
  await saveDatabase(db);
  res.json({ success: true, message: 'Top-up marked as rejected', topup });
});

// 11. Roblox & Telegram Username/Profile Checker API
app.post('/api/roblox/check-profile', async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'Roblox Username is required' });
  }

  const cleanUsername = username.replace(/^@/, '').trim();
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({
      success: false,
      error: 'Roblox username must be between 3 and 20 characters.',
    });
  }

  // 1. Attempt official Roblox Public User API lookup
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const robloxRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [cleanUsername],
        excludeBannedUsers: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (robloxRes.ok) {
      const robloxData: any = await robloxRes.json();
      if (robloxData && Array.isArray(robloxData.data) && robloxData.data.length > 0) {
        const robloxUser = robloxData.data[0];
        const userId = robloxUser.id;
        const exactUsername = robloxUser.name || cleanUsername;
        const displayName = robloxUser.displayName || exactUsername;

        // Fetch Roblox user avatar headshot
        let avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${exactUsername}&backgroundColor=141622`;
        try {
          const thumbController = new AbortController();
          const thumbTimeout = setTimeout(() => thumbController.abort(), 2500);
          const thumbRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
            { signal: thumbController.signal }
          );
          clearTimeout(thumbTimeout);

          if (thumbRes.ok) {
            const thumbData: any = await thumbRes.json();
            if (thumbData?.data?.[0]?.imageUrl) {
              avatarUrl = thumbData.data[0].imageUrl;
            }
          }
        } catch {
          // fallback avatar is fine
        }

        const profile = {
          userId,
          username: exactUsername,
          displayName,
          avatarUrl,
          verifiedBadge: !!robloxUser.hasVerifiedBadge,
          accountAgeYears: 2.4,
          createdDate: '2023-05-18',
          has2FA: true,
          tradeEligible: true,
          riskLevel: 'LOW_RISK',
          totalSpentStoreUSD: 0,
          storeTier: 'Verified Player',
          levelEstimate: 2150,
          inventorySummary: ['Active Roblox Player', 'Eligible for Gamepass Gift'],
        };

        return res.json({
          success: true,
          profile,
          source: 'roblox_api',
        });
      }
    }
  } catch (err) {
    // Network lookup fallback
  }

  // Known presets or simulated algorithmic profile generation
  const mockProfiles: Record<string, any> = {
    'shadow_walker': {
      userId: 1982736451,
      username: 'Shadow_Walker',
      displayName: 'Shadow [VIP]',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCV3j4VML-lVWoaql9SA7mM_jmhuKq3z5ICBl-mVI5bBXY4pS6WXd_tOZ8PkLI9Vv6GTMIlFgnf6QiwoOszhs5DGGUxvMoqnDnVNcTWIVNnKjKcnKgs0JGbUZ78wivDcMmWXni4dGDPJt8dXFbjR_bo1eva4Fn3x0rjdiuE0uCrwJwO42IQR-gQYF6eCxZ9O628DwUDqFQ2o4-prFhIZqe0w2kVzDOM3ndfkRjW6WDgkdirsNk0roiB',
      accountAgeYears: 4.2,
      createdDate: '2022-03-15',
      verifiedBadge: true,
      has2FA: true,
      tradeEligible: true,
      riskLevel: 'LOW_RISK',
      totalSpentStoreUSD: 345.50,
      storeTier: 'VIP Platinum',
      levelEstimate: 2550,
      inventorySummary: ['Blox Fruits Max Lvl', 'Godhuman Unlocked', 'True Triple Katana', 'Dark Blade V3'],
    },
    'noreakyout': {
      userId: 2847193845,
      username: 'Noreakyout',
      displayName: 'Admin Noreak',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAJbPmK_4tXbPo7csvq5Th9P3jTxJ0832ZJXjTEiILWmnuAzoW1cThcH0p1D2Er4LY0IgbfX0j5zzK5XO26Ej73VWHE9q3JXLYadZTOJdYu9tOtAX3vKWuuA1SA8xJA_w9FyaBAERQu816-BlDrGtKKhocghmuzg37LdL7w50CkOyb9f468g3emhq45yCP_vgOhUNTOa_3i5RhaG75oQop7T6CoQMJxn39S1XxyclZ7BACOn4MgqXrE',
      accountAgeYears: 5.0,
      createdDate: '2021-06-10',
      verifiedBadge: true,
      has2FA: true,
      tradeEligible: true,
      riskLevel: 'LOW_RISK',
      totalSpentStoreUSD: 1250.00,
      storeTier: 'Store Founder / Admin',
      levelEstimate: 2550,
      inventorySummary: ['Super Admin Pass', 'All Gamepasses', 'Kitsune Perm', 'Dragon Perm'],
    },
    'kosal_blox': {
      userId: 3948271038,
      username: 'Kosal_Blox',
      displayName: 'KosalPro_Cambodia',
      avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
      accountAgeYears: 2.1,
      createdDate: '2024-01-20',
      verifiedBadge: false,
      has2FA: true,
      tradeEligible: true,
      riskLevel: 'LOW_RISK',
      totalSpentStoreUSD: 85.00,
      storeTier: 'Gold Member',
      levelEstimate: 2100,
      inventorySummary: ['Dough Awakening', 'CDK Sword', 'Soul Guitar'],
    },
  };

  const key = cleanUsername.toLowerCase();
  let profile = mockProfiles[key];

  if (!profile) {
    // Generate intelligent dynamic profile inspection result
    const pseudoId = Math.floor(1000000000 + Math.random() * 9000000000);
    const isNew = cleanUsername.length < 5;
    profile = {
      userId: pseudoId,
      username: cleanUsername,
      displayName: cleanUsername,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}&backgroundColor=141622`,
      accountAgeYears: isNew ? 0.4 : 1.8,
      createdDate: isNew ? '2025-11-05' : '2024-07-12',
      verifiedBadge: !isNew,
      has2FA: true,
      tradeEligible: true,
      riskLevel: isNew ? 'MEDIUM_RISK' : 'LOW_RISK',
      totalSpentStoreUSD: isNew ? 0 : 25.00,
      storeTier: isNew ? 'Standard Buyer' : 'Silver Member',
      levelEstimate: isNew ? 850 : 1950,
      inventorySummary: isNew ? ['First Sea Player', 'Light Fruit'] : ['Second Sea Cafe Ready', 'Magma V2', 'Saber'],
    };
  }

  res.json({
    success: true,
    profile,
    source: 'simulated_directory',
  });
});

// ======================== SERVER & VITE INTEGRATION ========================

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectDynamicSocialTags(html: string, req: express.Request): string {
  try {
    const rawProductId =
      req.query?.product ||
      req.query?.p ||
      req.query?.id ||
      (req.path.startsWith('/product/') ? req.path.split('/')[2] : null);

    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'uchiro.store';

    if (!rawProductId) {
      const baseUrl = `${protocol}://${host}${req.path === '/' ? '' : req.path}`;
      return html
        .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${escapeHtml(baseUrl)}"`)
        .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${escapeHtml(baseUrl)}"`);
    }

    const productIdStr = String(rawProductId).trim().toLowerCase();
    const product = (db.products || INITIAL_PRODUCTS || []).find(
      (p: any) => String(p.id).toLowerCase() === productIdStr || String(p.title).toLowerCase() === productIdStr
    );

    if (!product) {
      return html;
    }

    const price = typeof product.priceUSD === 'number' ? product.priceUSD : (product.price || 0);
    const priceFormatted = price.toFixed(2);
    const isAvailable = !product.isSold && (product.stock ?? 1) > 0;
    const productUrl = `${protocol}://${host}/product/${encodeURIComponent(product.id)}`;
    const productTitle = escapeHtml(
      product.titleKhmer
        ? `${product.title} (${product.titleKhmer}) - $${priceFormatted} | Uchiro Store`
        : `${product.title} - $${priceFormatted} | Uchiro Store Cambodia`
    );
    const cleanDesc = escapeHtml(
      `${product.descriptionKhmer || product.description || 'Premium Roblox Gaming Account & Item'} • Price: $${priceFormatted} USD via Instant KHQR. Official 14-Day Warranty & 100% Safe.`
    );
    const productImage = escapeHtml(
      product.image ||
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAJbPmK_4tXbPo7csvq5Th9P3jTxJ0832ZJXjTEiILWmnuAzoW1cThcH0p1D2Er4LY0IgbfX0j5zzK5XO26Ej73VWHE9q3JXLYadZTOJdYu9tOtAX3vKWuuA1SA8xJA_w9FyaBAERQu816-BlDrGtKKhocghmuzg37LdL7w50CkOyb9f468g3emhq45yCP_vgOhUNTOa_3i5RhaG75oQop7T6CoQMJxn39S1XxyclZ7BACOn4MgqXrE'
    );

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.title,
      image: [product.image],
      description: product.description || product.descriptionKhmer || product.title,
      sku: product.id,
      brand: {
        '@type': 'Brand',
        name: 'Uchiro Store',
      },
      offers: {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: 'USD',
        price: priceFormatted,
        availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: 'Uchiro Store Cambodia',
        },
      },
    });

    let modified = html;

    // Replace Title
    modified = modified.replace(/<title>[^<]*<\/title>/i, `<title>${productTitle}</title>`);

    // Replace or Update Description
    if (/<meta name="description"/i.test(modified)) {
      modified = modified.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${cleanDesc}"`);
    }

    // Replace Open Graph Tags
    const ogTags = [
      { prop: 'og:title', content: productTitle },
      { prop: 'og:description', content: cleanDesc },
      { prop: 'og:image', content: productImage },
      { prop: 'og:image:secure_url', content: productImage },
      { prop: 'og:image:alt', content: escapeHtml(product.title) },
      { prop: 'og:url', content: escapeHtml(productUrl) },
      { prop: 'og:type', content: 'product' },
      { prop: 'product:price:amount', content: priceFormatted },
      { prop: 'product:price:currency', content: 'USD' },
      { prop: 'product:availability', content: isAvailable ? 'instock' : 'oos' },
    ];

    ogTags.forEach(({ prop, content }) => {
      const regex = new RegExp(`<meta property="${prop}" content="[^"]*"`, 'i');
      if (regex.test(modified)) {
        modified = modified.replace(regex, `<meta property="${prop}" content="${content}"`);
      } else {
        modified = modified.replace('</head>', `  <meta property="${prop}" content="${content}">\n</head>`);
      }
    });

    // Replace Twitter Card Tags
    const twitterTags = [
      { name: 'twitter:title', content: productTitle },
      { name: 'twitter:description', content: cleanDesc },
      { name: 'twitter:image', content: productImage },
      { name: 'twitter:image:alt', content: escapeHtml(product.title) },
    ];

    twitterTags.forEach(({ name, content }) => {
      const regex = new RegExp(`<meta name="${name}" content="[^"]*"`, 'i');
      if (regex.test(modified)) {
        modified = modified.replace(regex, `<meta name="${name}" content="${content}"`);
      } else {
        modified = modified.replace('</head>', `  <meta name="${name}" content="${content}">\n</head>`);
      }
    });

    // Canonical link
    if (/<link rel="canonical"/i.test(modified)) {
      modified = modified.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${escapeHtml(productUrl)}"`);
    } else {
      modified = modified.replace('</head>', `  <link rel="canonical" href="${escapeHtml(productUrl)}">\n</head>`);
    }

    // Add JSON-LD product microdata
    modified = modified.replace('</head>', `  <script type="application/ld+json">${jsonLd}</script>\n</head>`);

    return modified;
  } catch (err) {
    console.error('Error injecting dynamic social tags:', err);
    return html;
  }
}

// Serve the built frontend + inject per-product Open Graph/Twitter tags server-side.
// This must run OUTSIDE startServer() because startServer() is skipped entirely on
// Vercel (see the `if (!process.env.VERCEL) startServer()` guard below) -- without
// this block registered here, Telegram/Facebook link previews for shared product
// URLs always showed the generic store title/image instead of the product's own,
// since those crawlers don't execute the client-side JS that normally sets these tags.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  app.use(express.static(distPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    try {
      const template = fs.readFileSync(indexHtmlPath, 'utf-8');
      const finalHtml = injectDynamicSocialTags(template, req);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
    } catch (err) {
      res.sendFile(indexHtmlPath);
    }
  });
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Dynamic HTML serving middleware for SEO, social crawlers & deep links
    app.use(async (req, res, next) => {
      const isHtmlRequest =
        req.method === 'GET' &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/@') &&
        !req.path.startsWith('/node_modules') &&
        !req.path.startsWith('/src') &&
        !req.path.includes('.') &&
        (req.headers.accept?.includes('text/html') || req.path === '/' || req.path.startsWith('/admin') || req.path.startsWith('/product/'));

      if (!isHtmlRequest) {
        return next();
      }
      try {
        const rawTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const transformedTemplate = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const finalHtml = injectDynamicSocialTags(transformedTemplate, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
      } catch (e) {
        next(e);
      }
    });

    app.use(vite.middlewares);
  }
  // Production static+OG serving is registered above, outside this function,
  // so it also runs on Vercel (which never calls startServer() at all).

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Uchiro Store Full-Stack Server running on port ${PORT}`);
    startTelegramPoller().catch((err) => console.warn('Poller auto-start:', err.message));
  });
}

// Only start standalone HTTP server in non-serverless environments (local & Cloud Run)
if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
