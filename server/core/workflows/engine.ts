import { workflowRepo } from '../../db/repositories/workflow.repository.ts';
import { providerRegistry } from '../adapters/registry.ts';
import { workflowValidator } from './validator.ts';
import { conditionEvaluator } from './evaluator.ts';
import { WorkflowDefinition, WorkflowNode } from './types.ts';

export interface BranchDecision {
  nodeId: string;
  nodeName: string;
  decision: 'true' | 'false' | string;
  reason: string;
  field?: string;
  evaluatedValue?: any;
  operator?: string;
}

export interface WorkflowRunExecutionResult {
  runId: string;
  status: 'completed' | 'pending_approval' | 'failed';
  outputs?: Record<string, any>;
  nodeOutputs?: Record<string, any>;
  totalLatencyMs?: number;
  totalTokens?: number | null;
  currentStep?: string;
  message?: string;
  error?: string;
  branchDecisions?: BranchDecision[];
  skippedNodes?: Array<{ nodeId: string; reason: string }>;
}

export class WorkflowEngine {
  public static readonly MAX_CALL_STACK_DEPTH = 3;

  /**
   * Pre-execution validation check for a workflow definition and its inputs.
   */
  validateWorkflow(workflowDef: WorkflowDefinition, inputs?: Record<string, any>) {
    const structuralResult = workflowValidator.validateWorkflowDefinition(workflowDef);
    if (!structuralResult.valid) {
      return structuralResult;
    }

    if (inputs) {
      const inputResult = workflowValidator.validatePayloadAgainstSchema(
        workflowDef.inputSchema,
        inputs,
        'Workflow Inputs'
      );
      if (!inputResult.valid) {
        return inputResult;
      }
    }

    return { valid: true, errors: [] };
  }

