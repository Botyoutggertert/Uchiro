import express from 'express';
import crypto from 'crypto';

export interface SecurityOptions {
  action?: 'login' | 'order_create' | 'admin_login' | 'register' | 'payment_slip' | 'api' | string;
  maxRequests?: number;
  windowMs?: number;
  blockDurationMs?: number;
  checkSuspiciousPatterns?: boolean;
  burstThreshold?: number;
  burstWindowMs?: number;
}

export interface SecurityCheckResult {
  allowed: boolean;
  statusCode?: number;
  rateLimited?: boolean;
  blocked?: boolean;
  reason?: string;
  error?: string;
  remaining?: number;
  remainingSeconds?: number;
  retryAfterSeconds?: number;
  incidentId?: string;
  threatScore?: number;
  action?: string;
  clientIp?: string;
}

export interface SecurityIncident {
  id: string;
  timestamp: number;
  clientIp: string;
  action: string;
  reason: string;
  path: string;
  method: string;
  userAgent?: string;
  blockedUntil: number;
  threatScore: number;
}

export interface IpSecurityProfile {
  ip: string;
  firstSeen: number;
  lastSeen: number;
  totalRequests: number;
  actionTimestamps: Map<string, number[]>;
  actionBlocks: Map<string, number>;
  blockedUntil: number;
  blockReason: string;
  lastIncidentId?: string;
  failedAuthAttempts: number;
  suspiciousHits: number;
  recentTargetUsernames: Set<string>;
  threatScore: number;
}

// Global in-memory storage for IP security profiles and incident logs
const ipSecurityProfiles = new Map<string, IpSecurityProfile>();
const securityIncidents: SecurityIncident[] = [];
const MAX_INCIDENTS_STORED = 250;

// Malicious patterns & scanner signatures
const SUSPICIOUS_PATH_PATTERNS = [
  /\.\.\//,                  // Path traversal
  /\.\.%2f/i,                // Encoded path traversal
  /%2e%2e/i,                 // Encoded dots
  /\.env($|\?|\/)/i,         // Environment files
  /\.git($|\/)/i,            // Git repository
  /wp-admin|wp-login|xmlrpc/i, // WordPress probes
  /phpinfo|pma|phpmyadmin/i, // PHPMyAdmin / info probes
  /\/proc\/self/i,           // Linux proc probing
  /\/etc\/passwd/i,          // Passwd probe
  /actuator|swagger-ui/i,    // Unprotected actuator probes
  /\.aws\//i,                // AWS credentials probe
  /id_rsa/i,                 // SSH key probe
  /shell\.php|eval-stdin/i,  // Web shell probe
];

