import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';
import fs from 'node:fs';
import path from 'node:path';

import { DirectoryLock } from './lock.ts';

// Ensure data directory exists for persistent PGlite storage
const dataDir = path.resolve(process.cwd(), '.data/pglite');
export const dirLock = new DirectoryLock(dataDir);
dirLock.acquire();

// Safe stale recovery: only if lock was acquired and no active OS process holds postmaster.pid
const pidFile = path.join(dataDir, 'postmaster.pid');
if (fs.existsSync(pidFile)) {
  try {
    const pidContent = fs.readFileSync(pidFile, 'utf8');
    const recordedPid = parseInt(pidContent.trim().split('\n')[0], 10);
    let isRunning = false;
    if (!isNaN(recordedPid) && recordedPid > 0) {
      try {
        process.kill(recordedPid, 0);
        isRunning = true;
      } catch {
        isRunning = false;
      }
    }
    // Only unlink if the process is dead or dummy WASM PID
    if (!isRunning) {
      fs.unlinkSync(pidFile);
    }
  } catch {}
}

// Ensure standard PostgreSQL cluster subdirectories exist only if an initialized cluster is resuming
if (fs.existsSync(path.join(dataDir, 'global/pg_control'))) {
  const standardPgDirs = [
    'pg_commit_ts', 'pg_dynshmem', 'pg_logical', 'pg_multixact',
    'pg_notify', 'pg_replslot', 'pg_serial', 'pg_snapshots',
    'pg_stat', 'pg_stat_tmp', 'pg_subtrans', 'pg_tblspc',
    'pg_twophase', 'pg_wal', 'pg_xact'
  ];
  for (const dir of standardPgDirs) {
    const fullPath = path.join(dataDir, dir);
    if (!fs.existsSync(fullPath)) {
      try { fs.mkdirSync(fullPath, { recursive: true }); } catch {}
    }
  }
}

import { execFileSync } from 'node:child_process';

