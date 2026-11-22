import { pgTable, text, varchar, integer, numeric, boolean, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

// 1. Users, Roles & Sessions
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('analyst'), // 'admin' | 'analyst' | 'operator' | 'viewer'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. AI Providers & Models
export const aiProviders = pgTable('ai_providers', {
  id: varchar('id', { length: 64 }).primaryKey(), // 'gemini', 'openai', 'anthropic', 'demo'
  name: varchar('name', { length: 128 }).notNull(),
  providerType: varchar('provider_type', { length: 32 }).notNull(), // 'cloud', 'simulated', 'custom'
  baseUrl: varchar('base_url', { length: 255 }),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  isHealthy: boolean('is_healthy').default(true).notNull(),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiModels = pgTable('ai_models', {
  id: varchar('id', { length: 128 }).primaryKey(),
  providerId: varchar('provider_id', { length: 64 }).references(() => aiProviders.id, { onDelete: 'cascade' }).notNull(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  contextWindowTokens: integer('context_window_tokens').notNull(),
  supportsStreaming: boolean('supports_streaming').default(true).notNull(),
  supportsVision: boolean('supports_vision').default(false).notNull(),
  inputCostPerMillion: numeric('input_cost_per_million', { precision: 10, scale: 4 }), // Nullable
  outputCostPerMillion: numeric('output_cost_per_million', { precision: 10, scale: 4 }), // Nullable
  isSimulated: boolean('is_simulated').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. AI Executions & Telemetry (Null for unavailable, explicit fidelity flags)
export const aiExecutions = pgTable('ai_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  providerId: varchar('provider_id', { length: 64 }).references(() => aiProviders.id).notNull(),
  modelId: varchar('model_id', { length: 128 }).references(() => aiModels.id).notNull(),
  featureSource: varchar('feature_source', { length: 64 }).notNull(), // 'workspace', 'workflow', 'evaluation', 'coastal', 'playground'
  promptText: text('prompt_text').notNull(),
  systemInstruction: text('system_instruction'),
  responseText: text('response_text'),
  temperature: numeric('temperature', { precision: 3, scale: 2 }),
  promptTokens: integer('prompt_tokens'), // Strictly NULL if unavailable
  completionTokens: integer('completion_tokens'), // Strictly NULL if unavailable
  totalTokens: integer('total_tokens'), // Strictly NULL if unavailable
  latencyMs: integer('latency_ms').notNull(),
  estimatedCostUsd: numeric('estimated_cost_usd', { precision: 12, scale: 6 }), // Strictly NULL if unavailable
  metricFidelity: varchar('metric_fidelity', { length: 32 }).notNull(), // 'actual' | 'estimated' | 'simulated' | 'unavailable'
  isSimulated: boolean('is_simulated').default(false).notNull(),
  status: varchar('status', { length: 32 }).notNull(), // 'success' | 'error' | 'timeout'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Workflows & Multi-step Execution
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  stepDefinitions: jsonb('step_definitions').notNull(), // Array of step specs
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowRuns = pgTable('workflow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 32 }).notNull(), // 'running' | 'pending_approval' | 'completed' | 'failed' | 'rejected'
  inputs: jsonb('inputs').notNull(),
  outputs: jsonb('outputs'),
  totalLatencyMs: integer('total_latency_ms'),
  totalTokens: integer('total_tokens'), // Nullable
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const workflowStepRuns = pgTable('workflow_step_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'cascade' }).notNull(),
  stepIndex: integer('step_index').notNull(),
  stepName: varchar('step_name', { length: 128 }).notNull(),
  modelId: varchar('model_id', { length: 128 }).references(() => aiModels.id),
  executionId: uuid('execution_id').references(() => aiExecutions.id),
  status: varchar('status', { length: 32 }).notNull(), // 'running' | 'completed' | 'failed' | 'waiting_approval'
  inputPayload: jsonb('input_payload'),
  outputPayload: jsonb('output_payload'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Evaluations (Model Benchmarking)
export const evaluations = pgTable('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  testPrompt: text('test_prompt').notNull(),
  systemInstruction: text('system_instruction'),
  criteria: jsonb('criteria'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evaluationResults = pgTable('evaluation_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  evaluationId: uuid('evaluation_id').references(() => evaluations.id, { onDelete: 'cascade' }).notNull(),
  executionId: uuid('execution_id').references(() => aiExecutions.id, { onDelete: 'cascade' }).notNull(),
  modelId: varchar('model_id', { length: 128 }).references(() => aiModels.id).notNull(),
  qualityScore: numeric('quality_score', { precision: 3, scale: 1 }),
  humanRating: varchar('human_rating', { length: 32 }), // 'winner' | 'runner_up' | 'inadequate'
  evaluatorNotes: text('evaluator_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Coastal Intelligence Domain Template
export const coastalIncidents = pgTable('coastal_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportedByUserId: uuid('reported_by_user_id').references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  incidentType: varchar('incident_type', { length: 64 }).notNull(), // 'oil_spill', 'storm_surge', 'vessel_grounding', 'algae_bloom'
  severity: varchar('severity', { length: 32 }).notNull(), // 'minor', 'moderate', 'severe', 'critical'
  status: varchar('status', { length: 32 }).notNull(), // 'reported', 'triaged', 'analyzing', 'mitigation_active', 'resolved'
  latitude: numeric('latitude', { precision: 10, scale: 6 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 6 }).notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  sensorTelemetry: jsonb('sensor_telemetry'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const coastalIncidentAssessments = pgTable('coastal_incident_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').references(() => coastalIncidents.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  executionId: uuid('execution_id').references(() => aiExecutions.id),
  threatLevel: varchar('threat_level', { length: 32 }).notNull(), // 'LOW', 'ELEVATED', 'CRITICAL'
  environmentalImpactSummary: text('environmental_impact_summary').notNull(),
  proposedActions: jsonb('proposed_actions').notNull(), // Array of physical/mitigation action objects
  confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }).notNull(),
  isSimulated: boolean('is_simulated').default(false).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Consequential Action Approvals (Human-in-the-Loop Gate)
export const coastalActionApprovals = pgTable('coastal_action_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').references(() => coastalIncidents.id, { onDelete: 'cascade' }).notNull(),
  assessmentId: uuid('assessment_id').references(() => coastalIncidentAssessments.id, { onDelete: 'cascade' }).notNull(),
  actionType: varchar('action_type', { length: 64 }).notNull(), // 'dispatch_containment_booms', 'issue_evacuation_warning', etc.
  actionPayload: jsonb('action_payload').notNull(),
  isConsequential: boolean('is_consequential').default(true).notNull(),
  status: varchar('status', { length: 32 }).default('pending_review').notNull(), // 'pending_review', 'approved', 'rejected'
  requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id), // Must be 'operator' or 'admin'
  reviewNotes: text('review_notes'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});
