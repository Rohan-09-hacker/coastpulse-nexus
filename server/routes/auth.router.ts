import { Router } from 'express';
import crypto from 'node:crypto';
import { userRepo } from '../db/repositories/user.repository.ts';
import { sessionRepo } from '../db/repositories/session.repository.ts';
import { AuthenticatedRequest, SESSION_COOKIE_NAME, requireAuth, requireRole } from '../middleware/auth.middleware.ts';
import { hashPassword, verifyPassword } from '../core/security/password.ts';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

/**
 * Returns current session status or checks if first-time admin setup is required.
 */
authRouter.get('/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const allUsers = await userRepo.getAllUsers();
    const hasAdmin = allUsers.some((u) => u.role === 'admin' && u.is_active);

    res.setHeader('Content-Type', 'application/json');
    res.json({
      setupRequired: !hasAdmin,
      isAuthenticated: Boolean(req.user),
      user: req.user || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * First-Time Admin Setup: Initializes the initial administrator without any hardcoded credentials.
 * Only allowed once when no active admin exists in the system.
 */
authRouter.post('/setup-admin', async (req, res, next) => {
  try {
    const allUsers = await userRepo.getAllUsers();
    const hasAdmin = allUsers.some((u) => u.role === 'admin' && u.is_active);

    if (hasAdmin) {
      return res.status(409).setHeader('Content-Type', 'application/json').json({
        error: 'Conflict',
        message: 'Initial admin account has already been initialized. Please log in with existing credentials.',
        status: 409,
      });
    }

    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).setHeader('Content-Type', 'application/json').json({
        error: 'Bad Request',
        message: 'Email, password (min 8 chars), and display name are required for admin setup.',
        status: 400,
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepo.createUser(email.toLowerCase().trim(), passwordHash, displayName.trim(), 'admin');

    // Create session token and issue secure HTTP-only cookie
    const token = crypto.randomBytes(32).toString('hex');
    await sessionRepo.createSession(user.id, token, req.ip, req.headers['user-agent']);

    res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({
      message: 'Initial administrator account setup completed successfully.',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * User Login: Validates password with Argon2id/bcrypt and creates a server session.
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).setHeader('Content-Type', 'application/json').json({
        error: 'Bad Request',
        message: 'Email and password are required.',
        status: 400,
      });
    }

    const userWithHash = await userRepo.findByEmail(email.toLowerCase().trim());
    if (!userWithHash) {
      return res.status(401).setHeader('Content-Type', 'application/json').json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
        status: 401,
      });
    }

    const isValid = await verifyPassword(password, userWithHash.password_hash);
    if (!isValid) {
      return res.status(401).setHeader('Content-Type', 'application/json').json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
        status: 401,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await sessionRepo.createSession(userWithHash.id, token, req.ip, req.headers['user-agent']);

    res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.setHeader('Content-Type', 'application/json');
    res.json({
      message: 'Login successful.',
      user: {
        id: userWithHash.id,
        email: userWithHash.email,
        displayName: userWithHash.display_name,
        role: userWithHash.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * User Logout: Destroys session record in database and clears HTTP-only cookie.
 */
authRouter.post('/logout', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (req.sessionToken) {
      await sessionRepo.deleteSession(req.sessionToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.setHeader('Content-Type', 'application/json');
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * Get current authenticated user profile.
 */
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const allUsers = await userRepo.getAllUsers();
    res.setHeader('Content-Type', 'application/json');
    res.json({
      user: req.user,
      availableUsers: allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        isActive: u.is_active,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin user provisioning endpoint: Admin can create new team members with roles.
 */
authRouter.post('/users', requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { email, password, displayName, role } = req.body;
    if (!email || !password || !displayName || !role) {
      return res.status(400).setHeader('Content-Type', 'application/json').json({
        error: 'Bad Request',
        message: 'email, password (min 8 chars), displayName, and role are required.',
        status: 400,
      });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await userRepo.createUser(email.toLowerCase().trim(), passwordHash, displayName.trim(), role);

    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({
      message: `User created with role ${newUser.role}`,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.display_name,
        role: newUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
});