function verifyAndRepairCluster(targetDir: string) {
  if (fs.existsSync(path.join(targetDir, 'global/pg_control'))) {
    try {
      execFileSync(
        process.execPath,
        [
          '-e',
          `import('@electric-sql/pglite').then(async ({ PGlite }) => { const p = new PGlite(${JSON.stringify(targetDir)}); await p.waitReady; await p.close(); process.exit(0); }).catch(() => process.exit(1));`,
        ],
        { stdio: 'pipe', timeout: 20000 }
      );
    } catch (err: any) {
      if (err?.code === 'ETIMEDOUT' || err?.errno === 'ETIMEDOUT' || err?.killed) {
        console.warn(`[PGlite] Preflight check timed out for ${targetDir}; preserving existing cluster.`);
        return;
      }
      console.warn(`[PGlite] Cluster at ${targetDir} failed preflight check. Preserving corrupted data and creating fresh cluster.`);
      const backupDir = `${targetDir}.corrupt_${Date.now()}`;
      try {
        fs.renameSync(targetDir, backupDir);
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (e) {
        console.error('[PGlite] Cluster recovery backup failed:', e);
      }
    }
  }
}

function createPgliteInstance(targetDir: string): PGlite {
  verifyAndRepairCluster(targetDir);
  return new PGlite(targetDir);
}

export const pglite = createPgliteInstance(dataDir);
export const db = drizzle(pglite, { schema });

// Cleanly close PGlite and release directory lock on process shutdown
process.on('SIGINT', async () => {
  try { await pglite.close(); } catch {}
  dirLock.release();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  try { await pglite.close(); } catch {}
  dirLock.release();
  process.exit(0);
});

/**
 * Initializes database tables using standard PostgreSQL DDL compatible with PGlite.
 * Runs on server start to guarantee zero-setup first launch.
 */
export async function initializeDatabase() {
  await pglite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(128) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'analyst',
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      provider_type VARCHAR(32) NOT NULL,
      base_url VARCHAR(255),
      is_enabled BOOLEAN DEFAULT true NOT NULL,
      is_healthy BOOLEAN DEFAULT true NOT NULL,
      last_health_check_at TIMESTAMP WITH TIME ZONE,
      is_demo BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_models (
      id VARCHAR(128) PRIMARY KEY,
      provider_id VARCHAR(64) NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
      display_name VARCHAR(128) NOT NULL,
      context_window_tokens INTEGER NOT NULL,
      supports_streaming BOOLEAN DEFAULT true NOT NULL,
      supports_vision BOOLEAN DEFAULT false NOT NULL,
      input_cost_per_million NUMERIC(10, 4),
      output_cost_per_million NUMERIC(10, 4),
      is_simulated BOOLEAN DEFAULT false NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      provider_id VARCHAR(64) NOT NULL REFERENCES ai_providers(id),
      model_id VARCHAR(128) NOT NULL REFERENCES ai_models(id),
      feature_source VARCHAR(64) NOT NULL,
      prompt_text TEXT NOT NULL,
      system_instruction TEXT,
      response_text TEXT,
      temperature NUMERIC(3, 2),
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      latency_ms INTEGER NOT NULL,
      estimated_cost_usd NUMERIC(12, 6),
      metric_fidelity VARCHAR(32) NOT NULL,
      is_simulated BOOLEAN DEFAULT false NOT NULL,
      status VARCHAR(32) NOT NULL,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      step_definitions JSONB NOT NULL,
      requires_approval BOOLEAN DEFAULT false NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL,
      inputs JSONB NOT NULL,
      outputs JSONB,
      total_latency_ms INTEGER,
      total_tokens INTEGER,
      error_message TEXT,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS workflow_step_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      step_index INTEGER NOT NULL,
      step_name VARCHAR(128) NOT NULL,
      model_id VARCHAR(128) REFERENCES ai_models(id),
      execution_id UUID REFERENCES ai_executions(id),
      status VARCHAR(32) NOT NULL,
      input_payload JSONB,
      output_payload JSONB,
      latency_ms INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      test_prompt TEXT NOT NULL,
      system_instruction TEXT,
      criteria JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluation_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      execution_id UUID NOT NULL REFERENCES ai_executions(id) ON DELETE CASCADE,
      model_id VARCHAR(128) NOT NULL REFERENCES ai_models(id),
      quality_score NUMERIC(3, 1),
      human_rating VARCHAR(32),
      evaluator_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coastal_incidents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reported_by_user_id UUID REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      incident_type VARCHAR(64) NOT NULL,
      severity VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      latitude NUMERIC(10, 6) NOT NULL,
      longitude NUMERIC(10, 6) NOT NULL,
      location_name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      sensor_telemetry JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coastal_incident_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      incident_id UUID NOT NULL REFERENCES coastal_incidents(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      execution_id UUID REFERENCES ai_executions(id),
      threat_level VARCHAR(32) NOT NULL,
      environmental_impact_summary TEXT NOT NULL,
      proposed_actions JSONB NOT NULL,
      confidence_score NUMERIC(3, 2) NOT NULL,
      is_simulated BOOLEAN DEFAULT false NOT NULL,
      generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coastal_action_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      incident_id UUID NOT NULL REFERENCES coastal_incidents(id) ON DELETE CASCADE,
      assessment_id UUID NOT NULL REFERENCES coastal_incident_assessments(id) ON DELETE CASCADE,
      action_type VARCHAR(64) NOT NULL,
      action_payload JSONB NOT NULL,
      is_consequential BOOLEAN DEFAULT true NOT NULL,
      status VARCHAR(32) DEFAULT 'pending_review' NOT NULL,
      requested_by_user_id UUID REFERENCES users(id),
      reviewed_by_user_id UUID REFERENCES users(id),
      review_notes TEXT,
      requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      reviewed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS app_modules (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      domain VARCHAR(64) NOT NULL,
      description TEXT NOT NULL,
      version VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      is_reference_template BOOLEAN DEFAULT false NOT NULL,
      input_schema JSONB,
      output_schema JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  try {
    await pglite.query('ALTER TABLE workflows ALTER COLUMN user_id DROP NOT NULL');
  } catch {}

  await seedInitialData();
}

/**
 * Seeds default roles, users, AI providers, and baseline templates if missing.
 */
async function seedInitialData() {
  // Security requirement: Remove all predictable seeded credentials and placeholder password hashes (e.g. sha256:admin123).
  // Clean up any legacy placeholder accounts if they exist.
  await pglite.query("DELETE FROM users WHERE password_hash LIKE 'sha256:%' OR password_hash LIKE 'plain:%'");

  const existingProviders = await pglite.query<{ count: string }>('SELECT COUNT(*) as count FROM ai_providers');
  if (parseInt(existingProviders.rows[0]?.count || '0', 10) === 0) {
    await pglite.exec(`
      INSERT INTO ai_providers (id, name, provider_type, base_url, is_enabled, is_healthy, is_demo) VALUES
      ('gemini', 'Google Cloud Gemini', 'cloud', 'https://generativelanguage.googleapis.com', true, true, false),
      ('demo', 'COASTPULSE Deterministic Simulator', 'simulated', 'internal://demo', true, true, true),
      ('openai', 'OpenAI (BYOK Cloud)', 'cloud', 'https://api.openai.com/v1', false, false, false),
      ('anthropic', 'Anthropic Claude (BYOK Cloud)', 'cloud', 'https://api.anthropic.com/v1', false, false, false)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO ai_models (id, provider_id, display_name, context_window_tokens, supports_streaming, supports_vision, input_cost_per_million, output_cost_per_million, is_simulated) VALUES
      ('gemini-3.8-flash', 'gemini', 'Gemini 3.8 Flash (Recommended)', 1048576, true, true, 0.0750, 0.3000, false),
      ('gemini-3.1-flash-lite', 'gemini', 'Gemini 3.1 Flash Lite', 1048576, true, true, 0.0375, 0.1500, false),
      ('gemini-4-argon', 'gemini', 'Gemini 4 Argon (Advanced Reasoning)', 2097152, true, true, 1.2500, 5.0000, false),
      ('demo-sim-coastal-v1', 'demo', 'Demo Coastal Triage Sim v1', 32768, true, false, NULL, NULL, true),
      ('gpt-4o', 'openai', 'GPT-4o', 128000, true, true, 2.5000, 10.0000, false),
      ('claude-3-7-sonnet', 'anthropic', 'Claude 3.7 Sonnet', 200000, true, true, 3.0000, 15.0000, false)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  const existingIncidents = await pglite.query<{ count: string }>('SELECT COUNT(*) as count FROM coastal_incidents');
  if (parseInt(existingIncidents.rows[0]?.count || '0', 10) === 0) {
    await pglite.exec(`
      INSERT INTO coastal_incidents (id, reported_by_user_id, title, incident_type, severity, status, latitude, longitude, location_name, description, sensor_telemetry) VALUES
      ('11111111-1111-1111-1111-111111111111', NULL, 'Uncontained Fuel Sheen Spotted Near Kelp Sanctuary', 'oil_spill', 'severe', 'analyzing', 36.6183, -121.9015, 'Monterey Bay Marine Sanctuary', 'Commercial fishing vessel reported engine wash with visible iridescent hydrocarbon sheen extending ~850 meters toward protected kelp bed. Wind NW at 14 kts.', '{"water_temp_c": 13.8, "wind_speed_kts": 14.2, "wave_height_m": 1.4, "tide_level": "slack_high"}'),
      ('22222222-2222-2222-2222-222222222222', NULL, 'High Energy King Tide & Harbor Breaching', 'storm_surge', 'critical', 'mitigation_active', 46.2081, -124.0199, 'Cape Disappointment Outer Harbor', 'King tide surge combined with bar crossing breakers exceeding 6.2 meters. South jetty roadway partially inundated; floating docks stressed.', '{"water_temp_c": 10.2, "wind_speed_kts": 32.5, "wave_height_m": 5.8, "tide_level": "peak_spring"}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO coastal_incident_assessments (id, incident_id, user_id, threat_level, environmental_impact_summary, proposed_actions, confidence_score, is_simulated) VALUES
      ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', NULL, 'CRITICAL', 'Hydrocarbon drift modeling indicates shoreline impact within 3.5 hours at current NW wind velocity. High risk to sea otter population and juvenile rockfish habitats.', '[{"action_id": "act-01", "name": "Deploy Oil Containment Booms", "consequential": true, "lead_time_min": 45, "asset": "Station Monterey Response Boat #4"}, {"action_id": "act-02", "name": "Issue Fishery Advisory Zone 4", "consequential": true, "lead_time_min": 15, "asset": "Coast Guard Public Broadcast"}]', 0.92, true)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO coastal_action_approvals (id, incident_id, assessment_id, action_type, action_payload, is_consequential, status, requested_by_user_id) VALUES
      ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'dispatch_containment_booms', '{"equipment": "600m Shore-Seal Heavy Marine Boom", "vessel": "Response Cutter Pacific Star", "target_coordinates": [36.6183, -121.9015]}', true, 'pending_review', NULL)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  const existingWorkflows = await pglite.query<{ count: string }>('SELECT COUNT(*) as count FROM workflows');
  if (parseInt(existingWorkflows.rows[0]?.count || '0', 10) === 0) {
    await pglite.exec(`
      INSERT INTO workflows (id, user_id, name, description, step_definitions, requires_approval) VALUES
      ('55555555-5555-5555-5555-555555555555', NULL, 'Coastal Emergency Incident Triage Pipeline', 'Three-stage pipeline: Incident Entity Extraction -> Hazard Assessment -> Emergency Response Plan with Consequential Review Gate.', '[{"stepIndex": 0, "name": "Extract Incident Parameters", "promptTemplate": "Extract key marine hazard telemetry from this report:\\n{{incident_text}}", "targetModel": "gemini-3.8-flash"}, {"stepIndex": 1, "name": "Synthesize Environmental Impact", "promptTemplate": "Analyze coastal and ecological impact based on extracted hazard:\\n{{step_0_output}}", "targetModel": "gemini-3.8-flash"}, {"stepIndex": 2, "name": "Generate Mitigation Action Proposal", "promptTemplate": "Draft actionable incident response recommendations for field commanders:\\n{{step_1_output}}", "targetModel": "gemini-3.8-flash", "requiresHumanApproval": true}]', true)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  const existingApps = await pglite.query<{ count: string }>('SELECT COUNT(*) as count FROM app_modules');
  if (parseInt(existingApps.rows[0]?.count || '0', 10) === 0) {
    await pglite.exec(`
      INSERT INTO app_modules (id, name, domain, description, version, status, is_reference_template, input_schema, output_schema) VALUES
      ('coastal-intelligence', 'Coastal Intelligence', 'Maritime & Coastal', 'Incident telemetry ingestion, ecological risk assessment, and human-in-the-loop disaster mitigation dispatcher.', '1.2.0', 'active', true, '{"fields": ["title", "incident_type", "severity", "latitude", "longitude", "sensor_telemetry"]}', '{"fields": ["threat_level", "environmental_impact_summary", "proposed_actions"]}'),
      ('education-intelligence', 'Education Intelligence', 'Education & EdTech', 'Adaptive curriculum generation, multi-tier automated grading, and personalized pedagogical feedback.', '1.0.0-blueprint', 'registered', false, '{"fields": ["grade_level", "subject", "learning_objective", "student_submission"]}', '{"fields": ["rubric_scores", "concept_breakdown", "remedial_suggestions"]}'),
      ('healthcare-intelligence', 'Healthcare Intelligence', 'Healthcare & Clinical', 'Clinical note synthesis, triage urgency scoring, and differential symptom analysis with mandatory physician sign-off.', '1.0.0-blueprint', 'registered', false, '{"fields": ["symptoms", "vital_signs", "history"]}', '{"fields": ["urgency_tier", "differential_hypotheses", "consequential_actions"]}'),
      ('finance-intelligence', 'Finance Intelligence', 'Finance & FinTech', 'Automated SEC/regulatory compliance summarization, risk anomaly classification, and audit report generation.', '1.0.0-blueprint', 'registered', false, '{"fields": ["transaction_batch", "financial_statements", "jurisdiction"]}', '{"fields": ["risk_score", "suspicious_flags", "regulatory_audit_memo"]}'),
      ('security-intelligence', 'Security Intelligence', 'Cybersecurity & SecOps', 'SIEM log threat extraction, vulnerability triage, and automated incident response mitigation planning.', '1.0.0-blueprint', 'registered', false, '{"fields": ["log_payload", "cve_indicators", "network_segment"]}', '{"fields": ["attack_vector", "containment_actions", "quarantine_approval"]}'),
      ('environmental-intelligence', 'Environmental Intelligence', 'Climate & Ecology', 'Wildfire burn perimeter estimation, urban air quality index forecasting, and carbon footprint telemetry.', '1.0.0-blueprint', 'registered', false, '{"fields": ["satellite_band_data", "weather_station_feed", "geographic_bounds"]}', '{"fields": ["hazard_heat_map", "evacuation_boundary", "dispersion_forecast"]}')
      ON CONFLICT (id) DO NOTHING;
    `);
  }
}

/**
 * Checks real database connection and table presence.
 * Never reports healthy unless an active SQL query executes successfully.
 */
export async function checkDatabaseHealth(): Promise<{ isHealthy: boolean; tables: number; error?: string }> {
  try {
    const res = await pglite.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public';"
    );
    const tableCount = parseInt(res.rows[0]?.count || '0', 10);
    return {
      isHealthy: tableCount >= 7,
      tables: tableCount,
    };
  } catch (err: any) {
    return {
      isHealthy: false,
      tables: 0,
      error: err?.message || 'Database connection query failed',
    };
  }
}

