import { z } from 'zod';

export type NodeType =
  | 'input'
  | 'ai_generation'
  | 'data_transform'
  | 'approval_gate'
  | 'output'
  | 'conditional'
  | 'switch'
  | 'nested_workflow';

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
  decision: 'true' | 'false' | string; // 'true', 'false', or switch handle (e.g. 'case_low', 'default')
  reason: string;
  field?: string;
  evaluatedValue?: any;
  operator?: string;
}

export interface DataMapping {
  targetField: string;
  sourceNodeId: string; // '$workflow_input' or a specific node ID
  sourceField: string;
}

export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
}

export interface ObjectSchema {
  type: 'object';
  properties: Record<string, FieldSchema>;
  required?: string[];
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
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

// Zod schemas for runtime schema verification
export const ConditionOperatorZod = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'contains',
  'exists',
  'is_empty',
]);

export const SimpleConditionZod = z.object({
  field: z.string().min(1, 'Field name is required for condition evaluation'),
  operator: ConditionOperatorZod,
  value: z.any().optional(),
});

export const CompoundConditionZod: z.ZodType<CompoundCondition> = z.lazy(() =>
  z.object({
    combinator: z.enum(['AND', 'OR', 'NOT']),
    conditions: z.array(z.union([SimpleConditionZod, CompoundConditionZod])).min(1),
  })
);

export const ConditionConfigZod = z.union([SimpleConditionZod, CompoundConditionZod]);

export const SwitchCaseZod = z.object({
  id: z.string().min(1),
  value: z.any(),
  label: z.string().optional(),
  handle: z.string().min(1),
});

export const SwitchConfigZod = z.object({
  field: z.string().min(1, 'Field name is required for switch evaluation'),
  cases: z.array(SwitchCaseZod).min(1, 'Switch node must have at least one case'),
  defaultHandle: z.string().optional(),
});

export const NestedWorkflowConfigZod = z.object({
  childWorkflowId: z.string().min(1, 'Child workflow ID is required'),
  childWorkflowName: z.string().optional(),
  maxExecutionDepth: z.number().int().positive().optional(),
});

export const FieldSchemaZod = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export const ObjectSchemaZod = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), FieldSchemaZod),
  required: z.array(z.string()).optional(),
});

export const DataMappingZod = z.object({
  targetField: z.string().min(1, 'Target field is required'),
  sourceNodeId: z.string().min(1, 'Source node ID is required'),
  sourceField: z.string().min(1, 'Source field is required'),
});

export const WorkflowNodeZod = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    'input',
    'ai_generation',
    'data_transform',
    'approval_gate',
    'output',
    'conditional',
    'switch',
    'nested_workflow',
  ]),
  targetModel: z.string().optional(),
  promptTemplate: z.string().optional(),
  condition: ConditionConfigZod.optional(),
  switchConfig: SwitchConfigZod.optional(),
  nestedWorkflowConfig: NestedWorkflowConfigZod.optional(),
  inputSchema: ObjectSchemaZod,
  outputSchema: ObjectSchemaZod,
  mappings: z.array(DataMappingZod),
  requiresHumanApproval: z.boolean().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const WorkflowEdgeZod = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const WorkflowDefinitionZod = z.object({
  version: z.literal('2.0'),
  inputSchema: ObjectSchemaZod,
  outputSchema: ObjectSchemaZod,
  nodes: z.array(WorkflowNodeZod).min(1, 'Workflow must contain at least one node'),
  edges: z.array(WorkflowEdgeZod),
});
