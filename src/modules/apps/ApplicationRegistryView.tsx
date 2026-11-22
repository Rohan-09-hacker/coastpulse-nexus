import React, { useState, useEffect } from 'react';
import { api } from '../../core/api-client.ts';
import { AppModule, User, WorkflowRunResult } from '../../core/types.ts';
import {
  Boxes,
  ArrowRight,
  Compass,
  GraduationCap,
  HeartPulse,
  Landmark,
  ShieldAlert,
  TreePine,
  GitBranch,
  Play,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ApplicationRegistryViewProps {
  onNavigate: (tab: string) => void;
  onOpenWorkflow?: (workflowId: string) => void;
  currentUser?: User | null;
}

export const ApplicationRegistryView: React.FC<ApplicationRegistryViewProps> = ({
  onNavigate,
  onOpenWorkflow,
  currentUser,
}) => {
  const [apps, setApps] = useState<AppModule[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppModule | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [payloadText, setPayloadText] = useState<string>('{}');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<
    (WorkflowRunResult & {
      industry?: string;
      workflowId?: string;
      workflowName?: string;
      usedSyntheticData?: boolean;
      fidelity?: { mode: string; label: string; externalIntegrationStatus: string; isSimulated: boolean };
    }) | null
  >(null);

  const canRunWorkflow =
    currentUser?.role === 'analyst' ||
    currentUser?.role === 'operator' ||
    currentUser?.role === 'admin';
  const canApprove = currentUser?.role === 'operator' || currentUser?.role === 'admin';

  useEffect(() => {
    api
      .getApplications()
      .then((data) => {
        setApps(data);
        if (data.length > 0) {
          selectBlueprint(data[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectBlueprint = (app: AppModule) => {
    setSelectedApp(app);
    setRunResult(null);
    setRunError(null);
    const sample = app.blueprint?.syntheticSampleInput || {};
    setPayloadText(JSON.stringify(sample, null, 2));
  };

  const handleRunBlueprint = async () => {
    if (!selectedApp) return;
    setIsRunning(true);
    setRunError(null);
    setRunResult(null);

    try {
      let parsedInputs: Record<string, any> | undefined;
      try {
        parsedInputs = JSON.parse(payloadText);
      } catch {
        throw new Error('Synthetic payload must be valid JSON.');
      }

      const res = await api.runBlueprintWorkflow(selectedApp.id, {
        inputs: parsedInputs,
        useSyntheticDemo: true,
      });
      setRunResult(res);
    } catch (err: any) {
      setRunError(err.message || 'Failed to execute blueprint workflow.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleApprovePending = async () => {
    if (!runResult?.runId) return;
    setRunError(null);
    try {
      const res = await api.approveWorkflowRun(runResult.runId);
      setRunResult((prev) =>
        prev ? { ...prev, status: 'completed', message: res.message } : null
      );
    } catch (err: any) {
      setRunError(err.message || 'Failed to authorize pending workflow step.');
    }
  };

  const getDomainIcon = (domain: string) => {
    switch (domain.toLowerCase()) {
      case 'maritime & coastal':
        return Compass;
      case 'education & edtech':
        return GraduationCap;
      case 'healthcare & clinical':
        return HeartPulse;
      case 'finance & fintech':
        return Landmark;
      case 'cybersecurity & secops':
        return ShieldAlert;
      case 'climate & ecology':
        return TreePine;
      default:
        return Boxes;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#17243A] flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#3978F6]" />
            Universal Application Registry — NEXUS 3.0 Blueprints
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Six industry blueprints connected to the NEXUS 2.2 schema-driven workflow engine.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#17243A] bg-white/85 border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-xs whitespace-nowrap shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="tabular-nums font-medium">{loading ? 'Loading...' : `${apps.length} Industry Blueprints`}</span>
        </div>
      </div>

      {/* Grid of Universal Blueprints */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {apps.map((app) => {
          const Icon = getDomainIcon(app.domain);
          const isSelected = selectedApp?.id === app.id;
          const bp = app.blueprint;

          return (
            <div
              key={app.id}
              onClick={() => selectBlueprint(app)}
              className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 ${
                isSelected
                  ? 'bg-white/95 border-[#3978F6] shadow-[0_14px_34px_-10px_rgba(57,120,246,0.28)]'
                  : 'nexus-glass-card hover:bg-white/90 hover:border-[#3978F6]/40'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#EEF4FC] border border-[#3978F6]/20 flex items-center justify-center text-[#3978F6]">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold">
                    <span className="px-2 py-0.5 rounded-md bg-[#EEF4FC] text-slate-700 border border-white">
                      {bp?.industry || app.domain}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md border ${
                        app.is_reference_template
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {app.is_reference_template ? 'Active Live' : 'Simulated'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[#3978F6] uppercase tracking-wider font-semibold">
                    {app.domain}
                  </div>
                  <h3 className="text-sm font-bold text-[#17243A] mt-0.5">{app.name}</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {app.description}
                </p>

                {bp?.workflowAssociation && (
                  <div className="p-2.5 rounded-xl bg-[#EEF4FC]/85 border border-white text-[10px] font-mono text-[#17243A] flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-[#9275E8] shrink-0" />
                    <span className="truncate font-medium">{bp.workflowAssociation.workflowName}</span>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-slate-500">
                  ID: <span className="text-[#17243A] font-medium">{app.id}</span>
                </span>

                {app.is_reference_template ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('coastal');
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#3978F6] text-white font-semibold text-xs hover:bg-[#2A66E0] transition-colors cursor-pointer"
                  >
                    Launch Live <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-[#3978F6] text-[11px] font-mono font-semibold">
                    Inspect &amp; Run →
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Module Contract, Workflow Association & Execution Inspector */}
      {selectedApp && (
        <div className="rounded-3xl p-6 nexus-glass-card space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono text-[#3978F6] uppercase font-bold">
                  Industry: {selectedApp.blueprint?.industry || selectedApp.domain}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold">
                  {selectedApp.blueprint?.fidelity.label || 'SYNTHETIC DEMO DATA — External Integration Unavailable'}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#17243A] mt-1">{selectedApp.name}</h3>
              <p className="text-xs text-slate-600 mt-0.5">{selectedApp.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {selectedApp.blueprint?.workflowAssociation && onOpenWorkflow && (
                <button
                  type="button"
                  onClick={() => onOpenWorkflow(selectedApp.blueprint!.workflowAssociation.workflowId)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EEF4FC] border border-slate-200 hover:border-[#3978F6]/40 text-xs font-mono font-semibold text-[#17243A] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <GitBranch className="w-3.5 h-3.5 text-[#3978F6]" />
                  Open in Workflow Engine
                </button>
              )}

              <button
                type="button"
                onClick={handleRunBlueprint}
                disabled={isRunning || !canRunWorkflow}
                title={
                  !canRunWorkflow
                    ? 'Execution requires analyst, operator, or admin role.'
                    : 'Execute connected NEXUS 2.2 workflow with synthetic demo data'
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#3978F6] to-[#9275E8] hover:brightness-105 disabled:opacity-50 text-xs font-mono font-bold text-white shadow-[0_8px_20px_-6px_rgba(57,120,246,0.45)] transition-all cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isRunning ? 'Executing Pipeline...' : 'Run Blueprint Workflow (Demo)'}
              </button>
            </div>
          </div>

          {/* Workflow Association Bar */}
          {selectedApp.blueprint?.workflowAssociation && (
            <div className="p-3.5 rounded-2xl bg-[#EEF4FC]/80 border border-white flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#3978F6]" />
                <span className="text-slate-600">Associated Workflow:</span>
                <span className="text-[#17243A] font-bold">
                  {selectedApp.blueprint.workflowAssociation.workflowName}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="text-slate-600">
                  ID: <code className="text-[#3978F6] font-semibold">{selectedApp.blueprint.workflowAssociation.workflowId}</code>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg border font-semibold ${
                    selectedApp.blueprint.workflowAssociation.requiresHumanApproval
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {selectedApp.blueprint.workflowAssociation.requiresHumanApproval
                    ? 'Human Approval Gate Enforced'
                    : 'Automated Pipeline'}
                </span>
              </div>
            </div>
          )}

          {/* Schemas & Synthetic Input Payload */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Input Schema */}
            <div className="p-4 rounded-2xl bg-[#EEF4FC]/70 border border-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#17243A]">Input Schema</span>
                <span className="text-[10px] font-mono text-[#3978F6] font-semibold">Validated Contract</span>
              </div>
              <pre className="text-[11px] font-mono text-[#17243A] bg-white/85 p-3 rounded-xl overflow-x-auto border border-slate-200/80 max-h-56">
                {JSON.stringify(selectedApp.blueprint?.inputSchema || selectedApp.input_schema || { fields: [] }, null, 2)}
              </pre>
            </div>

            {/* Output Schema */}
            <div className="p-4 rounded-2xl bg-[#EEF4FC]/70 border border-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#17243A]">Output Schema</span>
                <span className="text-[10px] font-mono text-[#9275E8] font-semibold">Structured Output</span>
              </div>
              <pre className="text-[11px] font-mono text-[#17243A] bg-white/85 p-3 rounded-xl overflow-x-auto border border-slate-200/80 max-h-56">
                {JSON.stringify(selectedApp.blueprint?.outputSchema || selectedApp.output_schema || { fields: [] }, null, 2)}
              </pre>
            </div>

            {/* Synthetic Demo Input Payload */}
            <div className="p-4 rounded-2xl bg-[#EEF4FC]/70 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#17243A]">Synthetic Demo Input</span>
                <span className="text-[10px] font-mono text-amber-700 font-bold">SIMULATED DATA</span>
              </div>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={8}
                className="w-full text-[11px] font-mono text-[#17243A] bg-white/90 p-3 rounded-xl border border-slate-200 focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Execution Error */}
          {runError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{runError}</span>
            </div>
          )}

          {/* Execution Trace Result */}
          {runResult && (
            <div className="p-5 rounded-2xl bg-[#EEF4FC]/85 border border-[#3978F6]/30 space-y-3 font-mono text-xs shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#3978F6]" />
                  <span className="text-[#17243A] font-bold">
                    {runResult.industry} Execution Run ({runResult.runId})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {runResult.fidelity?.isSimulated && (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      SIMULATED DEMO EXECUTION
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                      runResult.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : runResult.status === 'pending_approval'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {runResult.status}
                  </span>
                </div>
              </div>

              {runResult.message && (
                <div className="text-slate-700">{runResult.message}</div>
              )}

              {runResult.status === 'pending_approval' && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Consequential action paused at human approval checkpoint.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApprovePending}
                    disabled={!canApprove}
                    title={
                      canApprove
                        ? 'Authorize consequential step and complete run'
                        : 'Requires operator or admin role'
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    {canApprove ? 'Authorize & Resume (Operator/Admin)' : 'Operator Sign-Off Required'}
                  </button>
                </div>
              )}

              {runResult.nodeOutputs && (
                <pre className="text-[11px] text-[#17243A] bg-white/90 p-3.5 rounded-xl overflow-x-auto border border-slate-200/80 max-h-60">
                  {JSON.stringify(runResult.nodeOutputs, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
