import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.ts';

export type UserRole = 'admin' | 'analyst' | 'operator' | 'viewer';

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication session required.',
      });
    }

    // Admin always has access to everything
    if (req.user.role === 'admin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient Permissions',
        message: `Your current role (${req.user.role}) cannot perform this action. Required: ${allowedRoles.join(' or ')}.`,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}
