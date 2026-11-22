import { pglite } from '../client.ts';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowRepository {
  async getWorkflows() {
    const res = await pglite.query(
      `SELECT w.*, u.display_name as creator_name
       FROM workflows w
       LEFT JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC`
    );
    return res.rows;
  }

  async getWorkflowById(id: string): Promise<any | null> {
    const res = await pglite.query<any>(`SELECT * FROM workflows WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  async createWorkflow(input: {
    userId: string;
    name: string;
    description?: string;
    stepDefinitions: any;
    requiresApproval?: boolean;
  }): Promise<any> {
    const id = uuidv4();
    const res = await pglite.query<any>(
      `INSERT INTO workflows (id, user_id, name, description, step_definitions, requires_approval)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        input.userId,
        input.name,
        input.description || null,
        JSON.stringify(input.stepDefinitions),
        input.requiresApproval || false,
      ]
    );
    return res.rows[0];
  }

  async updateWorkflow(id: string, input: {
    name?: string;
    description?: string;
    stepDefinitions?: any;
    requiresApproval?: boolean;
  }): Promise<any> {
    const existing = await this.getWorkflowById(id);
    if (!existing) {
      throw new Error(`Workflow with ID ${id} not found.`);
    }

    const name = input.name !== undefined ? input.name : existing.name;
    const description = input.description !== undefined ? input.description : existing.description;
    const stepDefs = input.stepDefinitions !== undefined ? JSON.stringify(input.stepDefinitions) : existing.step_definitions;
    const requiresApproval = input.requiresApproval !== undefined ? input.requiresApproval : existing.requires_approval;

    const res = await pglite.query<any>(
      `UPDATE workflows
       SET name = $1, description = $2, step_definitions = $3, requires_approval = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, stepDefs, requiresApproval, id]
    );
    return res.rows[0];
  }

  async createWorkflowRun(workflowId: string, userId: string, inputs: any): Promise<any> {
    const id = uuidv4();
    const res = await pglite.query<any>(
      `INSERT INTO workflow_runs (id, workflow_id, user_id, status, inputs)
       VALUES ($1, $2, $3, 'running', $4)
       RETURNING *`,
      [id, workflowId, userId, JSON.stringify(inputs)]
    );
    return res.rows[0];
  }

  async recordStepRun(input: {
    workflowRunId: string;
    stepIndex: number;
    stepName: string;
    modelId?: string;
    executionId?: string;
    status: string;
    inputPayload?: any;
    outputPayload?: any;
    latencyMs?: number;
  }) {
    const id = uuidv4();
    const res = await pglite.query(
      `INSERT INTO workflow_step_runs (
        id, workflow_run_id, step_index, step_name, model_id, execution_id,
        status, input_payload, output_payload, latency_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        input.workflowRunId,
        input.stepIndex,
        input.stepName,
        input.modelId || null,
        input.executionId || null,
        input.status,
        input.inputPayload ? JSON.stringify(input.inputPayload) : null,
        input.outputPayload ? JSON.stringify(input.outputPayload) : null,
        input.latencyMs || null,
      ]
    );
    return res.rows[0];
  }

  async completeWorkflowRun(runId: string, outputs: any, totalLatencyMs: number, totalTokens?: number | null) {
    const res = await pglite.query(
      `UPDATE workflow_runs
       SET status = 'completed', outputs = $1, total_latency_ms = $2, total_tokens = $3, completed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [JSON.stringify(outputs), totalLatencyMs, totalTokens ?? null, runId]
    );
    return res.rows[0];
  }

  async updateWorkflowRunStatus(runId: string, status: string, errorMessage?: string) {
    const res = await pglite.query(
      `UPDATE workflow_runs
       SET status = $1::varchar,
           error_message = $2,
           completed_at = CASE WHEN $1::varchar IN ('completed', 'failed', 'rejected') THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $3
       RETURNING *`,
      [status, errorMessage || null, runId]
    );
    return res.rows[0];
  }

  async getWorkflowRuns(limit = 20) {
    const res = await pglite.query(
      `SELECT r.*, w.name as workflow_name, u.display_name as user_name
       FROM workflow_runs r
       JOIN workflows w ON r.workflow_id = w.id
       JOIN users u ON r.user_id = u.id
       ORDER BY r.started_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}

export const workflowRepo = new WorkflowRepository();
