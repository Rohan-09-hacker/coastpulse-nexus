import React, { useState, useEffect } from 'react';
import { api } from '../../core/api-client.ts';
import {
  AIProviderStatus,
  AIModel,
  AnalyticsSummary,
  WorkflowItem,
  AppModule,
  User,
} from '../../core/types.ts';
import { FidelityBadge } from '../../components/shared/FidelityBadge.tsx';
import {
  Activity,
  Cpu,
  Database,
  GitBranch,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Terminal,
  Waves,
  AlertTriangle,
  Clock,
  Boxes,
} from 'lucide-react';

interface CommandCenterViewProps {
  providers: AIProviderStatus[];
  models: AIModel[];
  onNavigate: (tab: string) => void;
  currentUser: User | null;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  providers,
  models,
  onNavigate,
  currentUser,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [apps, setApps] = useState<AppModule[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('engine');
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, logsRes, workflowsRes, appsRes] = await Promise.all([
        api.getAnalyticsSummary().catch(() => null),
        api.getExecutionHistory(8).catch(() => []),
        api.getWorkflows().catch(() => []),
        api.getApplications().catch(() => []),
      ]);

      if (analyticsRes) setAnalytics(analyticsRes);
      setRecentLogs(logsRes || []);
      setWorkflows(workflowsRes || []);
      setApps(appsRes || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalRequests = analytics?.summary?.total_requests ?? 0;
  const avgLatency = analytics?.summary?.avg_latency_ms ?? 0;
  const activeProvidersCount = providers.filter((p) => p.isHealthy).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. HERO INTELLIGENCE BANNER */}
      <div className="relative rounded-3xl p-6 md:p-8 nexus-glass-card overflow-hidden">
        {/* Soft Blue & Lavender Ambient Accents */}
        <div className="absolute -top-16 right-0 w-96 h-96 bg-[#3978F6]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 left-1/3 w-80 h-80 bg-[#9275E8]/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(57,120,246,0.12)_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#3978F6] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-[#EEF4FC] border border-[#3978F6]/20">
                NEXUS AI SYSTEM
              </span>
              <span className="text-slate-300 text-xs font-mono">·</span>
              <span className="text-xs text-slate-600 font-mono">
                Operator: <span className="text-[#17243A] font-semibold">{currentUser?.displayName || 'Active Session'}</span> ({currentUser?.role || 'Guest'})
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-[#17243A] tracking-tight">
              Universal AI Command &amp; Orchestration Platform
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              Model-independent operational core for mission-critical generative pipelines,
              zero-cost embedded PostgreSQL persistence, and human-in-the-loop decision checkpoints.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('workspace')}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#3978F6] hover:bg-[#2A66E0] text-white shadow-[0_8px_20px_-6px_rgba(57,120,246,0.5)] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch AI Workspace
              </button>

