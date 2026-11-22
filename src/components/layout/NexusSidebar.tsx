import React from 'react';
import { User } from '../../core/types.ts';
import {
  LayoutDashboard,
  Terminal,
  Cpu,
  GitBranch,
  Scale,
  BarChart3,
  Code2,
  Boxes,
  Waves,
  Sliders,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Radio,
  Database,
} from 'lucide-react';

interface NexusSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  pendingApprovalsCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const NexusSidebar: React.FC<NexusSidebarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  pendingApprovalsCount,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'command-center',
      label: 'Command Center',
      sublabel: 'Overview & Telemetry',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'workspace',
      label: 'AI Workspace',
      sublabel: 'Prompt & Inference Studio',
      icon: Terminal,
      badge: null,
    },
    {
      id: 'control-center',
      label: 'Model Control',
      sublabel: 'Provider & Model Matrix',
      icon: Cpu,
      badge: null,
    },
    {
      id: 'workflows',
      label: 'Workflow Engine',
      sublabel: 'Multi-Step Orchestrator',
      icon: GitBranch,
      badge: null,
    },
    {
      id: 'evaluation',
      label: 'Evaluation Lab',
      sublabel: 'Model Benchmark & Diff',
      icon: Scale,
      badge: null,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      sublabel: 'Token & Latency Metrics',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'playground',
      label: 'API Playground',
      sublabel: 'Internal API Console',
      icon: Code2,
      badge: null,
    },
    {
      id: 'apps',
      label: 'App Registry',
      sublabel: 'Universal Industry Blueprints',
      icon: Boxes,
      badge: '6 Blueprints',
    },
    {
      id: 'coastal',
      label: 'Coastal Intelligence',
      sublabel: 'Marine Triage Template',
      icon: Waves,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Alert` : null,
      badgeVariant: 'amber',
    },
    {
      id: 'settings',
      label: 'Settings & Health',
      sublabel: 'Platform Diagnostics',
      icon: Sliders,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[#17243A]/25 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Floating Translucent Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 lg:top-3 lg:bottom-3 lg:left-3 z-50 flex flex-col bg-white/78 backdrop-blur-2xl border-r lg:border border-white/95 lg:rounded-2xl shadow-[0_16px_44px_-12px_rgba(23,36,58,0.12)] transition-all duration-300 ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[5.25rem]' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/70">
          <button
            type="button"
            onClick={() => onTabChange('command-center')}
            className="flex items-center gap-3 cursor-pointer group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40 rounded-lg"
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#3978F6] to-[#9275E8] text-white shadow-[0_6px_16px_-4px_rgba(57,120,246,0.45)] group-hover:scale-105 transition-transform shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-sm text-[#17243A]">
                    NEXUS
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/20">
                    CORE
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">Universal AI Platform</p>
              </div>
            )}
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-[#17243A] hover:bg-[#EEF4FC] border border-transparent hover:border-slate-200/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Database & Zero-Cost Status Pill (When Expanded) */}
        {!isCollapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-[#EEF4FC]/80 border border-white/90 flex items-center justify-between text-[11px] text-slate-600 shadow-xs">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono font-medium text-[#17243A]">PGlite Engine</span>
            </div>
            <span className="font-mono text-[10px] font-semibold text-emerald-700 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
              $0 Local DB
            </span>
          </div>
        )}

        {/* Navigation Items List */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#3978F6]/12 via-[#EEF4FC] to-[#9275E8]/10 text-[#17243A] font-semibold border border-[#3978F6]/25 shadow-[0_4px_14px_-4px_rgba(57,120,246,0.2)]'
                    : 'text-slate-600 hover:text-[#17243A] hover:bg-white/75 border border-transparent hover:border-slate-200/70'
                }`}
              >
                {/* Active Indicator Accent */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#3978F6]" />
                )}

                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#3978F6]' : 'text-slate-500 group-hover:text-[#3978F6]'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 text-left flex items-center justify-between overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ml-2 whitespace-nowrap shrink-0 ${
                          item.badgeVariant === 'amber'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 font-bold'
                            : 'bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/20 font-semibold'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Session Footer */}
        <div className="p-3 border-t border-slate-200/70 bg-[#EEF4FC]/50 lg:rounded-b-2xl">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3978F6]/15 to-[#9275E8]/20 border border-[#3978F6]/30 text-[#3978F6] flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-[#17243A] truncate">
                      {currentUser?.displayName || 'Unauthenticated'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {currentUser?.email || 'Guest Mode'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                  title="Sign out of current server session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {currentUser && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[10px]">
                  <span className="text-slate-500 font-medium">RBAC Role:</span>
                  <span
                    className={`font-mono uppercase font-bold px-2 py-0.5 rounded-md text-[9px] border ${
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
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-[#EEF4FC] border border-[#3978F6]/30 text-[#3978F6] flex items-center justify-center font-bold text-xs"
                title={`${currentUser?.displayName || 'User'} (${currentUser?.role || 'Guest'})`}
              >
                {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
