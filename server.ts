import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, checkDatabaseHealth } from './server/db/client.ts';
import { authMiddleware } from './server/middleware/auth.middleware.ts';
import { apiRateLimiter } from './server/middleware/rate-limiter.ts';
import { authRouter } from './server/routes/auth.router.ts';
import { providersRouter } from './server/routes/providers.router.ts';
import { modelsRouter } from './server/routes/models.router.ts';
import { workspaceRouter } from './server/routes/workspace.router.ts';
import { workflowsRouter } from './server/routes/workflows.router.ts';
import { evaluationsRouter } from './server/routes/evaluations.router.ts';
import { analyticsRouter } from './server/routes/analytics.router.ts';
import { playgroundRouter } from './server/routes/playground.router.ts';
import { coastalRouter } from './server/routes/coastal.router.ts';
import cookieParser from 'cookie-parser';
import { appsRouter } from './server/routes/apps.router.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createExpressApp() {
  const app = express();

  // Safe diagnostic request logging (passwords, tokens, and bodies are never logged)
  app.use((req, res, next) => {
    const start = performance.now();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const origin = req.headers.origin || 'none';
    const host = req.headers.host || 'unknown';

    res.on('finish', () => {
      const durationMs = Math.round(performance.now() - start);
      console.log(
        `[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms) | Host: ${host} | Origin: ${origin} | IP: ${clientIp}`
      );
    });
    next();
  });

  // Security & Body Parsers
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(apiRateLimiter);
  app.use(authMiddleware);

  // Health check endpoint with real database verification
  app.get('/api/health', async (req, res) => {
    const dbHealth = await checkDatabaseHealth();
    const isHealthy = dbHealth.isHealthy;
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      app: 'COASTPULSE CORE',
      timestamp: new Date().toISOString(),
      database: {
        engine: 'PGlite (Embedded PostgreSQL)',
        connected: dbHealth.isHealthy,
        tablesCount: dbHealth.tables,
        error: dbHealth.error || null,
      },
      zeroCost: true,
    });
  });

  // Mount Core Platform API Routes consistently under /api/v1/
  app.use('/api/v1/apps', appsRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/providers', providersRouter);
  app.use('/api/v1/models', modelsRouter);
  app.use('/api/v1/workspace', workspaceRouter);
  app.use('/api/v1/workflows', workflowsRouter);
  app.use('/api/v1/evaluations', evaluationsRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/playground', playgroundRouter);
  app.use('/api/v1/coastal', coastalRouter);

  // Strict 404 handler for ANY unmatched /api/* route: ALWAYS return JSON, NEVER HTML!
  app.all('/api/*', (req, res) => {
    res.status(404).setHeader('Content-Type', 'application/json').json({
      error: 'Not Found',
      message: `API route ${req.method} ${req.originalUrl} not found.`,
      status: 404,
    });
  });

  // Centralized Error Handler for API routes: ALWAYS return JSON, NEVER HTML!
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Error Handler]', err);
    res.status(err.status || 500).setHeader('Content-Type', 'application/json').json({
      error: err.name || 'Internal Server Error',
      message: err.message || 'An unexpected error occurred.',
      status: err.status || 500,
    });
  });

  return app;
}

async function startServer() {
  // CRITICAL: Dev server must run strictly on port 3000 per runtime environment constraints
  const PORT = 3000;

  // Initialize PGlite database and verify migrations
  console.log('[COASTPULSE CORE] Initializing embedded PostgreSQL (PGlite)...');
  try {
    await initializeDatabase();
    const health = await checkDatabaseHealth();
    if (!health.isHealthy) {
      console.error('[COASTPULSE CORE] Database verification failed:', health.error);
    } else {
      console.log(`[COASTPULSE CORE] Database verified healthy (${health.tables} tables ready).`);
    }
  } catch (err) {
    console.error('[COASTPULSE CORE] Fatal database initialization failure:', err);
  }

  const app = await createExpressApp();

  // Integrate Vite for frontend delivery AFTER all API routes
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Mount Vite middlewares only for non-API routes (SPA frontend)
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[COASTPULSE CORE] Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

// Start server only when executed directly as main script
const isMain = process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));
if (isMain) {
  startServer().catch((err) => {
    console.error('[COASTPULSE CORE] Fatal startup error:', err);
    process.exit(1);
  });
}
