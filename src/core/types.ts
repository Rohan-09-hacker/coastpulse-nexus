export type UserRole = 'admin' | 'analyst' | 'operator' | 'viewer';
export type MetricFidelity = 'actual' | 'estimated' | 'simulated' | 'unavailable';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
}

export interface IndustryBlueprintMeta {
  industry: string;
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  workflowAssociation: {
    workflowId: string;
    workflowName: string;
    requiresHumanApproval: boolean;
    stepCount: number;
    defaultModel: string;
  };
  fidelity: {
    mode: 'simulated' | 'hybrid_reference';
    dataSource: string;
    externalIntegrationStatus: 'unavailable';
    label: string;
  };
  syntheticSampleInput: Record<string, any>;
}

export interface AppModule {
  id: string;
  name: string;
  domain: string;
  description: string;
  version: string;
  status: 'active' | 'registered' | 'draft';
  is_reference_template: boolean;
  input_schema?: { fields: string[] };
  output_schema?: { fields: string[] };
  blueprint?: IndustryBlueprintMeta | null;
  created_at: string;
}

export interface AIProviderStatus {
  id: string;
  name: string;
  isDemo: boolean;
  isHealthy: boolean;
  healthMessage: string;
  latencyMs?: number;
  models: AIModel[];
}

export interface AIModel {
  id: string;
  displayName: string;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  isSimulated: boolean;
  providerId?: string;
  providerName?: string;
}

export interface ExecutionResponse {
  text: string;
  providerId: string;
  modelId: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  metricFidelity: MetricFidelity;
  isSimulated: boolean;
  status: 'success' | 'error';
  errorMessage?: string;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'exists'
  | 'is_empty';

export type LogicalCombinator = 'AND' | 'OR' | 'NOT';

export interface SimpleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface CompoundCondition {
  combinator: LogicalCombinator;
  conditions: Array<SimpleCondition | CompoundCondition>;
}

export type ConditionConfig = SimpleCondition | CompoundCondition;

export interface SwitchCase {
  id: string;
  value: any;
  label?: string;
  handle: string;
}

export interface SwitchConfig {
  field: string;
  cases: SwitchCase[];
  defaultHandle?: string;
}

export interface NestedWorkflowConfig {
  childWorkflowId: string;
  childWorkflowName?: string;
  maxExecutionDepth?: number;
}

export interface BranchDecision {
  nodeId: string;
  nodeName: string;
  decision: 'true' | 'false' | string;
  reason: string;
  field?: string;
  evaluatedValue?: any;
  operator?: string;
}

export interface DataMapping {
  targetField: string;
  sourceNodeId: string;
  sourceField: string;
}

export interface ObjectSchema {
  type: 'object';
  properties: Record<string, { type: 'string' | 'number' | 'boolean' | 'object' | 'array'; description?: string; required?: boolean }>;
  required?: string[];
}

export interface WorkflowNode {
  id: string;
  name: string;
  type:
    | 'input'
    | 'ai_generation'
    | 'data_transform'
    | 'approval_gate'
    | 'output'
    | 'conditional'
    | 'switch'
    | 'nested_workflow';
  targetModel?: string;
  promptTemplate?: string;
  condition?: ConditionConfig;
  switchConfig?: SwitchConfig;
  nestedWorkflowConfig?: NestedWorkflowConfig;
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  mappings: DataMapping[];
  requiresHumanApproval?: boolean;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false' | string;
  targetHandle?: string;
}

export interface WorkflowDefinition {
  version: '2.0';
  inputSchema: ObjectSchema;
  outputSchema: ObjectSchema;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  step_definitions: any;
  definition?: WorkflowDefinition;
  requires_approval: boolean;
  creator_name?: string;
  created_at: string;
}

export interface WorkflowRunResult {
  runId: string;
  status: 'running' | 'pending_approval' | 'completed' | 'failed';
  outputs?: Record<string, any>;
  nodeOutputs?: Record<string, any>;
  message?: string;
  currentStep?: string;
  totalLatencyMs?: number;
  totalTokens?: number | null;
  error?: string;
  branchDecisions?: BranchDecision[];
  skippedNodes?: Array<{ nodeId: string; reason: string }>;
}

export interface EvaluationItem {
  id: string;
  name: string;
  test_prompt: string;
  creator_name?: string;
  models_compared?: number;
  avg_score?: number;
  created_at: string;
}

export interface AnalyticsSummary {
  summary: {
    total_requests: number;
    successful_requests: number;
    error_requests: number;
    avg_latency_ms: number;
    actual_tokens_consumed: number | null;
    actual_cost_usd: number | null;
    simulated_tokens: number | null;
    missing_token_metadata_count: number;
  };
  modelDistribution: Array<{ model_id: string; count: number; avg_latency: number }>;
  providerDistribution: Array<{ provider_id: string; is_simulated: boolean; count: number }>;
  fidelityDistribution: Array<{ metric_fidelity: MetricFidelity; count: number }>;
}

export interface CoastalIncident {
  id: string;
  title: string;
  incident_type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  status: 'reported' | 'triaged' | 'analyzing' | 'mitigation_active' | 'resolved';
  latitude: number;
  longitude: number;
  location_name: string;
  description: string;
  sensor_telemetry?: {
    water_temp_c?: number;
    wind_speed_kts?: number;
    wave_height_m?: number;
    tide_level?: string;
  };
  created_at: string;
}

export interface CoastalApprovalItem {
  id: string;
  incident_id: string;
  assessment_id: string;
  action_type: string;
  action_payload: any;
  is_consequential: boolean;
  status: 'pending_review' | 'approved' | 'rejected';
  incident_title?: string;
  incident_severity?: string;
  location_name?: string;
  requester_name?: string;
  reviewer_name?: string;
  review_notes?: string;
  requested_at: string;
  reviewed_at?: string;
}
