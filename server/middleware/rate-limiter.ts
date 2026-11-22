import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests dispatched in a 60-second window. Please throttle execution.',
  },
});

export const aiExecutionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI Rate Limit Exceeded',
    message: 'AI generation concurrency limit reached. Please wait before triggering additional inferences.',
  },
});
