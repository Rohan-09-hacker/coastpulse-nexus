import React, { useState, useEffect } from 'react';
import { api } from '../../core/api-client.ts';
import {
  Terminal,
  ShieldCheck,
  Play,
  Copy,
  Check,
  AlertTriangle,
  Code2,
  Cpu,
  Layers,
} from 'lucide-react';

export const PlaygroundView: React.FC = () => {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<any | null>(null);
  const [targetPath, setTargetPath] = useState<string>('/api/v1/providers');
  const [payloadText, setPayloadText] = useState<string>('{}');

  const [loading, setLoading] = useState<boolean>(false);
  const [responseResult, setResponseResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    api.getPlaygroundEndpoints().then((list) => {
      setEndpoints(list);
      if (list.length > 0) {
        setSelectedEndpoint(list[0]);
        setTargetPath(list[0].path);
        setPayloadText(list[0].samplePayload ? JSON.stringify(list[0].samplePayload, null, 2) : '{}');
      }
    });
  }, []);

  const handleSelectEndpoint = (ep: any) => {
    setSelectedEndpoint(ep);
    setTargetPath(ep.path);
    setPayloadText(ep.samplePayload ? JSON.stringify(ep.samplePayload, null, 2) : '{}');
    setResponseResult(null);
    setErrorMsg(null);
  };

  const handleExecute = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResponseResult(null);

    let parsedPayload: any = {};
    if (payloadText.trim()) {
      try {
        parsedPayload = JSON.parse(payloadText);
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(`Malformed JSON in request payload: ${err.message}`);
        return;
      }
    }

    try {
      const res = await api.executePlayground(targetPath, parsedPayload);
      setResponseResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResponse = () => {
    if (!responseResult) return;
    navigator.clipboard.writeText(JSON.stringify(responseResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testSsrfProbes = [
    { label: 'AWS/GCP Metadata', probe: 'http://169.254.169.254/latest/meta-data' },
    { label: 'Loopback Probe', probe: 'http://localhost:3000/internal' },
    { label: 'Private Subnet', probe: 'http://192.168.1.1/admin' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-lg bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/20 font-semibold">
              In-Process IPC Dispatcher
            </span>
            <span className="text-xs text-slate-500">Kernel-Isolated</span>
          </div>
          <h2 className="text-xl font-bold text-[#17243A] flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-[#3978F6]" />
            API Playground &amp; Route Console
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Inspect, probe, and dispatch in-memory platform API calls with role-based access enforcement and strict SSRF loopback defenses.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExecute}
          disabled={loading || !targetPath.trim()}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-[#3978F6] hover:bg-[#2A66E0] disabled:opacity-40 text-white transition-all shadow-[0_8px_20px_-6px_rgba(57,120,246,0.5)] cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {loading ? 'Dispatching In-Process...' : 'Dispatch Request'}
        </button>
      </div>

      {/* SSRF Architectural Guarantee Card */}
      <div className="p-5 nexus-glass-card rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <div className="text-[#17243A] font-semibold flex items-center gap-2">
              SSRF &amp; Loopback Defense Shield Active
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                ACTIVE
              </span>
            </div>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Playground bypasses raw networking using in-process route dispatchers. External URL schemes (<code className="text-[#3978F6] font-semibold">http://</code>, <code className="text-[#3978F6] font-semibold">https://</code>), cloud metadata (<code className="text-[#3978F6] font-semibold">169.254.*</code>), and private RFC1918 subnets are blocked before execution.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Test Probes:</span>
          {testSsrfProbes.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setTargetPath(p.probe);
                setResponseResult(null);
                setErrorMsg(null);
              }}
              className="text-[11px] font-mono px-2.5 py-1 bg-[#EEF4FC] hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-white hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <strong className="font-semibold text-rose-900">Request Rejected:</strong> {errorMsg}
          </div>
        </div>
      )}

      {/* Main Grid: Allowlist & Request Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Approved Endpoints Allowlist (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#17243A] uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#3978F6]" />
              Verified Route Matrix
            </label>
            <span className="text-[10px] font-mono font-semibold text-[#3978F6] bg-[#EEF4FC] border border-[#3978F6]/20 px-2 py-0.5 rounded-md tabular-nums">
              {endpoints.length} Routes
            </span>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {endpoints.map((ep) => {
              const isSelected = selectedEndpoint?.id === ep.id;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => handleSelectEndpoint(ep)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#3978F6] shadow-[0_8px_22px_-6px_rgba(57,120,246,0.22)] text-[#17243A]'
                      : 'bg-white/65 border-white/90 text-slate-600 hover:bg-white hover:border-[#3978F6]/30 hover:text-[#17243A]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                        ep.method === 'POST'
                          ? 'bg-[#9275E8]/12 text-[#6D28D9] border-[#9275E8]/30'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {ep.method}
                    </span>
                    {ep.requiredRole && (
                      <span className="text-[10px] font-mono uppercase bg-[#EEF4FC] text-slate-600 border border-white px-1.5 py-0.5 rounded-md font-semibold">
                        {ep.requiredRole}+
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-[#3978F6] truncate font-semibold">{ep.path}</div>
                  <div className="text-[11px] text-slate-600 mt-1 line-clamp-1">{ep.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Request & Response Inspector (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Target Route & Method Bar */}
          <div className="nexus-glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1.5 bg-[#EEF4FC] text-[#3978F6] rounded-xl border border-[#3978F6]/20 font-bold uppercase tracking-wider">
                {selectedEndpoint?.method || 'POST'}
              </span>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="flex-1 bg-white/85 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono text-[#17243A] focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 transition-colors"
                placeholder="/api/v1/..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-600 flex items-center gap-1.5 font-semibold">
                  <Code2 className="w-3.5 h-3.5 text-[#3978F6]" />
                  JSON Request Body
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedEndpoint?.samplePayload) {
                      setPayloadText(JSON.stringify(selectedEndpoint.samplePayload, null, 2));
                    }
                  }}
                  className="text-[10px] font-mono text-[#3978F6] hover:underline font-semibold cursor-pointer"
                >
                  Reset Sample
                </button>
              </div>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={5}
                className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-xs font-mono text-[#17243A] focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 transition-colors leading-relaxed"
              />
            </div>
          </div>

          {/* Response Box */}
          <div className="nexus-glass-card rounded-2xl p-4 space-y-3 min-h-[300px]">
            <div className="flex items-center justify-between text-xs border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#3978F6]" />
                <span className="font-semibold text-[#17243A]">Dispatcher Response Inspector</span>
              </div>
              {responseResult && (
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-[#3978F6] font-semibold tabular-nums">
                    {responseResult.durationMs ?? 0} ms
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      responseResult.success
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {responseResult.success ? '200 OK' : 'FAILED'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    className="p-1.5 rounded-lg bg-[#EEF4FC] hover:bg-white text-slate-600 hover:text-[#17243A] border border-slate-200/80 transition-colors cursor-pointer"
                    title="Copy JSON Response"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            <pre className="bg-[#EEF4FC]/75 p-4 rounded-xl border border-white text-xs font-mono text-[#17243A] overflow-x-auto max-h-[360px] leading-relaxed">
              {responseResult ? (
                JSON.stringify(responseResult, null, 2)
              ) : (
                <span className="text-slate-500 italic">
                  {loading
                    ? 'Dispatching internal IPC request through route pipeline...'
                    : 'Select a verified endpoint and click Dispatch Request to inspect live server response.'}
                </span>
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
