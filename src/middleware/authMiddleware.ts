import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/userModel';

const DEV_ONLY_JWT_SECRET = 'uchiro-secure-jwt-auth-secret-key-2025';
const isProductionRuntime = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

if (isProductionRuntime && !process.env.JWT_SECRET) {
  // This default was previously committed to source control, so it must never be
  // trusted in production -- anyone who has seen it could forge admin session tokens.
  throw new Error(
    'JWT_SECRET environment variable is not set. Set a long random secret in your ' +
    'hosting provider (e.g. Vercel Project Settings -> Environment Variables) before deploying.'
  );
}

export const JWT_SECRET = process.env.JWT_SECRET || DEV_ONLY_JWT_SECRET;

export interface AuthUserPayload {
  uid: string;
  email: string;
  username: string;
  role: UserRole;
  displayName?: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Signs a JWT session token containing the authenticated user's ID and RBAC role.
 */
export function generateAuthToken(payload: Omit<AuthUserPayload, 'iat' | 'exp'>, expiresIn = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

/**
 * Middleware: verifyAuth
 * Extracts Bearer token, verifies its signature, and binds the authenticated user to req.user.
 * Returns HTTP 401 if token is absent or invalid.
 */
export function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || (req.headers['x-access-token'] as string) || (req.headers['x-admin-token'] as string);
    let token: string | undefined;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else {
        token = authHeader.trim();
      }
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication token is missing. Please log in.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    return next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session is invalid or has expired. Please log in again.',
    });
  }
}

/**
 * Middleware: requireAdmin
 * Ensures the authenticated user possesses the 'admin' role.
 * Returns HTTP 403 if the user is a standard customer.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // If verifyAuth has not already run, run it or verify user presence
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication required before checking admin privileges.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Administrator privileges required to access this resource.',
    });
  }

  return next();
}
