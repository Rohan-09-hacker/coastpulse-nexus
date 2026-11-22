import { Router } from 'express';
import { evaluationRunner } from '../core/evaluation/evaluator.ts';
import { AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { requireRole } from '../middleware/rbac.middleware.ts';

export const evaluationsRouter = Router();

evaluationsRouter.get('/', async (req, res) => {
  try {
    const list = await evaluationRunner.getEvaluations();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

evaluationsRouter.post('/run', requireRole(['analyst', 'operator', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, prompt, systemInstruction, modelIds } = req.body;
    if (!name || !prompt || !Array.isArray(modelIds) || modelIds.length === 0) {
      return res.status(400).json({ error: 'Name, prompt, and array of modelIds are required.' });
    }

    const result = await evaluationRunner.runEvaluation({
      userId: req.user?.id,
      name,
      prompt,
      systemInstruction,
      modelIds,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
