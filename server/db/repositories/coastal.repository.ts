import { pglite } from '../client.ts';
import { v4 as uuidv4 } from 'uuid';

export interface CoastalIncident {
  id: string;
  reported_by_user_id?: string;
  title: string;
  incident_type: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  location_name: string;
  description: string;
  sensor_telemetry?: any;
  created_at: string;
  updated_at: string;
}

export class CoastalRepository {
  async getIncidents(): Promise<CoastalIncident[]> {
    const res = await pglite.query<CoastalIncident>(
      `SELECT * FROM coastal_incidents ORDER BY created_at DESC`
    );
    return res.rows;
  }

  async getIncidentById(id: string) {
    const incidentRes = await pglite.query<CoastalIncident>(
      `SELECT * FROM coastal_incidents WHERE id = $1`,
      [id]
    );
    if (!incidentRes.rows[0]) return null;

    const assessmentsRes = await pglite.query(
      `SELECT * FROM coastal_incident_assessments WHERE incident_id = $1 ORDER BY generated_at DESC`,
      [id]
    );

    const approvalsRes = await pglite.query(
      `SELECT a.*, u.display_name as reviewer_name 
       FROM coastal_action_approvals a
       LEFT JOIN users u ON a.reviewed_by_user_id = u.id
       WHERE a.incident_id = $1 
       ORDER BY a.requested_at DESC`,
      [id]
    );

    return {
      incident: incidentRes.rows[0],
      assessments: assessmentsRes.rows,
      approvals: approvalsRes.rows,
    };
  }

  async createIncident(input: {
    reportedByUserId?: string;
    title: string;
    incidentType: string;
    severity: string;
    latitude: number;
    longitude: number;
    locationName: string;
    description: string;
    sensorTelemetry?: any;
  }) {
    const id = uuidv4();
    const res = await pglite.query(
      `INSERT INTO coastal_incidents (
        id, reported_by_user_id, title, incident_type, severity, status,
        latitude, longitude, location_name, description, sensor_telemetry
      ) VALUES ($1, $2, $3, $4, $5, 'reported', $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        input.reportedByUserId || null,
        input.title,
        input.incidentType,
        input.severity,
        input.latitude,
        input.longitude,
        input.locationName,
        input.description,
        input.sensorTelemetry ? JSON.stringify(input.sensorTelemetry) : null,
      ]
    );
    return res.rows[0];
  }

  async recordAssessment(input: {
    incidentId: string;
    userId?: string;
    executionId?: string;
    threatLevel: string;
    environmentalImpactSummary: string;
    proposedActions: any[];
    confidenceScore: number;
    isSimulated: boolean;
  }) {
    const id = uuidv4();
    const res = await pglite.query(
      `INSERT INTO coastal_incident_assessments (
        id, incident_id, user_id, execution_id, threat_level,
        environmental_impact_summary, proposed_actions, confidence_score, is_simulated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        input.incidentId,
        input.userId || null,
        input.executionId || null,
        input.threatLevel,
        input.environmentalImpactSummary,
        JSON.stringify(input.proposedActions),
        input.confidenceScore,
        input.isSimulated,
      ]
    );

    // If proposed actions contain consequential actions, automatically register them in the human approval queue
    for (const action of input.proposedActions) {
      if (action.consequential) {
        const approvalId = uuidv4();
        await pglite.query(
          `INSERT INTO coastal_action_approvals (
            id, incident_id, assessment_id, action_type, action_payload, is_consequential, status, requested_by_user_id
          ) VALUES ($1, $2, $3, $4, $5, true, 'pending_review', $6)`,
          [
            approvalId,
            input.incidentId,
            id,
            action.name || action.action_id || 'consequential_action',
            JSON.stringify(action),
            input.userId || null,
          ]
        );
      }
    }

    // Update incident status to 'triaged'
    await pglite.query(
      `UPDATE coastal_incidents SET status = 'triaged', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [input.incidentId]
    );

    return res.rows[0];
  }

  async getPendingApprovals() {
    const res = await pglite.query(`
      SELECT 
        a.*,
        i.title as incident_title,
        i.severity as incident_severity,
        i.location_name,
        req_u.display_name as requester_name,
        rev_u.display_name as reviewer_name
      FROM coastal_action_approvals a
      JOIN coastal_incidents i ON a.incident_id = i.id
      LEFT JOIN users req_u ON a.requested_by_user_id = req_u.id
      LEFT JOIN users rev_u ON a.reviewed_by_user_id = rev_u.id
      ORDER BY a.requested_at DESC
    `);
    return res.rows;
  }

  async reviewActionApproval(
    approvalId: string,
    reviewedByUserId: string,
    decision: 'approved' | 'rejected',
    reviewNotes?: string
  ) {
    const res = await pglite.query<any>(
      `UPDATE coastal_action_approvals 
       SET status = $1, reviewed_by_user_id = $2, review_notes = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [decision, reviewedByUserId, reviewNotes || null, approvalId]
    );

    const approval = res.rows[0];
    if (approval && decision === 'approved') {
      // Advance incident to 'mitigation_active'
      await pglite.query(
        `UPDATE coastal_incidents SET status = 'mitigation_active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.incident_id]
      );
    }
    return approval;
  }
}

export const coastalRepo = new CoastalRepository();
