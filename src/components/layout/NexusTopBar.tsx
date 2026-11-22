import React from 'react';
import { User } from '../../core/types.ts';
import { Menu, AlertTriangle } from 'lucide-react';

interface NexusTopBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User | null;
  pendingApprovalsCount: number;
  onOpenMobileSidebar: () => void;
}

export const NexusTopBar: React.FC<NexusTopBarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  pendingApprovalsCount,
  onOpenMobileSidebar,
}) => {
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'command-center':
        return 'Intelligence Command Center';
      case 'workspace':
        return 'AI Prompt & Inference Studio';
      case 'control-center':
        return 'Model Control Center';
      case 'workflows':
        return 'Multi-Step Workflow Engine';
      case 'evaluation':
        return 'Evaluation & Benchmarking Lab';
      case 'analytics':
        return 'Telemetry & Cost Analytics';
      case 'playground':
        return 'Internal API Playground';
      case 'apps':
        return 'Universal Application Registry';
      case 'coastal':
        return 'Coastal Marine Intelligence';
      case 'settings':
        return 'Platform Settings & Diagnostics';
      default:
        return 'Platform Overview';
    }
  };

  return (
    <div className="sticky top-0 z-30 px-4 md:px-6 lg:px-8 pt-3">
      <header className="h-14 px-4 md:px-5 flex items-center justify-between rounded-2xl bg-white/75 backdrop-blur-xl border border-white/95 shadow-[0_8px_28px_-8px_rgba(23,36,58,0.08)]">
        {/* Zone 1: Mobile Hamburger & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-[#17243A] hover:bg-[#EEF4FC] border border-slate-200/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
            title="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-mono text-[#3978F6] font-bold tracking-wider hidden sm:inline whitespace-nowrap">
              COASTPULSE CORE
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-[#17243A] font-semibold tracking-tight truncate">
              {getTabTitle(activeTab)}
            </span>
          </div>
        </div>

        {/* Zone 2: Engine Status & Consequential Gate */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* PGlite Engine Verification Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#EEF4FC]/90 border border-white text-[11px] text-slate-600 whitespace-nowrap shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Database:</span>
            <span className="font-mono text-emerald-700 font-semibold">PGlite (14 Tables)</span>
          </div>

          {/* Consequential Approvals Gate Button */}
          <button
            type="button"
            onClick={() => onTabChange('coastal')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40 ${
              pendingApprovalsCount > 0
                ? 'bg-amber-50/90 border-amber-200 text-amber-800 hover:bg-amber-100/80 shadow-xs'
                : 'bg-white/80 border-slate-200/80 text-slate-600 hover:text-[#17243A] hover:bg-[#EEF4FC]'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${pendingApprovalsCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}
            />
            <span className="hidden sm:inline">Action Approvals</span>
            <span
              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                pendingApprovalsCount > 0
                  ? 'bg-amber-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pendingApprovalsCount}
            </span>
          </button>

          {/* User Identity / Role Badge */}
          {currentUser && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/80 border border-slate-200/80 text-xs whitespace-nowrap shrink-0">
              <span className="text-[#17243A] font-medium hidden sm:inline">
                {currentUser.displayName}
              </span>
              <span
                className={`font-mono text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                  currentUser.role === 'admin'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : currentUser.role === 'operator'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-[#EEF4FC] text-[#3978F6] border-[#3978F6]/25'
                }`}
              >
                {currentUser.role}
              </span>
            </div>
          )}
        </div>
      </header>
    </div>
  );
};
