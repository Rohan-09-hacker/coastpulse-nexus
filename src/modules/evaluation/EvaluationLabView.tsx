import React, { useState } from 'react';
import { api } from '../../core/api-client.ts';
import { AIModel } from '../../core/types.ts';
import { FidelityBadge } from '../../components/shared/FidelityBadge.tsx';
import { Scale, Play, CheckCircle2, Star, Clock } from 'lucide-react';

interface EvaluationLabViewProps {
  models: AIModel[];
}

export const EvaluationLabView: React.FC<EvaluationLabViewProps> = ({ models }) => {
  const [evalName, setEvalName] = useState<string>('Offshore Emergency Triage Benchmark');
  const [testPrompt, setTestPrompt] = useState<string>(
    'An offshore supply vessel lost steering in heavy seas 2 miles outside the harbor breakwater with 20 personnel onboard. Wind 35 knots, breaking surf 4.5m. Provide immediate tactical stabilization orders and search & rescue priority.'
  );
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'gemini-3.8-flash',
    'demo-sim-coastal-v1',
  ]);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [results, setResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter((id) => id !== modelId));
      }
    } else {
      if (selectedModels.length < 3) {
        setSelectedModels([...selectedModels, modelId]);
      }
    }
  };

  const handleRunEvaluation = async () => {
    if (!testPrompt.trim() || selectedModels.length === 0) return;
    setIsRunning(true);
    setErrorMsg(null);
    setResults([]);

    try {
      const data = await api.runEvaluation({
        name: evalName,
        prompt: testPrompt,
        modelIds: selectedModels,
      });
      setResults(data.results || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Evaluation run failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#17243A] flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#3978F6]" />
            Evaluation &amp; Benchmarking Lab
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Side-by-side comparative benchmarking across roundtrip latency, token consumption, and response quality.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunEvaluation}
          disabled={isRunning || !testPrompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-[#3978F6] hover:bg-[#2A66E0] disabled:opacity-50 text-white shadow-[0_8px_20px_-6px_rgba(57,120,246,0.5)] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? 'Running Multi-Model Benchmark...' : 'Run Comparative Benchmark'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl">
          <strong>Evaluation Error:</strong> {errorMsg}
        </div>
      )}

      {/* Benchmark Setup Console */}
      <div className="p-6 nexus-glass-card rounded-3xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider font-bold text-[#3978F6] block mb-1.5">
              Benchmark Suite Title
            </label>
            <input
              type="text"
              value={evalName}
              onChange={(e) => setEvalName(e.target.value)}
              className="w-full bg-white/85 border border-slate-200 rounded-xl p-2.5 text-xs text-[#17243A] focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider font-bold text-[#3978F6] block mb-1.5">
              Select 2 to 3 Models to Compare
            </label>
            <div className="flex flex-wrap gap-2">
              {models.map((m) => {
                const isSelected = selectedModels.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModel(m.id)}
                    className={`px-3 py-1.5 text-xs rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer font-mono ${
                      isSelected
                        ? 'bg-[#EEF4FC] border-[#3978F6] text-[#17243A] font-bold shadow-xs'
                        : 'bg-white/75 border-slate-200 text-slate-600 hover:text-[#17243A] hover:border-slate-300'
                    }`}
                  >
                    <span>{m.displayName}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#3978F6]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-mono uppercase tracking-wider font-bold text-[#17243A] block mb-1.5">
            Standardized Comparative Test Prompt
          </label>
          <textarea
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            rows={3}
            className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-xs text-[#17243A] font-mono focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 leading-relaxed"
          />
        </div>
      </div>

      {/* Side-by-Side Results Matrix */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-[#17243A] uppercase tracking-wider">
              Side-by-Side Inference Diff &amp; Metrics
            </span>
            <span className="text-[11px] text-slate-600">
              All runs logged to <code className="text-[#3978F6] font-semibold">evaluation_results</code>
            </span>
          </div>

          <div
            className={`grid gap-5 ${
              results.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'
            }`}
          >
            {results.map((res, idx) => (
              <div
                key={idx}
                className="nexus-glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200/80 mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#17243A]">{res.modelId}</h4>
                      <div className="text-[10px] text-[#3978F6] font-mono uppercase font-bold mt-0.5">
                        {res.providerId}
                      </div>
                    </div>
                    <FidelityBadge fidelity={res.metricFidelity} isSimulated={res.isSimulated} />
                  </div>

                  {/* Quantitative Score Metrics Card */}
                  <div className="grid grid-cols-3 gap-2 bg-[#EEF4FC]/85 p-3 rounded-2xl border border-white text-center text-xs mb-3 font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-[#3978F6]" /> Latency
                      </div>
                      <div className="text-[#3978F6] font-bold mt-1 tabular-nums">{res.latencyMs} ms</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Tokens</div>
                      <div className="text-[#17243A] font-bold mt-1 tabular-nums">{res.totalTokens ?? 'NULL'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Rating</div>
                      <div className="text-amber-600 font-bold mt-1 flex items-center justify-center gap-0.5 tabular-nums">
                        <Star className="w-3 h-3 fill-current" />
                        {res.qualityScore}/5
                      </div>
                    </div>
                  </div>

                  {/* Response Text Box */}
                  <div className="font-mono text-xs text-[#17243A] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto bg-white/80 p-3.5 rounded-2xl border border-slate-200/70">
                    {res.text}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-200/70 flex justify-between">
                  <span className="tabular-nums">Est Cost: {res.estimatedCostUsd ? `$${res.estimatedCostUsd}` : 'NULL (Unbilled)'}</span>
                  <span className="text-emerald-700 font-bold uppercase">{res.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
