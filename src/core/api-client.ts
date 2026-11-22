import {
  User,
  AIProviderStatus,
  AIModel,
  ExecutionResponse,
  WorkflowItem,
  WorkflowRunResult,
  EvaluationItem,
  AnalyticsSummary,
  CoastalIncident,
  CoastalApprovalItem,
} from './types.ts';

class ApiClient {
  private authToken: string | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  getAuthToken() {
    return this.authToken;
  }

  /**
   * Centralized HTTP client that strictly validates Content-Type before parsing JSON.
   * If non-JSON or HTML is returned, provides a clear diagnostic including URL, status, and content preview.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    if (this.authToken) {
      headers.set('Authorization', `Bearer ${this.authToken}`);
    }

    let res: Response;
    try {
      res = await fetch(path, {
        credentials: 'include', // Includes secure HTTP-only cookies
        ...options,
        headers,
      });
    } catch (fetchErr: any) {
      throw new Error(`Network failure connecting to ${path}: ${fetchErr.message}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    if (!isJson) {
      const rawText = await res.text().catch(() => '');
      const preview = rawText.slice(0, 140).replace(/\s+/g, ' ');
      if (res.status === 403 && (preview.includes('403 Forbidden') || preview.includes('Forbidden'))) {
        throw new Error(
          `Request to ${path} was rejected by proxy [HTTP 403 Forbidden]. If the administrator account was already initialized, please sign in with your credentials.`
        );
      }
      throw new Error(
        `Unexpected non-JSON response from ${path} [HTTP ${res.status}]: Server returned Content-Type "${contentType || 'none'}" instead of JSON. Output preview: "${preview}"`
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch (jsonErr: any) {
      throw new Error(
        `Failed to parse JSON response from ${path} [HTTP ${res.status}]: ${jsonErr.message}`
      );
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || `API error [HTTP ${res.status}]`);
    }

    return data as T;
  }

  // Auth & Session
  async getAuthStatus(): Promise<{ setupRequired: boolean; isAuthenticated: boolean; user: User | null }> {
    return this.request('/api/v1/auth/status');
  }

  async setupAdmin(data: { email: string; password: string; displayName: string }): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/api/v1/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.authToken = res.token;
    }
    return res;
  }

  async login(data: { email: string; password: string }): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.authToken = res.token;
    }
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      this.authToken = null;
    }
  }

  async getMe(): Promise<{ user: User; availableUsers: User[] }> {
    return this.request('/api/v1/auth/me');
  }

  // Application Registry (Universal Modules)
  async getApplications(): Promise<import('./types.ts').AppModule[]> {
    return this.request('/api/v1/apps');
  }

  async getApplication(id: string): Promise<import('./types.ts').AppModule> {
    return this.request(`/api/v1/apps/${id}`);
  }

  async runBlueprintWorkflow(
    id: string,
    payload: { inputs?: Record<string, any>; useSyntheticDemo?: boolean } = {}
  ): Promise<WorkflowRunResult & {
    blueprintId: string;
    industry: string;
    workflowId: string;
    workflowName: string;
    usedSyntheticData: boolean;
    fidelity: {
      mode: string;
      label: string;
      externalIntegrationStatus: string;
      isSimulated: boolean;
    };
  }> {
    return this.request(`/api/v1/apps/${id}/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Providers & Models
  async getProviders(): Promise<AIProviderStatus[]> {
    return this.request('/api/v1/providers');
  }

  async testProvider(providerId: string): Promise<any> {
    return this.request(`/api/v1/providers/${providerId}/test`, { method: 'POST' });
  }

  async getModels(): Promise<AIModel[]> {
    return this.request('/api/v1/models');
  }

  // AI Workspace
  async generateCompletion(params: {
    modelId: string;
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ExecutionResponse> {
    return this.request('/api/v1/workspace/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async streamCompletion(
    params: {
      modelId: string;
      prompt: string;
      systemInstruction?: string;
      temperature?: number;
      maxTokens?: number;
    },
    onChunk: (text: string) => void,
    onComplete: (final: ExecutionResponse) => void,
    onError: (err: any) => void
  ) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const res = await fetch('/api/v1/workspace/stream', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(params),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const preview = text.slice(0, 140).replace(/\s+/g, ' ');
        throw new Error(`Stream request failed on /api/v1/workspace/stream [HTTP ${res.status}]: "${preview}"`);
      }

      if (!contentType.includes('text/event-stream')) {
        const text = await res.text().catch(() => '');
        const preview = text.slice(0, 140).replace(/\s+/g, ' ');
        throw new Error(
          `Expected text/event-stream from /api/v1/workspace/stream, but received "${contentType}": "${preview}"`
        );
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Response body stream not readable.');

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawJson = line.slice(6);
            try {
              const chunk = JSON.parse(rawJson);
              if (chunk.error) {
                onError(new Error(chunk.error));
                return;
              }
              if (chunk.deltaText) {
                onChunk(chunk.deltaText);
              }
              if (chunk.done && chunk.finalResponse) {
                onComplete(chunk.finalResponse);
              }
            } catch {
              // ignore partial json chunk
            }
          }
        }
      }
    } catch (err) {
      onError(err);
    }
  }

  // Workflows
  async getWorkflows(): Promise<WorkflowItem[]> {
    return this.request('/api/v1/workflows');
  }

  async getWorkflow(id: string): Promise<WorkflowItem> {
    return this.request(`/api/v1/workflows/${id}`);
  }

  async validateWorkflow(workflowDefinition: any): Promise<{ valid: boolean; errors: string[] }> {
    return this.request('/api/v1/workflows/validate', {
      method: 'POST',
      body: JSON.stringify({ workflowDefinition }),
    });
  }

  async createWorkflow(data: {
    name: string;
    description?: string;
    stepDefinitions: any;
    requiresApproval?: boolean;
  }): Promise<WorkflowItem> {
    return this.request('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(
    id: string,
    data: {
      name?: string;
      description?: string;
      stepDefinitions?: any;
      requiresApproval?: boolean;
    }
  ): Promise<WorkflowItem> {
    return this.request(`/api/v1/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async runWorkflow(id: string, inputs: Record<string, any>): Promise<WorkflowRunResult> {
    return this.request(`/api/v1/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    });
  }

  async approveWorkflowRun(runId: string): Promise<any> {
    return this.request(`/api/v1/workflows/runs/${runId}/approve`, {
      method: 'POST',
    });
  }

  // Evaluations
  async getEvaluations(): Promise<EvaluationItem[]> {
    return this.request('/api/v1/evaluations');
  }

  async runEvaluation(data: {
    name: string;
    prompt: string;
    systemInstruction?: string;
    modelIds: string[];
  }): Promise<any> {
    return this.request('/api/v1/evaluations/run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Analytics
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.request('/api/v1/analytics/summary');
  }

  async getExecutionHistory(limit = 30): Promise<any[]> {
    return this.request(`/api/v1/analytics/history?limit=${limit}`);
  }

  // API Playground
  async getPlaygroundEndpoints(): Promise<any[]> {
    return this.request('/api/v1/playground/endpoints');
  }

  async executePlayground(path: string, payload?: any): Promise<any> {
    return this.request('/api/v1/playground/execute', {
      method: 'POST',
      body: JSON.stringify({ path, payload }),
    });
  }

  // Coastal Intelligence Domain
  async getCoastalIncidents(): Promise<CoastalIncident[]> {
    return this.request('/api/v1/coastal/incidents');
  }

  async createCoastalIncident(data: any): Promise<CoastalIncident> {
    return this.request('/api/v1/coastal/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCoastalIncident(id: string): Promise<any> {
    return this.request(`/api/v1/coastal/incidents/${id}`);
  }

  async assessCoastalIncident(incidentId: string, modelId: string): Promise<any> {
    return this.request(`/api/v1/coastal/incidents/${incidentId}/assess`, {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    });
  }

  async getPendingApprovals(): Promise<CoastalApprovalItem[]> {
    return this.request('/api/v1/coastal/approvals/pending');
  }

  async reviewApproval(approvalId: string, decision: 'approved' | 'rejected', reviewNotes?: string): Promise<any> {
    return this.request(`/api/v1/coastal/approvals/${approvalId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewNotes }),
    });
  }
}

export const api = new ApiClient();
