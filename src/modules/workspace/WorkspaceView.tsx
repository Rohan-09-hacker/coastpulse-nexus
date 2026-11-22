import React, { useState } from 'react';
import { api } from '../../core/api-client.ts';
import { AIModel, ExecutionResponse } from '../../core/types.ts';
import { FidelityBadge } from '../../components/shared/FidelityBadge.tsx';
import {
  Play,
  RotateCcw,
  Sliders,
  Terminal,
  Clock,
  Coins,
} from 'lucide-react';

interface WorkspaceViewProps {
  models: AIModel[];
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ models }) => {
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [prompt, setPrompt] = useState<string>(
    'Synthesize an oceanographic risk assessment for an offshore storm surge warning near the Puget Sound entrance.'
  );
  const [systemInstruction, setSystemInstruction] = useState<string>(
    'You are COASTPULSE Core marine intelligence engine. Provide structured, precise operational analysis.'
  );
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(1024);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>('');
  const [responseTelemetry, setResponseTelemetry] = useState<ExecutionResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentModelObj = models.find((m) => m.id === selectedModel);

  const handleExecute = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setResponseText('');
    setResponseTelemetry(null);

    if (isStreaming) {
      await api.streamCompletion(
        {
          modelId: selectedModel,
          prompt,
          systemInstruction: systemInstruction.trim() || undefined,
          temperature,
          maxTokens,
        },
        (chunk) => {
          setResponseText((prev) => prev + chunk);
        },
        (final) => {
          setLoading(false);
          setResponseTelemetry(final);
          setResponseText(final.text);
        },
        (err) => {
          setLoading(false);
          setErrorMsg(err.message || 'Streaming failed.');
        }
      );
    } else {
      try {
        const resp = await api.generateCompletion({
          modelId: selectedModel,
          prompt,
          systemInstruction: systemInstruction.trim() || undefined,
          temperature,
          maxTokens,
        });
        setLoading(false);
        setResponseTelemetry(resp);
        setResponseText(resp.text);
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message || 'Execution failed.');
      }
    }
  };

  const samplePrompts = [
    {
      title: 'Storm Surge Triage',
      text: 'Analyze the oceanographic risk of a 5.2m king tide surge combined with gale force NW winds on harbor infrastructure.',
    },
    {
      title: 'Oil Plume Trajectory',
      text: 'Forecast 6-hour drift trajectory for a 400-gallon marine diesel spill off Monterey Bay in 15kt ebb currents.',
    },
    {
      title: 'Vessel Distress Assessment',
      text: 'Evaluate navigational hazard of an unpowered 45ft tug adrift 3.2 nautical miles off Cape Flattery in heavy fog.',
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#17243A] flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#3978F6]" />
            AI Prompt &amp; Inference Studio
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time inference dispatch, SSE token streaming, and empirical latency &amp; cost tracking.
          </p>
        </div>

        {/* Model Switcher & Streaming Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white/85 backdrop-blur-md border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-xs">
            <span className="text-xs text-slate-500 font-mono">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-xs text-[#3978F6] font-semibold focus:outline-none cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-white text-[#17243A]">
                  {m.displayName} {m.isSimulated ? '(Simulated)' : ''}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#17243A] bg-white/85 backdrop-blur-md border border-slate-200/90 px-3 py-1.5 rounded-xl cursor-pointer hover:border-[#3978F6]/40 transition-colors shadow-xs whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={isStreaming}
              onChange={(e) => setIsStreaming(e.target.checked)}
              className="accent-[#3978F6] rounded"
            />
            <span className="font-mono text-[11px] font-medium">SSE Streaming</span>
          </label>

          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40 ${
              showConfig
                ? 'bg-[#EEF4FC] text-[#3978F6] border-[#3978F6]/40 shadow-xs'
                : 'bg-white/85 text-slate-600 border-slate-200/90 hover:text-[#17243A]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Parameters</span>
          </button>
        </div>
      </div>

      {/* Model Simulated Warning Banner */}
      {currentModelObj?.isSimulated && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>
              <strong>Deterministic Simulator Active:</strong> Responses and token metrics are generated offline for simulated testing and logged with fidelity tag <code className="font-semibold">simulated</code>.
            </span>
          </div>
          <FidelityBadge fidelity="simulated" isSimulated />
        </div>
      )}

      {/* Parameter Control Panel (Expandable) */}
      {showConfig && (
        <div className="p-5 nexus-glass-card rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block text-[#17243A] font-semibold mb-1.5">
              System Instruction
            </label>
            <textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              rows={3}
              className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-3 text-[#17243A] focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 focus:outline-none font-mono text-xs leading-relaxed"
              placeholder="Optional system directive..."
            />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[#17243A] mb-1">
                <span className="font-medium">Temperature</span>
                <span className="font-mono text-[#3978F6] font-bold tabular-nums">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#3978F6] cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[#17243A] mb-1">
                <span className="font-medium">Max Output Tokens</span>
                <span className="font-mono text-[#3978F6] font-bold tabular-nums">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="128"
                max="4096"
                step="128"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                className="w-full accent-[#3978F6] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Console */}
        <div className="space-y-3 nexus-glass-card rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#17243A] tracking-wide uppercase font-mono">
              Prompt Directive
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-mono">Scenarios:</span>
              {samplePrompts.map((sp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sp.text)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#EEF4FC]/85 hover:bg-white text-slate-700 hover:text-[#3978F6] border border-white hover:border-[#3978F6]/30 transition-colors cursor-pointer font-medium"
                >
                  {sp.title}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
            className="w-full bg-white/80 border border-slate-200/90 rounded-2xl p-4 text-[#17243A] placeholder-slate-400 focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 focus:outline-none font-mono text-xs leading-relaxed shadow-inner"
            placeholder="Enter operational query or prompt instructions..."
          />

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setPrompt('');
                setResponseText('');
                setResponseTelemetry(null);
                setErrorMsg(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-white/85 hover:bg-white text-slate-600 border border-slate-200 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Console
            </button>

            <button
              type="button"
              onClick={handleExecute}
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-[#3978F6] hover:bg-[#2A66E0] disabled:opacity-50 text-white shadow-[0_8px_20px_-6px_rgba(57,120,246,0.5)] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {loading ? (isStreaming ? 'Streaming Response...' : 'Inferencing...') : 'Execute Inference'}
            </button>
          </div>
        </div>

        {/* Right: Response & Telemetry Output */}
        <div className="space-y-3 nexus-glass-card rounded-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#17243A] tracking-wide uppercase font-mono">
              Model Telemetry &amp; Response Stream
            </label>
            {responseTelemetry && (
              <FidelityBadge
                fidelity={responseTelemetry.metricFidelity}
                isSimulated={responseTelemetry.isSimulated}
              />
            )}
          </div>

          <div className="relative flex-1 min-h-[280px] bg-[#EEF4FC]/65 border border-white/90 rounded-2xl p-4 flex flex-col justify-between">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl mb-3">
                <strong>Upstream Error:</strong> {errorMsg}
              </div>
            )}

            <div className="font-mono text-xs text-[#17243A] whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[340px]">
              {responseText ? (
                responseText
              ) : (
                <span className="text-slate-500 italic">
                  {loading ? 'Awaiting response from provider...' : 'Model generation output will stream here...'}
                </span>
              )}
            </div>

            {/* Empirical Telemetry Bar */}
            <div className="mt-5 pt-4 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs font-mono">
              <div className="bg-white/85 p-2.5 rounded-xl border border-slate-200/70">
                <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-[#3978F6]" /> Latency
                </div>
                <div className="font-bold text-[#3978F6] mt-1 tabular-nums">
                  {responseTelemetry ? `${responseTelemetry.latencyMs} ms` : '—'}
                </div>
              </div>

              <div className="bg-white/85 p-2.5 rounded-xl border border-slate-200/70">
                <div className="text-[10px] text-slate-500">Prompt Tokens</div>
                <div className="font-bold text-[#17243A] mt-1 tabular-nums">
                  {responseTelemetry ? (responseTelemetry.promptTokens ?? 'NULL') : '—'}
                </div>
              </div>

              <div className="bg-white/85 p-2.5 rounded-xl border border-slate-200/70">
                <div className="text-[10px] text-slate-500">Completion Tokens</div>
                <div className="font-bold text-[#17243A] mt-1 tabular-nums">
                  {responseTelemetry ? (responseTelemetry.completionTokens ?? 'NULL') : '—'}
                </div>
              </div>

              <div className="bg-white/85 p-2.5 rounded-xl border border-slate-200/70">
                <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                  <Coins className="w-3 h-3 text-emerald-600" /> Cost
                </div>
                <div className="font-bold text-emerald-700 mt-1 tabular-nums">
                  {responseTelemetry
                    ? responseTelemetry.estimatedCostUsd !== null
                      ? `$${responseTelemetry.estimatedCostUsd.toFixed(6)}`
                      : 'NULL (Sim/Free)'
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