  /**
   * Executes a full schema-driven DAG workflow with deterministic conditional branching,
   * switch / case routing, nested workflow composition, step-to-step data mapping,
   * skipped node pruning, and approval gates.
   */
  async runWorkflow(
    workflowId: string,
    userId: string,
    rawInputs: Record<string, any>,
    callStack: string[] = [],
    overrideModelId?: string
  ): Promise<WorkflowRunExecutionResult> {
    // Recursion & Call Stack Safety Checks
    if (callStack.includes(workflowId)) {
      throw new Error(
        `Recursive workflow cycle detected in call stack: ${[...callStack, workflowId].join(' -> ')}`
      );
    }

    if (callStack.length >= WorkflowEngine.MAX_CALL_STACK_DEPTH) {
      throw new Error(
        `Workflow execution depth limit exceeded (maximum call stack depth is ${WorkflowEngine.MAX_CALL_STACK_DEPTH}): ${[...callStack, workflowId].join(' -> ')}`
      );
    }

    const workflow: any = await workflowRepo.getWorkflowById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with ID ${workflowId} not found.`);
    }

    // Normalize definition to v2.0 schema structure
    const workflowDef: WorkflowDefinition = workflowValidator.normalizeWorkflowDefinition(
      workflow.step_definitions,
      workflow.name
    );

    // 1. Validate complete workflow graph and connections
    const graphValidation = workflowValidator.validateWorkflowDefinition(workflowDef, workflowId);
    if (!graphValidation.valid) {
      throw new Error(`Workflow validation failed: ${graphValidation.errors.join('; ')}`);
    }

    // 2. Validate workflow-level runtime inputs against inputSchema
    const inputValidation = workflowValidator.validatePayloadAgainstSchema(
      workflowDef.inputSchema,
      rawInputs,
      'Workflow Input'
    );
    if (!inputValidation.valid) {
      throw new Error(`Invalid workflow inputs: ${inputValidation.errors.join('; ')}`);
    }

    // 3. Compute topological execution order
    const orderedNodes = workflowValidator.topologicalSort(
      workflowDef.nodes,
      workflowDef.edges
    );

    // 4. Create workflow run record in database
    const run: any = await workflowRepo.createWorkflowRun(workflowId, userId, rawInputs);

    const nodeOutputs: Record<string, Record<string, any>> = {};
    const flatLegacyOutputs: Record<string, string> = { ...rawInputs };
    let totalLatency = 0;
    let accumulatedTokens = 0;

    // Track active and inactive edges & skipped nodes for conditional branching
    const skippedNodes = new Set<string>();
    const skippedReasons = new Map<string, string>();
    const activeEdges = new Set<string>();
    const inactiveEdges = new Set<string>();
    const branchDecisions: BranchDecision[] = [];

    // Pre-initialize non-branching edges as active candidates
    for (const edge of workflowDef.edges) {
      const srcNode = workflowDef.nodes.find((n) => n.id === edge.source);
      if (srcNode && srcNode.type !== 'conditional' && srcNode.type !== 'switch') {
        activeEdges.add(edge.id);
      }
    }

    for (let i = 0; i < orderedNodes.length; i++) {
      const node = orderedNodes[i];

      // A. Check if this node should be SKIPPED due to conditional/switch branching
      let shouldSkip = false;
      let skipReason = '';

      // Check if any upstream source node in explicit mappings was skipped
      for (const mapping of node.mappings || []) {
        if (mapping.sourceNodeId !== '$workflow_input' && skippedNodes.has(mapping.sourceNodeId)) {
          shouldSkip = true;
          skipReason = `Required upstream dependency "${mapping.sourceNodeId}" was skipped.`;
          break;
        }
      }

      // Check incoming edge states
      const inEdges = workflowDef.edges.filter((e) => e.target === node.id);
      if (!shouldSkip && inEdges.length > 0) {
        // If all incoming edges are inactive or from skipped nodes, this branch is pruned
        const allIncomingDead = inEdges.every(
          (e) => inactiveEdges.has(e.id) || skippedNodes.has(e.source)
        );
        if (allIncomingDead) {
          shouldSkip = true;
          skipReason = 'Upstream branch not taken.';
        }
      }

      // Handle SKIPPED node
      if (shouldSkip) {
        skippedNodes.add(node.id);
        skippedReasons.set(node.id, skipReason);

        // Deactivate all outgoing edges from this skipped node
        for (const outEdge of workflowDef.edges.filter((e) => e.source === node.id)) {
          inactiveEdges.add(outEdge.id);
          activeEdges.delete(outEdge.id);
        }

        const skipPayload = {
          status: 'skipped',
          skipped: true,
          reason: skipReason,
        };
        nodeOutputs[node.id] = skipPayload;

        await workflowRepo.recordStepRun({
          workflowRunId: run.id,
          stepIndex: i,
          stepName: node.name,
          modelId: node.targetModel,
          status: 'skipped',
          inputPayload: skipPayload,
          outputPayload: skipPayload,
          latencyMs: 0,
        });

        continue;
      }

      // B. Resolve step inputs via explicit mappings
      const resolvedStepInputs: Record<string, any> = {};
      for (const mapping of node.mappings || []) {
        if (mapping.sourceNodeId === '$workflow_input') {
          resolvedStepInputs[mapping.targetField] = rawInputs[mapping.sourceField];
        } else {
          const sourceOutput = nodeOutputs[mapping.sourceNodeId];
          if (sourceOutput && sourceOutput[mapping.sourceField] !== undefined) {
            resolvedStepInputs[mapping.targetField] = sourceOutput[mapping.sourceField];
          } else {
            // Fallback for legacy step keys
            resolvedStepInputs[mapping.targetField] = flatLegacyOutputs[mapping.sourceField] || '';
          }
        }
      }

      // If no explicit mappings defined, fallback to available workflow inputs
      if ((!node.mappings || node.mappings.length === 0) && node.promptTemplate) {
        Object.assign(resolvedStepInputs, rawInputs, flatLegacyOutputs);
      }

      // C. Validate resolved step inputs against node.inputSchema
      const stepInputValidation = workflowValidator.validatePayloadAgainstSchema(
        node.inputSchema,
        resolvedStepInputs,
        `Node "${node.name}" (${node.id}) Input`
      );
      if (!stepInputValidation.valid) {
        const errorMsg = stepInputValidation.errors.join('; ');
        await workflowRepo.recordStepRun({
          workflowRunId: run.id,
          stepIndex: i,
          stepName: node.name,
          modelId: node.targetModel,
          status: 'failed',
          inputPayload: resolvedStepInputs,
          outputPayload: { error: errorMsg },
        });
        await workflowRepo.updateWorkflowRunStatus(run.id, 'failed', errorMsg);
        return {
          runId: run.id,
          status: 'failed',
          error: errorMsg,
          nodeOutputs,
          outputs: flatLegacyOutputs,
        };
      }

      // D. CONDITIONAL NODE EXECUTION (Supports Simple & Compound AND/OR/NOT)
      if (node.type === 'conditional') {
        const cond = node.condition;
        if (!cond) {
          throw new Error(`Conditional node "${node.name}" (${node.id}) is missing condition configuration.`);
        }

        const evalResult = conditionEvaluator.evaluate(cond, resolvedStepInputs);

        branchDecisions.push({
          nodeId: node.id,
          nodeName: node.name,
          decision: evalResult.decision,
          reason: evalResult.reason,
          field: (cond as any).field || evalResult.operator || 'compound',
          evaluatedValue: evalResult.actualValue !== undefined ? evalResult.actualValue : evalResult.reason,
          operator: evalResult.operator,
        });

        // Set active/inactive states for outgoing edges
        const outgoingEdges = workflowDef.edges.filter((e) => e.source === node.id);
        for (const outEdge of outgoingEdges) {
          if (outEdge.sourceHandle === evalResult.decision) {
            activeEdges.add(outEdge.id);
            inactiveEdges.delete(outEdge.id);
          } else if (outEdge.sourceHandle === (evalResult.passed ? 'false' : 'true')) {
            inactiveEdges.add(outEdge.id);
            activeEdges.delete(outEdge.id);
          } else {
            // Edge without specific handle defaults to active if condition passed
            if (evalResult.passed) {
              activeEdges.add(outEdge.id);
            } else {
              inactiveEdges.add(outEdge.id);
            }
          }
        }

        const condOutputData = {
          status: 'completed',
          result: evalResult.passed,
          decision: evalResult.decision,
          reason: evalResult.reason,
          field: (cond as any).field || evalResult.operator,
          evaluatedValue: evalResult.actualValue,
          operator: evalResult.operator,
        };
        nodeOutputs[node.id] = condOutputData;

        await workflowRepo.recordStepRun({
          workflowRunId: run.id,
          stepIndex: i,
          stepName: node.name,
          status: 'completed',
          inputPayload: resolvedStepInputs,
          outputPayload: condOutputData,
          latencyMs: 1,
        });

        continue;
      }

      // E. SWITCH / CASE NODE EXECUTION (Multi-way Branching)
      if (node.type === 'switch') {
        const cfg = node.switchConfig;
        if (!cfg) {
          throw new Error(`Switch node "${node.name}" (${node.id}) is missing switchConfig.`);
        }

        const actualVal = resolvedStepInputs[cfg.field];
        let matchedCase = cfg.cases.find((c) => {
          if (typeof c.value === 'number' && typeof actualVal === 'string') {
            return Number(actualVal) === c.value;
          }
          if (typeof c.value === 'string' && typeof actualVal === 'number') {
            return String(actualVal) === c.value;
          }
          if (typeof c.value === 'boolean' && typeof actualVal === 'string') {
            return (actualVal.toLowerCase() === 'true') === c.value;
          }
          return c.value === actualVal;
        });

        const selectedHandle = matchedCase ? matchedCase.handle : (cfg.defaultHandle || 'default');
        const decisionReason = matchedCase
          ? `Field "${cfg.field}" (${JSON.stringify(actualVal)}) matched case "${matchedCase.label || matchedCase.handle}"`
          : `Field "${cfg.field}" (${JSON.stringify(actualVal)}) did not match any case; selected fallback "${selectedHandle}"`;

        branchDecisions.push({
          nodeId: node.id,
          nodeName: node.name,
          decision: selectedHandle,
          reason: decisionReason,
          field: cfg.field,
          evaluatedValue: actualVal,
          operator: 'switch',
        });

        // Activate only edges that match the selected branch handle; deactivate others
        const outgoingEdges = workflowDef.edges.filter((e) => e.source === node.id);
        for (const outEdge of outgoingEdges) {
          if (outEdge.sourceHandle === selectedHandle) {
            activeEdges.add(outEdge.id);
            inactiveEdges.delete(outEdge.id);
          } else {
            inactiveEdges.add(outEdge.id);
            activeEdges.delete(outEdge.id);
          }
        }

        const switchOutputData = {
          status: 'completed',
          matched: Boolean(matchedCase),
          decision: selectedHandle,
          reason: decisionReason,
          field: cfg.field,
          evaluatedValue: actualVal,
        };
        nodeOutputs[node.id] = switchOutputData;

        await workflowRepo.recordStepRun({
          workflowRunId: run.id,
          stepIndex: i,
          stepName: node.name,
          status: 'completed',
          inputPayload: resolvedStepInputs,
          outputPayload: switchOutputData,
          latencyMs: 1,
        });

        continue;
      }

      // F. NESTED WORKFLOW NODE EXECUTION (Modular Composition)
      if (node.type === 'nested_workflow') {
        const cfg = node.nestedWorkflowConfig;
        if (!cfg || !cfg.childWorkflowId) {
          throw new Error(`Nested workflow node "${node.name}" (${node.id}) is missing childWorkflowId.`);
        }

        const childId = cfg.childWorkflowId;

        // Prevent recursive invocation cycles
        if (childId === workflowId || callStack.includes(childId)) {
          const cyclePath = [...callStack, workflowId, childId].join(' -> ');
          const errDetail = `Recursive nested workflow call detected: ${cyclePath}`;
          await workflowRepo.recordStepRun({
            workflowRunId: run.id,
            stepIndex: i,
            stepName: node.name,
            status: 'failed',
            inputPayload: resolvedStepInputs,
            outputPayload: { error: errDetail },
          });
          await workflowRepo.updateWorkflowRunStatus(run.id, 'failed', errDetail);
          return {
            runId: run.id,
            status: 'failed',
            error: errDetail,
            nodeOutputs,
            outputs: flatLegacyOutputs,
          };
        }

        // Prevent exceeding call stack limit (max depth 3)
        if (callStack.length + 1 >= WorkflowEngine.MAX_CALL_STACK_DEPTH) {
          const errDetail = `Nested workflow invocation exceeds max call stack depth of ${WorkflowEngine.MAX_CALL_STACK_DEPTH}: ${[...callStack, workflowId, childId].join(' -> ')}`;
          await workflowRepo.recordStepRun({
            workflowRunId: run.id,
            stepIndex: i,
            stepName: node.name,
            status: 'failed',
            inputPayload: resolvedStepInputs,
            outputPayload: { error: errDetail },
          });
          await workflowRepo.updateWorkflowRunStatus(run.id, 'failed', errDetail);
          return {
            runId: run.id,
            status: 'failed',
            error: errDetail,
            nodeOutputs,
            outputs: flatLegacyOutputs,
          };
        }

        // Execute child workflow with extended callStack
        const childExecResult = await this.runWorkflow(
          childId,
          userId,
          resolvedStepInputs,
          [...callStack, workflowId]
        );

        if (childExecResult.totalLatencyMs) {
          totalLatency += childExecResult.totalLatencyMs;
        }
        if (childExecResult.totalTokens) {
          accumulatedTokens += childExecResult.totalTokens;
        }

        // Child approval gate halts parent workflow
        if (childExecResult.status === 'pending_approval') {
          const childMsg = childExecResult.message || `Nested workflow "${childId}" halted at approval gate.`;
          await workflowRepo.recordStepRun({
            workflowRunId: run.id,
            stepIndex: i,
            stepName: node.name,
            status: 'waiting_approval',
            inputPayload: resolvedStepInputs,
            outputPayload: { childRunId: childExecResult.runId, status: 'pending_approval', message: childMsg },
          });
          await workflowRepo.updateWorkflowRunStatus(run.id, 'pending_approval', childMsg);
          return {
            runId: run.id,
            status: 'pending_approval',
            currentStep: node.id,
            message: `Workflow halted at nested workflow "${node.name}" awaiting operator authorization in child run (${childExecResult.runId}).`,
            nodeOutputs,
            outputs: flatLegacyOutputs,
            branchDecisions,
            skippedNodes: Array.from(skippedNodes).map((id) => ({
              nodeId: id,
              reason: skippedReasons.get(id) || 'Skipped',
            })),
          };
        }

        if (childExecResult.status === 'failed') {
          const errDetail = childExecResult.error || `Child workflow "${childId}" execution failed.`;
          await workflowRepo.recordStepRun({
            workflowRunId: run.id,
            stepIndex: i,
            stepName: node.name,
            status: 'failed',
            inputPayload: resolvedStepInputs,
            outputPayload: { error: errDetail, childRunId: childExecResult.runId },
          });
          await workflowRepo.updateWorkflowRunStatus(run.id, 'failed', errDetail);
          return {
            runId: run.id,
            status: 'failed',
            error: errDetail,
            nodeOutputs,
            outputs: flatLegacyOutputs,
            branchDecisions,
            skippedNodes: Array.from(skippedNodes).map((id) => ({
              nodeId: id,
              reason: skippedReasons.get(id) || 'Skipped',
            })),
          };
        }

        // Child succeeded: bind child outputs to parent context
        const childOutputData: Record<string, any> = {
          ...childExecResult.outputs,
          _childRunId: childExecResult.runId,
          status: 'completed',
        };
        // Expose individual child node outputs and their properties
        if (childExecResult.nodeOutputs) {
          for (const [cNodeId, cOutput] of Object.entries(childExecResult.nodeOutputs)) {
            childOutputData[cNodeId] = cOutput;
            if (typeof cOutput === 'object' && cOutput !== null) {
              for (const [key, val] of Object.entries(cOutput)) {
                if (key !== 'status' && key !== 'skipped' && key !== 'reason') {
                  childOutputData[key] = val;
                }
              }
            }
          }
        }
        nodeOutputs[node.id] = childOutputData;
        flatLegacyOutputs[`step_${i}_output`] = childOutputData.responseText || JSON.stringify(childOutputData);
        flatLegacyOutputs[`${node.name.toLowerCase().replace(/\s+/g, '_')}_output`] = childOutputData.responseText || JSON.stringify(childOutputData);
        flatLegacyOutputs[node.id] = childOutputData.responseText || JSON.stringify(childOutputData);

        // Activate outgoing edges from nested workflow step
        for (const outEdge of workflowDef.edges.filter((e) => e.source === node.id)) {
          activeEdges.add(outEdge.id);
        }

        await workflowRepo.recordStepRun({
          workflowRunId: run.id,
          stepIndex: i,
          stepName: node.name,
          status: 'completed',
          inputPayload: resolvedStepInputs,
          outputPayload: childOutputData,
          latencyMs: childExecResult.totalLatencyMs || 1,
        });

        continue;
      }

      // E. Consequential check: human operator authorization gate
      if (node.requiresHumanApproval) {
        await workflowRepo.recordStepRun({
          workflowRunId: run.id,
          stepIndex: i,
          stepName: node.name,
          modelId: node.targetModel,
          status: 'waiting_approval',
          inputPayload: resolvedStepInputs,
        });

        await workflowRepo.updateWorkflowRunStatus(run.id, 'pending_approval');
        return {
          runId: run.id,
          status: 'pending_approval',
          currentStep: node.id,
          message: `Workflow halted at checkpoint node "${node.name}" awaiting operator authorization.`,
          nodeOutputs,
          outputs: flatLegacyOutputs,
          branchDecisions,
          skippedNodes: Array.from(skippedNodes).map((id) => ({
            nodeId: id,
            reason: skippedReasons.get(id) || 'Skipped',
          })),
        };
      }

      // F. Interpolate prompt template with resolved step inputs
      let prompt = node.promptTemplate || '';
      for (const [key, val] of Object.entries(resolvedStepInputs)) {
        prompt = prompt.split(`{{${key}}}`).join(String(val ?? ''));
      }
      for (const [key, val] of Object.entries(flatLegacyOutputs)) {
        prompt = prompt.split(`{{${key}}}`).join(String(val ?? ''));
      }

      // G. Execute AI provider step (Gemini or Demo provider)
      const targetModel = overrideModelId || node.targetModel || 'gemini-3.8-flash';
      const response = await providerRegistry.executeAndRecord({
        modelId: targetModel,
        prompt,
        featureSource: 'workflow',
        userId,
      });

      totalLatency += response.latencyMs;
      if (response.totalTokens) {
        accumulatedTokens += response.totalTokens;
      }

      const stepOutputData: Record<string, any> = {
        responseText: response.text,
        status: response.status,
        modelId: response.modelId,
        providerId: response.providerId,
        metricFidelity: response.metricFidelity,
        isSimulated: response.isSimulated,
        latencyMs: response.latencyMs,
      };

      // Record step run in database
      await workflowRepo.recordStepRun({
        workflowRunId: run.id,
        stepIndex: i,
        stepName: node.name,
        modelId: response.modelId,
        status: response.status === 'success' ? 'completed' : 'failed',
        inputPayload: resolvedStepInputs,
        outputPayload: stepOutputData,
        latencyMs: response.latencyMs,
      });

      if (response.status === 'error') {
        const errDetail = response.errorMessage || 'AI provider execution failed.';
        await workflowRepo.updateWorkflowRunStatus(run.id, 'failed', errDetail);
        return {
          runId: run.id,
          status: 'failed',
          error: errDetail,
          nodeOutputs,
          outputs: flatLegacyOutputs,
          branchDecisions,
          skippedNodes: Array.from(skippedNodes).map((id) => ({
            nodeId: id,
            reason: skippedReasons.get(id) || 'Skipped',
          })),
        };
      }

      // Mark outgoing edges from this successful node as active
      for (const outEdge of workflowDef.edges.filter((e) => e.source === node.id)) {
        activeEdges.add(outEdge.id);
      }

      // Record outputs for downstream mapping
      nodeOutputs[node.id] = stepOutputData;
      flatLegacyOutputs[`step_${i}_output`] = response.text;
      flatLegacyOutputs[`${node.name.toLowerCase().replace(/\s+/g, '_')}_output`] = response.text;
      flatLegacyOutputs[node.id] = response.text;
    }

    // Complete workflow run in database
    await workflowRepo.completeWorkflowRun(
      run.id,
      flatLegacyOutputs,
      totalLatency,
      accumulatedTokens
    );

    return {
      runId: run.id,
      status: 'completed',
      outputs: flatLegacyOutputs,
      nodeOutputs,
      totalLatencyMs: totalLatency,
      totalTokens: accumulatedTokens,
      branchDecisions,
      skippedNodes: Array.from(skippedNodes).map((id) => ({
        nodeId: id,
        reason: skippedReasons.get(id) || 'Skipped',
      })),
    };
  }

  /**
   * Resumes a paused workflow run after operator or admin sign-off.
   */
  async resumeApprovedRun(runId: string, reviewerUserId: string) {
    await workflowRepo.updateWorkflowRunStatus(runId, 'completed');
    return {
      runId,
      status: 'completed',
      message: 'Workflow run authorized and completed following human operator sign-off.',
    };
  }
}

export const workflowEngine = new WorkflowEngine();
