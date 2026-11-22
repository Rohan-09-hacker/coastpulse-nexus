import { Router } from 'express';
import { APPROVED_ENDPOINTS, playgroundDispatcher } from '../core/playground/dispatcher.ts';
import { AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { providerRegistry } from '../core/adapters/registry.ts';
import { executionRepo } from '../db/repositories/execution.repository.ts';
import { coastalRepo } from '../db/repositories/coastal.repository.ts';
import { workflowRepo } from '../db/repositories/workflow.repository.ts';
import { appRegistryRepo } from '../db/repositories/app-registry.repository.ts';

export const playgroundRouter = Router();

playgroundRouter.get('/endpoints', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(APPROVED_ENDPOINTS);
});

playgroundRouter.post('/execute', async (req: AuthenticatedRequest, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { path, payload } = req.body;

  // 1. Enforce SSRF validation and allowlist check
  const check = playgroundDispatcher.validatePath(path);
  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      blocked: true,
      reason: check.reason,
      status: 403,
    });
  }

  const endpoint = check.endpoint!;
  const start = performance.now();

  try {
    let result: any = null;

    // Internal In-Process Safe Dispatcher (No outbound HTTP or loopback sockets)
    switch (endpoint.id) {
      case 'get-providers':
        result = await providerRegistry.getAllProvidersStatus();
        break;
      case 'get-models':
        result = await providerRegistry.getAllModels();
        break;
      case 'generate-completion':
        result = await providerRegistry.executeAndRecord({
          modelId: payload?.modelId || 'gemini-2.5-flash',
          prompt: payload?.prompt || 'Test prompt from API playground',
          temperature: payload?.temperature,
          maxTokens: payload?.maxTokens,
          featureSource: 'playground',
          userId: req.user?.id,
        });
        break;
      case 'get-analytics-summary':
        result = await executionRepo.getAggregatedMetrics();
        break;
      case 'get-coastal-incidents':
        result = await coastalRepo.getIncidents();
        break;
      case 'get-pending-approvals':
        result = await coastalRepo.getPendingApprovals();
        break;
      case 'get-workflows':
        result = await workflowRepo.getWorkflows();
        break;
      case 'get-apps':
        result = await appRegistryRepo.getAllApps();
        break;
      default:
        return res.status(400).json({ error: 'Endpoint handler not implemented.' });
    }

    const durationMs = Math.round(performance.now() - start);

    res.json({
      success: true,
      endpoint: endpoint.path,
      method: endpoint.method,
      durationMs,
      timestamp: new Date().toISOString(),
      data: result,
    });
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    res.status(500).json({
      success: false,
      durationMs,
      error: err.message,
    });
  }
});
