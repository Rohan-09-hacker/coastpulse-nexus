import { providerRegistry } from '../adapters/registry.ts';
import { pglite } from '../../db/client.ts';
import { v4 as uuidv4 } from 'uuid';

export interface EvaluationRunRequest {
  userId?: string;
  name: string;
  prompt: string;
  systemInstruction?: string;
  modelIds: string[];
}

export class EvaluationRunner {
  async runEvaluation(request: EvaluationRunRequest) {
    const evalId = uuidv4();
    await pglite.query(
      `INSERT INTO evaluations (id, user_id, name, test_prompt, system_instruction)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        evalId,
        request.userId || '00000000-0000-0000-0000-000000000003', // default to analyst
        request.name,
        request.prompt,
        request.systemInstruction || null,
      ]
    );

    const modelResults = [];

    for (const modelId of request.modelIds) {
      const response = await providerRegistry.executeAndRecord({
        modelId,
        prompt: request.prompt,
        systemInstruction: request.systemInstruction,
        featureSource: 'evaluation',
        userId: request.userId,
      });

      // Calculate baseline automated scoring (coherence, latency efficiency, token economy)
      let qualityScore = 4.0;
      if (response.status === 'error') {
        qualityScore = 1.0;
      } else {
        if (response.latencyMs < 1500) qualityScore += 0.5;
        if (response.text.length > 250) qualityScore += 0.5;
      }
      qualityScore = Math.min(5.0, Math.max(1.0, qualityScore));

      const resultId = uuidv4();
      await pglite.query(
        `INSERT INTO evaluation_results (id, evaluation_id, execution_id, model_id, quality_score, evaluator_notes)
         VALUES ($1, $2, gen_random_uuid(), $3, $4, $5)`,
        [
          resultId,
          evalId,
          modelId,
          qualityScore,
          `Automated evaluation: Latency ${response.latencyMs}ms, fidelity: ${response.metricFidelity}`,
        ]
      );

      modelResults.push({
        modelId,
        providerId: response.providerId,
        text: response.text,
        latencyMs: response.latencyMs,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        estimatedCostUsd: response.estimatedCostUsd,
        metricFidelity: response.metricFidelity,
        isSimulated: response.isSimulated,
        status: response.status,
        qualityScore,
      });
    }

    return {
      evaluationId: evalId,
      name: request.name,
      prompt: request.prompt,
      results: modelResults,
    };
  }

  async getEvaluations() {
    const res = await pglite.query(`
      SELECT e.*, u.display_name as creator_name,
        COUNT(r.id)::int as models_compared,
        AVG(r.quality_score)::numeric(3, 1) as avg_score
      FROM evaluations e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN evaluation_results r ON e.id = r.evaluation_id
      GROUP BY e.id, u.display_name
      ORDER BY e.created_at DESC
    `);
    return res.rows;
  }
}

export const evaluationRunner = new EvaluationRunner();
