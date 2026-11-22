import { Request, Response, NextFunction } from 'express';
import { sessionRepo } from '../db/repositories/session.repository.ts';

export type UserRole = 'admin' | 'analyst' | 'operator' | 'viewer';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionToken?: string;
}

export const SESSION_COOKIE_NAME = 'coastpulse_session';

/**
 * Validates real server session via secure HTTP-only cookie or Bearer header.
 * NEVER trusts client-controlled x-user-id headers for authentication!
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  req.user = undefined;
  req.sessionToken = undefined;

  // 1. Extract session token strictly from secure HTTP-only cookie or Bearer token header
  let token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }

  // Explicit unauthenticated test flag
  if (req.headers['x-auth-test'] === 'unauthenticated' || !token) {
    return next();
  }

  try {
    const session = await sessionRepo.getSessionByToken(token);
    if (session && session.user && session.user.is_active) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.display_name,
        role: session.user.role,
      };
      req.sessionToken = token;
    }
  } catch (err) {
    console.error('[AuthMiddleware] Error validating session:', err);
  }

  next();
}

/**
 * Enforces mandatory authentication. Returns JSON 401 if unauthenticated.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    return res.status(401).setHeader('Content-Type', 'application/json').json({
      error: 'Unauthorized',
      message: 'Valid server session required. Please log in.',
      status: 401,
    });
  }
  next();
}

/**
 * Enforces Role-Based Access Control (RBAC) server-side.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
      return res.status(401).setHeader('Content-Type', 'application/json').json({
        error: 'Unauthorized',
        message: 'Authentication required.',
        status: 401,
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).setHeader('Content-Type', 'application/json').json({
        error: 'Forbidden',
        message: `Access denied. Role "${req.user.role}" does not have required permissions: [${allowedRoles.join(', ')}].`,
        status: 403,
      });
    }

    next();
  };
}
