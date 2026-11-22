import React, { useState } from 'react';
import { api } from '../../core/api-client.ts';
import { AIProviderStatus } from '../../core/types.ts';
import { FidelityBadge } from '../../components/shared/FidelityBadge.tsx';
import {
  Cpu,
  RefreshCw,
  Lock,
  Server,
} from 'lucide-react';

interface ControlCenterViewProps {
  providers: AIProviderStatus[];
  onRefreshProviders: () => void;
}

export const ControlCenterView: React.FC<ControlCenterViewProps> = ({
  providers,
  onRefreshProviders,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const res = await api.testProvider(providerId);
      setTestResults((prev) => ({ ...prev, [providerId]: res }));
      onRefreshProviders();
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { isHealthy: false, message: err.message },
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#17243A] flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#3978F6]" />
            Model Control Center
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Audit multi-cloud generative connectivity, trigger live roundtrip latency pings, and inspect context quotas.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshProviders}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white/85 hover:bg-white text-[#17243A] border border-slate-200/90 hover:border-[#3978F6]/40 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#3978F6]" />
          Refresh Model Catalog
        </button>
      </div>

      {/* Security Architecture Callout */}
      <div className="p-4 nexus-glass-card rounded-2xl flex items-start gap-3.5 text-xs text-slate-700">
        <div className="w-8 h-8 rounded-xl bg-[#EEF4FC] border border-[#3978F6]/20 flex items-center justify-center text-[#3978F6] shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="leading-relaxed">
          <strong className="text-[#17243A] font-semibold">Zero Client-Side Secret Exposure:</strong>{' '}
          All external model credentials (<code className="text-[#3978F6] font-semibold">GEMINI_API_KEY</code>, BYOK <code className="text-[#3978F6] font-semibold">OPENAI_API_KEY</code>, <code className="text-[#3978F6] font-semibold">ANTHROPIC_API_KEY</code>) reside exclusively in backend environment memory. The frontend dispatches strictly to unified in-process adapters with zero client-exposed tokens.
        </div>
      </div>

      {/* Provider Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map((p) => {
          const testRes = testResults[p.id];
          const isHealthy = testRes ? testRes.isHealthy : p.isHealthy;
          const statusMessage = testRes ? testRes.message : p.healthMessage;
          const latencyMs = testRes ? testRes.latencyMs : p.latencyMs;

          return (
            <div
              key={p.id}
              className={`p-5 rounded-3xl nexus-glass-card transition-all flex flex-col justify-between hover:-translate-y-0.5 ${
                p.isDemo
                  ? 'border-amber-200/90'
                  : isHealthy
                  ? 'border-white/95'
                  : 'border-slate-200/80 opacity-90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-[#17243A]">{p.name}</h3>
                      {p.isDemo ? (
                        <FidelityBadge fidelity="simulated" isSimulated />
                      ) : (
                        <FidelityBadge fidelity="actual" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Provider ID: <span className="text-[#3978F6] font-semibold">{p.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isHealthy ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Nominal / Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Unconfigured / Offline
                      </span>
                    )}
                  </div>
                </div>

                {/* Diagnostics Panel */}
                <div className="bg-[#EEF4FC]/75 p-3.5 rounded-2xl border border-white mb-4 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono">
                    <span>Diagnostics:</span>
                    {latencyMs !== undefined && (
                      <span className="text-[#3978F6] font-bold tabular-nums">
                        {latencyMs} ms roundtrip
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#17243A] leading-normal font-mono">
                    {statusMessage || 'Provider initialized.'}
                  </div>
                </div>
              </div>

              {/* Models Count & Test Ping */}
              <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-200/70">
                <span className="text-slate-600 font-mono text-[11px]">
                  Registered Models:{' '}
                  <span className="text-[#17243A] font-bold tabular-nums">{p.models.length}</span>
                </span>

                <button
                  type="button"
                  onClick={() => handleTestConnection(p.id)}
                  disabled={testingId === p.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-[#EEF4FC] text-[#17243A] border border-slate-200 hover:border-[#3978F6]/40 transition-colors disabled:opacity-50 cursor-pointer font-mono font-medium shadow-xs"
                >
                  <RefreshCw className={`w-3 h-3 text-[#3978F6] ${testingId === p.id ? 'animate-spin' : ''}`} />
                  {testingId === p.id ? 'Pinging...' : 'Test Ping'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unified Models Table */}
      <div className="rounded-3xl p-6 nexus-glass-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#17243A] flex items-center gap-2">
            <Server className="w-4 h-4 text-[#3978F6]" />
            Registered Model Capabilities Matrix
          </h3>
          <span className="text-[11px] font-mono text-slate-600 tabular-nums">
            {providers.reduce((acc, p) => acc + p.models.length, 0)} Models Available
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white/75">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#EEF4FC]/90 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4 font-semibold">Model ID</th>
                <th className="py-3 px-4 font-semibold">Display Name</th>
                <th className="py-3 px-4 font-semibold">Provider</th>
                <th className="py-3 px-4 font-semibold text-right">Context Window</th>
                <th className="py-3 px-4 font-semibold">Streaming</th>
                <th className="py-3 px-4 font-semibold">Fidelity Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[#17243A]">
              {providers.flatMap((p) =>
                p.models.map((m) => (
                  <tr key={m.id} className="hover:bg-[#EEF4FC]/50 transition-colors">
                    <td className="py-2.5 px-4 text-[#3978F6] font-bold">{m.id}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-[#17243A]">{m.displayName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{p.name}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">
                      {m.contextWindow.toLocaleString()} tokens
                    </td>
                    <td className="py-2.5 px-4">
                      {m.supportsStreaming ? (
                        <span className="text-emerald-700 font-semibold">Yes (SSE)</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {m.isSimulated ? (
                        <FidelityBadge fidelity="simulated" isSimulated />
                      ) : (
                        <FidelityBadge fidelity="actual" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
