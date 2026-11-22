import { Router } from 'express';
import { workflowRepo } from '../db/repositories/workflow.repository.ts';
import { workflowEngine } from '../core/workflows/engine.ts';
import { workflowValidator } from '../core/workflows/validator.ts';
import { AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { requireRole } from '../middleware/rbac.middleware.ts';

export const workflowsRouter = Router();

// Validate workflow definition without executing or saving
workflowsRouter.post('/validate', async (req, res) => {
  try {
    const { workflowDefinition } = req.body;
    if (!workflowDefinition) {
      return res.status(400).json({
        valid: false,
        errors: ['Missing workflowDefinition in request payload.'],
      });
    }

    const normalized = workflowValidator.normalizeWorkflowDefinition(workflowDefinition);
    const result = workflowValidator.validateWorkflowDefinition(normalized);
    res.setHeader('Content-Type', 'application/json');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      valid: false,
      errors: [err.message || 'Validation error.'],
    });
  }
});

// List all workflows with normalized v2.0 graph specifications
workflowsRouter.get('/', async (req, res, next) => {
  try {
    const list = await workflowRepo.getWorkflows();
    const normalized = list.map((wf: any) => ({
      ...wf,
      definition: workflowValidator.normalizeWorkflowDefinition(wf.step_definitions, wf.name),
    }));
    res.setHeader('Content-Type', 'application/json');
    res.json(normalized);
  } catch (err) {
    next(err);
  }
});

// List execution runs (must precede /:id so 'runs' is not treated as a workflow UUID)
workflowsRouter.get('/runs', async (req, res) => {
  try {
    const runs = await workflowRepo.getWorkflowRuns();
    res.setHeader('Content-Type', 'application/json');
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get workflow by ID
workflowsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const wf: any = await workflowRepo.getWorkflowById(id);
    if (!wf) {
      return res.status(404).json({ error: `Workflow with ID ${id} not found.` });
    }
    res.setHeader('Content-Type', 'application/json');
    res.json({
      ...wf,
      definition: workflowValidator.normalizeWorkflowDefinition(wf.step_definitions, wf.name),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new workflow with DAG & schema validation
workflowsRouter.post(
  '/',
  requireRole(['analyst', 'operator', 'admin']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { name, description, stepDefinitions, requiresApproval } = req.body;
      if (!name || !stepDefinitions) {
        return res.status(400).json({ error: 'Name and stepDefinitions are required.' });
      }

      // Validate workflow definition
      const normalized = workflowValidator.normalizeWorkflowDefinition(stepDefinitions, name);
      const validation = workflowValidator.validateWorkflowDefinition(normalized);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid workflow definition',
          validationErrors: validation.errors,
        });
      }

      const created = await workflowRepo.createWorkflow({
        userId: req.user!.id,
        name,
        description,
        stepDefinitions: normalized,
        requiresApproval: Boolean(requiresApproval),
      });

      res.setHeader('Content-Type', 'application/json');
      res.status(201).json({
        ...created,
        definition: normalized,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Update existing workflow with DAG & schema validation
workflowsRouter.put(
  '/:id',
  requireRole(['analyst', 'operator', 'admin']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { name, description, stepDefinitions, requiresApproval } = req.body;

      let normalized = undefined;
      if (stepDefinitions) {
        normalized = workflowValidator.normalizeWorkflowDefinition(stepDefinitions, name);
        const validation = workflowValidator.validateWorkflowDefinition(normalized, id);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Invalid workflow definition',
            validationErrors: validation.errors,
          });
        }
      }

      const updated = await workflowRepo.updateWorkflow(id, {
        name,
        description,
        stepDefinitions: normalized,
        requiresApproval: requiresApproval !== undefined ? Boolean(requiresApproval) : undefined,
      });

      res.setHeader('Content-Type', 'application/json');
      res.json({
        ...updated,
        definition: normalized || workflowValidator.normalizeWorkflowDefinition(updated.step_definitions, updated.name),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Execute a workflow DAG
workflowsRouter.post(
  '/:id/run',
  requireRole(['analyst', 'operator', 'admin']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const inputs = req.body.inputs || {};
      const result = await workflowEngine.runWorkflow(id, req.user!.id, inputs);
      res.setHeader('Content-Type', 'application/json');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        error: 'Workflow Execution Failed',
        message: err.message,
      });
    }
  }
);

// Consequential action authorization: requires operator or admin role
workflowsRouter.post(
  '/runs/:id/approve',
  requireRole(['operator', 'admin']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const result = await workflowEngine.resumeApprovedRun(id, req.user!.id);
      res.setHeader('Content-Type', 'application/json');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
