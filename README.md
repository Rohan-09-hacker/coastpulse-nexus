
<div align="center">

# 🌊 COASTPULSE CORE

### One Engine. Unlimited AI Applications.

**A modular, model-independent AI orchestration platform for building, executing, and evaluating intelligent workflows.**

[![Live Platform](https://img.shields.io/badge/LIVE%20PLATFORM-Visit%20Now-00B4D8?style=for-the-badge)](https://coastpulse-core.ai.studio/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Rohan-09-hacker/coastpulse-nexus)

[**🚀 LAUNCH COASTPULSE CORE**](https://coastpulse-core.ai.studio/)

</div>

---

## ⚡ What is COASTPULSE CORE?

COASTPULSE CORE is a full-stack AI orchestration platform designed to bring multiple AI capabilities into one unified environment.

It combines a visual workflow engine, multi-provider AI workspace, model evaluation tools, telemetry, and industry-oriented application blueprints.

At its core is **NEXUS**, the workflow orchestration layer that connects application logic into structured, schema-validated workflows.

> Move beyond isolated AI tools. Build, connect, execute, and manage intelligent applications through one unified engine.

---

## ✨ Platform Features

| Module | Description |
|---|---|
| 🎯 Command Center | Platform health, workflow activity and provider status |
| 🤖 AI Workspace | Multi-provider AI prompt experimentation |
| 🧠 Model Control Center | AI provider configuration and capability inspection |
| ⚙️ NEXUS Workflow Engine | Visual DAG-based workflow orchestration |
| 🧪 Evaluation Lab | Model comparison and performance evaluation |
| 📊 Telemetry & Analytics | Usage, latency and metric-fidelity tracking |
| 🔌 API Playground | Internal API exploration with request protections |
| 🏗️ Application Registry | Industry-oriented AI workflow blueprints |
| 🌊 Coastal Intelligence | Maritime and environmental intelligence reference app |

---

## 🧠 NEXUS — The Workflow Engine

NEXUS is the orchestration layer powering COASTPULSE CORE.

### Core capabilities

- **Visual DAG Workflows** — Design structured workflows through a visual canvas.
- **Schema Validation** — Validate workflow structures and inputs.
- **Conditional Branching** — Deterministic IF / ELSE execution.
- **Switch / Case Routing** — Multi-way workflow routing.
- **Nested Workflows** — Compose smaller pipelines into larger systems.
- **Cycle Detection** — Prevent invalid workflow recursion.
- **Human-in-the-Loop** — Approval checkpoints for consequential actions.
- **Execution Tracking** — Maintain workflow execution records.

### Workflow Architecture

```text
          USER / APPLICATION
                  |
                  v
       +----------------------+
       |   COASTPULSE CORE    |
       |                      |
       | AI Workspace         |
       | Application Registry |
       | Evaluation Lab       |
       +----------+-----------+
                  |
                  v
       +----------------------+
       |     NEXUS ENGINE     |
       |                      |
       | Workflow Graph       |
       | Schema Validation    |
       | Conditional Routing  |
       | Nested Pipelines     |
       | Approval Checkpoints |
       +----------+-----------+
                  |
                  v
       +----------------------+
       |    EXPRESS API       |
       |                      |
       | Authentication       |
       | RBAC                 |
       | Provider Adapters    |
       | Execution Services   |
       +----------+-----------+
                  |
                  v
       +----------------------+
       |    PGLITE DATABASE   |
       |                      |
       | Users & Sessions     |
       | Workflows            |
       | Execution Records    |
       +----------------------+
```

---

## 🌍 Universal Application Registry

COASTPULSE CORE connects NEXUS to six industry-oriented blueprint areas.

| Industry | Blueprint |
|---|---|
| 🌊 Maritime | Coastal Intelligence |
| 🎓 Education | Education Intelligence |
| 🏥 Healthcare | Healthcare Intelligence |
| 💳 Finance | Finance Intelligence |
| 🛡️ Cybersecurity | Security Intelligence |
| 🌱 Environment | Climate & Ecology Intelligence |

These blueprints provide structured starting points for building domain-specific applications.

**Note:** Demo executions may use synthetic inputs and simulated outputs unless live integrations are configured.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Build Tool | Vite |
| Backend | Node.js, Express.js |
| Database | PGlite (PostgreSQL WASM) |
| ORM | Drizzle ORM |
| Validation | Zod |
| AI Integration | Google GenAI SDK |
| Icons | Lucide |

---

## 🔐 Security Architecture

COASTPULSE CORE incorporates server-side security controls:

- Password hashing using bcryptjs.
- Server-validated sessions.
- HTTP-only session cookies.
- SHA-256 session token digests.
- Role-Based Access Control (RBAC).
- Four access roles:
  - `admin`
  - `operator`
  - `analyst`
  - `viewer`
- Server-side AI credential handling.
- Request rate limiting.
- Human approval checkpoints.

Security is an ongoing engineering responsibility; the project has not been independently security-certified.

---

## 📊 Metric Fidelity & Transparency

COASTPULSE uses explicit metric classifications to distinguish real measurements from demo data.

| Classification | Meaning |
|---|---|
| `actual` | Measured or reported by an actual provider |
| `estimated` | Estimated value |
| `simulated` | Generated through a simulator or demo |
| `unavailable` | Measurement could not be obtained |

The platform avoids presenting unavailable token counts or costs as measured values.

---

# 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Rohan-09-hacker/coastpulse-nexus.git

cd coastpulse-nexus
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Add your provider credentials to `.env`:

```env
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key
```

**Never commit your `.env` file or expose API keys publicly.**

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Complete the Initial Administrator Setup flow to create your first admin account.

### 5. Type check and build

```bash
npm run lint
npm run build
```

### 6. Run tests

With the application server running:

```bash
npm test

npx tsx server/tests/blueprints-verification.test.ts
```

### 7. Production mode

```bash
npm run build

NODE_ENV=production npm start
```

---

## ⚙️ Operational Notes

- PGlite uses a local database directory with an exclusive process lock.
- The embedded database setup is intended for single-process operation.
- Plan and validate an external database architecture before multi-instance scaling.
- Production deployments should use HTTPS.
- Live AI functionality depends on valid provider credentials and external service availability.

---

## 🗺️ Roadmap

Potential future development directions:

- [ ] External PostgreSQL deployment architecture.
- [ ] Multi-instance workflow execution.
- [ ] Advanced workflow recovery and retries.
- [ ] Expanded AI provider integrations.
- [ ] Model fallback strategies.
- [ ] Additional industry application blueprints.
- [ ] Advanced execution observability.
- [ ] Expanded automated security testing.

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Add or update relevant tests.
5. Submit a pull request.

---

## 🔗 Project Links

| Resource | Link |
|---|---|
| 🌐 Live Platform | https://coastpulse-core.ai.studio/ |
| 💻 GitHub Repository | https://github.com/Rohan-09-hacker/coastpulse-nexus |

---

<div align="center">

### Built to connect AI capabilities into something bigger.

# COASTPULSE CORE

**Powered by NEXUS**

*One Engine. Unlimited AI Applications.*

</div>
