import { pglite } from '../client.ts';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

export interface UserSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'analyst' | 'operator' | 'viewer';
    is_active: boolean;
  };
}

export class SessionRepository {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSession(userId: string, token: string, ipAddress?: string, userAgent?: string, durationDays = 7): Promise<UserSessionRecord> {
    const id = uuidv4();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const res = await pglite.query<UserSessionRecord>(
      `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, userId, tokenHash, ipAddress || null, userAgent || null, expiresAt]
    );

    return res.rows[0];
  }

  async getSessionByToken(token: string): Promise<UserSessionRecord | null> {
    const tokenHash = this.hashToken(token);
    const res = await pglite.query<any>(
      `SELECT s.*, u.email, u.display_name, u.role, u.is_active
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = true`,
      [tokenHash]
    );

    if (!res.rows[0]) return null;

    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      token_hash: row.token_hash,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      expires_at: row.expires_at,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        email: row.email,
        display_name: row.display_name,
        role: row.role,
        is_active: row.is_active,
      },
    };
  }

  async deleteSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await pglite.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await pglite.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  }
}

export const sessionRepo = new SessionRepository();
