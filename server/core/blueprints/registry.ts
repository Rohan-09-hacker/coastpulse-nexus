import { pglite } from '../../db/client.ts';
import { ObjectSchema, WorkflowDefinition } from '../workflows/types.ts';
import { workflowRepo } from '../../db/repositories/workflow.repository.ts';

export type IndustryName =
  | 'Education'
  | 'Healthcare'
  | 'Finance'
  | 'Cybersecurity'
  | 'Environmental'
  | 'Maritime';

export interface BlueprintFidelity {
  mode: 'simulated' | 'hybrid_reference';
  dataSource: string;
  externalIntegrationStatus: 'unavailable';
  label: string;
}

export interface IndustryBlueprint {
  id: string;
  industry: IndustryName;
  name: string;
  domain: string;
  description: string;
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  workflowAssociation: {
    workflowId: string;
    workflowName: string;
    requiresHumanApproval: boolean;
    stepCount: number;
    defaultModel: string;
  };
  fidelity: BlueprintFidelity;
  syntheticSampleInput: Record<string, any>;
  workflowDefinition: WorkflowDefinition;
}

function buildStandardBlueprintWorkflow(params: {
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  step1Name: string;
  step1Prompt: string;
  step2Name: string;
  step2Prompt: string;
  approvalStepName?: string;
}): WorkflowDefinition {
  const inputKeys = Object.keys(params.inputSchema.properties);
  const step1Mappings = inputKeys.map((field) => ({
    targetField: field,
    sourceNodeId: '$workflow_input',
    sourceField: field,
  }));

  const nodes: WorkflowDefinition['nodes'] = [
    {
      id: 'step_ingest',
      name: params.step1Name,
      type: 'ai_generation',
      targetModel: 'demo-sim-coastal-v1',
      promptTemplate: params.step1Prompt,
      inputSchema: params.inputSchema,
      outputSchema: {
        type: 'object',
        properties: {
          responseText: { type: 'string', description: 'Initial structured analysis' },
        },
        required: ['responseText'],
      },
      mappings: step1Mappings,
      requiresHumanApproval: false,
      position: { x: 60, y: 140 },
    },
    {
      id: 'step_synthesize',
      name: params.step2Name,
      type: 'ai_generation',
      targetModel: 'demo-sim-coastal-v1',
      promptTemplate: params.step2Prompt,
      inputSchema: {
        type: 'object',
        properties: {
          prior_analysis: { type: 'string', required: true },
        },
        required: ['prior_analysis'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          responseText: { type: 'string', description: 'Synthesized blueprint output' },
        },
        required: ['responseText'],
      },
      mappings: [
        {
          targetField: 'prior_analysis',
          sourceNodeId: 'step_ingest',
          sourceField: 'responseText',
        },
      ],
      requiresHumanApproval: false,
      position: { x: 340, y: 140 },
    },
  ];

  const edges: WorkflowDefinition['edges'] = [
    {
      id: 'edge_ingest_synthesize',
      source: 'step_ingest',
      target: 'step_synthesize',
      sourceHandle: 'responseText',
      targetHandle: 'prior_analysis',
    },
  ];

  if (params.approvalStepName) {
    nodes.push({
      id: 'step_approval',
      name: params.approvalStepName,
      type: 'approval_gate',
      inputSchema: {
        type: 'object',
        properties: {
          proposed_action: { type: 'string', required: true },
        },
        required: ['proposed_action'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          approved: { type: 'boolean' },
        },
      },
      mappings: [
        {
          targetField: 'proposed_action',
          sourceNodeId: 'step_synthesize',
          sourceField: 'responseText',
        },
      ],
      requiresHumanApproval: true,
      position: { x: 620, y: 140 },
    });

    edges.push({
      id: 'edge_synthesize_approval',
      source: 'step_synthesize',
      target: 'step_approval',
      sourceHandle: 'responseText',
      targetHandle: 'proposed_action',
    });
  }

  return {
    version: '2.0',
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    nodes,
    edges,
  };
}

