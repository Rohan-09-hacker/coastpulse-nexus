import { Router } from 'express';
import { appRegistryRepo } from '../db/repositories/app-registry.repository.ts';
import {
  ensureAllBlueprintWorkflows,
  ensureBlueprintWorkflow,
  getBlueprintById,
} from '../core/blueprints/registry.ts';
import { workflowValidator } from '../core/workflows/validator.ts';
import { workflowEngine } from '../core/workflows/engine.ts';
import { AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { requireRole } from '../middleware/rbac.middleware.ts';

export const appsRouter = Router();

appsRouter.get('/', async (req, res, next) => {
  try {
    await ensureAllBlueprintWorkflows();
    const apps = await appRegistryRepo.getAllApps();
    const enriched = apps.map((app) => {
      const bp = getBlueprintById(app.id);
      return {
        ...app,
        blueprint: bp
          ? {
              industry: bp.industry,
              inputSchema: bp.inputSchema,
              outputSchema: bp.outputSchema,
              workflowAssociation: bp.workflowAssociation,
              fidelity: bp.fidelity,
              syntheticSampleInput: bp.syntheticSampleInput,
            }
          : null,
      };
    });
    res.setHeader('Content-Type', 'application/json');
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

appsRouter.get('/:id', async (req, res, next) => {
  try {
    const app = await appRegistryRepo.getAppById(req.params.id);
    if (!app) {
      return res.status(404).setHeader('Content-Type', 'application/json').json({
        error: 'Not Found',
        message: `Application module '${req.params.id}' is not registered.`,
        status: 404,
      });
    }
    const bp = getBlueprintById(app.id);
    if (bp) {
      await ensureBlueprintWorkflow(app.id);
    }
    res.setHeader('Content-Type', 'application/json');
    res.json({
      ...app,
      blueprint: bp
        ? {
            industry: bp.industry,
            inputSchema: bp.inputSchema,
            outputSchema: bp.outputSchema,
            workflowAssociation: bp.workflowAssociation,
            fidelity: bp.fidelity,
            syntheticSampleInput: bp.syntheticSampleInput,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Connects an industry blueprint directly to the NEXUS 2.2 WorkflowEngine.
 * Enforces RBAC (analyst/operator/admin), validates inputs against the blueprint schema,
 * uses synthetic demo data only when explicitly selected or omitted, and preserves
 * human approval gates and fidelity labeling.
 */
appsRouter.post(
  '/:id/run',
  requireRole(['analyst', 'operator', 'admin']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const app = await appRegistryRepo.getAppById(id);
      const bp = getBlueprintById(id);

      if (!app || !bp) {
        return res.status(404).setHeader('Content-Type', 'application/json').json({
          error: 'Not Found',
          message: `Industry blueprint '${id}' is not registered.`,
        });
      }

      const workflowId = await ensureBlueprintWorkflow(id);
      const hasCustomInputs = req.body && req.body.inputs !== undefined;
      const useSyntheticDemo = req.body?.useSyntheticDemo !== false;
      const rawInputPayload = hasCustomInputs ? req.body.inputs : bp.syntheticSampleInput;
      const usedSyntheticData = !hasCustomInputs || Boolean(req.body?.useSyntheticDemo);

      // Validate input payload strictly against the blueprint's ObjectSchema
      const validation = workflowValidator.validatePayloadAgainstSchema(
        bp.inputSchema,
        rawInputPayload,
        `${bp.industry} Blueprint Input`
      );
      if (!validation.valid) {
        return res.status(400).setHeader('Content-Type', 'application/json').json({
          error: 'Blueprint Schema Validation Failed',
          message: validation.errors.join('; '),
          validationErrors: validation.errors,
        });
      }

      // Map Maritime blueprint fields cleanly into existing seeded Coastal workflow input without altering DB record
      let workflowInputs = { ...rawInputPayload };
      if (id === 'coastal-intelligence' && !workflowInputs.incident_text) {
        const telemetryStr =
          typeof workflowInputs.sensor_telemetry === 'string'
            ? workflowInputs.sensor_telemetry
            : JSON.stringify(workflowInputs.sensor_telemetry || {});
        workflowInputs.incident_text = `[${String(workflowInputs.severity || 'ALERT').toUpperCase()}] ${workflowInputs.title} (${workflowInputs.incident_type}) at (${workflowInputs.latitude}, ${workflowInputs.longitude}). Telemetry: ${telemetryStr}`;
      }

      const overrideModelId = useSyntheticDemo ? 'demo-sim-coastal-v1' : undefined;
      const result = await workflowEngine.runWorkflow(
        workflowId,
        req.user!.id,
        workflowInputs,
        [],
        overrideModelId
      );

      res.setHeader('Content-Type', 'application/json');
      res.json({
        blueprintId: bp.id,
        industry: bp.industry,
        workflowId,
        workflowName: bp.workflowAssociation.workflowName,
        usedSyntheticData,
        fidelity: useSyntheticDemo
          ? {
              mode: 'simulated',
              label: bp.fidelity.label,
              externalIntegrationStatus: bp.fidelity.externalIntegrationStatus,
              isSimulated: true,
            }
          : {
              mode: 'actual',
              label: 'LIVE MODEL EXECUTION — External telemetry unavailable',
              externalIntegrationStatus: bp.fidelity.externalIntegrationStatus,
              isSimulated: false,
            },
        ...result,
      });
    } catch (err: any) {
      res.status(400).setHeader('Content-Type', 'application/json').json({
        error: 'Blueprint Execution Failed',
        message: err.message,
      });
    }
  }
);
