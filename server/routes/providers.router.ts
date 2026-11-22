import { Router } from 'express';
import { providerRegistry } from '../core/adapters/registry.ts';

export const providersRouter = Router();

providersRouter.get('/', async (req, res, next) => {
  try {
    const statuses = await providerRegistry.getAllProvidersStatus();
    res.setHeader('Content-Type', 'application/json');
    res.json(statuses);
  } catch (err) {
    next(err);
  }
});

providersRouter.post('/:id/test', async (req, res) => {
  const { id } = req.params;
  const adapter = providerRegistry.getAdapter(id);
  if (!adapter) {
    return res.status(404).json({ error: `Provider ${id} not found.` });
  }

  const health = await adapter.checkHealth();
  res.json({
    providerId: id,
    name: adapter.providerName,
    isDemo: adapter.isDemo,
    ...health,
  });
});

providersRouter.get('/models', async (req, res) => {
  try {
    const models = await providerRegistry.getAllModels();
    res.json(models);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
