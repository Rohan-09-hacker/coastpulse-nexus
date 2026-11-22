import { IAIProviderAdapter, CompletionRequest, CompletionResponse, StreamChunk } from './adapter.interface.ts';

export class OpenAIAdapter implements IAIProviderAdapter {
  readonly providerId = 'openai';
  readonly providerName = 'OpenAI (BYOK Cloud)';
  readonly isDemo = false;

  async initialize(): Promise<void> {}

  async checkHealth(): Promise<{ isHealthy: boolean; message: string; latencyMs?: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        isHealthy: false,
        message: 'OPENAI_API_KEY is not configured in server environment (BYOK required).',
      };
    }
    const start = performance.now();
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const latencyMs = Math.round(performance.now() - start);
      return {
        isHealthy: res.ok,
        message: res.ok ? 'Connected to OpenAI API.' : `OpenAI responded with HTTP ${res.status}`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        message: err.message || 'Failed to reach OpenAI API.',
      };
    }
  }

  async listModels() {
    return [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsVision: true,
        isSimulated: false,
      },
      {
        id: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128000,
        supportsStreaming: true,
        supportsVision: true,
        isSimulated: false,
      },
    ];
  }

  async generateText(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        text: '',
        providerId: this.providerId,
        modelId: request.modelId,
        latencyMs: 0,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        metricFidelity: 'unavailable',
        isSimulated: false,
        status: 'error',
        errorMessage: 'OPENAI_API_KEY is not set on the server.',
      };
    }

    const start = performance.now();
    try {
      const messages: any[] = [];
      if (request.systemInstruction) {
        messages.push({ role: 'system', content: request.systemInstruction });
      }
      messages.push({ role: 'user', content: request.prompt });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: request.modelId,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        }),
      });

      const data = await res.json();
      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        return {
          text: '',
          providerId: this.providerId,
          modelId: request.modelId,
          latencyMs,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          metricFidelity: 'unavailable',
          isSimulated: false,
          status: 'error',
          errorMessage: data.error?.message || `HTTP ${res.status}`,
        };
      }

      const promptTokens = data.usage?.prompt_tokens ?? null;
      const completionTokens = data.usage?.completion_tokens ?? null;
      const totalTokens = data.usage?.total_tokens ?? null;
      let estimatedCostUsd: number | null = null;
      if (promptTokens !== null && completionTokens !== null) {
        estimatedCostUsd = Number(((promptTokens * 2.5 + completionTokens * 10) / 1_000_000).toFixed(6));
      }

      return {
        text: data.choices?.[0]?.message?.content || '',
        providerId: this.providerId,
        modelId: request.modelId,
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        metricFidelity: 'actual',
        isSimulated: false,
        status: 'success',
      };
    } catch (err: any) {
      return {
        text: '',
        providerId: this.providerId,
        modelId: request.modelId,
        latencyMs: Math.round(performance.now() - start),
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        metricFidelity: 'unavailable',
        isSimulated: false,
        status: 'error',
        errorMessage: err.message,
      };
    }
  }

  async generateStream(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<CompletionResponse> {
    // Falls back to generateText with synthetic streaming chunk
    const resp = await this.generateText(request);
    onChunk({ deltaText: resp.text, done: true, finalResponse: resp });
    return resp;
  }
}
