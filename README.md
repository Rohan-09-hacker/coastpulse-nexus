# COASTPULSE CORE

> **Universal Model-Independent AI Application Platform**  
> *"One Engine. Unlimited AI Applications."*

COASTPULSE CORE is a full-stack AI orchestration, evaluation, and workflow automation platform built around an embedded zero-cost PostgreSQL database (**PGlite**), server-enforced authentication and RBAC, strict AI metric fidelity labeling, and human-in-the-loop approval checkpoints for consequential actions.

---

## Key Features

1. **Command Center**: Unified architectural overview, live provider health matrix, active workflow pipelines, execution telemetry, and blueprint registry snapshot.
2. **AI Workspace**: Multi-provider prompt studio supporting SSE token streaming, temperature/token controls, and empirical latency, token, and cost tracking.
3. **Model Control Center**: Live provider status inspection, server-managed credentials (`GEMINI_API_KEY`, optional BYOK `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), and model capability registry.
4. **NEXUS 2.2 Visual Workflow Engine**:
   - Interactive Light Glassmorphism DAG canvas with cycle prevention and JSON Schema validation.
   - Safe deterministic `IF-ELSE` branching (9 allowlisted comparison operators, compound `AND` / `OR` / `NOT` trees up to depth 5) without arbitrary code evaluation.
   - Multi-way `Switch / Case` routing with default branch fallback and inactive branch pruning.
   - Nested sub-pipelines (depth guard max 3, recursion cycle detection, child-to-parent approval propagation).
5. **Evaluation Lab**: Side-by-side multi-model prompt benchmarking, latency comparison, and quality evaluation.
6. **Telemetry & Cost Analytics**: Usage analytics partitioned by metric fidelity (`actual`, `estimated`, `simulated`, `unavailable`).
7. **API Playground**: SSRF-protected internal API explorer blocking loopback, private IP, and metadata probes.
8. **Universal Application Registry (NEXUS 3.0 Blueprints)**: Connects the workflow engine to six schema-validated industry blueprints:
   - **Maritime & Coastal** (`coastal-intelligence`)
   - **Education & EdTech** (`education-intelligence`)
   - **Healthcare & Clinical** (`healthcare-intelligence`)
   - **Finance & FinTech** (`finance-intelligence`)
   - **Cybersecurity & SecOps** (`security-intelligence`)
   - **Climate & Ecology** (`environmental-intelligence`)
9. **Coastal Intelligence (Reference Domain App)**: Littoral incident feed, oceanographic buoy telemetry, AI ecological threat triage, and operator sign-off queue.
10. **Platform Settings & Health**: Embedded PGlite diagnostics, 14-table schema manifest, and active session security overview.

---

## Simulated Data & Metric Fidelity Notice

- **Explicit Fidelity Partitioning**: All AI executions record an explicit `metricFidelity` classification (`actual`, `estimated`, `simulated`, or `unavailable`) along with an `isSimulated` flag. Token counts and costs are recorded as `null` when unavailable from an upstream API—never fabricated.
- **Simulated AI Outputs**:
  - The built-in `COASTPULSE Deterministic Simulator` (`demo-sim-coastal-v1` / `DemoAdapter`) generates deterministic synthetic outputs for offline testing and demos, clearly labeled `SIMULATED` in the UI and API responses.
  - Industry blueprint demo runs in **Application Registry** (`Run Blueprint Workflow (Demo)`) execute with synthetic sample payloads (`syntheticSampleInput`) and simulated model execution (`SIMULATED DEMO EXECUTION` / `SYNTHETIC DEMO DATA — External Integration Unavailable`) unless live external integrations are configured.
- **No Default Credentials**: No pre-seeded usernames or passwords ship with this repository. On a clean database, the **Initial Administrator Setup** flow creates the first `admin` account safely at runtime.

---

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, Lucide Icons (`src/`), styled with a Light Glassmorphism design language.
- **Backend**: Express.js (`server.ts`, `server/routes/`) serving both API routes (`/api/v1/*`, `/api/health`) and the Vite dev middleware or built `dist/` bundle on port `3000`.
- **Database**: In-process **PGlite** WASM PostgreSQL (`server/db/client.ts`) persisting to `.data/pglite` across 14 relational tables, protected by an exclusive OS PID-checked `DirectoryLock` (`server/db/lock.ts`).
- **Security**:
  - Password hashing via `bcryptjs` (12 salt rounds; minimum 8 characters).
  - Server-validated sessions stored as SHA-256 token digests in `user_sessions` (`coastpulse_session` HTTP-only cookie + `Authorization: Bearer` support).
  - 4-tier server-enforced RBAC (`admin`, `operator`, `analyst`, `viewer`).
  - Human-in-the-loop approval gates (`pending_approval` -> `POST /api/v1/workflows/runs/:id/approve`) restricted to `operator` and `admin` roles.
  - All external AI API keys stay strictly server-side.

---

## Prerequisites & Local Setup

### Prerequisites
- **Node.js** 20+ (tested on Node.js 22)
- **npm** (or bun)

### 1. Install Dependencies & Configure Environment
```bash
npm install
cp .env.example .env
```
Edit `.env` to add your optional server-side `GEMINI_API_KEY` (if omitted, the offline deterministic simulator `demo-sim-coastal-v1` and blueprint synthetic demos still operate normally).

### 2. Start the Development Server
```bash
npm run dev
```
The server starts on `http://localhost:3000`. Open it in your browser and complete the **Initial Administrator Setup** form to register your local `admin` account.

### 3. Type Check, Build & Verification Tests
Run type checking and the production build:
```bash
npm run lint
npm run build
```

With the server running on `http://localhost:3000`, run the automated verification suites:
```bash
npm test
npx tsx server/tests/blueprints-verification.test.ts
```

### 4. Run Production Bundle Locally
```bash
npm run build
NODE_ENV=production npm start
```

---

## Operational Notes

- **Single-Process Database Lock**: PGlite enforces single-process ownership on `.data/pglite`. Always run verification tests against the running HTTP server (`http://localhost:3000`) rather than spawning a second process targeting `.data/pglite`.
- **HTTPS in Production**: When `NODE_ENV=production`, session cookies are marked `Secure`, so production deployments should terminate TLS (HTTPS).
