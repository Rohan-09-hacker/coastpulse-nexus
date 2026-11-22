import { Router } from 'express';
import { providerRegistry } from '../core/adapters/registry.ts';

export const modelsRouter = Router();

modelsRouter.get('/', async (req, res, next) => {
  try {
    const models = await providerRegistry.getAllModels();
    res.setHeader('Content-Type', 'application/json');
    res.json(models);
  } catch (err) {
    next(err);
  }
});
