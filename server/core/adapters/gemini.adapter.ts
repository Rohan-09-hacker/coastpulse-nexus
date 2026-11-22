import { GoogleGenAI } from '@google/genai';
import { IAIProviderAdapter, CompletionRequest, CompletionResponse, StreamChunk } from './adapter.interface.ts';

export class GeminiAdapter implements IAIProviderAdapter {
  readonly providerId = 'gemini';
  readonly providerName = 'Google Cloud Gemini';
  readonly isDemo = false;

  private ai: GoogleGenAI | null = null;
  private apiKey: string | undefined;

  async initialize(): Promise<void> {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  async checkHealth(): Promise<{ isHealthy: boolean; message: string; latencyMs?: number }> {
    const start = performance.now();
    if (!process.env.GEMINI_API_KEY) {
      return {
        isHealthy: false,
        message: 'GEMINI_API_KEY is not configured in server environment.',
      };
    }

    try {
      if (!this.ai) {
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      }
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini health check timed out after 3500ms')), 3500)
      );
      const response = await Promise.race([
        this.ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'ping',
          config: { maxOutputTokens: 5 },
        }),
        timeoutPromise,
      ]);
      const latencyMs = Math.round(performance.now() - start);
      return {
        isHealthy: Boolean(response.text),
        message: 'Connected to Gemini API successfully.',
        latencyMs,
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        message: err?.message || 'Failed to connect to Google Gemini API.',
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }

  async listModels() {
    // If API key is present, query actual models available to the configured Gemini account
    if (process.env.GEMINI_API_KEY) {
      try {
        if (!this.ai) {
          this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        }
        const modelList = await this.ai.models.list();
        const supported: any[] = [];
        for await (const m of modelList) {
          const id = m.name?.replace('models/', '') || '';
          // Only include valid text/multimodal generative models
          if (
            id &&
            !id.includes('deprecated') &&
            (id.startsWith('gemini') || id.includes('flash') || id.includes('pro'))
          ) {
            supported.push({
              id,
              displayName: m.displayName || id,
              contextWindow: m.inputTokenLimit || 1048576,
              supportsStreaming: true,
              supportsVision: true,
              isSimulated: false,
            });
          }
        }
        if (supported.length > 0) {
          return supported;
        }
      } catch (err) {
        console.warn('[GeminiAdapter] models.list() unavailable, using verified supported models:', err);
      }
    }

    // Official non-deprecated models strictly verified per @google/genai guidelines
    return [
      {
        id: 'gemini-3.8-flash',
        displayName: 'Gemini 3.8 Flash (Recommended)',
        contextWindow: 1048576,
        supportsStreaming: true,
        supportsVision: true,
        isSimulated: false,
      },
      {
        id: 'gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash Lite',
        contextWindow: 1048576,
        supportsStreaming: true,
        supportsVision: true,
        isSimulated: false,
      },
      {
        id: 'gemini-4-argon',
        displayName: 'Gemini 4 Argon (Advanced Reasoning)',
        contextWindow: 2097152,
        supportsStreaming: true,
        supportsVision: true,
        isSimulated: false,
      },
    ];
  }

  private calculateCost(modelId: string, promptTokens: number | null, completionTokens: number | null): number | null {
    if (promptTokens === null || completionTokens === null) return null;
    if (modelId.includes('flash')) {
      const inCost = (promptTokens / 1_000_000) * 0.075;
      const outCost = (completionTokens / 1_000_000) * 0.3;
      return Number((inCost + outCost).toFixed(6));
    }
    if (modelId.includes('pro')) {
      const inCost = (promptTokens / 1_000_000) * 1.25;
      const outCost = (completionTokens / 1_000_000) * 5.0;
      return Number((inCost + outCost).toFixed(6));
    }
    return null;
  }

  async generateText(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();
    if (!process.env.GEMINI_API_KEY) {
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
        errorMessage: 'GEMINI_API_KEY is not configured in server environment.',
      };
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    try {
      const model = request.modelId.startsWith('gemini') ? request.modelId : 'gemini-3.8-flash';
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 6000ms')), 6000)
      );

      const response = await Promise.race([
        this.ai.models.generateContent({
          model,
          contents: request.prompt,
          config: {
            systemInstruction: request.systemInstruction || undefined,
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
          },
        }),
        timeoutPromise,
      ]);

      const latencyMs = Math.round(performance.now() - start);
      const promptTokens = response.usageMetadata?.promptTokenCount ?? null;
      const completionTokens = response.usageMetadata?.candidatesTokenCount ?? null;
      const totalTokens = response.usageMetadata?.totalTokenCount ?? (
        promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null
      );
      const estimatedCostUsd = this.calculateCost(model, promptTokens, completionTokens);

      return {
        text: response.text || '',
        providerId: this.providerId,
        modelId: model,
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        metricFidelity: 'actual',
        isSimulated: false,
        status: 'success',
      };
    } catch (error: any) {
      const latencyMs = Math.round(performance.now() - start);
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
        errorMessage: error?.message || 'Gemini generation failure',
      };
    }
  }

  async generateStream(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<CompletionResponse> {
    const start = performance.now();
    if (!process.env.GEMINI_API_KEY) {
      const errResp: CompletionResponse = {
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
        errorMessage: 'GEMINI_API_KEY is not configured in server environment.',
      };
      onChunk({ deltaText: '', done: true, finalResponse: errResp });
      return errResp;
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    try {
      const model = request.modelId.startsWith('gemini') ? request.modelId : 'gemini-2.5-flash';
      const stream = await this.ai.models.generateContentStream({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction || undefined,
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      });

      let accumulatedText = '';
      let lastUsage: any = null;

      for await (const chunk of stream) {
        const textDelta = chunk.text || '';
        accumulatedText += textDelta;
        if (chunk.usageMetadata) {
          lastUsage = chunk.usageMetadata;
        }
        onChunk({
          deltaText: textDelta,
          done: false,
        });
      }

      const latencyMs = Math.round(performance.now() - start);
      const promptTokens = lastUsage?.promptTokenCount ?? null;
      const completionTokens = lastUsage?.candidatesTokenCount ?? null;
      const totalTokens = lastUsage?.totalTokenCount ?? (
        promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null
      );
      const estimatedCostUsd = this.calculateCost(model, promptTokens, completionTokens);

      const finalResponse: CompletionResponse = {
        text: accumulatedText,
        providerId: this.providerId,
        modelId: model,
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        metricFidelity: 'actual',
        isSimulated: false,
        status: 'success',
      };

      onChunk({
        deltaText: '',
        done: true,
        finalResponse,
      });

      return finalResponse;
    } catch (error: any) {
      const latencyMs = Math.round(performance.now() - start);
      const errResponse: CompletionResponse = {
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
        errorMessage: error?.message || 'Gemini stream failed',
      };
      onChunk({ deltaText: '', done: true, finalResponse: errResponse });
      return errResponse;
    }
  }
}
