import { pglite } from '../client.ts';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'analyst' | 'operator' | 'viewer';
  is_active: boolean;
}

export class UserRepository {
  async getAllUsers(): Promise<User[]> {
    const res = await pglite.query<User>(
      'SELECT id, email, display_name, role, is_active FROM users ORDER BY created_at ASC'
    );
    return res.rows;
  }

  async findById(id: string): Promise<User | null> {
    const res = await pglite.query<User>(
      'SELECT id, email, display_name, role, is_active FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
    const res = await pglite.query<User & { password_hash: string }>(
      'SELECT id, email, password_hash, display_name, role, is_active FROM users WHERE email = $1',
      [email]
    );
    return res.rows[0] || null;
  }

  async createUser(email: string, passwordHash: string, displayName: string, role: string): Promise<User> {
    const id = uuidv4();
    const res = await pglite.query<User>(
      `INSERT INTO users (id, email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, display_name, role, is_active`,
      [id, email, passwordHash, displayName, role]
    );
    return res.rows[0];
  }

  async updateRole(userId: string, newRole: 'admin' | 'analyst' | 'operator' | 'viewer'): Promise<User | null> {
    const res = await pglite.query<User>(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
       RETURNING id, email, display_name, role, is_active`,
      [newRole, userId]
    );
    return res.rows[0] || null;
  }
}

export const userRepo = new UserRepository();
