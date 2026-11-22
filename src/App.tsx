import React, { useState, useEffect } from 'react';
import { api } from './core/api-client.ts';
import { User, AIProviderStatus, AIModel } from './core/types.ts';
import { NexusSidebar } from './components/layout/NexusSidebar.tsx';
import { NexusTopBar } from './components/layout/NexusTopBar.tsx';
import { CommandCenterView } from './modules/command-center/CommandCenterView.tsx';
import { WorkspaceView } from './modules/workspace/WorkspaceView.tsx';
import { ControlCenterView } from './modules/control-center/ControlCenterView.tsx';
import { WorkflowEngineView } from './modules/workflows/WorkflowEngineView.tsx';
import { EvaluationLabView } from './modules/evaluation/EvaluationLabView.tsx';
import { AnalyticsDashboardView } from './modules/analytics/AnalyticsDashboardView.tsx';
import { PlaygroundView } from './modules/playground/PlaygroundView.tsx';
import { ApplicationRegistryView } from './modules/apps/ApplicationRegistryView.tsx';
import { CoastalAppView } from './templates/coastal/CoastalAppView.tsx';
import { SettingsView } from './modules/settings/SettingsView.tsx';
import { AuthModal } from './components/shared/AuthModal.tsx';
import { Activity, ShieldCheck, Database } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<string>('command-center');
  const [providers, setProviders] = useState<AIProviderStatus[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(1);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  // Responsive sidebar collapse states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const refreshAllData = async () => {
    try {
      const authStatus = await api.getAuthStatus();
      setSetupRequired(authStatus.setupRequired);

      if (authStatus.setupRequired || !authStatus.isAuthenticated) {
        setShowAuthModal(true);
        setCurrentUser(null);
      } else {
        setShowAuthModal(false);
        const meRes = await api.getMe();
        setCurrentUser(meRes.user);
        setAvailableUsers(meRes.availableUsers);
      }

      const [provRes, modelsRes, appsRes] = await Promise.all([
        api.getProviders(),
        api.getModels(),
        api.getPendingApprovals(),
      ]);

      setProviders(provRes);
      setModels(modelsRes);
      setPendingApprovalsCount(appsRes.length);
    } catch (err: any) {
      setInitError(err.message || 'Error connecting to COASTPULSE CORE backend.');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleAuthAction = async (action: string) => {
    if (action === 'logout') {
      await api.logout();
      setCurrentUser(null);
      setShowAuthModal(true);
    }
  };

  const handleRefreshApprovalsCount = async () => {
    try {
      const apps = await api.getPendingApprovals();
      setPendingApprovalsCount(apps.length);
    } catch {
      // ignore
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#17243A] flex items-center justify-center font-mono text-xs relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute -top-24 left-1/4 w-[480px] h-[480px] bg-[#3978F6]/12 rounded-full blur-[120px]" />
          <div className="absolute -bottom-24 right-1/4 w-[480px] h-[480px] bg-[#9275E8]/12 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 text-center space-y-4 nexus-glass-card px-8 py-7 rounded-2xl">
          <div className="relative w-11 h-11 mx-auto">
            <div className="w-11 h-11 rounded-full border-2 border-[#3978F6]/20" />
            <div className="absolute inset-0 w-11 h-11 rounded-full border-2 border-[#3978F6] border-t-transparent animate-spin" />
          </div>
          <div>
            <div className="text-[#17243A] font-bold tracking-widest text-sm uppercase">
              COASTPULSE CORE <span className="text-[#3978F6]">// NEXUS</span>
            </div>
            <div className="text-slate-600 text-xs mt-1">
              Initializing in-process PGlite PostgreSQL &amp; Provider Matrix...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#17243A] flex font-sans selection:bg-[#3978F6] selection:text-white relative overflow-x-hidden">
      {/* Subtle Blue & Lavender Ambient Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 left-1/5 w-[680px] h-[680px] bg-[#3978F6]/[0.08] rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-[-6%] w-[560px] h-[560px] bg-[#9275E8]/[0.09] rounded-full blur-[130px]" />
        <div className="absolute -bottom-32 left-1/3 w-[520px] h-[520px] bg-[#EEF4FC] rounded-full blur-[110px]" />
      </div>

      {/* NEXUS Floating Translucent Sidebar Navigation */}
      <NexusSidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }}
        currentUser={currentUser}
        onLogout={() => handleAuthAction('logout')}
        pendingApprovalsCount={pendingApprovalsCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area (offset by floating sidebar width on desktop) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 relative z-10 ${
          isSidebarCollapsed ? 'lg:pl-[6.25rem]' : 'lg:pl-[17.25rem]'
        }`}
      >
        {/* NEXUS Clean Translucent Top Bar */}
        <NexusTopBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          pendingApprovalsCount={pendingApprovalsCount}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        {/* Dynamic Main Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
          {initError && (
            <div className="p-4 bg-rose-50/90 backdrop-blur-md border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-3 shadow-sm">
              <span className="font-bold">Platform Diagnostic Alert:</span> {initError}
            </div>
          )}

          {/* Module Views */}
          {activeTab === 'command-center' && (
            <CommandCenterView
              providers={providers}
              models={models}
              onNavigate={setActiveTab}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'workspace' && <WorkspaceView models={models} />}

          {activeTab === 'control-center' && (
            <ControlCenterView
              providers={providers}
              onRefreshProviders={async () => {
                const [p, m] = await Promise.all([api.getProviders(), api.getModels()]);
                setProviders(p);
                setModels(m);
              }}
            />
          )}

          {activeTab === 'workflows' && (
            <WorkflowEngineView currentUser={currentUser} initialWorkflowId={selectedWorkflowId} />
          )}

          {activeTab === 'evaluation' && <EvaluationLabView models={models} />}

          {activeTab === 'analytics' && <AnalyticsDashboardView />}

          {activeTab === 'playground' && <PlaygroundView />}

          {activeTab === 'apps' && (
            <ApplicationRegistryView
              onNavigate={setActiveTab}
              currentUser={currentUser}
              onOpenWorkflow={(wfId) => {
                setSelectedWorkflowId(wfId);
                setActiveTab('workflows');
              }}
            />
          )}

          {activeTab === 'coastal' && (
            <CoastalAppView
              currentUser={currentUser}
              models={models}
              onRefreshApprovalsCount={handleRefreshApprovalsCount}
            />
          )}

          {activeTab === 'settings' && <SettingsView currentUser={currentUser} />}
        </main>

        {/* Minimalist Translucent Footer */}
        <footer className="border-t border-slate-200/70 bg-white/60 backdrop-blur-md py-3.5 px-4 md:px-8 text-xs text-slate-600 font-mono flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[#17243A] font-semibold">COASTPULSE CORE // NEXUS</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">Universal AI Application Platform</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Embedded PGlite ($0)</span>
            <span aria-hidden="true">•</span>
            <span>Bcrypt Sessions</span>
            <span aria-hidden="true">•</span>
            <span>Strict SSRF Filter</span>
          </div>
        </footer>
      </div>

      {/* Auth Modal for First Admin Setup or Sign-in */}
      {showAuthModal && (
        <AuthModal
          setupRequired={setupRequired}
          onSuccess={() => {
            setShowAuthModal(false);
            refreshAllData();
          }}
        />
      )}
    </div>
  );
}
