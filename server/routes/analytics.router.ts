import { Router } from 'express';
import { executionRepo } from '../db/repositories/execution.repository.ts';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', async (req, res, next) => {
  try {
    const data = await executionRepo.getAggregatedMetrics();
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
    const history = await executionRepo.getExecutionHistory(limit, offset);
    res.setHeader('Content-Type', 'application/json');
    res.json(history);
  } catch (err) {
    next(err);
  }
});