const SUSPICIOUS_QUERY_PATTERNS = [
  /<script\b[^>]*>/i,        // XSS script tags
  /javascript:/i,            // Javascript URI
  /onerror\s*=/i,            // Event handler injection
  /union\s+select/i,         // SQL Injection UNION SELECT
  /'\s*or\s*'1'\s*=\s*'1/i,  // SQL Injection 1=1
  /benchmark\s*\(|sleep\s*\(/i, // SQL Time-based blind injection
  /select\s+.*\s+from/i,     // SQL SELECT FROM
];

export function getSafeClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export class SecurityManager {
  private static defaultOptions: Record<string, SecurityOptions> = {
    login: {
      action: 'login',
      maxRequests: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000, // 5 min lockout
      burstThreshold: 3,
      burstWindowMs: 5 * 1000,
      checkSuspiciousPatterns: true,
    },
    admin_login: {
      action: 'admin_login',
      maxRequests: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000, // 5 min lockout
      burstThreshold: 2,
      burstWindowMs: 4 * 1000,
      checkSuspiciousPatterns: true,
    },
    order_create: {
      action: 'order_create',
      maxRequests: 8,
      windowMs: 60 * 1000,
      blockDurationMs: 45 * 1000, // 45 sec cooldown
      burstThreshold: 3,
      burstWindowMs: 6 * 1000,
      checkSuspiciousPatterns: true,
    },
    payment_slip: {
      action: 'payment_slip',
      maxRequests: 6,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
      burstThreshold: 2,
      burstWindowMs: 5 * 1000,
      checkSuspiciousPatterns: true,
    },
    register: {
      action: 'register',
      maxRequests: 4,
      windowMs: 60 * 1000,
      blockDurationMs: 3 * 60 * 1000,
      burstThreshold: 2,
      burstWindowMs: 5 * 1000,
      checkSuspiciousPatterns: true,
    },
    api: {
      action: 'api',
      maxRequests: 120,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
      burstThreshold: 25,
      burstWindowMs: 2 * 1000,
      checkSuspiciousPatterns: true,
    },
  };

  /**
   * Get or initialize the profile for a client IP
   */
  static getProfile(ip: string): IpSecurityProfile {
    let profile = ipSecurityProfiles.get(ip);
    const now = Date.now();
    if (!profile) {
      profile = {
        ip,
        firstSeen: now,
        lastSeen: now,
        totalRequests: 0,
        actionTimestamps: new Map(),
        actionBlocks: new Map(),
        blockedUntil: 0,
        blockReason: '',
        failedAuthAttempts: 0,
        suspiciousHits: 0,
        recentTargetUsernames: new Set(),
        threatScore: 0,
      };
      ipSecurityProfiles.set(ip, profile);
    }
    profile.lastSeen = now;
    return profile;
  }

  /**
   * Detect suspicious patterns in URLs, query strings, and bodies
   */
  static inspectSuspiciousPattern(req: express.Request): { detected: boolean; reason?: string; threatIncrement?: number } {
    const rawUrl = req.originalUrl || req.url || '';
    const rawPath = req.path || '';

    // 1. Path scanner detection
    for (const pattern of SUSPICIOUS_PATH_PATTERNS) {
      if (pattern.test(rawUrl) || pattern.test(rawPath)) {
        return {
          detected: true,
          reason: `Malicious scanner probe detected: pattern ${pattern.toString()} in path`,
          threatIncrement: 45,
        };
      }
    }

    // 2. Query string injection check
    const queryStr = decodeURIComponent(req.url.split('?')[1] || '');
    if (queryStr) {
      for (const pattern of SUSPICIOUS_QUERY_PATTERNS) {
        if (pattern.test(queryStr)) {
          return {
            detected: true,
            reason: `Malicious injection signature in query parameters: ${pattern.toString()}`,
            threatIncrement: 50,
          };
        }
      }
    }

    // 3. User-Agent Scanner / Bot Signature
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const maliciousAgents = ['sqlmap', 'nikto', 'dirbuster', 'gobuster', 'masscan', 'acunetix', 'wpscan', 'nmap'];
    for (const bot of maliciousAgents) {
      if (userAgent.includes(bot)) {
        return {
          detected: true,
          reason: `Automated vulnerability scanner user-agent: ${bot}`,
          threatIncrement: 60,
        };
      }
    }

    // 4. Request Body Inspection (for SQLi / XSS string probes)
    if (req.body && typeof req.body === 'object') {
      try {
        const bodyText = JSON.stringify(req.body);
        for (const pattern of SUSPICIOUS_QUERY_PATTERNS) {
          if (pattern.test(bodyText)) {
            return {
              detected: true,
              reason: `Malicious injection payload in request body`,
              threatIncrement: 50,
            };
          }
        }
      } catch {
        // Ignore JSON stringify errors
      }
    }

    return { detected: false };
  }

  /**
   * Log an official security incident and record in audit buffer
   */
  static logIncident(
    ip: string,
    action: string,
    reason: string,
    req: express.Request,
    blockedUntil: number,
    threatScore: number
  ): SecurityIncident {
    const incident: SecurityIncident = {
      id: `SEC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      timestamp: Date.now(),
      clientIp: ip,
      action,
      reason,
      path: req.originalUrl || req.url || 'unknown',
      method: req.method,
      userAgent: req.headers['user-agent'] as string,
      blockedUntil,
      threatScore,
    };

    securityIncidents.unshift(incident);
    if (securityIncidents.length > MAX_INCIDENTS_STORED) {
      securityIncidents.pop();
    }

    console.warn(`[Security Alert] IP ${ip} blocked! Reason: ${reason} (Incident ID: ${incident.id})`);
    return incident;
  }

  /**
   * Check request frequency and evaluate whether to allow or block
   */
  static check(
    req: express.Request,
    actionName?: string,
    customOptions?: SecurityOptions
  ): SecurityCheckResult {
    const ip = getSafeClientIp(req);
    const now = Date.now();
    const profile = this.getProfile(ip);
    profile.totalRequests++;

    const action = actionName || customOptions?.action || 'api';
    const config: SecurityOptions = {
      ...(this.defaultOptions[action] || this.defaultOptions['api']),
      ...customOptions,
    };

    // 1. Global IP Block / Quarantine Check
    if (profile.blockedUntil > now) {
      const remainingSeconds = Math.max(1, Math.ceil((profile.blockedUntil - now) / 1000));
      return {
        allowed: false,
        statusCode: 429,
        rateLimited: true,
        blocked: true,
        action,
        clientIp: ip,
        remainingSeconds,
        retryAfterSeconds: remainingSeconds,
        reason: profile.blockReason || 'IP quarantined due to suspicious traffic patterns',
        error: `Security Defense Active: Your IP is temporarily restricted. Please retry in ${remainingSeconds}s.`,
        incidentId: profile.lastIncidentId,
        threatScore: profile.threatScore,
      };
    }

    // 2. Action-Specific Cooldown Block Check (e.g. order cooldown or login lockout)
    const actionBlockedUntil = profile.actionBlocks.get(action) || 0;
    if (actionBlockedUntil > now) {
      const remainingSeconds = Math.max(1, Math.ceil((actionBlockedUntil - now) / 1000));
      return {
        allowed: false,
        statusCode: 429,
        rateLimited: true,
        blocked: true,
        action,
        clientIp: ip,
        remainingSeconds,
        retryAfterSeconds: remainingSeconds,
        reason: `Rate limit lockout active for action: ${action}`,
        error: `Rate limit active for ${action}. Please wait ${remainingSeconds}s before attempting again.`,
        incidentId: profile.lastIncidentId,
        threatScore: profile.threatScore,
      };
    }

    // 3. Suspicious Traffic Pattern Inspection
    if (config.checkSuspiciousPatterns !== false) {
      const inspect = this.inspectSuspiciousPattern(req);
      if (inspect.detected) {
        profile.suspiciousHits++;
        profile.threatScore = Math.min(100, profile.threatScore + (inspect.threatIncrement || 40));

        // Quarantine IP for 5 to 15 minutes depending on threat score
        const blockDuration = profile.threatScore >= 80 ? 15 * 60 * 1000 : 5 * 60 * 1000;
        profile.blockedUntil = now + blockDuration;
        profile.blockReason = inspect.reason || 'Suspicious automated traffic pattern';

        const incident = this.logIncident(
          ip,
          action,
          inspect.reason || 'Malicious pattern probe',
          req,
          profile.blockedUntil,
          profile.threatScore
        );
        profile.lastIncidentId = incident.id;

        const remainingSeconds = Math.ceil(blockDuration / 1000);
        return {
          allowed: false,
          statusCode: 403,
          rateLimited: true,
          blocked: true,
          action,
          clientIp: ip,
          remainingSeconds,
          retryAfterSeconds: remainingSeconds,
          reason: inspect.reason,
          error: `Security WAF Block: Suspicious traffic pattern detected. Request rejected.`,
          incidentId: incident.id,
          threatScore: profile.threatScore,
        };
      }
    }

    // 4. Per-IP Frequency & Burst Tracking
    const windowMs = config.windowMs || 60 * 1000;
    const maxRequests = config.maxRequests || 10;
    const burstThreshold = config.burstThreshold || 5;
    const burstWindowMs = config.burstWindowMs || 3 * 1000;

    // Prune expired timestamps
    const timestamps = (profile.actionTimestamps.get(action) || []).filter(
      (ts) => now - ts < windowMs
    );

    // Check rapid burst velocity
    const burstCount = timestamps.filter((ts) => now - ts < burstWindowMs).length;
    if (burstCount >= burstThreshold) {
      profile.threatScore = Math.min(100, profile.threatScore + 15);
      const cooldownMs = config.blockDurationMs || 30 * 1000;
      profile.actionBlocks.set(action, now + cooldownMs);

      const incident = this.logIncident(
        ip,
        action,
        `Burst limit exceeded: ${burstCount + 1} requests within ${burstWindowMs / 1000}s`,
        req,
        now + cooldownMs,
        profile.threatScore
      );
      profile.lastIncidentId = incident.id;

      const remainingSeconds = Math.ceil(cooldownMs / 1000);
      return {
        allowed: false,
        statusCode: 429,
        rateLimited: true,
        blocked: true,
        action,
        clientIp: ip,
        remainingSeconds,
        retryAfterSeconds: remainingSeconds,
        reason: 'BURST_FLOOD_DETECTED',
        error: `High-frequency burst detected. Cooldown enforced for ${remainingSeconds}s.`,
        incidentId: incident.id,
        threatScore: profile.threatScore,
      };
    }

    // Check sliding window request limit
    if (timestamps.length >= maxRequests) {
      profile.threatScore = Math.min(100, profile.threatScore + 10);
      const cooldownMs = config.blockDurationMs || windowMs;
      profile.actionBlocks.set(action, now + cooldownMs);

      const incident = this.logIncident(
        ip,
        action,
        `Rate limit exceeded: ${timestamps.length + 1} requests in ${windowMs / 1000}s`,
        req,
        now + cooldownMs,
        profile.threatScore
      );
      profile.lastIncidentId = incident.id;

      const remainingSeconds = Math.ceil(cooldownMs / 1000);
      return {
        allowed: false,
        statusCode: 429,
        rateLimited: true,
        blocked: true,
        action,
        clientIp: ip,
        remainingSeconds,
        retryAfterSeconds: remainingSeconds,
        reason: 'RATE_LIMIT_EXCEEDED',
        error: `Rate limit threshold reached for ${action}. Please wait ${remainingSeconds}s.`,
        incidentId: incident.id,
        threatScore: profile.threatScore,
      };
    }

    // Allowed: Record current timestamp
    timestamps.push(now);
    profile.actionTimestamps.set(action, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - timestamps.length),
      threatScore: profile.threatScore,
      clientIp: ip,
      action,
    };
  }

  /**
   * Record a failed credential or operation attempt (e.g. invalid password)
   */
  static recordFailure(req: express.Request, action: string, usernameAttempted?: string): void {
    const ip = getSafeClientIp(req);
    const profile = this.getProfile(ip);
    profile.failedAuthAttempts++;
    profile.threatScore = Math.min(100, profile.threatScore + 12);

    if (usernameAttempted) {
      profile.recentTargetUsernames.add(usernameAttempted.toLowerCase());
    }

    // Credential stuffing detection: Multiple different usernames tried from same IP
    if (profile.recentTargetUsernames.size >= 4) {
      const now = Date.now();
      const blockDuration = 10 * 60 * 1000; // 10 minute lockout
      profile.blockedUntil = now + blockDuration;
      profile.blockReason = 'Credential stuffing detected: Multiple accounts probed from single IP';

      const incident = this.logIncident(
        ip,
        action,
        `Credential stuffing attack blocked (Targeted ${profile.recentTargetUsernames.size} distinct accounts)`,
        req,
        profile.blockedUntil,
        profile.threatScore
      );
      profile.lastIncidentId = incident.id;
    }
  }

  /**
   * Clear failure trackers on a valid authentication
   */
  static recordSuccess(req: express.Request, action: string): void {
    const ip = getSafeClientIp(req);
    const profile = this.getProfile(ip);
    profile.failedAuthAttempts = Math.max(0, profile.failedAuthAttempts - 1);
    profile.threatScore = Math.max(0, profile.threatScore - 5);
    profile.recentTargetUsernames.clear();
    profile.actionBlocks.delete(action);
  }

  /**
   * Cleanup stale records periodically
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [ip, profile] of ipSecurityProfiles.entries()) {
      if (now - profile.lastSeen > 3600 * 1000 && profile.blockedUntil < now) {
        ipSecurityProfiles.delete(ip);
      }
    }
  }

  /**
   * Return high-level summary of active security metrics
   */
  static getStats() {
    const now = Date.now();
    let activeQuarantineCount = 0;
    let highThreatCount = 0;

    for (const p of ipSecurityProfiles.values()) {
      if (p.blockedUntil > now) activeQuarantineCount++;
      if (p.threatScore > 50) highThreatCount++;
    }

    return {
      trackedIpsCount: ipSecurityProfiles.size,
      activeQuarantineCount,
      highThreatCount,
      totalIncidentsLogged: securityIncidents.length,
      recentIncidents: securityIncidents.slice(0, 10),
    };
  }
}

// Prune memory every 10 minutes
setInterval(() => SecurityManager.cleanup(), 10 * 60 * 1000);

/**
 * Express Middleware that enforces per-IP frequency limits and blocks suspicious traffic patterns
 */
export function securityMiddleware(options?: SecurityOptions) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip static assets
    const isStatic = req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|webp)$/i) || req.path.startsWith('/assets/');
    if (isStatic) return next();

    const result = SecurityManager.check(req, options?.action, options);

    // Apply security response headers
    const ip = result.clientIp || getSafeClientIp(req);
    res.setHeader('X-Security-Client-IP', ip);
    res.setHeader('X-Security-Threat-Score', String(result.threatScore || 0));

    if (result.remaining !== undefined) {
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    }

    if (!result.allowed) {
      const retrySecs = result.retryAfterSeconds || 60;
      res.setHeader('Retry-After', String(retrySecs));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + retrySecs));
      res.setHeader('X-Security-Reason', result.reason || 'RATE_LIMITED');
      if (result.incidentId) {
        res.setHeader('X-Security-Incident-ID', result.incidentId);
      }

      return res.status(result.statusCode || 429).json({
        success: false,
        error: result.error,
        rateLimited: true,
        action: result.action || options?.action || 'api',
        reason: result.reason,
        remainingSeconds: retrySecs,
        retryAfter: retrySecs,
        incidentId: result.incidentId,
        ip,
        timestamp: Date.now(),
      });
    }

    // Attach security context to request
    (req as any).security = {
      clientIp: ip,
      threatScore: result.threatScore,
      action: result.action,
    };

    next();
  };
}

// Pre-configured middleware presets
securityMiddleware.general = securityMiddleware({ action: 'api' });
securityMiddleware.login = securityMiddleware({ action: 'login' });
securityMiddleware.admin = securityMiddleware({ action: 'admin_login' });
securityMiddleware.order = securityMiddleware({ action: 'order_create' });
securityMiddleware.slip = securityMiddleware({ action: 'payment_slip' });

/**
 * Wrapper function for route handlers to add per-IP rate limiting and suspicious traffic pattern defense
 */
export function withSecurityWrapper(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => any,
  options?: SecurityOptions
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = SecurityManager.check(req, options?.action, options);

    if (!result.allowed) {
      const retrySecs = result.retryAfterSeconds || 60;
      res.setHeader('Retry-After', String(retrySecs));
      res.setHeader('X-Security-Reason', result.reason || 'RATE_LIMITED');
      if (result.incidentId) {
        res.setHeader('X-Security-Incident-ID', result.incidentId);
      }

      return res.status(result.statusCode || 429).json({
        success: false,
        error: result.error,
        rateLimited: true,
        action: result.action || options?.action || 'api',
        reason: result.reason,
        remainingSeconds: retrySecs,
        retryAfter: retrySecs,
        incidentId: result.incidentId,
        ip: result.clientIp,
        timestamp: Date.now(),
      });
    }

    (req as any).security = {
      clientIp: result.clientIp,
      threatScore: result.threatScore,
      action: result.action,
    };

    return handler(req, res, next);
  };
}

export const Security = SecurityManager;
