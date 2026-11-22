import {
  WorkflowDefinition,
  WorkflowDefinitionZod,
  ObjectSchema,
  WorkflowNode,
  WorkflowEdge,
} from './types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class WorkflowValidator {
  /**
   * Validates dynamic payloads against an ObjectSchema specification.
   */
  validatePayloadAgainstSchema(
    schema: ObjectSchema,
    payload: any,
    contextName: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        valid: false,
        errors: [`${contextName}: Expected an object payload, received ${typeof payload}.`],
      };
    }

    const requiredFields = schema.required || [];
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        errors.push(`${contextName}: Missing required field "${field}".`);
      }
    }

    // Validate property types if defined
    for (const [propName, propDef] of Object.entries(schema.properties || {})) {
      const val = payload[propName];
      if (val !== undefined && val !== null) {
        if (propDef.type === 'string' && typeof val !== 'string') {
          errors.push(
            `${contextName}: Field "${propName}" expected string, received ${typeof val}.`
          );
        } else if (propDef.type === 'number' && typeof val !== 'number') {
          errors.push(
            `${contextName}: Field "${propName}" expected number, received ${typeof val}.`
          );
        } else if (propDef.type === 'boolean' && typeof val !== 'boolean') {
          errors.push(
            `${contextName}: Field "${propName}" expected boolean, received ${typeof val}.`
          );
        } else if (propDef.type === 'array' && !Array.isArray(val)) {
          errors.push(
            `${contextName}: Field "${propName}" expected array, received ${typeof val}.`
          );
        } else if (
          propDef.type === 'object' &&
          (typeof val !== 'object' || Array.isArray(val))
        ) {
          errors.push(
            `${contextName}: Field "${propName}" expected object, received ${typeof val}.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Performs deep validation of a complete WorkflowDefinition:
   * 1. Zod structure check
   * 2. Edge validation (non-empty, existing source/target, no self-loops)
   * 3. DAG cycle detection (prevents circular execution paths)
   * 4. Step-to-step data mapping validation
   */
  validateWorkflowDefinition(workflow: WorkflowDefinition, currentWorkflowId?: string): ValidationResult {
    const errors: string[] = [];

    // 1. Zod schema validation
    const parseRes = WorkflowDefinitionZod.safeParse(workflow);
    if (!parseRes.success) {
      for (const issue of parseRes.error.issues) {
        errors.push(`Structure error at ${issue.path.join('.')}: ${issue.message}`);
      }
      return { valid: false, errors };
    }

    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of workflow.nodes) {
      if (nodeMap.has(node.id)) {
        errors.push(`Duplicate node ID detected: "${node.id}".`);
      }
      nodeMap.set(node.id, node);
    }

    // 2. Edge and connection validation
    const adjacency = new Map<string, string[]>();
    for (const node of workflow.nodes) {
      adjacency.set(node.id, []);
    }

    for (const edge of workflow.edges) {
      if (edge.source === edge.target) {
        errors.push(`Self-referencing loop detected on node "${edge.source}".`);
        continue;
      }
      if (!nodeMap.has(edge.source)) {
        errors.push(`Edge "${edge.id}" references non-existent source node "${edge.source}".`);
      }
      if (!nodeMap.has(edge.target)) {
        errors.push(`Edge "${edge.id}" references non-existent target node "${edge.target}".`);
      }
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        adjacency.get(edge.source)!.push(edge.target);
      }
    }

    // 3. Cycle Detection via DFS (coloring algorithm: 0 = unvisited, 1 = visiting, 2 = visited)
    const visited = new Map<string, number>();
    for (const nodeId of nodeMap.keys()) {
      visited.set(nodeId, 0);
    }

    const cyclePath: string[] = [];
    let hasCycle = false;

    const dfs = (curr: string, pathStack: string[]): boolean => {
      visited.set(curr, 1); // Mark visiting
      pathStack.push(curr);

      const neighbors = adjacency.get(curr) || [];
      for (const neighbor of neighbors) {
        if (visited.get(neighbor) === 1) {
          // Cycle detected!
          hasCycle = true;
          const cycleStartIdx = pathStack.indexOf(neighbor);
          cyclePath.push(...pathStack.slice(cycleStartIdx), neighbor);
          return true;
        }
        if (visited.get(neighbor) === 0) {
          if (dfs(neighbor, pathStack)) return true;
        }
      }

      pathStack.pop();
      visited.set(curr, 2); // Mark visited
      return false;
    };

    for (const nodeId of nodeMap.keys()) {
      if (visited.get(nodeId) === 0) {
        if (dfs(nodeId, [])) break;
      }
    }

    if (hasCycle) {
      errors.push(
        `Cyclic dependency detected in workflow DAG: ${cyclePath.join(' -> ')}. Workflows must be strictly directed acyclic graphs.`
      );
    }

    // 4. Data Mapping Validation
    // Downstream steps must only reference upstream nodes or $workflow_input
    const reachableUpstream = this.computeAllUpstreamNodes(workflow.nodes, workflow.edges);

    for (const node of workflow.nodes) {
      for (const mapping of node.mappings || []) {
        // Validate target field exists in node's inputSchema
        if (!node.inputSchema.properties[mapping.targetField]) {
          errors.push(
            `Node "${node.name}" (${node.id}): Target mapping field "${mapping.targetField}" is not defined in its inputSchema.`
          );
        }

        if (mapping.sourceNodeId === '$workflow_input') {
          // Check that workflow.inputSchema has this sourceField
          if (!workflow.inputSchema.properties[mapping.sourceField]) {
            errors.push(
              `Node "${node.name}" (${node.id}): Mapping references unknown workflow input field "${mapping.sourceField}".`
            );
          }
        } else {
          // Check source node exists
          const sourceNode = nodeMap.get(mapping.sourceNodeId);
          if (!sourceNode) {
            errors.push(
              `Node "${node.name}" (${node.id}): Mapping references unknown source node "${mapping.sourceNodeId}".`
            );
          } else {
            // Check that sourceNode is strictly upstream of this node
            const upstreams = reachableUpstream.get(node.id) || new Set<string>();
            if (!upstreams.has(mapping.sourceNodeId)) {
              errors.push(
                `Node "${node.name}" (${node.id}): Source node "${sourceNode.name}" (${mapping.sourceNodeId}) is not topologically upstream of this step.`
              );
            }
            // Check that sourceField exists in sourceNode.outputSchema
            if (
              sourceNode.outputSchema &&
              !sourceNode.outputSchema.properties[mapping.sourceField]
            ) {
              errors.push(
                `Node "${node.name}" (${node.id}): Source field "${mapping.sourceField}" not found in outputSchema of "${sourceNode.name}".`
              );
            }
          }
        }
      }
    }

    // 5. Node-Specific Validations (Conditional, Switch, Nested Workflow)
    for (const node of workflow.nodes) {
      if (node.type === 'conditional') {
        if (!node.condition) {
          errors.push(`Conditional node "${node.name}" (${node.id}) requires a condition configuration.`);
        } else {
          errors.push(...this.validateCondition(node.condition, node.name, node.id));
        }

        const outgoingEdges = workflow.edges.filter((e) => e.source === node.id);
        if (outgoingEdges.length === 0) {
          errors.push(`Conditional node "${node.name}" (${node.id}) must have at least one outgoing branch edge.`);
        }
      }

      if (node.type === 'switch') {
        if (!node.switchConfig) {
          errors.push(`Switch node "${node.name}" (${node.id}) requires switchConfig.`);
        } else {
          if (!node.switchConfig.field || typeof node.switchConfig.field !== 'string') {
            errors.push(`Switch node "${node.name}" (${node.id}): switchConfig.field is required.`);
          }
          if (!Array.isArray(node.switchConfig.cases) || node.switchConfig.cases.length === 0) {
            errors.push(`Switch node "${node.name}" (${node.id}): switchConfig.cases must contain at least one case.`);
          } else {
            const seenValues = new Set<string>();
            for (const c of node.switchConfig.cases) {
              const valKey = String(c.value);
              if (seenValues.has(valKey)) {
                errors.push(`Switch node "${node.name}" (${node.id}): Duplicate case value detected: "${c.value}".`);
              }
              seenValues.add(valKey);

              if (!c.handle || typeof c.handle !== 'string') {
                errors.push(`Switch node "${node.name}" (${node.id}): Each switch case must specify a valid handle identifier.`);
              }
            }

            const outgoingEdges = workflow.edges.filter((e) => e.source === node.id);
            if (outgoingEdges.length === 0) {
              errors.push(`Switch node "${node.name}" (${node.id}) must have at least one outgoing branch edge.`);
            }
          }
        }
      }

      if (node.type === 'nested_workflow') {
        if (!node.nestedWorkflowConfig) {
          errors.push(`Nested workflow node "${node.name}" (${node.id}) requires nestedWorkflowConfig.`);
        } else {
          if (!node.nestedWorkflowConfig.childWorkflowId) {
            errors.push(`Nested workflow node "${node.name}" (${node.id}): childWorkflowId is required.`);
          } else if (currentWorkflowId && node.nestedWorkflowConfig.childWorkflowId === currentWorkflowId) {
            errors.push(
              `Nested workflow node "${node.name}" (${node.id}): Direct recursive cycle detected. A workflow cannot invoke itself as a child.`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Deep validation of condition structures, enforcing max depth of 5 and valid operators.
   */
  private validateCondition(
    condition: any,
    nodeName: string,
    nodeId: string,
    path = 'condition',
    depth = 1
  ): string[] {
    const errors: string[] = [];
    if (!condition || typeof condition !== 'object') {
      errors.push(`Node "${nodeName}" (${nodeId}): Invalid condition object at ${path}.`);
      return errors;
    }

    if (depth > 5) {
      errors.push(
        `Node "${nodeName}" (${nodeId}): Condition nesting depth exceeds maximum allowed limit of 5 at ${path}.`
      );
      return errors;
    }

    if ('combinator' in condition) {
      const allowedCombinators = ['AND', 'OR', 'NOT'];
      if (!allowedCombinators.includes(condition.combinator)) {
        errors.push(
          `Node "${nodeName}" (${nodeId}): Invalid logical combinator "${condition.combinator}" at ${path}. Must be AND, OR, or NOT.`
        );
      }
      if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) {
        errors.push(
          `Node "${nodeName}" (${nodeId}): Compound condition at ${path} must have a non-empty "conditions" array.`
        );
      } else {
        condition.conditions.forEach((sub: any, idx: number) => {
          errors.push(
            ...this.validateCondition(sub, nodeName, nodeId, `${path}.conditions[${idx}]`, depth + 1)
          );
        });
      }
    } else {
      if (!condition.field || typeof condition.field !== 'string') {
        errors.push(`Node "${nodeName}" (${nodeId}): condition.field must be specified at ${path}.`);
      }
      const allowedOperators = [
        'equals',
        'not_equals',
        'greater_than',
        'greater_than_or_equal',
        'less_than',
        'less_than_or_equal',
        'contains',
        'exists',
        'is_empty',
      ];
      if (!condition.operator || !allowedOperators.includes(condition.operator)) {
        errors.push(
          `Node "${nodeName}" (${nodeId}): condition.operator "${condition.operator}" at ${path} is invalid or unsupported.`
        );
      }
    }
    return errors;
  }

  /**
   * Helper to compute set of all reachable upstream nodes for each node in DAG.
   */
  private computeAllUpstreamNodes(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[]
  ): Map<string, Set<string>> {
    const upstreamMap = new Map<string, Set<string>>();
    for (const node of nodes) {
      upstreamMap.set(node.id, new Set<string>());
    }

    // Direct incoming
    const inEdges = new Map<string, string[]>();
    for (const node of nodes) {
      inEdges.set(node.id, []);
    }
    for (const edge of edges) {
      if (inEdges.has(edge.target)) {
        inEdges.get(edge.target)!.push(edge.source);
      }
    }

    // Multi-pass closure (Bellman-Ford / transitive closure)
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) {
        const currentSet = upstreamMap.get(node.id)!;
        const initialSize = currentSet.size;
        for (const parentId of inEdges.get(node.id) || []) {
          currentSet.add(parentId);
          const parentUpstreams = upstreamMap.get(parentId);
          if (parentUpstreams) {
            for (const ancestor of parentUpstreams) {
              currentSet.add(ancestor);
            }
          }
        }
        if (currentSet.size > initialSize) {
          changed = true;
        }
      }
    }

    return upstreamMap;
  }

  /**
   * Computes topological sort for node execution order in a DAG.
   */
  topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, WorkflowNode>();
    const adj = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      nodeMap.set(node.id, node);
      adj.set(node.id, []);
    }

    for (const edge of edges) {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        adj.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const sorted: WorkflowNode[] = [];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      sorted.push(nodeMap.get(currId)!);

      for (const neighborId of adj.get(currId) || []) {
        const newDeg = (inDegree.get(neighborId) || 1) - 1;
        inDegree.set(neighborId, newDeg);
        if (newDeg === 0) queue.push(neighborId);
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Topological sort failed: DAG contains cyclic dependencies.');
    }

    return sorted;
  }

  /**
   * Upgrades legacy step definitions (array of step specifications) into full WorkflowDefinition (v2.0)
   */
  normalizeWorkflowDefinition(rawDefinition: any, defaultName = 'Workflow'): WorkflowDefinition {
    // If already in 2.0 format
    if (
      rawDefinition &&
      typeof rawDefinition === 'object' &&
      rawDefinition.version === '2.0' &&
      Array.isArray(rawDefinition.nodes)
    ) {
      return rawDefinition as WorkflowDefinition;
    }

    // Parse if string
    let parsed = rawDefinition;
    if (typeof rawDefinition === 'string') {
      try {
        parsed = JSON.parse(rawDefinition);
      } catch {
        parsed = [];
      }
    }

    if (parsed && parsed.version === '2.0' && Array.isArray(parsed.nodes)) {
      return parsed as WorkflowDefinition;
    }

    // Convert legacy flat array of steps:
    const legacySteps: any[] = Array.isArray(parsed) ? parsed : [];
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    const workflowInputSchema: ObjectSchema = {
      type: 'object',
      properties: {
        incident_text: {
          type: 'string',
          description: 'Incident report telemetry or prompt payload',
          required: true,
        },
      },
      required: ['incident_text'],
    };

    legacySteps.forEach((st: any, idx: number) => {
      const nodeId = `node_${idx + 1}`;
      const prevNodeId = idx > 0 ? `node_${idx}` : null;

      const mappings =
        idx === 0
          ? [
              {
                targetField: 'incident_text',
                sourceNodeId: '$workflow_input',
                sourceField: 'incident_text',
              },
            ]
          : [
              {
                targetField: `step_${idx - 1}_output`,
                sourceNodeId: prevNodeId!,
                sourceField: 'responseText',
              },
            ];

      const inputProperties: Record<string, any> = {};
      if (idx === 0) {
        inputProperties['incident_text'] = { type: 'string', required: true };
      } else {
        inputProperties[`step_${idx - 1}_output`] = { type: 'string', required: true };
      }

      nodes.push({
        id: nodeId,
        name: st.name || `Step ${idx + 1}`,
        type: st.requiresHumanApproval ? 'approval_gate' : 'ai_generation',
        targetModel: st.targetModel || 'gemini-3.8-flash',
        promptTemplate: st.promptTemplate || '{{incident_text}}',
        inputSchema: {
          type: 'object',
          properties: inputProperties,
          required: Object.keys(inputProperties),
        },
        outputSchema: {
          type: 'object',
          properties: {
            responseText: { type: 'string', description: 'Generated text response' },
          },
          required: ['responseText'],
        },
        mappings,
        requiresHumanApproval: Boolean(st.requiresHumanApproval),
        position: { x: 100 + idx * 260, y: 150 },
      });

      if (prevNodeId) {
        edges.push({
          id: `edge_${idx}_${idx + 1}`,
          source: prevNodeId,
          target: nodeId,
          sourceHandle: 'responseText',
          targetHandle: `step_${idx - 1}_output`,
        });
      }
    });

    return {
      version: '2.0',
      inputSchema: workflowInputSchema,
      outputSchema: {
        type: 'object',
        properties: {
          final_result: { type: 'string' },
        },
      },
      nodes,
      edges,
    };
  }
}

export const workflowValidator = new WorkflowValidator();