export const INDUSTRY_BLUEPRINTS: Record<string, IndustryBlueprint> = {
  'education-intelligence': {
    id: 'education-intelligence',
    industry: 'Education',
    name: 'Education Intelligence',
    domain: 'Education & EdTech',
    description:
      'Adaptive curriculum generation, multi-tier automated grading, and personalized pedagogical feedback.',
    inputSchema: {
      type: 'object',
      properties: {
        grade_level: { type: 'string', description: 'Target learner grade or level', required: true },
        subject: { type: 'string', description: 'Academic subject area', required: true },
        learning_objective: { type: 'string', description: 'Curriculum standard or objective', required: true },
        student_submission: { type: 'string', description: 'Learner response for rubric evaluation', required: true },
      },
      required: ['grade_level', 'subject', 'learning_objective', 'student_submission'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        rubric_scores: { type: 'string', description: 'Structured multi-tier rubric scoring' },
        concept_breakdown: { type: 'string', description: 'Mastery vs misconception breakdown' },
        remedial_suggestions: { type: 'string', description: 'Personalized next-step exercises' },
      },
    },
    workflowAssociation: {
      workflowId: '66666666-6666-6666-6666-666666666601',
      workflowName: 'Education Curriculum & Rubric Evaluation Pipeline',
      requiresHumanApproval: false,
      stepCount: 2,
      defaultModel: 'demo-sim-coastal-v1',
    },
    fidelity: {
      mode: 'simulated',
      dataSource: 'Synthetic Demo Data',
      externalIntegrationStatus: 'unavailable',
      label: 'SYNTHETIC DEMO DATA — External LMS integration unavailable (Demo Simulator)',
    },
    syntheticSampleInput: {
      grade_level: 'Grade 10',
      subject: 'Marine Ecology',
      learning_objective: 'Explain trophic cascades and coastal kelp forest resilience',
      student_submission:
        'Sea otters control sea urchin populations, which prevents overgrazing of kelp canopies and preserves nursery habitats.',
    },
    workflowDefinition: buildStandardBlueprintWorkflow({
      inputSchema: {
        type: 'object',
        properties: {
          grade_level: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          learning_objective: { type: 'string', required: true },
          student_submission: { type: 'string', required: true },
        },
        required: ['grade_level', 'subject', 'learning_objective', 'student_submission'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          rubric_scores: { type: 'string' },
          concept_breakdown: { type: 'string' },
          remedial_suggestions: { type: 'string' },
        },
      },
      step1Name: 'Evaluate Student Submission Against Rubric',
      step1Prompt:
        'Evaluate {{grade_level}} {{subject}} submission for objective "{{learning_objective}}":\n{{student_submission}}',
      step2Name: 'Synthesize Concept Breakdown & Remedial Plan',
      step2Prompt: 'Generate personalized remedial feedback from rubric evaluation:\n{{prior_analysis}}',
    }),
  },

  'healthcare-intelligence': {
    id: 'healthcare-intelligence',
    industry: 'Healthcare',
    name: 'Healthcare Intelligence',
    domain: 'Healthcare & Clinical',
    description:
      'Clinical note synthesis, triage urgency scoring, and differential symptom analysis with mandatory physician sign-off.',
    inputSchema: {
      type: 'object',
      properties: {
        symptoms: { type: 'string', description: 'Presenting patient symptoms', required: true },
        vital_signs: { type: 'string', description: 'Recorded vitals (HR, BP, SpO2, Temp)', required: true },
        history: { type: 'string', description: 'Relevant medical history & medications', required: true },
      },
      required: ['symptoms', 'vital_signs', 'history'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        urgency_tier: { type: 'string', description: 'Clinical triage acuity tier' },
        differential_hypotheses: { type: 'string', description: 'Ranked diagnostic hypotheses' },
        consequential_actions: { type: 'string', description: 'Proposed orders requiring clinician sign-off' },
      },
    },
    workflowAssociation: {
      workflowId: '66666666-6666-6666-6666-666666666602',
      workflowName: 'Healthcare Clinical Triage & Physician Sign-Off Pipeline',
      requiresHumanApproval: true,
      stepCount: 3,
      defaultModel: 'demo-sim-coastal-v1',
    },
    fidelity: {
      mode: 'simulated',
      dataSource: 'Synthetic Demo Data',
      externalIntegrationStatus: 'unavailable',
      label: 'SYNTHETIC DEMO DATA — External EHR/FHIR integration unavailable (Demo Simulator)',
    },
    syntheticSampleInput: {
      symptoms: 'Acute onset shortness of breath and pleuritic chest discomfort (synthetic demo case)',
      vital_signs: 'HR 108 bpm, BP 134/82 mmHg, SpO2 93% RA, Temp 37.1C',
      history: 'Post-operative knee arthroscopy 6 days prior; no known drug allergies',
    },
    workflowDefinition: buildStandardBlueprintWorkflow({
      inputSchema: {
        type: 'object',
        properties: {
          symptoms: { type: 'string', required: true },
          vital_signs: { type: 'string', required: true },
          history: { type: 'string', required: true },
        },
        required: ['symptoms', 'vital_signs', 'history'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          urgency_tier: { type: 'string' },
          differential_hypotheses: { type: 'string' },
          consequential_actions: { type: 'string' },
        },
      },
      step1Name: 'Synthesize Clinical Vitals & Symptom Intake',
      step1Prompt:
        'Synthesize clinical intake — Symptoms: {{symptoms}} | Vitals: {{vital_signs}} | History: {{history}}',
      step2Name: 'Score Triage Acuity & Differential Hypotheses',
      step2Prompt: 'Generate triage urgency score and consequential order proposal:\n{{prior_analysis}}',
      approvalStepName: 'Mandatory Clinician / Operator Sign-Off',
    }),
  },

  'finance-intelligence': {
    id: 'finance-intelligence',
    industry: 'Finance',
    name: 'Finance Intelligence',
    domain: 'Finance & FinTech',
    description:
      'Automated SEC/regulatory compliance summarization, risk anomaly classification, and audit report generation.',
    inputSchema: {
      type: 'object',
      properties: {
        transaction_batch: { type: 'string', description: 'Batch summary or ledger snippet', required: true },
        financial_statements: { type: 'string', description: 'Quarterly or balance sheet context', required: true },
        jurisdiction: { type: 'string', description: 'Regulatory jurisdiction (e.g., US-SEC, EU-MiCA)', required: true },
      },
      required: ['transaction_batch', 'financial_statements', 'jurisdiction'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        risk_score: { type: 'string', description: 'Normalized compliance anomaly rating' },
        suspicious_flags: { type: 'string', description: 'Detected transaction anomalies' },
        regulatory_audit_memo: { type: 'string', description: 'Audit memo pending compliance sign-off' },
      },
    },
    workflowAssociation: {
      workflowId: '66666666-6666-6666-6666-666666666603',
      workflowName: 'Finance Compliance & Risk Anomaly Audit Pipeline',
      requiresHumanApproval: true,
      stepCount: 3,
      defaultModel: 'demo-sim-coastal-v1',
    },
    fidelity: {
      mode: 'simulated',
      dataSource: 'Synthetic Demo Data',
      externalIntegrationStatus: 'unavailable',
      label: 'SYNTHETIC DEMO DATA — External ERP/ledger feed unavailable (Demo Simulator)',
    },
    syntheticSampleInput: {
      transaction_batch: 'Batch #SIM-409: 14 cross-border wire transfers totaling $248,500 split below threshold',
      financial_statements: 'Q3 Liquidity Reserve: $4.2M; Operating Variance: +12.4%',
      jurisdiction: 'US-SEC / FinCEN',
    },
    workflowDefinition: buildStandardBlueprintWorkflow({
      inputSchema: {
        type: 'object',
        properties: {
          transaction_batch: { type: 'string', required: true },
          financial_statements: { type: 'string', required: true },
          jurisdiction: { type: 'string', required: true },
        },
        required: ['transaction_batch', 'financial_statements', 'jurisdiction'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          risk_score: { type: 'string' },
          suspicious_flags: { type: 'string' },
          regulatory_audit_memo: { type: 'string' },
        },
      },
      step1Name: 'Extract Ledger Anomalies & Jurisdiction Rules',
      step1Prompt:
        'Inspect synthetic transaction batch under {{jurisdiction}}: {{transaction_batch}} | Statements: {{financial_statements}}',
      step2Name: 'Draft Regulatory Audit & Escalation Memo',
      step2Prompt: 'Classify financial risk anomalies and prepare audit memo:\n{{prior_analysis}}',
      approvalStepName: 'Compliance Officer Audit Escalation Sign-Off',
    }),
  },

  'security-intelligence': {
    id: 'security-intelligence',
    industry: 'Cybersecurity',
    name: 'Security Intelligence',
    domain: 'Cybersecurity & SecOps',
    description:
      'SIEM log threat extraction, vulnerability triage, and automated incident response mitigation planning.',
    inputSchema: {
      type: 'object',
      properties: {
        log_payload: { type: 'string', description: 'SIEM / IDS event log payload', required: true },
        cve_indicators: { type: 'string', description: 'Observed CVEs or IOC signatures', required: true },
        network_segment: { type: 'string', description: 'Target VLAN or infrastructure zone', required: true },
      },
      required: ['log_payload', 'cve_indicators', 'network_segment'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        attack_vector: { type: 'string', description: 'Identified intrusion vector' },
        containment_actions: { type: 'string', description: 'Recommended firewall/quarantine actions' },
        quarantine_approval: { type: 'string', description: 'Operator authorization state' },
      },
    },
    workflowAssociation: {
      workflowId: '66666666-6666-6666-6666-666666666604',
      workflowName: 'Cybersecurity SIEM Triage & Quarantine Pipeline',
      requiresHumanApproval: true,
      stepCount: 3,
      defaultModel: 'demo-sim-coastal-v1',
    },
    fidelity: {
      mode: 'simulated',
      dataSource: 'Synthetic Demo Data',
      externalIntegrationStatus: 'unavailable',
      label: 'SYNTHETIC DEMO DATA — External SIEM/SOAR feed unavailable (Demo Simulator)',
    },
    syntheticSampleInput: {
      log_payload: 'SYNTHETIC SIEM ALERT: Repeated SSH key brute-force followed by outbound beacon on 4444/tcp',
      cve_indicators: 'CVE-2024-6387 (regreSSHion indicator), Suspicious IP 198.51.100.42 (TEST-NET-2)',
      network_segment: 'DMZ-Ingress-Cluster-02',
    },
    workflowDefinition: buildStandardBlueprintWorkflow({
      inputSchema: {
        type: 'object',
        properties: {
          log_payload: { type: 'string', required: true },
          cve_indicators: { type: 'string', required: true },
          network_segment: { type: 'string', required: true },
        },
        required: ['log_payload', 'cve_indicators', 'network_segment'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          attack_vector: { type: 'string' },
          containment_actions: { type: 'string' },
          quarantine_approval: { type: 'string' },
        },
      },
      step1Name: 'Extract SIEM Threat Indicators',
      step1Prompt:
        'Analyze SIEM log on {{network_segment}} with IOCs {{cve_indicators}}:\n{{log_payload}}',
      step2Name: 'Formulate Segment Quarantine & Containment Plan',
      step2Prompt: 'Draft consequential containment & host quarantine actions:\n{{prior_analysis}}',
      approvalStepName: 'SecOps Operator Quarantine Authorization',
    }),
  },

  'environmental-intelligence': {
    id: 'environmental-intelligence',
    industry: 'Environmental',
    name: 'Environmental Intelligence',
    domain: 'Climate & Ecology',
    description:
      'Wildfire burn perimeter estimation, urban air quality index forecasting, and carbon footprint telemetry.',
    inputSchema: {
      type: 'object',
      properties: {
        satellite_band_data: { type: 'string', description: 'Thermal / multispectral band summary', required: true },
        weather_station_feed: { type: 'string', description: 'Wind, humidity, and temperature telemetry', required: true },
        geographic_bounds: { type: 'string', description: 'Bounding sector or watershed ID', required: true },
      },
      required: ['satellite_band_data', 'weather_station_feed', 'geographic_bounds'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        hazard_heat_map: { type: 'string', description: 'Estimated burn/plume hotspot perimeter' },
        evacuation_boundary: { type: 'string', description: 'Proposed civil evacuation perimeter' },
        dispersion_forecast: { type: 'string', description: 'AQI & smoke dispersion projection' },
      },
    },
    workflowAssociation: {
      workflowId: '66666666-6666-6666-6666-666666666605',
      workflowName: 'Environmental Hazard & Dispersion Forecast Pipeline',
      requiresHumanApproval: true,
      stepCount: 3,
      defaultModel: 'demo-sim-coastal-v1',
    },
    fidelity: {
      mode: 'simulated',
      dataSource: 'Synthetic Demo Data',
      externalIntegrationStatus: 'unavailable',
      label: 'SYNTHETIC DEMO DATA — External satellite/NOAA sensor feed unavailable (Demo Simulator)',
    },
    syntheticSampleInput: {
      satellite_band_data: 'MODIS/VIIRS synthetic thermal anomaly: 382K hotspot cluster across 420 hectares',
      weather_station_feed: 'Wind NE 26 kts gusting 38 kts, RH 11%, Temp 34C',
      geographic_bounds: 'Sierra Foothills Sector Bravo (38.92N, -120.78W)',
    },
    workflowDefinition: buildStandardBlueprintWorkflow({
      inputSchema: {
        type: 'object',
        properties: {
          satellite_band_data: { type: 'string', required: true },
          weather_station_feed: { type: 'string', required: true },
          geographic_bounds: { type: 'string', required: true },
        },
        required: ['satellite_band_data', 'weather_station_feed', 'geographic_bounds'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          hazard_heat_map: { type: 'string' },
          evacuation_boundary: { type: 'string' },
          dispersion_forecast: { type: 'string' },
        },
      },
      step1Name: 'Analyze Satellite Thermal & Weather Telemetry',
      step1Prompt:
        'Estimate environmental perimeter in {{geographic_bounds}} | Bands: {{satellite_band_data}} | Weather: {{weather_station_feed}}',
      step2Name: 'Project Smoke Dispersion & Evacuation Boundary',
      step2Prompt: 'Generate evacuation boundary and AQI dispersion forecast:\n{{prior_analysis}}',
      approvalStepName: 'Emergency Evacuation Boundary Authorization',
    }),
  },

  'coastal-intelligence': {
    id: 'coastal-intelligence',
    industry: 'Maritime',
    name: 'Coastal Intelligence',
    domain: 'Maritime & Coastal',
    description:
      'Incident telemetry ingestion, ecological risk assessment, and human-in-the-loop disaster mitigation dispatcher.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Maritime incident summary title', required: true },
        incident_type: { type: 'string', description: 'Hazard classification (e.g., oil_spill)', required: true },
        severity: { type: 'string', description: 'Severity level (minor/moderate/severe/critical)', required: true },
        latitude: { type: 'number', description: 'Incident latitude', required: true },
        longitude: { type: 'number', description: 'Incident longitude', required: true },
        sensor_telemetry: { type: 'string', description: 'Buoy wind/wave/tide telemetry', required: true },
      },
      required: ['title', 'incident_type', 'severity', 'latitude', 'longitude', 'sensor_telemetry'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        threat_level: { type: 'string', description: 'Evaluated maritime threat tier' },
        environmental_impact_summary: { type: 'string', description: 'Shoreline and marine habitat impact' },
        proposed_actions: { type: 'string', description: 'Boom deployment & Notice to Mariners actions' },
      },
    },
    workflowAssociation: {
      workflowId: '55555555-5555-5555-5555-555555555555',
      workflowName: 'Coastal Emergency Incident Triage Pipeline',
      requiresHumanApproval: true,
      stepCount: 3,
      defaultModel: 'gemini-3.8-flash',
    },
    fidelity: {
      mode: 'hybrid_reference',
      dataSource: 'Active Reference Template + Synthetic Telemetry Fallback',
      externalIntegrationStatus: 'unavailable',
      label: 'REFERENCE TEMPLATE — Live buoy hardware unavailable; uses synthetic telemetry / Demo Simulator fallback',
    },
    syntheticSampleInput: {
      title: 'Uncontained Diesel Sheen Near Kelp Sanctuary',
      incident_type: 'oil_spill',
      severity: 'critical',
      latitude: 36.6183,
      longitude: -121.9015,
      sensor_telemetry: 'Wind NW 14.2 kts, Wave height 1.4m, Water temp 13.8C, Tide: slack_high',
    },
    workflowDefinition: buildStandardBlueprintWorkflow({
      inputSchema: {
        type: 'object',
        properties: {
          incident_text: { type: 'string', required: true },
        },
        required: ['incident_text'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          final_result: { type: 'string' },
        },
      },
      step1Name: 'Extract Incident Parameters',
      step1Prompt: 'Extract key marine hazard telemetry from this report:\n{{incident_text}}',
      step2Name: 'Synthesize Environmental Impact',
      step2Prompt: 'Analyze coastal and ecological impact based on extracted hazard:\n{{prior_analysis}}',
      approvalStepName: 'Generate Mitigation Action Proposal',
    }),
  },
};

