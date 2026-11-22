import React, { useState, useEffect } from 'react';
import { api } from '../../core/api-client.ts';
import { AnalyticsSummary } from '../../core/types.ts';
import { FidelityBadge } from '../../components/shared/FidelityBadge.tsx';
import {
  BarChart3,
  RefreshCw,
  Clock,
  Layers,
  Activity,
  Coins,
  CheckCircle2,
} from 'lucide-react';

export const AnalyticsDashboardView: React.FC = () => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [summaryRes, historyRes] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getExecutionHistory(30),
      ]);
      setData(summaryRes);
      setHistory(historyRes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const s = data?.summary;
  const successRate =
    s && s.total_requests > 0
      ? Math.round((s.successful_requests / s.total_requests) * 100)
      : 100;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#17243A] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#3978F6]" />
            Telemetry &amp; Cost Analytics
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Real PostgreSQL execution logs with strict fidelity segregation between live cloud inferences and offline simulators.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white/85 hover:bg-white text-[#17243A] border border-slate-200/90 hover:border-[#3978F6]/40 transition-colors disabled:opacity-50 cursor-pointer font-mono whitespace-nowrap shrink-0 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#3978F6] ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit Metrics
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl">
          <strong>Analytics Error:</strong> {errorMsg}
        </div>
      )}

      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
        <div className="nexus-glass-card p-5 rounded-3xl space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between uppercase">
            <span>Total Inferences</span>
            <Activity className="w-3.5 h-3.5 text-[#3978F6]" />
          </div>
          <div className="text-2xl font-bold text-[#17243A] tabular-nums">
            {s?.total_requests ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">Live PostgreSQL audit rows</div>
        </div>

        <div className="nexus-glass-card p-5 rounded-3xl space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between uppercase">
            <span>Success Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            {successRate}%
          </div>
          <div className="text-[10px] text-slate-500 tabular-nums">
            {s?.successful_requests ?? 0} pass / {s?.error_requests ?? 0} fail
          </div>
        </div>

        <div className="nexus-glass-card p-5 rounded-3xl space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between uppercase">
            <span>Mean Latency</span>
            <Clock className="w-3.5 h-3.5 text-[#9275E8]" />
          </div>
          <div className="text-2xl font-bold text-[#3978F6] tabular-nums">
            {s?.avg_latency_ms ? `${s.avg_latency_ms} ms` : '—'}
          </div>
          <div className="text-[10px] text-slate-500">Across valid inferences</div>
        </div>

        <div className="nexus-glass-card p-5 rounded-3xl space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between uppercase">
            <span>Actual Spend</span>
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            {s?.actual_cost_usd !== null && s?.actual_cost_usd !== undefined
              ? `$${Number(s.actual_cost_usd).toFixed(5)}`
              : '$0.00000'}
          </div>
          <div className="text-[10px] text-slate-500">Billed over real cloud tokens</div>
        </div>
      </div>

      {/* Metric Fidelity Partition */}
      <div className="p-6 nexus-glass-card rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-mono font-bold text-[#17243A] uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3978F6]" />
            Token Metric Fidelity Partition
          </h3>
          <span className="text-[11px] text-[#3978F6] font-mono font-semibold">Truthful Telemetry Enforcement</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#EEF4FC]/75 p-4 rounded-2xl border border-emerald-200/70 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#17243A] font-bold">Actual Live Tokens</span>
              <FidelityBadge fidelity="actual" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
              {s?.actual_tokens_consumed ? s.actual_tokens_consumed.toLocaleString() : 0}
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Tokens counted directly from live upstream API responses.
            </p>
          </div>

          <div className="bg-[#EEF4FC]/75 p-4 rounded-2xl border border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#17243A] font-bold">Simulated Tokens</span>
              <FidelityBadge fidelity="simulated" isSimulated />
            </div>
            <div className="text-xl font-bold font-mono text-amber-700 tabular-nums">
              {s?.simulated_tokens ? s.simulated_tokens.toLocaleString() : 0}
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Simulated tokens from demo simulator for offline operational testing.
            </p>
          </div>

          <div className="bg-[#EEF4FC]/75 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#17243A] font-bold">Missing/Null Headers</span>
              <FidelityBadge fidelity="unavailable" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-600 tabular-nums">
              {s?.missing_token_metadata_count ?? 0}
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Calls where provider omitted token metadata (stored strictly as NULL).
            </p>
          </div>
        </div>
      </div>

      {/* Model Distribution & Provider Share */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="nexus-glass-card p-5 rounded-3xl space-y-3">
          <h3 className="text-xs font-mono font-bold text-[#17243A] uppercase tracking-wider">
            Execution Volume by Model
          </h3>
          <div className="space-y-2.5">
            {data?.modelDistribution && data.modelDistribution.length > 0 ? (
              data.modelDistribution.map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-[#EEF4FC]/75 p-3 rounded-xl border border-white font-mono"
                >
                  <div>
                    <span className="text-[#3978F6] font-bold">{m.model_id}</span>
                    <span className="text-[10px] text-slate-500 ml-2 tabular-nums">({m.avg_latency} ms avg)</span>
                  </div>
                  <span className="text-[#17243A] font-bold tabular-nums">{m.count} calls</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic py-6 text-center font-mono">
                No model executions recorded yet.
              </div>
            )}
          </div>
        </div>

        <div className="nexus-glass-card p-5 rounded-3xl space-y-3">
          <h3 className="text-xs font-mono font-bold text-[#17243A] uppercase tracking-wider">
            Execution Volume by Provider
          </h3>
          <div className="space-y-2.5">
            {data?.providerDistribution && data.providerDistribution.length > 0 ? (
              data.providerDistribution.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-[#EEF4FC]/75 p-3 rounded-xl border border-white font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#17243A] uppercase">{p.provider_id}</span>
                    {p.is_simulated && <span className="text-[10px] text-amber-700 font-bold">(DEMO)</span>}
                  </div>
                  <span className="text-[#17243A] font-bold tabular-nums">{p.count} calls</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic py-6 text-center font-mono">
                No provider executions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution Audit Log Table */}
      <div className="p-6 nexus-glass-card rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-[#17243A] uppercase tracking-wider">
            Real Inferences Audit Log
          </h3>
          <span className="text-[11px] font-mono text-slate-600 tabular-nums">{history.length} Entries Loaded</span>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white/75">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#EEF4FC]/90 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-3.5 font-semibold">Timestamp</th>
                <th className="py-3 px-3.5 font-semibold">Module Source</th>
                <th className="py-3 px-3.5 font-semibold">Model</th>
                <th className="py-3 px-3.5 font-semibold text-right">Latency</th>
                <th className="py-3 px-3.5 font-semibold text-right">Total Tokens</th>
                <th className="py-3 px-3.5 font-semibold text-right">Est Cost</th>
                <th className="py-3 px-3.5 font-semibold">Fidelity</th>
                <th className="py-3 px-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[#17243A] text-[11px]">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-[#EEF4FC]/50 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap tabular-nums">
                    {new Date(row.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3.5 text-[#3978F6] font-bold uppercase">{row.feature_source}</td>
                  <td className="py-2.5 px-3.5 text-[#17243A] font-medium">{row.model_id}</td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">{row.latency_ms} ms</td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-600">
                    {row.total_tokens !== null ? row.total_tokens : <span className="text-slate-400">NULL</span>}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-600">
                    {row.estimated_cost_usd !== null ? `$${row.estimated_cost_usd}` : <span className="text-slate-400">NULL</span>}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <FidelityBadge fidelity={row.metric_fidelity} isSimulated={row.is_simulated} />
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${
                        row.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
