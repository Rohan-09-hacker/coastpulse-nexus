export interface ApprovedEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  samplePayload?: Record<string, any>;
  requiredRole?: string;
}

export const APPROVED_ENDPOINTS: ApprovedEndpoint[] = [
  {
    id: 'get-providers',
    method: 'GET',
    path: '/api/v1/providers',
    description: 'Fetch all connected AI providers and live health telemetry',
  },
  {
    id: 'get-models',
    method: 'GET',
    path: '/api/v1/models',
    description: 'Query all available models across cloud and demo adapters',
  },
  {
    id: 'generate-completion',
    method: 'POST',
    path: '/api/v1/workspace/generate',
    description: 'Execute a single AI prompt with latency & token metrics',
    samplePayload: {
      modelId: 'gemini-2.5-flash',
      prompt: 'Summarize the role of coastal barrier islands in mitigating hurricane storm surges.',
      temperature: 0.7,
      maxTokens: 500,
    },
  },
  {
    id: 'get-analytics-summary',
    method: 'GET',
    path: '/api/v1/analytics/summary',
    description: 'Retrieve real execution telemetry partitioned by metric fidelity',
  },
  {
    id: 'get-coastal-incidents',
    method: 'GET',
    path: '/api/v1/coastal/incidents',
    description: 'Query coastal incident reports and oceanographic sensor telemetry',
  },
  {
    id: 'get-pending-approvals',
    method: 'GET',
    path: '/api/v1/coastal/approvals/pending',
    description: 'View active consequential incident mitigation actions requiring operator sign-off',
    requiredRole: 'operator',
  },
  {
    id: 'get-apps',
    method: 'GET',
    path: '/api/v1/apps',
    description: 'Query the Universal Application Registry for registered industry AI modules and schemas',
  },
  {
    id: 'get-workflows',
    method: 'GET',
    path: '/api/v1/workflows',
    description: 'List multi-step AI workflow orchestration templates',
  },
];

export class PlaygroundDispatcher {
  /**
   * Validates target path against SSRF attacks and enforce strict allowlist.
   */
  validatePath(targetPath: string): { allowed: boolean; reason?: string; endpoint?: ApprovedEndpoint } {
    if (!targetPath || typeof targetPath !== 'string') {
      return { allowed: false, reason: 'Invalid or missing target path.' };
    }

    const trimmed = targetPath.trim();

    // 1. Block any URL protocols (http://, https://, gopher://, file://)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
      return {
        allowed: false,
        reason: 'SSRF Violation: External URL protocols and hostnames are strictly forbidden. Only internal endpoints permitted.',
      };
    }

    // 2. Block loopback, metadata addresses, and IP notations
    if (
      trimmed.includes('localhost') ||
      trimmed.includes('127.0.0.1') ||
      trimmed.includes('::1') ||
      trimmed.includes('169.254') ||
      /10\.\d+\.\d+\.\d+/.test(trimmed) ||
      /192\.168\.\d+\.\d+/.test(trimmed) ||
      /172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/.test(trimmed)
    ) {
      return {
        allowed: false,
        reason: 'SSRF Violation: Loopback addresses, private IP ranges, and cloud metadata probes are strictly forbidden.',
      };
    }

    // 3. Must start with /api/v1/
    if (!trimmed.startsWith('/api/v1/')) {
      return {
        allowed: false,
        reason: 'Access Denied: Target path must begin with /api/v1/.',
      };
    }

    // 4. Strict allowlist match
    const cleanPath = trimmed.split('?')[0];
    const match = APPROVED_ENDPOINTS.find((ep) => ep.path === cleanPath);
    if (!match) {
      return {
        allowed: false,
        reason: `Endpoint "${cleanPath}" is not on the approved API Playground allowlist.`,
      };
    }

    return { allowed: true, endpoint: match };
  }
}

export const playgroundDispatcher = new PlaygroundDispatcher();
