import React, { useState, useEffect } from 'react';
import { api } from '../../core/api-client.ts';
import { CoastalIncident, CoastalApprovalItem, User, AIModel } from '../../core/types.ts';
import { FidelityBadge } from '../../components/shared/FidelityBadge.tsx';
import {
  Waves,
  Compass,
  Wind,
  Droplets,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  FileText,
  Activity,
  Radio,
  Navigation,
  Anchor,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface CoastalAppViewProps {
  currentUser: User | null;
  models: AIModel[];
  onRefreshApprovalsCount?: () => void;
}

export const CoastalAppView: React.FC<CoastalAppViewProps> = ({
  currentUser,
  models,
  onRefreshApprovalsCount,
}) => {
  const [incidents, setIncidents] = useState<CoastalIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<CoastalIncident | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<any | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<CoastalApprovalItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');

  const [isAssessing, setIsAssessing] = useState<boolean>(false);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Incident Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('oil_spill');
  const [newSeverity, setNewSeverity] = useState<'minor' | 'moderate' | 'severe' | 'critical'>('severe');
  const [newLocation, setNewLocation] = useState('Point Reyes Outer Shoals');
  const [newLat, setNewLat] = useState('38.0012');
  const [newLng, setNewLng] = useState('-123.0234');
  const [newDesc, setNewDesc] = useState('');

  const isOperatorOrAdmin = currentUser?.role === 'operator' || currentUser?.role === 'admin';

  const loadData = async () => {
    try {
      const [incList, appList] = await Promise.all([
        api.getCoastalIncidents(),
        api.getPendingApprovals(),
      ]);
      setIncidents(incList);
      setPendingApprovals(appList);
      if (onRefreshApprovalsCount) onRefreshApprovalsCount();

      if (incList.length > 0 && !selectedIncident) {
        selectIncident(incList[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const selectIncident = async (inc: CoastalIncident) => {
    setSelectedIncident(inc);
    try {
      const detail = await api.getCoastalIncident(inc.id);
      setIncidentDetail(detail);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTriggerAssessment = async () => {
    if (!selectedIncident) return;
    setIsAssessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.assessCoastalIncident(selectedIncident.id, selectedModel);
      setSuccessMsg('AI incident assessment complete. Consequential actions registered in review queue.');
      await selectIncident(selectedIncident);
      const appList = await api.getPendingApprovals();
      setPendingApprovals(appList);
      if (onRefreshApprovalsCount) onRefreshApprovalsCount();
    } catch (err: any) {
      setErrorMsg(err.message || 'Assessment failed.');
    } finally {
      setIsAssessing(false);
    }
  };

  const handleReviewAction = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setErrorMsg(null);
    try {
      await api.reviewApproval(approvalId, decision, `Signed off by ${currentUser?.displayName} (${currentUser?.role})`);
      setSuccessMsg(`Action successfully ${decision.toUpperCase()}.`);
      loadData();
      if (selectedIncident) {
        selectIncident(selectedIncident);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Action review failed.');
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createCoastalIncident({
        title: newTitle,
        incidentType: newType,
        severity: newSeverity,
        locationName: newLocation,
        latitude: parseFloat(newLat),
        longitude: parseFloat(newLng),
        description: newDesc,
        sensorTelemetry: {
          water_temp_c: 12.4,
          wind_speed_kts: 18.5,
          wave_height_m: 2.1,
          tide_level: 'ebb',
        },
      });
      setShowNewModal(false);
      setSuccessMsg('Maritime incident report filed successfully.');
      await loadData();
      selectIncident(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to file incident report.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Domain Template Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-lg bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/20 font-semibold">
              Decoupled Domain Template
            </span>
            <span className="text-xs text-slate-500 font-mono">App ID: coastal-pulse-v1</span>
          </div>
          <h2 className="text-xl font-bold text-[#17243A] flex items-center gap-2.5">
            <Waves className="w-5 h-5 text-[#3978F6]" />
            Coastal Intelligence &amp; Maritime Command
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Real-time littoral hazard triage, oceanographic buoy telemetry correlation, and human-in-the-loop operational sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#3978F6] hover:bg-[#2A66E0] text-white transition-all shadow-[0_8px_20px_-6px_rgba(57,120,246,0.45)] cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Report Incident
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-white/85 hover:bg-white text-slate-600 hover:text-[#17243A] border border-slate-200 transition-colors cursor-pointer shadow-xs"
            title="Refresh maritime telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <div>{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Human Approval Queue Alert Box (When Pending Items Exist) */}
      {pendingApprovals.length > 0 && (
        <div className="p-5 nexus-glass-card border-amber-300/80 rounded-3xl space-y-3 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-amber-900 font-semibold text-xs">
              <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <span>
                Human Approval Gate: {pendingApprovals.length} Consequential Action(s) Awaiting Operator Sign-off
              </span>
            </div>
            <span className="text-[11px] text-amber-800 font-mono font-semibold bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 whitespace-nowrap">
              Authorization Gate: Operator / Admin
            </span>
          </div>

          <div className="divide-y divide-amber-200/70">
            {pendingApprovals.map((app) => (
              <div key={app.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-[#17243A] flex flex-wrap items-center gap-2">
                    <span className="text-amber-800">{app.action_type.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="text-[11px] font-mono text-[#3978F6]">[{app.location_name}]</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                    Incident Context: <span className="text-[#17243A] font-medium">{app.incident_title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOperatorOrAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReviewAction(app.id, 'approved')}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Authorize Dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewAction(app.id, 'rejected')}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      Sign-off requires Operator or Admin role
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Incident Feed & Assessment Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Col 1: Incident Feed (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#17243A] font-semibold">
            <span className="uppercase tracking-wider font-mono flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#3978F6]" />
              Maritime Incident Queue
            </span>
            <span className="text-[10px] font-mono text-[#3978F6] bg-[#EEF4FC] border border-[#3978F6]/20 px-2 py-0.5 rounded-md tabular-nums">
              {incidents.length} Active
            </span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {incidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <div
                  key={inc.id}
                  onClick={() => selectIncident(inc)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-[#3978F6] shadow-[0_8px_22px_-6px_rgba(57,120,246,0.22)] text-[#17243A]'
                      : 'bg-white/70 border-white/90 text-slate-600 hover:bg-white hover:border-[#3978F6]/30 hover:text-[#17243A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md border ${
                        inc.severity === 'critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : inc.severity === 'severe'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-[#EEF4FC] text-[#3978F6] border-[#3978F6]/25'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-[#17243A] line-clamp-1">{inc.title}</h4>
                  <div className="text-[11px] text-[#3978F6] mt-1 flex items-center gap-1.5 font-mono">
                    <Compass className="w-3 h-3 text-[#3978F6]" />
                    <span>{inc.location_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 2: Tactical Incident Detail & AI Assessment Pipeline (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedIncident && (
            <div className="nexus-glass-card rounded-3xl p-5 space-y-5">
              {/* Incident Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#EEF4FC] text-slate-700 border border-white uppercase font-semibold">
                      TYPE: {selectedIncident.incident_type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/20 uppercase font-semibold">
                      STATUS: {selectedIncident.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#17243A]">{selectedIncident.title}</h3>
                  <div className="text-xs text-slate-600 mt-1 font-mono flex items-center gap-2 tabular-nums">
                    <Navigation className="w-3.5 h-3.5 text-[#3978F6]" />
                    {selectedIncident.location_name} ({Number(selectedIncident.latitude ?? 0).toFixed(4)}°N, {Number(selectedIncident.longitude ?? 0).toFixed(4)}°W)
                  </div>
                </div>

                {/* AI Triage Trigger */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-[#3978F6] font-mono font-semibold focus:outline-none focus:border-[#3978F6]"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleTriggerAssessment}
                    disabled={isAssessing}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[#3978F6] hover:bg-[#2A66E0] disabled:opacity-40 text-white transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAssessing ? 'Triaging...' : 'Run AI Triage'}
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="text-xs text-[#17243A] leading-relaxed font-mono bg-[#EEF4FC]/75 p-4 rounded-2xl border border-white">
                {selectedIncident.description}
              </div>

              {/* Oceanographic Buoy Telemetry Feed */}
              {selectedIncident.sensor_telemetry && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5 font-semibold">
                    <Activity className="w-3 h-3 text-[#3978F6]" />
                    Littoral Sensor &amp; Buoy Telemetry Matrix
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-[#EEF4FC]/75 p-3 rounded-2xl border border-white flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200/70 text-[#3978F6]">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Water Temp</div>
                        <div className="font-mono font-bold text-[#17243A] tabular-nums">
                          {selectedIncident.sensor_telemetry.water_temp_c ?? 13.5}°C
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#EEF4FC]/75 p-3 rounded-2xl border border-white flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200/70 text-[#3978F6]">
                        <Wind className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Wind Velocity</div>
                        <div className="font-mono font-bold text-[#17243A] tabular-nums">
                          {selectedIncident.sensor_telemetry.wind_speed_kts ?? 15.0} kts
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#EEF4FC]/75 p-3 rounded-2xl border border-white flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200/70 text-[#3978F6]">
                        <Waves className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Swell Height</div>
                        <div className="font-mono font-bold text-[#17243A] tabular-nums">
                          {selectedIncident.sensor_telemetry.wave_height_m ?? 1.8} m
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#EEF4FC]/75 p-3 rounded-2xl border border-white flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200/70 text-[#3978F6]">
                        <Anchor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Tidal Phase</div>
                        <div className="font-mono font-bold text-[#17243A]">
                          {selectedIncident.sensor_telemetry.tide_level ?? 'Slack'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Threat Assessment History */}
              {incidentDetail?.assessments && incidentDetail.assessments.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-[#17243A]">
                    <span className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#3978F6]" />
                      AI Ecological Threat &amp; Mitigation Assessment
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                      Generated at {new Date(incidentDetail.assessments[0].generated_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="bg-white/85 p-4 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 font-medium">Calculated Threat Level:</span>
                        <span className="font-mono font-bold text-rose-700 uppercase tracking-wider">
                          {incidentDetail.assessments[0].threat_level}
                        </span>
                      </div>
                      <FidelityBadge
                        fidelity={incidentDetail.assessments[0].is_simulated ? 'simulated' : 'actual'}
                        isSimulated={incidentDetail.assessments[0].is_simulated}
                      />
                    </div>

                    <div className="font-mono text-[#17243A] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto pr-1 text-[11px]">
                      {incidentDetail.assessments[0].environmental_impact_summary}
                    </div>
                  </div>
                </div>
              )}

              {/* Incident Consequential Approvals Log */}
              {incidentDetail?.approvals && incidentDetail.approvals.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-[#17243A] flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#3978F6]" />
                    Consequential Response Action Sign-off Trail
                  </div>

                  <div className="space-y-2">
                    {incidentDetail.approvals.map((app: any) => (
                      <div
                        key={app.id}
                        className="bg-[#EEF4FC]/75 p-3 rounded-xl border border-white flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <span className="text-[#17243A] font-semibold">
                            {app.action_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            {app.review_notes || 'Pending evaluation sign-off'}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                            app.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : app.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Incident Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-[#17243A]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/92 backdrop-blur-2xl border border-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-[0_24px_60px_-12px_rgba(23,36,58,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
              <h3 className="text-sm font-bold text-[#17243A] flex items-center gap-2">
                <Waves className="w-4 h-4 text-[#3978F6]" />
                Report Marine Tactical Incident
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-500 hover:text-[#17243A] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                  Incident Headline
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Tanker Hull Breach in Shallow Channel"
                  className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                    Hazard Classification
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] focus:outline-none focus:border-[#3978F6] font-mono"
                  >
                    <option value="oil_spill">Oil / Hydrocarbon Plume</option>
                    <option value="storm_surge">Storm Surge &amp; King Tide</option>
                    <option value="vessel_grounding">Vessel Grounding / Distress</option>
                    <option value="algae_bloom">Harmful Algal Bloom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                    Severity Tier
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] focus:outline-none focus:border-[#3978F6] font-mono"
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                    Location Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] font-mono focus:outline-none focus:border-[#3978F6]"
                  />
                </div>
                <div>
                  <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                    Latitude (°N)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] font-mono focus:outline-none focus:border-[#3978F6]"
                  />
                </div>
                <div>
                  <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                    Longitude (°W)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] font-mono focus:outline-none focus:border-[#3978F6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#17243A] font-semibold mb-1.5 font-mono uppercase text-[11px]">
                  Field Sensor &amp; Observer Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detail visible slick dimensions, vessel trajectory, weather conditions..."
                  className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl p-2.5 text-[#17243A] font-mono focus:outline-none focus:border-[#3978F6]"
                />
              </div>

              <div className="pt-3 border-t border-slate-200/70 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs bg-white hover:bg-[#EEF4FC] text-slate-700 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3978F6] hover:bg-[#2A66E0] text-white shadow-xs cursor-pointer"
                >
                  File Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
