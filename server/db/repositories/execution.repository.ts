import { pglite } from '../client.ts';
import { v4 as uuidv4 } from 'uuid';

export interface RecordExecutionInput {
  userId?: string | null;
  providerId: string;
  modelId: string;
  featureSource: 'workspace' | 'workflow' | 'evaluation' | 'coastal' | 'playground';
  promptText: string;
  systemInstruction?: string | null;
  responseText?: string | null;
  temperature?: number | null;
  promptTokens?: number | null; // Nullable
  completionTokens?: number | null; // Nullable
  totalTokens?: number | null; // Nullable
  latencyMs: number;
  estimatedCostUsd?: number | null; // Nullable
  metricFidelity: 'actual' | 'estimated' | 'simulated' | 'unavailable';
  isSimulated: boolean;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string | null;
}

export class ExecutionRepository {
  async recordExecution(input: RecordExecutionInput): Promise<string> {
    const id = uuidv4();
    // Ensure model exists in ai_models table to satisfy foreign key constraint
    await pglite.query(
      `INSERT INTO ai_models (id, provider_id, display_name, context_window_tokens, is_simulated)
       VALUES ($1, $2, $1, 1048576, $3)
       ON CONFLICT (id) DO NOTHING`,
      [input.modelId, input.providerId, input.isSimulated]
    );

    await pglite.query(
      `INSERT INTO ai_executions (
        id, user_id, provider_id, model_id, feature_source, prompt_text, system_instruction,
        response_text, temperature, prompt_tokens, completion_tokens, total_tokens,
        latency_ms, estimated_cost_usd, metric_fidelity, is_simulated, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        id,
        input.userId || null,
        input.providerId,
        input.modelId,
        input.featureSource,
        input.promptText,
        input.systemInstruction || null,
        input.responseText || null,
        input.temperature ?? null,
        input.promptTokens ?? null,
        input.completionTokens ?? null,
        input.totalTokens ?? null,
        input.latencyMs,
        input.estimatedCostUsd ?? null,
        input.metricFidelity,
        input.isSimulated,
        input.status,
        input.errorMessage || null,
      ]
    );
    return id;
  }

  async getExecutionHistory(limit = 50, offset = 0) {
    const res = await pglite.query(
      `SELECT e.*, u.display_name as user_name, u.role as user_role
       FROM ai_executions e
       LEFT JOIN users u ON e.user_id = u.id
       ORDER BY e.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }

  async getAggregatedMetrics() {
    // Computes real analytics from database, cleanly partitioned by fidelity
    const totalsRes = await pglite.query(`
      SELECT 
        COUNT(*)::int as total_requests,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::int as successful_requests,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as error_requests,
        AVG(CASE WHEN status = 'success' THEN latency_ms END)::int as avg_latency_ms,
        
        -- Actual tokens & cost (strictly over actual executions)
        SUM(CASE WHEN metric_fidelity = 'actual' THEN total_tokens END)::int as actual_tokens_consumed,
        SUM(CASE WHEN metric_fidelity = 'actual' THEN estimated_cost_usd END)::numeric(12, 6) as actual_cost_usd,
        
        -- Simulated tokens (demo executions)
        SUM(CASE WHEN is_simulated = true THEN total_tokens END)::int as simulated_tokens,
        
        -- Unavailable count
        COUNT(CASE WHEN total_tokens IS NULL THEN 1 END)::int as missing_token_metadata_count
      FROM ai_executions
    `);

    // Model distribution
    const modelDistribution = await pglite.query(`
      SELECT model_id, COUNT(*)::int as count, AVG(latency_ms)::int as avg_latency
      FROM ai_executions
      GROUP BY model_id
      ORDER BY count DESC
    `);

    // Provider distribution
    const providerDistribution = await pglite.query(`
      SELECT provider_id, is_simulated, COUNT(*)::int as count
      FROM ai_executions
      GROUP BY provider_id, is_simulated
    `);

    // Fidelity breakdown
    const fidelityDistribution = await pglite.query(`
      SELECT metric_fidelity, COUNT(*)::int as count
      FROM ai_executions
      GROUP BY metric_fidelity
    `);

    return {
      summary: totalsRes.rows[0] || {},
      modelDistribution: modelDistribution.rows,
      providerDistribution: providerDistribution.rows,
      fidelityDistribution: fidelityDistribution.rows,
    };
  }
}

export const executionRepo = new ExecutionRepository();
