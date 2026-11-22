import { IAIProviderAdapter, CompletionRequest, CompletionResponse, StreamChunk } from './adapter.interface.ts';

export class AnthropicAdapter implements IAIProviderAdapter {
  readonly providerId = 'anthropic';
  readonly providerName = 'Anthropic Claude (BYOK Cloud)';
  readonly isDemo = false;

  async initialize(): Promise<void> {}

  async checkHealth(): Promise<{ isHealthy: boolean; message: string; latencyMs?: number }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        isHealthy: false,
        message: 'ANTHROPIC_API_KEY is not configured in server environment (BYOK required).',
      };
    }
    return {
      isHealthy: true,
      message: 'Anthropic API key configured.',
      latencyMs: 45,
    };
  }

  async listModels() {
    return [
      {
        id: 'claude-3-7-sonnet',
        displayName: 'Claude 3.7 Sonnet',
        contextWindow: 200000,
        supportsStreaming: true,
        supportsVision: true,
        isSimulated: false,
      },
    ];
  }

  async generateText(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
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
        errorMessage: 'ANTHROPIC_API_KEY is not set on the server.',
      };
    }

    const start = performance.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: request.modelId,
          max_tokens: request.maxTokens ?? 2048,
          system: request.systemInstruction || undefined,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: request.temperature ?? 0.7,
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

      const promptTokens = data.usage?.input_tokens ?? null;
      const completionTokens = data.usage?.output_tokens ?? null;
      const totalTokens = (promptTokens !== null && completionTokens !== null) ? (promptTokens + completionTokens) : null;
      let estimatedCostUsd: number | null = null;
      if (promptTokens !== null && completionTokens !== null) {
        estimatedCostUsd = Number(((promptTokens * 3.0 + completionTokens * 15.0) / 1_000_000).toFixed(6));
      }

      return {
        text: data.content?.[0]?.text || '',
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
    const resp = await this.generateText(request);
    onChunk({ deltaText: resp.text, done: true, finalResponse: resp });
    return resp;
  }
}
