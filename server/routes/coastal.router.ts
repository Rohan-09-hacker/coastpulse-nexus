import { Router } from 'express';
import { coastalRepo } from '../db/repositories/coastal.repository.ts';
import { providerRegistry } from '../core/adapters/registry.ts';
import { AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { requireRole } from '../middleware/rbac.middleware.ts';

export const coastalRouter = Router();

coastalRouter.get('/incidents', async (req, res, next) => {
  try {
    const incidents = await coastalRepo.getIncidents();
    res.setHeader('Content-Type', 'application/json');
    res.json(incidents);
  } catch (err) {
    next(err);
  }
});

coastalRouter.get('/incidents/:id', async (req, res, next) => {
  try {
    const data = await coastalRepo.getIncidentById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Incident not found', status: 404 });
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

coastalRouter.post('/incidents', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, incidentType, severity, latitude, longitude, locationName, description, sensorTelemetry } = req.body;
    if (!title || !incidentType || !severity || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing mandatory incident coordinates or classification.' });
    }

    const incident = await coastalRepo.createIncident({
      reportedByUserId: req.user?.id,
      title,
      incidentType,
      severity,
      latitude: Number(latitude),
      longitude: Number(longitude),
      locationName: locationName || 'Offshore Sector',
      description: description || '',
      sensorTelemetry,
    });

    res.json(incident);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

coastalRouter.post('/incidents/:id/assess', async (req: AuthenticatedRequest, res) => {
  try {
    const incidentData = await coastalRepo.getIncidentById(req.params.id);
    if (!incidentData) return res.status(404).json({ error: 'Incident not found' });

    const incident = incidentData.incident;
    const prompt = `Analyze this coastal maritime incident and provide a structured emergency triage assessment:
INCIDENT: "${incident.title}"
TYPE: ${incident.incident_type} | SEVERITY: ${incident.severity}
LOCATION: ${incident.location_name} (Coordinates: ${incident.latitude}, ${incident.longitude})
DESCRIPTION: ${incident.description}
LIVE SENSOR TELEMETRY: ${JSON.stringify(incident.sensor_telemetry || {})}

Provide:
1. Threat Level (LOW, ELEVATED, or CRITICAL)
2. Environmental & Ecological Impact Assessment (marine wildlife, coastline vulnerability, drift forecast)
3. Proposed Mitigation Actions (specify whether each action is consequential and requires operator sign-off)`;

    const selectedModel = (req.body.modelId as string) || 'gemini-2.5-flash';
    const response = await providerRegistry.executeAndRecord({
      modelId: selectedModel,
      prompt,
      featureSource: 'coastal',
      userId: req.user?.id,
    });

    const isSimulated = response.isSimulated;
    const threatLevel = response.text.toUpperCase().includes('CRITICAL') ? 'CRITICAL' : 'ELEVATED';

    const proposedActions = [
      {
        action_id: 'act-barrier-containment',
        name: 'Rapid Deployment of Marine Containment Barriers',
        consequential: true,
        priority: 'immediate',
        resource: 'Regional Spill Response Vessels',
        target_sector: incident.location_name,
      },
      {
        action_id: 'act-broadcast-maritime-warning',
        name: 'Issue Urgent Notice to Mariners & Vessel Exclusion Zone',
        consequential: true,
        priority: 'high',
        resource: 'Coast Guard Sector VHF Channel 16',
        target_sector: incident.location_name,
      },
      {
        action_id: 'act-drone-monitoring',
        name: 'Deploy Autonomous Thermal Slick Mapping Drones',
        consequential: false,
        priority: 'routine',
        resource: 'Station Autonomous Flight Unit',
        target_sector: incident.location_name,
      },
    ];

    const assessment = await coastalRepo.recordAssessment({
      incidentId: incident.id,
      userId: req.user?.id,
      threatLevel,
      environmentalImpactSummary: response.text,
      proposedActions,
      confidenceScore: isSimulated ? 0.94 : 0.89,
      isSimulated,
    });

    res.json({
      assessment,
      executionTelemetry: {
        latencyMs: response.latencyMs,
        metricFidelity: response.metricFidelity,
        totalTokens: response.totalTokens,
        estimatedCostUsd: response.estimatedCostUsd,
        isSimulated: response.isSimulated,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Human Approval Queue Endpoints
coastalRouter.get('/approvals/pending', async (req, res) => {
  try {
    const list = await coastalRepo.getPendingApprovals();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

coastalRouter.post('/approvals/:id/review', requireRole(['operator', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { decision, reviewNotes } = req.body;
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "approved" or "rejected".' });
    }

    const reviewed = await coastalRepo.reviewActionApproval(
      id,
      req.user!.id,
      decision as 'approved' | 'rejected',
      reviewNotes
    );

    res.json({
      message: `Action ${decision.toUpperCase()} by ${req.user!.displayName} (${req.user!.role})`,
      approval: reviewed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
