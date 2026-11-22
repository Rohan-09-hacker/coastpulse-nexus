export type MetricFidelity = 'actual' | 'estimated' | 'simulated' | 'unavailable';

export interface CompletionRequest {
  modelId: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  featureSource: 'workspace' | 'workflow' | 'evaluation' | 'coastal' | 'playground';
  userId?: string;
}

export interface CompletionResponse {
  text: string;
  providerId: string;
  modelId: string;
  latencyMs: number;
  promptTokens: number | null; // Nullable when not returned by provider
  completionTokens: number | null; // Nullable when not returned by provider
  totalTokens: number | null; // Nullable when not returned by provider
  estimatedCostUsd: number | null; // Nullable when not calculable
  metricFidelity: MetricFidelity;
  isSimulated: boolean;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface StreamChunk {
  deltaText: string;
  done: boolean;
  finalResponse?: CompletionResponse;
}

export interface IAIProviderAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly isDemo: boolean;

  initialize(): Promise<void>;
  checkHealth(): Promise<{ isHealthy: boolean; message: string; latencyMs?: number }>;
  listModels(): Promise<Array<{
    id: string;
    displayName: string;
    contextWindow: number;
    supportsStreaming: boolean;
    supportsVision: boolean;
    isSimulated: boolean;
  }>>;
  generateText(request: CompletionRequest): Promise<CompletionResponse>;
  generateStream(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<CompletionResponse>;
}
