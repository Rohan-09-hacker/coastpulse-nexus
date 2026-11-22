import { pglite } from '../client.ts';

export interface AppModuleRecord {
  id: string;
  name: string;
  domain: string;
  description: string;
  version: string;
  status: 'active' | 'registered' | 'draft';
  is_reference_template: boolean;
  input_schema?: any;
  output_schema?: any;
  created_at: string;
}

export class AppRegistryRepository {
  async getAllApps(): Promise<AppModuleRecord[]> {
    const res = await pglite.query<AppModuleRecord>(
      'SELECT * FROM app_modules ORDER BY is_reference_template DESC, name ASC'
    );
    return res.rows;
  }

  async getAppById(id: string): Promise<AppModuleRecord | null> {
    const res = await pglite.query<AppModuleRecord>(
      'SELECT * FROM app_modules WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }
}

export const appRegistryRepo = new AppRegistryRepository();
