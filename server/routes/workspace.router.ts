import { Router, Response } from 'express';
import { providerRegistry } from '../core/adapters/registry.ts';
import { AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { aiExecutionRateLimiter } from '../middleware/rate-limiter.ts';

export const workspaceRouter = Router();

workspaceRouter.post('/generate', aiExecutionRateLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { modelId, prompt, systemInstruction, temperature, maxTokens } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt text is required.' });
    }

    const response = await providerRegistry.executeAndRecord({
      modelId: modelId || 'gemini-2.5-flash',
      prompt,
      systemInstruction,
      temperature: typeof temperature === 'number' ? temperature : undefined,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
      featureSource: 'workspace',
      userId: req.user?.id,
    });

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Workspace generation failed.' });
  }
});

workspaceRouter.post('/stream', aiExecutionRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelId, prompt, systemInstruction, temperature, maxTokens } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt text is required.' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    await providerRegistry.streamAndRecord(
      {
        modelId: modelId || 'gemini-2.5-flash',
        prompt,
        systemInstruction,
        temperature: typeof temperature === 'number' ? temperature : undefined,
        maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
        featureSource: 'workspace',
        userId: req.user?.id,
      },
      (chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    );

    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});
