import { IAIProviderAdapter, CompletionRequest, CompletionResponse, StreamChunk } from './adapter.interface.ts';
import { GeminiAdapter } from './gemini.adapter.ts';
import { DemoAdapter } from './demo.adapter.ts';
import { OpenAIAdapter } from './openai.adapter.ts';
import { AnthropicAdapter } from './anthropic.adapter.ts';
import { executionRepo } from '../../db/repositories/execution.repository.ts';

export class ProviderRegistry {
  private adapters: Map<string, IAIProviderAdapter> = new Map();
  private initialized = false;

  constructor() {
    this.registerAdapter(new GeminiAdapter());
    this.registerAdapter(new DemoAdapter());
    this.registerAdapter(new OpenAIAdapter());
    this.registerAdapter(new AnthropicAdapter());
  }

  registerAdapter(adapter: IAIProviderAdapter) {
    this.adapters.set(adapter.providerId, adapter);
  }

  async initialize() {
    if (this.initialized) return;
    for (const adapter of this.adapters.values()) {
      await adapter.initialize();
    }
    this.initialized = true;
  }

  getAdapter(providerId: string): IAIProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  getAdapterForModel(modelId: string): IAIProviderAdapter {
    if (modelId.startsWith('gemini')) {
      return this.adapters.get('gemini') || this.adapters.get('demo')!;
    }
    if (modelId.startsWith('demo') || modelId.includes('sim')) {
      return this.adapters.get('demo')!;
    }
    if (modelId.startsWith('gpt')) {
      return this.adapters.get('openai') || this.adapters.get('demo')!;
    }
    if (modelId.startsWith('claude')) {
      return this.adapters.get('anthropic') || this.adapters.get('demo')!;
    }
    // Default fallback to Gemini or Demo
    return this.adapters.get('gemini') || this.adapters.get('demo')!;
  }

  async getAllProvidersStatus() {
    const statuses = [];
    for (const [id, adapter] of this.adapters.entries()) {
      const health = await adapter.checkHealth();
      const models = await adapter.listModels();
      statuses.push({
        id,
        name: adapter.providerName,
        isDemo: adapter.isDemo,
        isHealthy: health.isHealthy,
        healthMessage: health.message,
        latencyMs: health.latencyMs,
        models,
      });
    }
    return statuses;
  }

  async getAllModels() {
    const all = [];
    for (const [providerId, adapter] of this.adapters.entries()) {
      const models = await adapter.listModels();
      for (const m of models) {
        all.push({
          ...m,
          providerId,
          providerName: adapter.providerName,
        });
      }
    }
    return all;
  }

  async executeAndRecord(request: CompletionRequest): Promise<CompletionResponse> {
    await this.initialize();
    const adapter = this.getAdapterForModel(request.modelId);
    const response = await adapter.generateText(request);

    // Save execution record with explicit metric fidelity & null safety
    await executionRepo.recordExecution({
      userId: request.userId || null,
      providerId: response.providerId,
      modelId: response.modelId,
      featureSource: request.featureSource,
      promptText: request.prompt,
      systemInstruction: request.systemInstruction || null,
      responseText: response.text,
      temperature: request.temperature ?? null,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      estimatedCostUsd: response.estimatedCostUsd,
      metricFidelity: response.metricFidelity,
      isSimulated: response.isSimulated,
      status: response.status,
      errorMessage: response.errorMessage || null,
    });

    return response;
  }

  async streamAndRecord(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<CompletionResponse> {
    await this.initialize();
    const adapter = this.getAdapterForModel(request.modelId);

    const response = await adapter.generateStream(request, onChunk);

    // Record the completed stream execution
    await executionRepo.recordExecution({
      userId: request.userId || null,
      providerId: response.providerId,
      modelId: response.modelId,
      featureSource: request.featureSource,
      promptText: request.prompt,
      systemInstruction: request.systemInstruction || null,
      responseText: response.text,
      temperature: request.temperature ?? null,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      estimatedCostUsd: response.estimatedCostUsd,
      metricFidelity: response.metricFidelity,
      isSimulated: response.isSimulated,
      status: response.status,
      errorMessage: response.errorMessage || null,
    });

    return response;
  }
}

export const providerRegistry = new ProviderRegistry();
