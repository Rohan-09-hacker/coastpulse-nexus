import React from 'react';
import { User } from '../../core/types.ts';
import { Radio, Database, AlertTriangle, Users } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  availableUsers: User[];
  onSwitchUser: (userId: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingApprovalsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchUser,
  activeTab,
  onTabChange,
  pendingApprovalsCount,
}) => {
  const tabs = [
    { id: 'workspace', label: '1. AI Workspace' },
    { id: 'control-center', label: '2. Model Control Center' },
    { id: 'workflows', label: '3. Workflow Engine' },
    { id: 'evaluation', label: '4. Evaluation Lab' },
    { id: 'analytics', label: '5. Analytics Dashboard' },
    { id: 'playground', label: '6. API Playground' },
    { id: 'coastal', label: '7. Coastal Intelligence (Demo Template)' },
  ];

  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl text-[#17243A] sticky top-0 z-40">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#3978F6] to-[#9275E8] text-white shadow-sm">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sm text-[#17243A]">COASTPULSE CORE</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/20 font-semibold">
                UNIVERSAL
              </span>
            </div>
            <div className="text-[11px] text-slate-500">One Engine. Unlimited AI Applications.</div>
          </div>
        </div>

        {/* Global Telemetry & Status Badges */}
        <div className="flex items-center gap-3">
          {/* Zero-Cost PostgreSQL Status */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-700 bg-[#EEF4FC] border border-white px-2.5 py-1 rounded-xl">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium">PGlite PostgreSQL ($0 Local DB)</span>
          </div>

          {/* Consequential Approvals Bell */}
          <button
            type="button"
            onClick={() => onTabChange('coastal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
              pendingApprovalsCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                : 'bg-white border-slate-200 text-slate-600 hover:text-[#17243A]'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${pendingApprovalsCount > 0 ? 'text-amber-600' : ''}`} />
            <span>Human Approvals</span>
            <span
              className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold tabular-nums ${
                pendingApprovalsCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pendingApprovalsCount}
            </span>
          </button>

          {/* User Session & Role Indicator */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded-xl">
            <Users className="w-3.5 h-3.5 text-[#3978F6]" />
            <span className="text-xs text-[#17243A] font-medium">
              {currentUser?.displayName || 'Unauthenticated'}
            </span>
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                currentUser?.role === 'admin'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : currentUser?.role === 'operator'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : currentUser?.role === 'analyst'
                  ? 'bg-[#EEF4FC] text-[#3978F6] border-[#3978F6]/25'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {currentUser?.role || 'None'}
            </span>
            <button
              type="button"
              onClick={() => onSwitchUser('logout')}
              className="text-[10px] text-slate-500 hover:text-rose-600 ml-1 border-l border-slate-200 pl-2 cursor-pointer font-mono"
              title="Sign out of current server session"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-slate-200/70">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                isActive
                  ? 'border-[#3978F6] text-[#3978F6] bg-[#EEF4FC]/60'
                  : 'border-transparent text-slate-600 hover:text-[#17243A] hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.id === 'coastal' && pendingApprovalsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