              <button
                type="button"
                onClick={() => onNavigate('coastal')}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-white/85 hover:bg-white text-[#17243A] border border-slate-200/90 hover:border-[#3978F6]/40 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
              >
                <Waves className="w-3.5 h-3.5 text-[#3978F6]" />
                Coastal Intelligence Station
              </button>

              <button
                type="button"
                onClick={() => onNavigate('workflows')}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#EEF4FC]/90 hover:bg-[#EEF4FC] text-[#17243A] border border-[#9275E8]/30 hover:border-[#9275E8]/60 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9275E8]/40"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#9275E8]" />
                Orchestrate Workflow
              </button>
            </div>
          </div>

          {/* Quick Real Telemetry KPI Grid */}
          <div className="grid grid-cols-2 gap-3 w-full lg:w-80 shrink-0 font-mono">
            <div className="p-3.5 rounded-2xl bg-[#EEF4FC]/85 border border-white/90 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Inferences</span>
                <Activity className="w-3.5 h-3.5 text-[#3978F6]" />
              </div>
              <div className="text-xl font-bold text-[#17243A] mt-1 tabular-nums">
                {loading ? '—' : totalRequests}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Dispatched to date</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#EEF4FC]/85 border border-white/90 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Avg Latency</span>
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                {loading ? '—' : avgLatency} <span className="text-xs font-normal text-slate-500">ms</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Real roundtrip</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#EEF4FC]/85 border border-white/90 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Models Active</span>
                <Cpu className="w-3.5 h-3.5 text-[#9275E8]" />
              </div>
              <div className="text-xl font-bold text-[#17243A] mt-1 tabular-nums">
                {models.length}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{activeProvidersCount} providers up</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#EEF4FC]/85 border border-white/90 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Blueprints</span>
                <Layers className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-[#17243A] mt-1 tabular-nums">
                {apps.length}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Industry engines</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE AI ARCHITECTURE MATRIX VISUALIZATION */}
      <div className="rounded-3xl p-6 nexus-glass-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3978F6]" />
              <h2 className="text-base font-bold text-[#17243A] tracking-tight">
                Interactive System Topology
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Click any node in the orchestration topology to inspect real runtime configuration.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-mono text-[11px]">Selected Subsystem:</span>
            <span className="font-mono text-[#3978F6] font-bold px-2.5 py-0.5 rounded-lg bg-[#EEF4FC] border border-[#3978F6]/20 uppercase">
              {selectedNode}
            </span>
          </div>
        </div>

        {/* Visual Architecture Canvas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Node 1: Multi-Provider Ingestion Layer */}
          <div
            onClick={() => setSelectedNode('providers')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:-translate-y-0.5 ${
              selectedNode === 'providers'
                ? 'bg-white border-[#3978F6] shadow-[0_10px_28px_-8px_rgba(57,120,246,0.28)]'
                : 'bg-[#EEF4FC]/70 border-white/90 hover:bg-white/90 hover:border-[#3978F6]/35'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-[#3978F6] tracking-wider uppercase font-semibold">
                Layer 01
              </span>
              <Cpu className="w-4 h-4 text-[#3978F6]" />
            </div>
            <h3 className="text-sm font-bold text-[#17243A]">Model Providers</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              Google Gemini, Deterministic Coastal Sim, BYOK OpenAI &amp; Anthropic.
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/70">
              <span>{providers.length} Registered</span>
              <span className="text-[#3978F6] font-semibold group-hover:translate-x-1 transition-transform">
                Inspect →
              </span>
            </div>
          </div>

          {/* Node 2: Core Orchestration & Security */}
          <div
            onClick={() => setSelectedNode('engine')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:-translate-y-0.5 ${
              selectedNode === 'engine'
                ? 'bg-white border-[#9275E8] shadow-[0_10px_28px_-8px_rgba(146,117,232,0.28)]'
                : 'bg-[#EEF4FC]/70 border-white/90 hover:bg-white/90 hover:border-[#9275E8]/35'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-[#9275E8] tracking-wider uppercase font-semibold">
                Layer 02 · Core
              </span>
              <ShieldCheck className="w-4 h-4 text-[#9275E8]" />
            </div>
            <h3 className="text-sm font-bold text-[#17243A]">COASTPULSE Core</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              Server sessions, bcrypt RBAC, Rate-Limiting, in-process SSRF guardrails.
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/70">
              <span className="text-emerald-700 font-semibold">Strict Auth Enforced</span>
              <span className="text-[#9275E8] font-semibold group-hover:translate-x-1 transition-transform">
                Inspect →
              </span>
            </div>
          </div>

          {/* Node 3: Embedded PostgreSQL Persistence */}
          <div
            onClick={() => setSelectedNode('database')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:-translate-y-0.5 ${
              selectedNode === 'database'
                ? 'bg-white border-emerald-500 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.25)]'
                : 'bg-[#EEF4FC]/70 border-white/90 hover:bg-white/90 hover:border-emerald-400/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-emerald-700 tracking-wider uppercase font-semibold">
                Layer 03 · Data
              </span>
              <Database className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-[#17243A]">PGlite Engine</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              Embedded PostgreSQL with Drizzle ORM, directory locking, and 14 schemas.
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/70">
              <span className="text-emerald-700 font-semibold">Persistent · $0 Cloud</span>
              <span className="text-emerald-700 font-semibold group-hover:translate-x-1 transition-transform">
                Inspect →
              </span>
            </div>
          </div>

          {/* Node 4: Universal Application Blueprints */}
          <div
            onClick={() => setSelectedNode('apps')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:-translate-y-0.5 ${
              selectedNode === 'apps'
                ? 'bg-white border-amber-500 shadow-[0_10px_28px_-8px_rgba(245,158,11,0.22)]'
                : 'bg-[#EEF4FC]/70 border-white/90 hover:bg-white/90 hover:border-amber-400/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-amber-700 tracking-wider uppercase font-semibold">
                Layer 04 · Apps
              </span>
              <Boxes className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-[#17243A]">Industry Registry</h3>
            <p className="text-[11px] text-slate-600 mt-1">
              Coastal, Healthcare, Finance, Cybersecurity, Education, Ecology.
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/70">
              <span className="text-amber-700 font-semibold">{apps.length} Blueprints</span>
              <span className="text-amber-700 font-semibold group-hover:translate-x-1 transition-transform">
                Inspect →
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Topology Node Detail Drawer */}
        <div className="mt-4 p-4 rounded-2xl bg-[#EEF4FC]/75 border border-white/90 text-xs">
          {selectedNode === 'providers' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-[#17243A]">
                  Model Provider Adapter Layer
                </h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Unified TypeScript adapters implement <code className="text-[#3978F6] font-semibold">IAIProviderAdapter</code> with zero client-side keys. Currently active models include Gemini 3.8 Flash, 3.1 Flash Lite, 4 Argon, and Demo Simulator v1.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('control-center')}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#3978F6] text-[#3978F6] hover:text-white border border-[#3978F6]/25 font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Open Model Control →
              </button>
            </div>
          )}

          {selectedNode === 'engine' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-[#17243A]">
                  Security, Sessions &amp; Consequential Gates
                </h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Real server sessions validated with SHA-256 tokens in HTTP-only cookies. Workflows and coastal incident mitigation actions pass through mandatory role-based authorization checkpoints.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#9275E8] text-[#9275E8] hover:text-white border border-[#9275E8]/30 font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Inspect RBAC &amp; Security →
              </button>
            </div>
          )}

          {selectedNode === 'database' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-[#17243A]">
                  PGlite Embedded PostgreSQL Storage
                </h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Full relational PostgreSQL running in-process via WebAssembly with zero network latency, persistent file storage in <code className="text-[#3978F6] font-semibold">.data/pglite</code>, and strict single-process directory locking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                View Database Health →
              </button>
            </div>
          )}

          {selectedNode === 'apps' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-[#17243A]">
                  Application Registry &amp; Multi-Industry Blueprints
                </h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Reusable domain schemas and workflows enabling one core engine to power unlimited vertical applications without rebuilding backend infrastructure.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('apps')}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 font-mono text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Browse App Registry →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. TWO-COLUMN SPLIT: PROVIDER STATUS & WORKFLOW PIPELINES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: AI Provider Matrix */}
        <div className="rounded-3xl p-6 nexus-glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#3978F6]" />
              <h3 className="text-sm font-bold text-[#17243A]">Live Provider Status</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('control-center')}
              className="text-xs text-[#3978F6] hover:text-[#2A66E0] font-semibold font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              Control Center <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-[#EEF4FC]/70 border border-white/90 flex items-center justify-between gap-3 hover:bg-white/90 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      p.isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#17243A]">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      ID: <span className="text-[#3978F6] font-semibold">{p.id}</span> · {p.models.length} Models
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {p.isDemo ? (
                    <FidelityBadge fidelity="simulated" isSimulated />
                  ) : (
                    <FidelityBadge fidelity="actual" />
                  )}
                  {p.latencyMs !== undefined && (
                    <span className="font-mono text-[10px] text-[#3978F6] font-semibold bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 tabular-nums">
                      {p.latencyMs} ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Active Workflows & Pipelines */}
        <div className="rounded-3xl p-6 nexus-glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#9275E8]" />
              <h3 className="text-sm font-bold text-[#17243A]">Active Workflow Pipelines</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('workflows')}
              className="text-xs text-[#9275E8] hover:text-[#7C5CE0] font-semibold font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              Workflow Engine <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {workflows.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#EEF4FC]/60 border border-white text-center text-xs text-slate-500">
                No active workflows registered.
              </div>
            ) : (
              workflows.map((wf) => {
                let parsedDefs: any = wf.step_definitions;
                if (typeof parsedDefs === 'string') {
                  try {
                    parsedDefs = JSON.parse(parsedDefs || '[]');
                  } catch {
                    parsedDefs = [];
                  }
                }
                const steps = Array.isArray(parsedDefs)
                  ? parsedDefs
                  : Array.isArray(parsedDefs?.nodes)
                  ? parsedDefs.nodes
                  : Array.isArray(wf.definition?.nodes)
                  ? wf.definition.nodes
                  : [];

                return (
                  <div
                    key={wf.id}
                    className="p-3.5 rounded-2xl bg-[#EEF4FC]/70 border border-white/90 hover:bg-white/90 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-[#17243A]">{wf.name}</h4>
                      {wf.requires_approval && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> Approval Gate
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-1">{wf.description}</p>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 text-[10px] font-mono text-slate-500">
                      <span className="tabular-nums">{steps.length} Sequenced Steps</span>
                      <button
                        type="button"
                        onClick={() => onNavigate('workflows')}
                        className="text-[#3978F6] font-semibold hover:underline cursor-pointer"
                      >
                        Dispatch Run →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. RECENT REAL EXECUTION ACTIVITY LOG */}
      <div className="rounded-3xl p-6 nexus-glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#3978F6]" />
            <h3 className="text-sm font-bold text-[#17243A]">Recent AI Execution Telemetry</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="text-xs text-[#3978F6] hover:text-[#2A66E0] font-semibold font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            Full Analytics &amp; Cost Log <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-[#EEF4FC]/60 rounded-2xl border border-white">
            No executions logged yet. Dispatch an inference from the AI Workspace to generate telemetry.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#EEF4FC]/90 border-b border-slate-200/80 text-slate-600 text-[11px]">
                  <th className="py-2.5 px-3.5 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-3.5 font-semibold">Provider</th>
                  <th className="py-2.5 px-3.5 font-semibold">Model</th>
                  <th className="py-2.5 px-3.5 font-semibold">Feature</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Latency</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Tokens</th>
                  <th className="py-2.5 px-3.5 font-semibold">Fidelity</th>
                  <th className="py-2.5 px-3.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#17243A] text-[11px]">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#EEF4FC]/50 transition-colors">
                    <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3.5 uppercase text-[#3978F6] font-bold">{log.provider_id}</td>
                    <td className="py-2.5 px-3.5 text-[#17243A] font-medium">{log.model_id}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">{log.feature_source}</td>
                    <td className="py-2.5 px-3.5 text-[#17243A] text-right tabular-nums">{log.latency_ms} ms</td>
                    <td className="py-2.5 px-3.5 text-slate-600 text-right tabular-nums">
                      {log.total_tokens !== null ? log.total_tokens : 'NULL'}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <FidelityBadge
                        fidelity={log.metric_fidelity}
                        isSimulated={log.is_simulated}
                      />
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. APPLICATION REGISTRY SNAPSHOT */}
      <div className="rounded-3xl p-6 nexus-glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-[#17243A]">Universal Application Registry</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('apps')}
            className="text-xs text-[#3978F6] hover:text-[#2A66E0] font-semibold font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            All Blueprints <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {apps.map((app) => (
            <div
              key={app.id}
              onClick={() => {
                if (app.id === 'coastal-intelligence') onNavigate('coastal');
                else onNavigate('apps');
              }}
              className="p-4 rounded-2xl bg-[#EEF4FC]/70 border border-white/90 hover:bg-white hover:border-[#3978F6]/35 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-[10px] font-mono font-semibold text-[#3978F6] px-2 py-0.5 rounded-md bg-white border border-[#3978F6]/20 truncate">
                  {app.domain}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                    app.is_reference_template
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {app.is_reference_template ? 'Live Template' : 'Blueprint'}
                </span>
              </div>
              <h4 className="text-xs font-bold text-[#17243A] group-hover:text-[#3978F6] transition-colors">
                {app.name}
              </h4>
              <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{app.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
