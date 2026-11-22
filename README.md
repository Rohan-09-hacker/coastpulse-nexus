<div align="center">COASTPULSE CORE
One Engine. Unlimited AI Applications.
A modular, model-independent AI orchestration platform for building, executing, and evaluating intelligent workflows.


Launch COASTPULSE CORE →
</div>What is COASTPULSE CORE?
COASTPULSE CORE is a full-stack AI platform designed to bring multiple AI capabilities into one unified environment. It combines a visual workflow engine, multi-provider AI workspace, model evaluation tools, telemetry, and industry-oriented application blueprints.

At its core is NEXUS, the workflow orchestration layer that connects application logic into structured, schema-validated workflows. The platform is designed to make AI workflows easier to build, inspect, execute, and improve.
The vision: Move beyond isolated AI tools and give developers one extensible engine for creating purpose-built AI applications.

Explore the platform
Workspace	What it does
Command Center	Overview of platform health, workflows, provider status, and activity
AI Workspace	Experiment with supported AI providers through a prompt interface
Model Control Center	Inspect provider availability and manage server-side model configuration
NEXUS Workflow Engine	Design and run structured workflows using a visual DAG canvas
Evaluation Lab	Compare model responses and evaluate execution characteristics
Telemetry & Analytics	Inspect usage metrics with explicit metric-fidelity labels
API Playground	Explore internal APIs with server-side request protections
Application Registry	Explore industry-focused workflow blueprints
Coastal Intelligence	Reference application for coastal and maritime intelligence scenarios


NEXUS Workflow Engine
NEXUS is the orchestration layer behind COASTPULSE CORE.

Key capabilities include:
- Visual DAG workflows — represent workflow steps and their dependencies.
- Schema validation — validate workflow structures and inputs.
- Deterministic branching — route execution through conditional IF / ELSE logic.
- Switch / Case routing — support multi-way branch selection.
- Nested workflows — compose smaller workflows into larger pipelines.
- Cycle and depth guards — help prevent invalid or runaway nested execution.
- Human approval checkpoints — pause consequential workflow actions for operator approval.
Workflow execution philosophy
COASTPULSE distinguishes between real, estimated, simulated, and unavailable measurements. This matters because a demo result should never be mistaken for a live external integration or a measured production outcome.
Industry application blueprints
The Application Registry connects the workflow engine to six industry-oriented blueprint areas:
Blueprint	Example domain
Maritime & Coastal	Coastal incidents and environmental monitoring
Education & EdTech	Student and learning intelligence
Healthcare & Clinical	Clinical workflow concepts
Finance & FinTech	Financial workflow concepts
Cybersecurity & SecOps	Security operations concepts
Climate & Ecology	Environmental and climate intelligence


These blueprints provide structured starting points. Demo executions may use synthetic inputs and simulated model outputs unless the required live integrations are configured.
Architecture & technology
Layer	Technologies
Frontend	React 19, TypeScript, Vite
Styling	Tailwind CSS v4
Backend	Node.js, Express.js
Database	PGlite (embedded WASM PostgreSQL)
Data access	Drizzle ORM
Validation	Zod
AI integration	Google GenAI SDK, with optional provider configuration
UI icons	Lucide


High-level architecture
┌──────────────────────────────────────────────┐
│               COASTPULSE CORE                │
│                                              │
│  Command Center · AI Workspace · Evaluation │
│  Registry · Analytics · API Playground      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                 NEXUS ENGINE                 │
│                                              │
│  Workflow Graph · Validation · Branching     │
│  Nested Pipelines · Approval Checkpoints     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              EXPRESS API LAYER               │
│                                              │
│  Authentication · RBAC · API Routes          │
│  Provider Adapters · Execution Services      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             PGLITE / DATA LAYER              │
│                                              │
│  Users · Sessions · Workflows · Run Records  │
└──────────────────────────────────────────────┘
Security-minded design
The platform includes several server-side security controls:
- Password hashing using bcryptjs.
- Server-validated sessions, with session token digests stored in the database.
- HTTP-only session cookies and Bearer-token support.
- Role-based access control with admin, operator, analyst, and viewer roles.
- Server-side handling of external AI provider credentials.
- Request rate limiting and protected API routes.
- Human approval controls for selected workflow actions.
Security is an ongoing engineering responsibility; these features should not be interpreted as a claim of independent security certification or a completed penetration test.
Metric fidelity & demo transparency
COASTPULSE uses explicit metric-fidelity classifications:
Label	Meaning
actual	Reported from an actual provider or measured execution
estimated	Estimated rather than directly measured
simulated	Generated by a simulator or demo execution
unavailable	The metric could not be obtained


The platform is designed to avoid presenting unavailable token counts or costs as measured values. Demo workflows can use synthetic data and simulated outputs, and should be treated accordingly.
Run locally
Requirements
- Node.js 20 or later
- npm
1. Clone the repository
git clone https://github.com/Rohan-09-hacker/coastpulse-nexus.git
cd coastpulse-nexus
2. Install dependencies
npm install
3. Configure environment variables
cp .env.example .env
Add the provider credentials you intend to use to .env. For example:
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key
Keep real credentials private. Never commit your .env file or API keys.

The platform also includes deterministic demo/simulator paths for supported offline demonstrations.
4. Start the development server
npm run dev
Open:
http://localhost:3000
On a fresh database, follow the Initial Administrator Setup flow to create the first administrator account.
5. Type-check and build
npm run lint
npm run build
6. Run verification tests
With the application server running:
npm test
npx tsx server/tests/blueprints-verification.test.ts
7. Run the production build locally
npm run build
NODE_ENV=production npm start
Operational notes
- The embedded PGlite database uses a local data directory and an exclusive process lock. Treat this setup as a single-process deployment model.
- For production-scale multi-instance deployments, plan and validate an external database architecture before horizontal scaling.
- Production deployments should use HTTPS. Secure session cookies are enabled when NODE_ENV=production.
- Configure only the AI providers you intend to use. Provider availability and live execution depend on valid credentials and external service access.
Roadmap
The following are potential development directions, not claims that these capabilities are already shipped:
- External PostgreSQL deployment support and multi-instance architecture.
- Stronger workflow recovery, retry, and execution-resume capabilities.
- Expanded provider adapters and model fallback policies.
- More industry-specific application blueprints.
- Deeper workflow observability and developer tooling.
- Expanded automated security and integration testing.
Contributing
Ideas, bug reports, and thoughtful feedback are welcome.
1. Fork the repository.
2. Create a feature branch.
3. Make your changes and add or update tests where appropriate.
4. Run the type check, build, and relevant verification tests.
5. Open a pull request describing the change.
Project links
- Live application: https://coastpulse-core.ai.studio/
- Source code: https://github.com/Rohan-09-hacker/coastpulse-nexus
<div align="center">Built to connect AI capabilities into something bigger.
COASTPULSE CORE · Powered by NEXUS
</div>
