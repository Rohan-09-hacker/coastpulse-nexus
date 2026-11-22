import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../core/api-client.ts';
import {
  WorkflowItem,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowRunResult,
  ConditionOperator,
  LogicalCombinator,
  SimpleCondition,
  CompoundCondition,
  SwitchCase,
  User,
} from '../../core/types.ts';
import {
  GitBranch,
  Play,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  Link as LinkIcon,
  X,
  Sparkles,
  Terminal,
  Cpu,
  Layers,
  Settings,
  Check,
  AlertCircle,
  HelpCircle,
  CornerDownRight,
  Split,
  Shuffle,
  FolderGit2,
  GitMerge,
} from 'lucide-react';

interface WorkflowEngineViewProps {
  currentUser: User | null;
  initialWorkflowId?: string | null;
}

export const WorkflowEngineView: React.FC<WorkflowEngineViewProps> = ({ currentUser, initialWorkflowId }) => {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);

  // Canvas & Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    handle: string;
  } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Execution state
  const [incidentInput, setIncidentInput] = useState<string>(
    'Commercial tug Pacific Pioneer disabled with 1,200 gallons marine diesel onboard. Drifting 1.5 miles off Point Reyes Lighthouse. Wind SSW at 22 knots, swell 3.8m.'
  );
  const [fuelGallonsInput, setFuelGallonsInput] = useState<number>(1200);
  const [customInputs, setCustomInputs] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentRunResult, setCurrentRunResult] = useState<WorkflowRunResult | null>(null);
  const [activeStepNodeId, setActiveStepNodeId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isOperatorOrAdmin = currentUser?.role === 'operator' || currentUser?.role === 'admin';

  // Load Workflows
  const loadWorkflows = async () => {
    try {
      const data = await api.getWorkflows();
      setWorkflows(data);
      if (data.length > 0) {
        const target = initialWorkflowId
          ? data.find((w) => w.id === initialWorkflowId) || data[0]
          : !selectedWorkflow
          ? data[0]
          : null;
        if (target) {
          selectWorkflow(target);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load workflows.');
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [initialWorkflowId]);

  const selectWorkflow = (wf: WorkflowItem) => {
    setSelectedWorkflow(wf);
    const def = wf.definition || {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: {
          incident_text: { type: 'string', required: true },
          fuel_gallons: { type: 'number', required: false },
        },
        required: ['incident_text'],
      },
      outputSchema: {
        type: 'object',
        properties: { final_result: { type: 'string' } },
      },
      nodes: [],
      edges: [],
    };
    setDefinition(JSON.parse(JSON.stringify(def)));
    setSelectedNodeId(def.nodes[0]?.id || null);
    setValidationResult(null);
    setCurrentRunResult(null);

    const props = def.inputSchema?.properties || {};
    const initialCustom: Record<string, any> = {};
    for (const [key, schemaProp] of Object.entries(props)) {
      if (key !== 'incident_text' && key !== 'fuel_gallons') {
        initialCustom[key] = schemaProp.type === 'number' ? 0 : `[Synthetic Demo ${key}]`;
      }
    }
    setCustomInputs(initialCustom);
  };

  // Node Dragging on Canvas
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (connectingSource) return;
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
    const node = definition?.nodes.find((n) => n.id === nodeId);
    if (node && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - node.position.x,
        y: e.clientY - rect.top - node.position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !definition || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(20, Math.min(rect.width - 250, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(20, Math.min(rect.height - 200, e.clientY - rect.top - dragOffset.y));

    setDefinition({
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n
      ),
    });
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Cycle Detection Helper for Connection Creation
  const wouldCreateCycle = (source: string, target: string, currentEdges: WorkflowEdge[]): boolean => {
    if (source === target) return true;
    const adj = new Map<string, string[]>();
    for (const e of currentEdges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    if (!adj.has(source)) adj.set(source, []);
    adj.get(source)!.push(target);

    const visited = new Set<string>();
    const queue = [target];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === source) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        for (const neighbor of adj.get(curr) || []) {
          queue.push(neighbor);
        }
      }
    }
    return false;
  };

  // Connect Nodes
  const handlePortClick = (nodeId: string, isSource: boolean, handleName = 'output') => {
    if (isSource) {
      setConnectingSource({ nodeId, handle: handleName });
    } else {
      if (!connectingSource) return;
      if (connectingSource.nodeId === nodeId) {
        setErrorMsg('Cannot connect a node to itself.');
        setConnectingSource(null);
        return;
      }
      if (!definition) return;

      const alreadyConnected = definition.edges.some(
        (e) =>
          e.source === connectingSource.nodeId &&
          e.target === nodeId &&
          e.sourceHandle === connectingSource.handle
      );
      if (alreadyConnected) {
        setErrorMsg('Connection already exists.');
        setConnectingSource(null);
        return;
      }

      if (wouldCreateCycle(connectingSource.nodeId, nodeId, definition.edges)) {
        setErrorMsg('Connection rejected: Would introduce a cyclic dependency loop in the DAG.');
        setConnectingSource(null);
        return;
      }

      // Add edge and auto-generate mapping
      const newEdge: WorkflowEdge = {
        id: `e_${connectingSource.nodeId}_${connectingSource.handle}_${nodeId}`,
        source: connectingSource.nodeId,
        target: nodeId,
        sourceHandle: connectingSource.handle as any,
        targetHandle: 'context_input',
      };

      const targetNode = definition.nodes.find((n) => n.id === nodeId);
      const existingMappings = targetNode?.mappings || [];
      const updatedMappings = [
        ...existingMappings,
        {
          targetField: 'context_input',
          sourceNodeId: connectingSource.nodeId,
          sourceField: 'responseText',
        },
      ];

      setDefinition({
        ...definition,
        edges: [...definition.edges, newEdge],
        nodes: definition.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                mappings: updatedMappings,
                inputSchema: {
                  ...n.inputSchema,
                  properties: {
                    ...n.inputSchema.properties,
                    context_input: { type: 'string', required: true },
                  },
                },
              }
            : n
        ),
      });

      setConnectingSource(null);
      setErrorMsg(null);
    }
  };

  // Add Node
  const handleAddNode = (
    type:
      | 'ai_generation'
      | 'data_transform'
      | 'approval_gate'
      | 'conditional'
      | 'switch'
      | 'nested_workflow'
  ) => {
    if (!definition) return;
    const count = definition.nodes.length + 1;
    const newNodeId = `node_${Date.now().toString().slice(-4)}`;

    const newNode: WorkflowNode = {
      id: newNodeId,
      name:
        type === 'conditional'
          ? `Condition Check ${count}`
          : type === 'switch'
          ? `Triage Switch ${count}`
          : type === 'nested_workflow'
          ? `Sub-Pipeline ${count}`
          : type === 'approval_gate'
          ? `Authorization Gate ${count}`
          : type === 'data_transform'
          ? `Data Synthesis ${count}`
          : `AI Generator ${count}`,
      type,
      targetModel:
        type === 'approval_gate' || type === 'conditional' || type === 'switch' || type === 'nested_workflow'
          ? undefined
          : 'gemini-3.8-flash',
      promptTemplate:
        type === 'approval_gate' || type === 'conditional' || type === 'switch' || type === 'nested_workflow'
          ? undefined
          : 'Synthesize upstream coastal telemetry and generate action proposal:\n{{incident_text}}',
      condition:
        type === 'conditional'
          ? {
              field: 'fuel_gallons',
              operator: 'greater_than_or_equal',
              value: 1000,
            }
          : undefined,
      switchConfig:
        type === 'switch'
          ? {
              field: 'severity',
              cases: [
                { id: 'c_low', value: 'LOW', label: 'Low Alert', handle: 'case_low' },
                { id: 'c_med', value: 'MEDIUM', label: 'Medium Alert', handle: 'case_med' },
                { id: 'c_high', value: 'HIGH', label: 'High Alert', handle: 'case_high' },
              ],
              defaultHandle: 'default',
            }
          : undefined,
      nestedWorkflowConfig:
        type === 'nested_workflow'
          ? {
              childWorkflowId: workflows.length > 0 ? workflows[0].id : '',
              childWorkflowName: workflows.length > 0 ? workflows[0].name : 'Child Sub-Pipeline',
              maxExecutionDepth: 3,
            }
          : undefined,
      inputSchema: {
        type: 'object',
        properties: {
          incident_text: { type: 'string', required: true },
          fuel_gallons: { type: 'number', required: false },
          severity: { type: 'string', required: false },
        },
        required: ['incident_text'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          responseText: { type: 'string', description: 'Generated inference output' },
          result: { type: 'boolean', description: 'Condition outcome' },
          decision: { type: 'string', description: 'Branch decision handle' },
        },
        required:
          type === 'conditional'
            ? ['result', 'decision']
            : type === 'switch'
            ? ['decision']
            : ['responseText'],
      },
      mappings: [
        {
          targetField: 'incident_text',
          sourceNodeId: '$workflow_input',
          sourceField: 'incident_text',
        },
        {
          targetField: 'fuel_gallons',
          sourceNodeId: '$workflow_input',
          sourceField: 'fuel_gallons',
        },
        {
          targetField: 'severity',
          sourceNodeId: '$workflow_input',
          sourceField: 'severity',
        },
      ],
      requiresHumanApproval: type === 'approval_gate',
      position: { x: 50 + (count % 3) * 260, y: 80 + Math.floor(count / 3) * 160 },
    };

    setDefinition({
      ...definition,
      nodes: [...definition.nodes, newNode],
    });
    setSelectedNodeId(newNodeId);
  };

  // Remove Node
  const handleRemoveNode = (nodeId: string) => {
    if (!definition) return;
    setDefinition({
      ...definition,
      nodes: definition.nodes.filter((n) => n.id !== nodeId),
      edges: definition.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Remove Edge
  const handleRemoveEdge = (edgeId: string) => {
    if (!definition) return;
    setDefinition({
      ...definition,
      edges: definition.edges.filter((e) => e.id !== edgeId),
    });
  };

  // Validate Entire Workflow DAG
  const handleValidateWorkflow = async () => {
    if (!definition) return;
    setErrorMsg(null);
    try {
      const res = await api.validateWorkflow(definition);
      setValidationResult(res);
      if (!res.valid) {
        setErrorMsg(`Workflow validation failed: ${res.errors.join('; ')}`);
      } else {
        setSaveSuccessMsg('Workflow DAG, conditional branches, and schemas validated successfully.');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation request failed.');
    }
  };

  // Save Workflow to PGlite
  const handleSaveWorkflow = async () => {
    if (!selectedWorkflow || !definition) return;
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const val = await api.validateWorkflow(definition);
      if (!val.valid) {
        setErrorMsg(`Cannot save invalid workflow: ${val.errors.join('; ')}`);
        return;
      }

      await api.updateWorkflow(selectedWorkflow.id, {
        name: selectedWorkflow.name,
        description: selectedWorkflow.description,
        stepDefinitions: definition,
        requiresApproval: definition.nodes.some((n) => n.requiresHumanApproval),
      });

      setSaveSuccessMsg('Workflow DAG, conditional branches, and mappings saved to database.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      await loadWorkflows();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save workflow.');
    }
  };

  // Run Workflow
  const usesLegacyIncidentInput =
    !definition?.inputSchema?.properties ||
    'incident_text' in definition.inputSchema.properties;

  const handleRunWorkflow = async () => {
    if (!selectedWorkflow) return;
    if (usesLegacyIncidentInput && !incidentInput.trim()) return;
    setIsRunning(true);
    setErrorMsg(null);
    setCurrentRunResult(null);

    try {
      const payload = usesLegacyIncidentInput
        ? {
            incident_text: incidentInput,
            fuel_gallons: Number(fuelGallonsInput) || 0,
          }
        : customInputs;
      const result = await api.runWorkflow(selectedWorkflow.id, payload);
      setCurrentRunResult(result);
      if (result.status === 'pending_approval' && result.currentStep) {
        setActiveStepNodeId(result.currentStep);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Workflow run failed.');
    } finally {
      setIsRunning(false);
    }
  };

  // Approve Consequential Step
  const handleApproveResume = async () => {
    if (!currentRunResult?.runId) return;
    try {
      const res = await api.approveWorkflowRun(currentRunResult.runId);
      setCurrentRunResult((prev) =>
        prev ? { ...prev, status: 'completed', message: res.message } : null
      );
      setActiveStepNodeId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Approval sign-off failed.');
    }
  };

  const selectedNode = definition?.nodes.find((n) => n.id === selectedNodeId);

  // Update Selected Node Property
  const updateSelectedNode = (patch: Partial<WorkflowNode>) => {
    if (!definition || !selectedNodeId) return;
    setDefinition({
      ...definition,
      nodes: definition.nodes.map((n) => (n.id === selectedNodeId ? { ...n, ...patch } : n)),
    });
  };

  // Helper to check if a node was skipped in current run
  const isNodeSkipped = (nodeId: string) => {
    return currentRunResult?.skippedNodes?.some((s) => s.nodeId === nodeId) || false;
  };

  // Helper to check if an edge is in an active branch decision
  const getEdgeActiveStatus = (edge: WorkflowEdge) => {
    if (!currentRunResult?.branchDecisions) return 'normal';
    const decision = currentRunResult.branchDecisions.find((d) => d.nodeId === edge.source);
    if (!decision) return 'normal';
    if (edge.sourceHandle === decision.decision) return 'active_branch';
    return 'inactive_branch';
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#17243A] flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-[#3978F6]" />
            NEXUS 2.1 Conditional Intelligence Engine
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Safe deterministic DAG branching, runtime condition evaluation, skipped node pruning, and consequential authorization gates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleValidateWorkflow}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-semibold rounded-xl bg-white/85 hover:bg-white border border-slate-200 hover:border-[#3978F6]/40 text-[#17243A] transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#3978F6]" />
            Validate DAG
          </button>

          <button
            type="button"
            onClick={handleSaveWorkflow}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-semibold rounded-xl bg-[#EEF4FC] hover:bg-white border border-[#3978F6]/25 hover:border-[#3978F6] text-[#3978F6] transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-[#3978F6]" />
            Save Pipeline
          </button>

          <button
            type="button"
            onClick={handleRunWorkflow}
            disabled={isRunning || (usesLegacyIncidentInput && !incidentInput.trim())}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#3978F6] to-[#9275E8] hover:brightness-105 disabled:opacity-50 text-white shadow-[0_8px_20px_-6px_rgba(57,120,246,0.45)] transition-all cursor-pointer font-mono whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunning ? 'Evaluating DAG...' : 'Dispatch Pipeline'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Top Bar: Pipeline Selector & Node Palette */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="nexus-glass-card rounded-2xl p-3.5 md:col-span-1">
          <label className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#3978F6] block mb-1.5">
            Registered Pipeline
          </label>
          <select
            value={selectedWorkflow?.id || ''}
            onChange={(e) => {
              const wf = workflows.find((w) => w.id === e.target.value);
              if (wf) selectWorkflow(wf);
            }}
            className="w-full bg-white/90 border border-slate-200 rounded-xl p-2 text-xs text-[#17243A] font-semibold focus:border-[#3978F6] focus:outline-none cursor-pointer"
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id} className="bg-white text-[#17243A]">
                {wf.name}
              </option>
            ))}
          </select>
        </div>

        <div className="nexus-glass-card rounded-2xl p-3.5 md:col-span-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-600 uppercase">
              Add Node:
            </span>
            <button
              type="button"
              onClick={() => handleAddNode('conditional')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-xl bg-amber-50 border border-amber-200 hover:border-amber-400 text-amber-800 transition-all cursor-pointer font-bold"
            >
              <Split className="w-3.5 h-3.5 text-amber-600" />
              + IF-ELSE Condition
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('switch')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-xl bg-[#9275E8]/10 border border-[#9275E8]/30 hover:border-[#9275E8] text-[#6D28D9] transition-all cursor-pointer font-bold"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#9275E8]" />
              + Switch / Case
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('nested_workflow')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-xl bg-[#EEF4FC] border border-[#3978F6]/25 hover:border-[#3978F6] text-[#3978F6] transition-all cursor-pointer font-bold"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-[#3978F6]" />
              + Sub-Pipeline
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('ai_generation')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-xl bg-white border border-slate-200 hover:border-[#3978F6] text-[#17243A] transition-all cursor-pointer font-medium"
            >
              <Cpu className="w-3.5 h-3.5 text-[#3978F6]" />
              + AI Generator
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('data_transform')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-xl bg-white border border-slate-200 hover:border-[#9275E8] text-[#17243A] transition-all cursor-pointer font-medium"
            >
              <Layers className="w-3.5 h-3.5 text-[#9275E8]" />
              + Transformer
            </button>
            <button
              type="button"
              onClick={() => handleAddNode('approval_gate')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-xl bg-rose-50 border border-rose-200 hover:border-rose-400 text-rose-700 transition-all cursor-pointer font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
              + Checkpoint
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-600 flex items-center gap-3">
            <span className="tabular-nums">
              Nodes: <strong className="text-[#3978F6]">{definition?.nodes.length || 0}</strong>
            </span>
            <span className="tabular-nums">
              Edges: <strong className="text-[#9275E8]">{definition?.edges.length || 0}</strong>
            </span>
            {connectingSource && (
              <span className="px-2.5 py-0.5 rounded-lg bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/30 font-semibold">
                Click target input port to bind {connectingSource.handle.toUpperCase()} branch
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace: Visual Canvas + Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Visual Workflow Canvas (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full h-[540px] bg-gradient-to-br from-[#F7F9FC] via-[#EEF4FC] to-[#F3EFFC] border border-white rounded-3xl overflow-hidden shadow-[inset_0_2px_12px_rgba(23,36,58,0.04),0_12px_32px_-10px_rgba(23,36,58,0.08)] select-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(57, 120, 246, 0.22) 1.2px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* Canvas Ambient Watermark */}
            <div className="absolute top-3.5 left-4 text-[10px] font-mono font-semibold text-slate-500 tracking-wider flex items-center gap-2 pointer-events-none bg-white/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white">
              <Sparkles className="w-3 h-3 text-[#3978F6]" />
              NEXUS 2.1 CONDITIONAL DAG CANVAS (TRUE/FALSE PORT CONNECTIONS)
            </div>

            {/* SVG Layer for Bezier Curve Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <linearGradient id="edgeGradientDefault" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3978F6" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#9275E8" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="edgeGradientTrue" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#3978F6" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="edgeGradientFalse" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E11D48" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.95" />
                </linearGradient>
                <marker id="arrowDefault" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#7C3AED" />
                </marker>
                <marker id="arrowTrue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#059669" />
                </marker>
                <marker id="arrowFalse" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#E11D48" />
                </marker>
              </defs>

              {definition?.edges.map((edge) => {
                const sourceNode = definition.nodes.find((n) => n.id === edge.source);
                const targetNode = definition.nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const isSourceConditional = sourceNode.type === 'conditional';
                const isSourceSwitch = sourceNode.type === 'switch';

                // Adjust Y based on true/false port or switch case ports
                let yOffset = 40;
                if (isSourceConditional) {
                  yOffset = edge.sourceHandle === 'false' ? 68 : 32;
                } else if (isSourceSwitch && sourceNode.switchConfig?.cases) {
                  const cases = sourceNode.switchConfig.cases;
                  const cIdx = cases.findIndex((c) => c.handle === edge.sourceHandle);
                  if (cIdx !== -1) {
                    yOffset = 24 + cIdx * 20;
                  } else {
                    yOffset = 24 + cases.length * 20;
                  }
                }

                const x1 = sourceNode.position.x + 236;
                const y1 = sourceNode.position.y + yOffset;
                const x2 = targetNode.position.x;
                const y2 = targetNode.position.y + 40;
                const dx = Math.abs(x2 - x1) * 0.5;
                const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                const activeStatus = getEdgeActiveStatus(edge);
                const isTrueHandle = edge.sourceHandle === 'true';
                const isFalseHandle = edge.sourceHandle === 'false';

                const strokeColor =
                  activeStatus === 'inactive_branch'
                    ? '#94A3B8'
                    : isTrueHandle
                    ? 'url(#edgeGradientTrue)'
                    : isFalseHandle
                    ? 'url(#edgeGradientFalse)'
                    : 'url(#edgeGradientDefault)';

                const marker =
                  isTrueHandle ? 'url(#arrowTrue)' : isFalseHandle ? 'url(#arrowFalse)' : 'url(#arrowDefault)';

                return (
                  <g key={edge.id} opacity={activeStatus === 'inactive_branch' ? 0.45 : 1}>
                    <path
                      d={path}
                      stroke={strokeColor}
                      strokeWidth={activeStatus === 'active_branch' ? 3.5 : 2.5}
                      strokeDasharray={activeStatus === 'inactive_branch' ? '5,5' : undefined}
                      fill="none"
                      markerEnd={marker}
                    />
                    {/* Handle label pill on mid-point */}
                    {(isSourceConditional || isSourceSwitch) && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 7}
                        fill={isTrueHandle ? '#047857' : isFalseHandle ? '#BE123C' : '#6D28D9'}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {edge.sourceHandle ? edge.sourceHandle.toUpperCase() : ''}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Render Nodes on Canvas */}
            {definition?.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isExecutionHalted = currentRunResult?.currentStep === node.id;
              const isSkipped = isNodeSkipped(node.id);
              const isConditional = node.type === 'conditional';
              const isSwitch = node.type === 'switch';
              const isNested = node.type === 'nested_workflow';

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  style={{
                    transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                  }}
                  className={`absolute w-60 rounded-2xl border p-3.5 backdrop-blur-xl transition-all cursor-move select-none ${
                    isSkipped
                      ? 'bg-white/60 border-dashed border-slate-300 opacity-65 shadow-xs'
                      : isExecutionHalted
                      ? 'bg-amber-50/95 border-amber-500 shadow-[0_10px_28px_-6px_rgba(245,158,11,0.35)]'
                      : isSelected
                      ? 'bg-white/95 border-[#3978F6] shadow-[0_14px_32px_-8px_rgba(57,120,246,0.32)]'
                      : isConditional
                      ? 'bg-white/88 border-amber-300 hover:border-amber-500 shadow-[0_8px_24px_-8px_rgba(23,36,58,0.12)]'
                      : isSwitch
                      ? 'bg-white/88 border-[#9275E8]/50 hover:border-[#9275E8] shadow-[0_8px_24px_-8px_rgba(23,36,58,0.12)]'
                      : isNested
                      ? 'bg-white/88 border-[#3978F6]/45 hover:border-[#3978F6] shadow-[0_8px_24px_-8px_rgba(23,36,58,0.12)]'
                      : node.requiresHumanApproval
                      ? 'bg-white/88 border-rose-300 hover:border-rose-500 shadow-[0_8px_24px_-8px_rgba(23,36,58,0.12)]'
                      : 'bg-white/88 border-white hover:border-[#3978F6]/50 shadow-[0_8px_24px_-8px_rgba(23,36,58,0.12)]'
                  }`}
                >
                  {/* Left Input Port */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePortClick(node.id, false);
                    }}
                    title="Input Port (Click after source handle to connect)"
                    className="absolute -left-2.5 top-8 w-5 h-5 rounded-full bg-white border-2 border-[#3978F6] flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-xs"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3978F6]" />
                  </div>

                  {/* Output Ports */}
                  {isConditional ? (
                    <>
                      {/* TRUE Port (Green) */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortClick(node.id, true, 'true');
                        }}
                        title="TRUE Output Port (Connects to branch when condition passes)"
                        className={`absolute -right-2.5 top-6 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-xs ${
                          connectingSource?.nodeId === node.id && connectingSource.handle === 'true'
                            ? 'bg-emerald-500 border-white ring-4 ring-emerald-400/30'
                            : 'bg-white border-emerald-600'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span className="absolute left-6 text-[8px] font-mono font-bold text-emerald-700 bg-white/85 px-1 rounded pointer-events-none">
                          TRUE
                        </span>
                      </div>

                      {/* FALSE Port (Rose) */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortClick(node.id, true, 'false');
                        }}
                        title="FALSE Output Port (Connects to branch when condition fails)"
                        className={`absolute -right-2.5 top-15 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-xs ${
                          connectingSource?.nodeId === node.id && connectingSource.handle === 'false'
                            ? 'bg-rose-500 border-white ring-4 ring-rose-400/30'
                            : 'bg-white border-rose-600'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        <span className="absolute left-6 text-[8px] font-mono font-bold text-rose-700 bg-white/85 px-1 rounded pointer-events-none">
                          FALSE
                        </span>
                      </div>
                    </>
                  ) : isSwitch && node.switchConfig?.cases ? (
                    <>
                      {node.switchConfig.cases.map((c, cIdx) => (
                        <div
                          key={c.id || c.handle}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePortClick(node.id, true, c.handle);
                          }}
                          style={{ top: `${20 + cIdx * 20}px` }}
                          title={`Switch Case Port: ${c.label || c.value} (handle: ${c.handle})`}
                          className={`absolute -right-2.5 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-xs ${
                            connectingSource?.nodeId === node.id && connectingSource.handle === c.handle
                              ? 'bg-[#9275E8] border-white ring-4 ring-[#9275E8]/30'
                              : 'bg-white border-[#9275E8]'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-[#9275E8]" />
                          <span className="absolute left-6 text-[8px] font-mono font-bold text-[#6D28D9] bg-white/85 px-1 rounded pointer-events-none whitespace-nowrap">
                            {c.label || c.value}
                          </span>
                        </div>
                      ))}
                      {/* Default Fallback Port */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortClick(node.id, true, node.switchConfig?.defaultHandle || 'default');
                        }}
                        style={{ top: `${20 + node.switchConfig.cases.length * 20}px` }}
                        title="Default Fallback Port"
                        className={`absolute -right-2.5 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-xs ${
                          connectingSource?.nodeId === node.id &&
                          connectingSource.handle === (node.switchConfig?.defaultHandle || 'default')
                            ? 'bg-slate-600 border-white ring-4 ring-slate-400/30'
                            : 'bg-white border-slate-400'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span className="absolute left-6 text-[8px] font-mono font-bold text-slate-600 bg-white/85 px-1 rounded pointer-events-none whitespace-nowrap">
                          DEFAULT
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePortClick(node.id, true, 'output');
                      }}
                      title="Output Port (Click to begin connection)"
                      className={`absolute -right-2.5 top-8 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-xs ${
                        connectingSource?.nodeId === node.id
                          ? 'bg-[#9275E8] border-white ring-4 ring-[#9275E8]/30'
                          : 'bg-white border-[#9275E8]'
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[#9275E8]" />
                    </div>
                  )}

                  {/* Node Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {isConditional ? (
                        <Split className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : isSwitch ? (
                        <Shuffle className="w-4 h-4 text-[#9275E8] shrink-0" />
                      ) : isNested ? (
                        <FolderGit2 className="w-4 h-4 text-[#3978F6] shrink-0" />
                      ) : node.requiresHumanApproval ? (
                        <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <Cpu className="w-4 h-4 text-[#3978F6] shrink-0" />
                      )}
                      <span className="font-bold text-xs text-[#17243A] truncate w-36 font-sans">
                        {node.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNode(node.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Node Badges & Models */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mb-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-md border uppercase font-bold text-[9px] ${
                        isConditional
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : isSwitch
                          ? 'bg-[#9275E8]/12 border-[#9275E8]/30 text-[#6D28D9]'
                          : isNested
                          ? 'bg-[#EEF4FC] border-[#3978F6]/25 text-[#3978F6]'
                          : 'bg-[#EEF4FC] border-slate-200 text-[#17243A]'
                      }`}
                    >
                      {isConditional
                        ? 'IF-ELSE CONDITION'
                        : isSwitch
                        ? 'SWITCH / CASE'
                        : isNested
                        ? 'SUB-PIPELINE'
                        : node.type.replace('_', ' ')}
                    </span>
                    {node.targetModel && (
                      <span className="text-[#3978F6] font-semibold truncate max-w-[90px]">
                        {node.targetModel}
                      </span>
                    )}
                  </div>

                  {/* Condition Details Preview */}
                  {isConditional && node.condition && (
                    <div className="text-[10px] font-mono text-amber-900 bg-amber-50/90 p-1.5 rounded-lg border border-amber-200 mb-2 truncate">
                      {'combinator' in node.condition ? (
                        <span>
                          GROUP: <strong>{node.condition.combinator}</strong> ({node.condition.conditions.length} rules)
                        </span>
                      ) : (
                        <span>
                          IF <code>{node.condition.field}</code> {node.condition.operator.replace(/_/g, ' ')}{' '}
                          <code>{JSON.stringify(node.condition.value ?? '')}</code>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Switch Details Preview */}
                  {isSwitch && node.switchConfig && (
                    <div className="text-[10px] font-mono text-[#6D28D9] bg-[#9275E8]/10 p-1.5 rounded-lg border border-[#9275E8]/25 mb-2 truncate">
                      SWITCH on <code>{node.switchConfig.field}</code> ({node.switchConfig.cases.length} cases)
                    </div>
                  )}

                  {/* Nested Workflow Preview */}
                  {isNested && node.nestedWorkflowConfig && (
                    <div className="text-[10px] font-mono text-[#3978F6] bg-[#EEF4FC] p-1.5 rounded-lg border border-[#3978F6]/20 mb-2 truncate">
                      INVOKES: <code>{node.nestedWorkflowConfig.childWorkflowName || node.nestedWorkflowConfig.childWorkflowId || 'Select Pipeline'}</code>
                    </div>
                  )}

                  {/* Mappings Summary */}
                  {!isConditional && !isSwitch && (
                    <div className="text-[10px] font-mono text-slate-600 bg-[#EEF4FC]/70 p-1.5 rounded-lg border border-slate-200/70">
                      {node.mappings.length > 0 ? (
                        <div className="truncate">
                          Map: {node.mappings[0].sourceNodeId}.{node.mappings[0].sourceField} &rarr;{' '}
                          {node.mappings[0].targetField}
                        </div>
                      ) : (
                        <span className="italic text-slate-500">Direct Input</span>
                      )}
                    </div>
                  )}

                  {/* Status Banner */}
                  {isSkipped ? (
                    <div className="mt-2 text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300 flex items-center justify-between">
                      <span>STATUS: SKIPPED</span>
                      <span className="text-[8px] text-slate-500">Inactive Branch</span>
                    </div>
                  ) : node.requiresHumanApproval ? (
                    <div className="mt-2 text-[9px] font-mono font-bold text-rose-700 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Consequential Sign-Off Gate</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Connected Edges Management */}
          <div className="nexus-glass-card rounded-2xl p-4">
            <h4 className="text-xs font-mono font-bold text-[#17243A] mb-2.5 flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5 text-[#9275E8]" />
              Active DAG Branch &amp; Node Connections ({definition?.edges.length || 0})
            </h4>

            {definition && definition.edges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {definition.edges.map((edge) => {
                  const s = definition.nodes.find((n) => n.id === edge.source);
                  const t = definition.nodes.find((n) => n.id === edge.target);
                  const isTrue = edge.sourceHandle === 'true';
                  const isFalse = edge.sourceHandle === 'false';

                  return (
                    <div
                      key={edge.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/85 border text-[11px] font-mono text-[#17243A] shadow-xs ${
                        isTrue
                          ? 'border-emerald-200 text-emerald-800'
                          : isFalse
                          ? 'border-rose-200 text-rose-800'
                          : 'border-slate-200'
                      }`}
                    >
                      <span className="font-bold">{s?.name || edge.source}</span>
                      {edge.sourceHandle && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            isTrue ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          [{edge.sourceHandle}]
                        </span>
                      )}
                      <span className="text-slate-400">&rarr;</span>
                      <span className="text-[#3978F6] font-bold">{t?.name || edge.target}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEdge(edge.id)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500 italic">
                No active connections. Click a port then an input port to establish validated data flow.
              </div>
            )}
          </div>
        </div>

        {/* Node Inspector & Configuration Panel (1 Col) */}
        <div className="space-y-4">
          <div className="nexus-glass-card rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 text-xs font-mono">
              <span className="font-bold text-[#17243A] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#3978F6]" />
                Node Inspector
              </span>
              {selectedNode && (
                <span className="text-[10px] text-[#3978F6] bg-[#EEF4FC] px-2 py-0.5 rounded-md border border-[#3978F6]/20 font-mono font-semibold">
                  {selectedNode.id}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-3.5 text-xs">
                {/* Node Name */}
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-500 font-semibold block mb-1">
                    Node Title
                  </label>
                  <input
                    type="text"
                    value={selectedNode.name}
                    onChange={(e) => updateSelectedNode({ name: e.target.value })}
                    className="w-full bg-white/85 border border-slate-200 rounded-xl p-2 text-[#17243A] font-mono text-xs focus:border-[#3978F6] focus:outline-none"
                  />
                </div>

                {/* Node Type Selector */}
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-500 font-semibold block mb-1">
                    Node Type
                  </label>
                  <select
                    value={selectedNode.type}
                    onChange={(e) => updateSelectedNode({ type: e.target.value as any })}
                    className="w-full bg-white/85 border border-slate-200 rounded-xl p-2 text-xs text-[#17243A] font-mono font-semibold focus:border-[#3978F6] focus:outline-none cursor-pointer"
                  >
                    <option value="conditional">Conditional / IF-ELSE Branch</option>
                    <option value="switch">Switch / Case Multi-Way Branch</option>
                    <option value="nested_workflow">Nested Sub-Pipeline Invocation</option>
                    <option value="ai_generation">AI Generator (Gemini / Demo)</option>
                    <option value="data_transform">Data Transformer</option>
                    <option value="approval_gate">Human Authorization Checkpoint</option>
                  </select>
                </div>

                {/* CONDITIONAL NODE CONFIGURATION (Simple vs Compound) */}
                {selectedNode.type === 'conditional' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/75 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-800 flex items-center gap-1.5">
                        <Split className="w-4 h-4 text-amber-600" />
                        Condition Rule Configuration
                      </span>
                      {selectedNode.condition && 'combinator' in selectedNode.condition ? (
                        <button
                          type="button"
                          onClick={() => {
                            const firstSub: any = (selectedNode.condition as any).conditions[0] || {
                              field: 'fuel_gallons',
                              operator: 'greater_than_or_equal',
                              value: 1000,
                            };
                            updateSelectedNode({
                              condition: {
                                field: firstSub.field || 'fuel_gallons',
                                operator: firstSub.operator || 'greater_than_or_equal',
                                value: firstSub.value ?? 1000,
                              },
                            });
                          }}
                          className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[#17243A] hover:text-[#3978F6] cursor-pointer"
                        >
                          Convert to Single Rule
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const cur = selectedNode.condition as SimpleCondition;
                            updateSelectedNode({
                              condition: {
                                combinator: 'AND',
                                conditions: [
                                  cur || { field: 'fuel_gallons', operator: 'greater_than_or_equal', value: 1000 },
                                  { field: 'incident_text', operator: 'contains', value: 'diesel' },
                                ],
                              },
                            });
                          }}
                          className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer font-semibold"
                        >
                          + Convert to Compound Tree
                        </button>
                      )}
                    </div>

                    {/* COMPOUND TREE MODE (AND / OR / NOT) */}
                    {selectedNode.condition && 'combinator' in selectedNode.condition ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-mono uppercase text-slate-600 font-semibold">
                            Logical Operator:
                          </label>
                          <select
                            value={selectedNode.condition.combinator}
                            onChange={(e) => {
                              const comb = e.target.value as LogicalCombinator;
                              const cond = selectedNode.condition as CompoundCondition;
                              updateSelectedNode({
                                condition: {
                                  ...cond,
                                  combinator: comb,
                                },
                              });
                            }}
                            className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-amber-800 font-mono font-bold"
                          >
                            <option value="AND">AND (All Must Match)</option>
                            <option value="OR">OR (Any Must Match)</option>
                            <option value="NOT">NOT (Invert Sub-Rule)</option>
                          </select>
                        </div>

                        {/* Sub-rules list */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[10px] font-mono uppercase text-slate-600 block font-semibold">
                            Sub-Conditions ({selectedNode.condition.conditions.length}):
                          </span>
                          {selectedNode.condition.conditions.map((sub: any, subIdx: number) => (
                            <div
                              key={subIdx}
                              className="p-2.5 rounded-xl bg-white/90 border border-amber-200/80 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-amber-700">
                                  Rule #{subIdx + 1}
                                </span>
                                {(selectedNode.condition as CompoundCondition).conditions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cond = selectedNode.condition as CompoundCondition;
                                      const newSubs = cond.conditions.filter((_, idx) => idx !== subIdx);
                                      updateSelectedNode({
                                        condition: { ...cond, conditions: newSubs },
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 text-xs cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                                <input
                                  type="text"
                                  placeholder="field"
                                  value={sub.field || ''}
                                  onChange={(e) => {
                                    const cond = selectedNode.condition as CompoundCondition;
                                    const newSubs = [...cond.conditions];
                                    newSubs[subIdx] = { ...newSubs[subIdx], field: e.target.value };
                                    updateSelectedNode({ condition: { ...cond, conditions: newSubs } });
                                  }}
                                  className="bg-[#EEF4FC]/70 border border-slate-200 rounded-lg p-1 text-[11px] text-[#17243A]"
                                />
                                <select
                                  value={sub.operator || 'equals'}
                                  onChange={(e) => {
                                    const cond = selectedNode.condition as CompoundCondition;
                                    const newSubs = [...cond.conditions];
                                    newSubs[subIdx] = { ...newSubs[subIdx], operator: e.target.value as any };
                                    updateSelectedNode({ condition: { ...cond, conditions: newSubs } });
                                  }}
                                  className="bg-[#EEF4FC]/70 border border-slate-200 rounded-lg p-1 text-[11px] text-amber-800 font-semibold"
                                >
                                  <option value="equals">==</option>
                                  <option value="not_equals">!=</option>
                                  <option value="greater_than">&gt;</option>
                                  <option value="greater_than_or_equal">&gt;=</option>
                                  <option value="less_than">&lt;</option>
                                  <option value="less_than_or_equal">&lt;=</option>
                                  <option value="contains">contains</option>
                                  <option value="exists">exists</option>
                                  <option value="is_empty">empty</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="val"
                                  value={sub.value ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsedVal = !isNaN(Number(raw)) && raw.trim() !== '' ? Number(raw) : raw;
                                    const cond = selectedNode.condition as CompoundCondition;
                                    const newSubs = [...cond.conditions];
                                    newSubs[subIdx] = { ...newSubs[subIdx], value: parsedVal };
                                    updateSelectedNode({ condition: { ...cond, conditions: newSubs } });
                                  }}
                                  className="bg-[#EEF4FC]/70 border border-slate-200 rounded-lg p-1 text-[11px] text-[#17243A]"
                                />
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const cond = selectedNode.condition as CompoundCondition;
                              updateSelectedNode({
                                condition: {
                                  ...cond,
                                  conditions: [
                                    ...cond.conditions,
                                    { field: 'risk_tier', operator: 'equals', value: 'HIGH' },
                                  ],
                                },
                              });
                            }}
                            className="w-full py-1.5 text-[10px] font-mono font-bold rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-amber-800 transition-colors cursor-pointer"
                          >
                            + Add Sub-Rule
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* SINGLE RULE MODE */
                      <div className="space-y-3">
                        {/* Field */}
                        <div>
                          <label className="text-[10px] font-mono text-slate-600 font-semibold block mb-1">
                            Evaluation Field:
                          </label>
                          <input
                            type="text"
                            value={(selectedNode.condition as SimpleCondition)?.field || ''}
                            onChange={(e) =>
                              updateSelectedNode({
                                condition: {
                                  field: e.target.value,
                                  operator: (selectedNode.condition as SimpleCondition)?.operator || 'equals',
                                  value: (selectedNode.condition as SimpleCondition)?.value,
                                },
                              })
                            }
                            placeholder="e.g. fuel_gallons or severity"
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-[#17243A] font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        {/* Operator */}
                        <div>
                          <label className="text-[10px] font-mono text-slate-600 font-semibold block mb-1">
                            Comparison Operator:
                          </label>
                          <select
                            value={(selectedNode.condition as SimpleCondition)?.operator || 'equals'}
                            onChange={(e) =>
                              updateSelectedNode({
                                condition: {
                                  field: (selectedNode.condition as SimpleCondition)?.field || '',
                                  operator: e.target.value as ConditionOperator,
                                  value: (selectedNode.condition as SimpleCondition)?.value,
                                },
                              })
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-amber-800 font-mono font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
                          >
                            <option value="equals">equals (==)</option>
                            <option value="not_equals">not_equals (!=)</option>
                            <option value="greater_than">greater_than (&gt;)</option>
                            <option value="greater_than_or_equal">greater_than_or_equal (&gt;=)</option>
                            <option value="less_than">less_than (&lt;)</option>
                            <option value="less_than_or_equal">less_than_or_equal (&lt;=)</option>
                            <option value="contains">contains (substring / array)</option>
                            <option value="exists">exists (not null/empty)</option>
                            <option value="is_empty">is_empty (null or length 0)</option>
                          </select>
                        </div>

                        {/* Target Value */}
                        {(selectedNode.condition as SimpleCondition)?.operator !== 'exists' &&
                          (selectedNode.condition as SimpleCondition)?.operator !== 'is_empty' && (
                            <div>
                              <label className="text-[10px] font-mono text-slate-600 font-semibold block mb-1">
                                Comparison Value:
                              </label>
                              <input
                                type="text"
                                value={(selectedNode.condition as SimpleCondition)?.value ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsedVal = !isNaN(Number(raw)) && raw.trim() !== '' ? Number(raw) : raw;
                                  updateSelectedNode({
                                    condition: {
                                      field: (selectedNode.condition as SimpleCondition)?.field || '',
                                      operator: (selectedNode.condition as SimpleCondition)?.operator || 'equals',
                                      value: parsedVal,
                                    },
                                  });
                                }}
                                placeholder="e.g. 1000 or severe"
                                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-[#17243A] font-mono focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}

                {/* SWITCH / CASE NODE CONFIGURATION */}
                {selectedNode.type === 'switch' && (
                  <div className="p-3.5 rounded-2xl bg-[#9275E8]/10 border border-[#9275E8]/30 space-y-3">
                    <span className="text-xs font-mono font-bold text-[#6D28D9] block flex items-center gap-1.5">
                      <Shuffle className="w-4 h-4 text-[#9275E8]" />
                      Switch / Case Multi-Way Branching
                    </span>

                    {/* Switch Expression Field */}
                    <div>
                      <label className="text-[10px] font-mono text-slate-600 font-semibold block mb-1">
                        Switch Expression Field:
                      </label>
                      <input
                        type="text"
                        value={selectedNode.switchConfig?.field || ''}
                        onChange={(e) =>
                          updateSelectedNode({
                            switchConfig: {
                              field: e.target.value,
                              cases: selectedNode.switchConfig?.cases || [],
                              defaultHandle: selectedNode.switchConfig?.defaultHandle || 'default',
                            },
                          })
                        }
                        placeholder="e.g. severity or incident_type"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-[#17243A] font-mono focus:border-[#9275E8] focus:outline-none"
                      />
                    </div>

                    {/* Cases List */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-slate-600 font-semibold block">
                        Case Ports ({selectedNode.switchConfig?.cases.length || 0}):
                      </label>
                      {(selectedNode.switchConfig?.cases || []).map((c, cIdx) => (
                        <div
                          key={c.id || cIdx}
                          className="p-2.5 rounded-xl bg-white/90 border border-slate-200 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#6D28D9]">
                              Port: {c.handle}
                            </span>
                            {(selectedNode.switchConfig?.cases.length || 0) > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const cases = (selectedNode.switchConfig?.cases || []).filter(
                                    (_, idx) => idx !== cIdx
                                  );
                                  updateSelectedNode({
                                    switchConfig: {
                                      ...selectedNode.switchConfig!,
                                      cases,
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 text-xs cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                            <div>
                              <span className="text-[9px] text-slate-500 block">Value</span>
                              <input
                                type="text"
                                value={c.value ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsed = !isNaN(Number(raw)) && raw.trim() !== '' ? Number(raw) : raw;
                                  const cases = [...(selectedNode.switchConfig?.cases || [])];
                                  cases[cIdx] = { ...cases[cIdx], value: parsed };
                                  updateSelectedNode({
                                    switchConfig: { ...selectedNode.switchConfig!, cases },
                                  });
                                }}
                                className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-lg p-1 text-[#17243A]"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 block">Label</span>
                              <input
                                type="text"
                                value={c.label || ''}
                                onChange={(e) => {
                                  const cases = [...(selectedNode.switchConfig?.cases || [])];
                                  cases[cIdx] = { ...cases[cIdx], label: e.target.value };
                                  updateSelectedNode({
                                    switchConfig: { ...selectedNode.switchConfig!, cases },
                                  });
                                }}
                                className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-lg p-1 text-[#17243A]"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 block">Handle</span>
                              <input
                                type="text"
                                value={c.handle || ''}
                                onChange={(e) => {
                                  const cases = [...(selectedNode.switchConfig?.cases || [])];
                                  cases[cIdx] = { ...cases[cIdx], handle: e.target.value };
                                  updateSelectedNode({
                                    switchConfig: { ...selectedNode.switchConfig!, cases },
                                  });
                                }}
                                className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-lg p-1 text-[#6D28D9] font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const curCases = selectedNode.switchConfig?.cases || [];
                          const nextIdx = curCases.length + 1;
                          updateSelectedNode({
                            switchConfig: {
                              ...selectedNode.switchConfig!,
                              cases: [
                                ...curCases,
                                {
                                  id: `case_${nextIdx}`,
                                  value: `VAL_${nextIdx}`,
                                  label: `Tier ${nextIdx}`,
                                  handle: `case_tier_${nextIdx}`,
                                },
                              ],
                            },
                          });
                        }}
                        className="w-full py-1.5 text-[10px] font-mono font-bold rounded-xl bg-white border border-[#9275E8]/30 hover:border-[#9275E8] text-[#6D28D9] transition-colors cursor-pointer"
                      >
                        + Add Switch Case
                      </button>
                    </div>

                    {/* Default Fallback Handle */}
                    <div>
                      <label className="text-[10px] font-mono text-slate-600 font-semibold block mb-1">
                        Default Fallback Handle:
                      </label>
                      <input
                        type="text"
                        value={selectedNode.switchConfig?.defaultHandle || 'default'}
                        onChange={(e) =>
                          updateSelectedNode({
                            switchConfig: {
                              ...selectedNode.switchConfig!,
                              defaultHandle: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-mono focus:border-[#9275E8] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* NESTED WORKFLOW NODE CONFIGURATION */}
                {selectedNode.type === 'nested_workflow' && (
                  <div className="p-3.5 rounded-2xl bg-[#EEF4FC]/85 border border-[#3978F6]/25 space-y-3">
                    <span className="text-xs font-mono font-bold text-[#3978F6] block flex items-center gap-1.5">
                      <FolderGit2 className="w-4 h-4 text-[#3978F6]" />
                      Sub-Pipeline Composition
                    </span>

                    <div>
                      <label className="text-[10px] font-mono text-slate-600 font-semibold block mb-1">
                        Select Child Pipeline to Invoke:
                      </label>
                      <select
                        value={selectedNode.nestedWorkflowConfig?.childWorkflowId || ''}
                        onChange={(e) => {
                          const childWf = workflows.find((w) => w.id === e.target.value);
                          updateSelectedNode({
                            nestedWorkflowConfig: {
                              childWorkflowId: e.target.value,
                              childWorkflowName: childWf?.name || 'Selected Pipeline',
                              maxExecutionDepth: 3,
                            },
                          });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-[#17243A] font-mono focus:border-[#3978F6] focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Choose child workflow --</option>
                        {workflows
                          .filter((w) => w.id !== selectedWorkflow?.id)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.id})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/85 border border-slate-200 text-[10px] font-mono text-slate-600 space-y-1">
                      <div className="text-[#3978F6] font-bold">Execution Guards:</div>
                      <div>&bull; Max Call Stack Depth: 3 levels</div>
                      <div>&bull; Direct and transitive cycles strictly prohibited</div>
                      <div>&bull; Human approval in child halts parent execution</div>
                    </div>
                  </div>
                )}

                {/* Target AI Model (if applicable) */}
                {selectedNode.type !== 'conditional' &&
                  selectedNode.type !== 'switch' &&
                  selectedNode.type !== 'nested_workflow' &&
                  selectedNode.type !== 'approval_gate' && (
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 font-semibold block mb-1">
                        AI Model Provider
                      </label>
                      <select
                        value={selectedNode.targetModel || 'gemini-3.8-flash'}
                        onChange={(e) => updateSelectedNode({ targetModel: e.target.value })}
                        className="w-full bg-white/85 border border-slate-200 rounded-xl p-2 text-xs text-[#3978F6] font-mono font-semibold focus:border-[#3978F6] focus:outline-none cursor-pointer"
                      >
                        <option value="gemini-3.8-flash">Google Gemini 3.8 Flash (Genuine AI)</option>
                        <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (Genuine AI)</option>
                        <option value="demo-simulator">Demo Simulator (Explicitly Labeled)</option>
                      </select>
                    </div>
                  )}

                {/* Consequential Checkpoint Toggle */}
                {selectedNode.type !== 'conditional' && selectedNode.type !== 'switch' && (
                  <div className="p-3 rounded-xl bg-[#EEF4FC]/80 border border-white flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-700 block">
                        Human Authorization Gate
                      </span>
                      <span className="text-[10px] text-slate-600">
                        Halts run until an Operator or Admin signs off.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedNode.requiresHumanApproval)}
                      onChange={(e) =>
                        updateSelectedNode({ requiresHumanApproval: e.target.checked })
                      }
                      className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                    />
                  </div>
                )}

                {/* Prompt Template */}
                {selectedNode.type !== 'conditional' &&
                  selectedNode.type !== 'switch' &&
                  selectedNode.type !== 'nested_workflow' &&
                  selectedNode.type !== 'approval_gate' && (
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 font-semibold block mb-1">
                        Prompt Template (use <code>{'{{variable}}'}</code> interpolation)
                      </label>
                      <textarea
                        rows={3}
                        value={selectedNode.promptTemplate || ''}
                        onChange={(e) => updateSelectedNode({ promptTemplate: e.target.value })}
                        className="w-full bg-white/85 border border-slate-200 rounded-xl p-2.5 text-xs text-[#17243A] font-mono focus:border-[#3978F6] focus:outline-none leading-relaxed"
                      />
                    </div>
                  )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 italic font-mono">
                Select a node on the visual canvas to configure its schema, condition, model, and data mappings.
              </div>
            )}
          </div>

          {/* Initial Input Payload Form */}
          <div className="nexus-glass-card rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#17243A] flex items-center gap-2 font-mono uppercase">
                <Terminal className="w-4 h-4 text-[#3978F6]" />
                Runtime Workflow Payload
              </label>
              {!usesLegacyIncidentInput && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  SYNTHETIC DEMO INPUT
                </span>
              )}
            </div>

            {usesLegacyIncidentInput ? (
              <>
                <div>
                  <span className="text-[10px] font-mono text-slate-600 block mb-1">
                    Incident Report (<code>incident_text</code>):
                  </span>
                  <textarea
                    value={incidentInput}
                    onChange={(e) => setIncidentInput(e.target.value)}
                    rows={2}
                    className="w-full bg-white/85 border border-slate-200 rounded-xl p-2.5 text-xs text-[#17243A] font-mono focus:border-[#3978F6] focus:outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-600 block mb-1">
                    Fuel Volume Metric (<code>fuel_gallons</code>):
                  </span>
                  <input
                    type="number"
                    value={fuelGallonsInput}
                    onChange={(e) => setFuelGallonsInput(Number(e.target.value))}
                    className="w-full bg-white/85 border border-slate-200 rounded-xl p-2.5 text-xs text-[#3978F6] font-mono font-semibold focus:border-[#3978F6] focus:outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(definition?.inputSchema?.properties || {}).map(([key, prop]) => (
                  <div key={key}>
                    <span className="text-[10px] font-mono text-slate-600 block mb-1">
                      <code className="font-semibold text-[#17243A]">{key}</code> ({prop.type})
                    </span>
                    <input
                      type={prop.type === 'number' ? 'number' : 'text'}
                      value={customInputs[key] ?? ''}
                      onChange={(e) =>
                        setCustomInputs({
                          ...customInputs,
                          [key]: prop.type === 'number' ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className="w-full bg-white/85 border border-slate-200 rounded-xl p-2 text-xs text-[#17243A] font-mono focus:border-[#3978F6] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Execution Output & Consequential Action Review */}
      {currentRunResult && (
        <div className="nexus-glass-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 text-xs font-mono">
            <span className="font-bold text-[#17243A] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3978F6]" />
              Pipeline Execution Trace (Run ID: {currentRunResult.runId})
            </span>
            <span
              className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold border ${
                currentRunResult.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : currentRunResult.status === 'pending_approval'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              STATUS: {currentRunResult.status}
            </span>
          </div>

          {/* Conditional Branch Decisions Log */}
          {currentRunResult.branchDecisions && currentRunResult.branchDecisions.length > 0 && (
            <div className="p-4 bg-[#EEF4FC]/75 border border-amber-200 rounded-2xl space-y-2">
              <div className="text-xs font-mono font-bold text-amber-800 flex items-center gap-2">
                <Split className="w-4 h-4 text-amber-600" />
                <span>Runtime Condition Evaluations ({currentRunResult.branchDecisions.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {currentRunResult.branchDecisions.map((decision, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/85 border border-slate-200 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#17243A]">{decision.nodeName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                          decision.decision === 'true'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : decision.decision === 'false'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-[#9275E8]/12 text-[#6D28D9] border-[#9275E8]/30'
                        }`}
                      >
                        BRANCH: {decision.decision.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">{decision.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nested Sub-Pipeline Run Traces */}
          {Object.entries(currentRunResult.nodeOutputs || {}).some(
            ([_, out]) => Boolean((out as any)?._childRunId)
          ) && (
            <div className="p-3.5 bg-[#EEF4FC]/85 border border-[#3978F6]/25 rounded-2xl space-y-2">
              <div className="text-xs font-mono font-bold text-[#3978F6] flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-[#3978F6]" />
                <span>Nested Sub-Pipeline Invocations</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(currentRunResult.nodeOutputs || {})
                  .filter(([_, out]) => Boolean((out as any)?._childRunId))
                  .map(([nodeId, out]: any) => (
                    <div
                      key={nodeId}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#3978F6]/25 text-xs font-mono flex items-center gap-2.5"
                    >
                      <span className="font-bold text-[#17243A]">{nodeId}</span>
                      <span className="text-[10px] text-[#3978F6] font-bold">
                        Child Run ID: {out._childRunId}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-bold">
                        {out.status || 'COMPLETED'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Skipped Inactive Nodes Log */}
          {currentRunResult.skippedNodes && currentRunResult.skippedNodes.length > 0 && (
            <div className="p-3.5 bg-[#EEF4FC]/70 border border-white rounded-2xl text-xs font-mono space-y-1.5">
              <span className="font-bold text-slate-600 uppercase text-[10px]">
                Pruned Inactive Branches:
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {currentRunResult.skippedNodes.map((s, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2"
                  >
                    <span className="font-bold text-[#17243A]">{s.nodeId}</span>
                    <span className="text-[9px] text-slate-500 italic">({s.reason})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Approval Banner */}
          {currentRunResult.status === 'pending_approval' && (
            <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900 font-mono">
                    Consequential Checkpoint Triggered
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5 font-mono">
                    {currentRunResult.message}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-amber-800 font-mono">
                  {isOperatorOrAdmin
                    ? `Authenticated as ${currentUser?.role.toUpperCase()} (Authorized to sign off).`
                    : 'Sign-off requires OPERATOR or ADMIN role.'}
                </span>

                <button
                  type="button"
                  onClick={handleApproveResume}
                  disabled={!isOperatorOrAdmin}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
                >
                  Authorize &amp; Dispatch Mitigation Action
                </button>
              </div>
            </div>
          )}

          {/* Output Artifacts */}
          {currentRunResult.outputs && (
            <div className="space-y-3">
              <div className="text-xs font-mono font-bold text-[#3978F6]">
                Generated Step Outputs:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentRunResult.outputs)
                  .filter(([k]) => k !== 'incident_text' && k !== 'fuel_gallons')
                  .map(([key, val], idx) => (
                    <div
                      key={idx}
                      className="bg-[#EEF4FC]/75 p-4 rounded-2xl border border-white space-y-2"
                    >
                      <div className="text-[11px] font-bold text-[#3978F6] font-mono flex items-center justify-between">
                        <span>{key}</span>
                        <span className="text-[9px] text-slate-600 uppercase bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          Step Artifact
                        </span>
                      </div>
                      <div className="text-[#17243A] text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {String(val)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Metrics Footer */}
          {currentRunResult.totalLatencyMs !== undefined && (
            <div className="pt-3 border-t border-slate-200/80 text-xs font-mono text-slate-600 flex items-center justify-between">
              <span className="tabular-nums">
                Total Pipeline Latency:{' '}
                <strong className="text-[#3978F6]">{currentRunResult.totalLatencyMs} ms</strong>
              </span>
              <span className="tabular-nums">
                Tokens Consumed:{' '}
                <strong className="text-[#17243A]">
                  {currentRunResult.totalTokens ?? 'Metric unavailable'}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