export function getBlueprintById(id: string): IndustryBlueprint | null {
  return INDUSTRY_BLUEPRINTS[id] || null;
}

export function getAllBlueprints(): IndustryBlueprint[] {
  return Object.values(INDUSTRY_BLUEPRINTS);
}

/**
 * Ensures the associated workflow exists in PGlite without altering any existing rows.
 */
export async function ensureBlueprintWorkflow(blueprintId: string): Promise<string> {
  const blueprint = INDUSTRY_BLUEPRINTS[blueprintId];
  if (!blueprint) {
    throw new Error(`Unknown industry blueprint: ${blueprintId}`);
  }

  const wfId = blueprint.workflowAssociation.workflowId;
  const existing = await workflowRepo.getWorkflowById(wfId);
  if (existing) {
    return wfId;
  }

  await pglite.query(
    `INSERT INTO workflows (id, user_id, name, description, step_definitions, requires_approval)
     VALUES ($1, NULL, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [
      wfId,
      blueprint.workflowAssociation.workflowName,
      `[${blueprint.industry} Blueprint] ${blueprint.description}`,
      JSON.stringify(blueprint.workflowDefinition),
      blueprint.workflowAssociation.requiresHumanApproval,
    ]
  );

  return wfId;
}

let allEnsured = false;

export async function ensureAllBlueprintWorkflows(): Promise<void> {
  if (allEnsured) return;
  for (const blueprint of Object.values(INDUSTRY_BLUEPRINTS)) {
    await ensureBlueprintWorkflow(blueprint.id);
  }
  allEnsured = true;
}
