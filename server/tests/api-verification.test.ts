import assert from 'node:assert';
import { DirectoryLock } from '../db/lock.ts';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runApiVerification() {
  console.log(`[TEST RUNNER] Running Security, Database & AI Verification Suite at ${BASE_URL}...`);

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}:`, err.message);
      process.exitCode = 1;
    }
  }

  // 1. Database Health
  await test('GET /api/health returns healthy and positive table count', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.database.connected, true);
    assert.ok(data.database.tablesCount >= 10);
  });

  // 2. Authentication: Unauthenticated access returns 401
  await test('GET /api/v1/auth/me without valid session returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // 3. Authentication: Spoofed x-user-id header is ignored and CANNOT grant access
  await test('Spoofed x-user-id header is ignored and returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: {
        'x-user-id': '00000000-0000-0000-0000-000000000001', // Spoofed admin UUID
        'x-role': 'admin',
      },
    });
    assert.strictEqual(res.status, 401, 'Must reject spoofed user ID header with 401');
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // 4. Authentication: First-admin setup and secure session issuance
  let adminToken = '';
  await test('POST /api/v1/auth/setup-admin creates admin with bcrypt and issues token', async () => {
    // Check if setup required or try setup
    const statusRes = await fetch(`${BASE_URL}/api/v1/auth/status`);
    const statusData = await statusRes.json();

    if (statusData.setupRequired) {
      const setupRes = await fetch(`${BASE_URL}/api/v1/auth/setup-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin.security@coastpulse.internal',
          password: 'SuperSecurePassword2026!',
          displayName: 'Lead Architect',
        }),
      });
      assert.strictEqual(setupRes.status, 201);
      const setupData = await setupRes.json();
      assert.strictEqual(setupData.user.role, 'admin');
      assert.ok(setupData.token);
      adminToken = setupData.token;
    } else {
      // Login with provisioned admin credentials
      const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin.security@coastpulse.internal',
          password: 'SuperSecurePassword2026!',
        }),
      });
      assert.strictEqual(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert.ok(loginData.token);
      adminToken = loginData.token;
    }
  });

  // 4b. Duplicate admin setup must be rejected with JSON 409 Conflict when an admin already exists
  await test('Duplicate POST /api/v1/auth/setup-admin is rejected with JSON 409 Conflict', async () => {
    const dupRes = await fetch(`${BASE_URL}/api/v1/auth/setup-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker.admin@coastpulse.internal',
        password: 'AnotherSecurePassword2026!',
        displayName: 'Attacker Admin',
      }),
    });
    assert.strictEqual(dupRes.status, 409);
    const contentType = dupRes.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), 'Must return JSON Content-Type, never HTML');
    const dupData = await dupRes.json();
    assert.strictEqual(dupData.error, 'Conflict');
  });

  // 5. Authentication: Verified session grants authenticated access
  await test('GET /api/v1/auth/me with Bearer token succeeds and returns authenticated user', async () => {
    assert.ok(adminToken, 'Admin token required');
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'admin');
  });

  // 6. RBAC: Privileged user creation is gated by admin role
  await test('POST /api/v1/auth/users allows admin to provision team member with operator role', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: `operator.${Date.now()}@coastpulse.internal`,
        password: 'OperatorStrongPassword2026!',
        displayName: 'Duty Operator',
        role: 'operator',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'operator');
  });

  // 7. Database Safety: DirectoryLock prevents concurrent instance access
  await test('DirectoryLock rejects concurrent access to the same database directory', async () => {
    const dataDir = path.resolve(process.cwd(), '.data/pglite');
    const secondLock = new DirectoryLock(dataDir);
    let rejected = false;
    try {
      secondLock.acquire();
    } catch (err: any) {
      rejected = true;
      assert.ok(err.message.includes('locked by active PID') || err.message.includes('Concurrent access'));
    } finally {
      if (!rejected) secondLock.release();
    }
    assert.strictEqual(rejected, true, 'Second directory lock must be rejected when active');
  });

  // 8. AI Provider: Demo Simulator Execution
  await test('POST /api/v1/workspace/generate with demo provider returns explicit simulated fidelity', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspace/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        modelId: 'demo-sim-coastal-v1',
        prompt: 'Simulated oil spill containment assessment',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.providerId, 'demo');
    assert.strictEqual(data.metricFidelity, 'simulated');
    assert.strictEqual(data.isSimulated, true);
    assert.strictEqual(data.estimatedCostUsd, null);
    assert.ok(data.text.includes('[SIMULATED SCENARIO ASSESSMENT - DEMO ADAPTER]'));
  });

  // 9. AI Provider: Gemini Request Security & Non-Fabricated Error Handling
  await test('POST /api/v1/workspace/generate with real Gemini model handles real API call securely without fake success', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspace/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        modelId: 'gemini-3.8-flash',
        prompt: 'Say Hello in 3 words',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.providerId, 'gemini');
    // If no key or insufficient scopes, status is error and fidelity is unavailable - NEVER simulated or fake success!
    if (data.status === 'error') {
      assert.strictEqual(data.metricFidelity, 'unavailable');
      assert.strictEqual(data.isSimulated, false);
      assert.ok(data.errorMessage, 'Must report exact upstream error message');
      console.log('    [Verified Gemini API response message]:', data.errorMessage.slice(0, 100));
    } else {
      assert.strictEqual(data.status, 'success');
      assert.strictEqual(data.metricFidelity, 'actual');
    }
  });

  // 10. API Playground: SSRF protection
  await test('POST /api/v1/playground/execute blocks loopback/external SSRF probe', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/playground/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        path: 'http://169.254.169.254/latest/meta-data',
      }),
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.blocked, true);
  });

  // 11. Strict JSON 404
  await test('GET /api/v1/non-existent-route returns JSON 404, NEVER HTML', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/non-existent-route`);
    assert.strictEqual(res.status, 404);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'));
    const text = await res.text();
    assert.ok(!text.includes('<!doctype'));
  });

  // 12. Workflow Schema Validation: Reject missing required input
  await test('POST /api/v1/workflows/:id/run rejects missing required schema input with 400', async () => {
    // Get seeded workflow
    const wfRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const workflows = await wfRes.json();
    const targetWf = workflows.find((w: any) =>
      Array.isArray(w.definition?.inputSchema?.required) && w.definition.inputSchema.required.length > 0
    ) || workflows[workflows.length - 1];

    // Attempt to run without required incident_text input
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${targetWf.id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ inputs: {} }),
    });
    assert.strictEqual(runRes.status, 400);
    const data = await runRes.json();
    assert.ok(data.message.includes('Missing required field') || data.error.includes('Failed'));
  });

  // 13. Workflow DAG Cycle Prevention: Validate endpoint rejects cyclic workflows
  await test('POST /api/v1/workflows/validate rejects cyclic dependency loops', async () => {
    const cyclicWorkflow = {
      version: '2.0',
      inputSchema: { type: 'object', properties: { test: { type: 'string' } } },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'node_alpha',
          name: 'Alpha Node',
          type: 'ai_generation',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'node_beta',
          name: 'Beta Node',
          type: 'ai_generation',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [],
          position: { x: 100, y: 0 },
        },
      ],
      edges: [
        { id: 'e1', source: 'node_alpha', target: 'node_beta' },
        { id: 'e2', source: 'node_beta', target: 'node_alpha' }, // Cycle!
      ],
    };

    const res = await fetch(`${BASE_URL}/api/v1/workflows/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ workflowDefinition: cyclicWorkflow }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.valid, false);
    assert.ok(data.errors.some((e: string) => e.includes('Cyclic dependency detected')));
  });

  // 14. Step-to-Step Data Mapping and Execution Pipeline
  let pausedRunId = '';
  await test('POST /api/v1/workflows/:id/run executes multi-step DAG with explicit mapping & approval gate', async () => {
    // Create a dedicated test workflow with Demo adapter and human checkpoint
    const testDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: {
          incident_text: { type: 'string', required: true },
        },
        required: ['incident_text'],
      },
      outputSchema: {
        type: 'object',
        properties: { final_result: { type: 'string' } },
      },
      nodes: [
        {
          id: 'step_telemetry',
          name: 'Extract Telemetry',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Analyze marine incident telemetry:\n{{incident_text}}',
          inputSchema: {
            type: 'object',
            properties: { incident_text: { type: 'string', required: true } },
            required: ['incident_text'],
          },
          outputSchema: {
            type: 'object',
            properties: { responseText: { type: 'string' } },
            required: ['responseText'],
          },
          mappings: [
            {
              targetField: 'incident_text',
              sourceNodeId: '$workflow_input',
              sourceField: 'incident_text',
            },
          ],
          requiresHumanApproval: false,
          position: { x: 50, y: 100 },
        },
        {
          id: 'step_checkpoint',
          name: 'Containment Action Authorization',
          type: 'approval_gate',
          inputSchema: {
            type: 'object',
            properties: { previous_analysis: { type: 'string', required: true } },
            required: ['previous_analysis'],
          },
          outputSchema: {
            type: 'object',
            properties: { status: { type: 'string' } },
          },
          mappings: [
            {
              targetField: 'previous_analysis',
              sourceNodeId: 'step_telemetry',
              sourceField: 'responseText',
            },
          ],
          requiresHumanApproval: true,
          position: { x: 300, y: 100 },
        },
      ],
      edges: [
        {
          id: 'e_telemetry_checkpoint',
          source: 'step_telemetry',
          target: 'step_checkpoint',
          sourceHandle: 'responseText',
          targetHandle: 'previous_analysis',
        },
      ],
    };

    const createWfRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Deterministic Verification Pipeline',
        description: 'Automated test pipeline verifying data mapping and human sign-off checkpoint.',
        stepDefinitions: testDef,
        requiresApproval: true,
      }),
    });
    assert.strictEqual(createWfRes.status, 201);
    const createdWf = await createWfRes.json();

    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${createdWf.id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        inputs: {
          incident_text: 'Test marine spill: 800 gallons fuel adrift near harbor entrance.',
        },
      }),
    });
    const runData = await runRes.json();
    assert.strictEqual(runRes.status, 200);
    assert.ok(runData.runId);
    assert.strictEqual(runData.status, 'pending_approval');
    assert.ok(runData.message.includes('checkpoint') || runData.message.includes('operator'));
    pausedRunId = runData.runId;
  });

  // 15. Consequential Authorization Checkpoint: Operator/Admin Sign-off
  await test('POST /api/v1/workflows/runs/:id/approve allows operator/admin to authorize consequential step', async () => {
    assert.ok(pausedRunId, 'Must have a paused run ID from previous test');

    // Attempt approval without auth must be rejected with 401
    const unauthRes = await fetch(`${BASE_URL}/api/v1/workflows/runs/${pausedRunId}/approve`, {
      method: 'POST',
    });
    assert.strictEqual(unauthRes.status, 401);

    // Authorized admin sign-off
    const approveRes = await fetch(`${BASE_URL}/api/v1/workflows/runs/${pausedRunId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.strictEqual(approveData.status, 'completed');
  });

  // 16. Workflow Graph Persistence in PGlite
  await test('PUT /api/v1/workflows/:id updates workflow graph definition and persists to database', async () => {
    const wfRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const workflows = await wfRes.json();
    const targetWf = workflows[0];

    const updatedDef = {
      ...targetWf.definition,
      nodes: targetWf.definition.nodes.map((n: any, idx: number) => ({
        ...n,
        position: { x: 50 + idx * 200, y: 120 },
      })),
    };

    const putRes = await fetch(`${BASE_URL}/api/v1/workflows/${targetWf.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: targetWf.name,
        stepDefinitions: updatedDef,
      }),
    });
    assert.strictEqual(putRes.status, 200);
    const putData = await putRes.json();
    assert.strictEqual(putData.definition.nodes[0].position.x, 50);

    // Verify persistence by fetching fresh from DB
    const verifyRes = await fetch(`${BASE_URL}/api/v1/workflows/${targetWf.id}`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.definition.nodes[0].position.x, 50);
  });

  // 17. Milestone 02: Condition Evaluator - Operator Suite & Edge Case Unit Tests
  await test('ConditionEvaluator correctly evaluates all 9 operators, missing fields, and type coercion', async () => {
    const { conditionEvaluator } = await import('../core/workflows/evaluator.ts');

    // equals & not_equals
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'status', operator: 'equals', value: 'critical' }, { status: 'critical' }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'status', operator: 'equals', value: 'critical' }, { status: 'minor' }).passed, false);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'count', operator: 'equals', value: 10 }, { count: '10' }).passed, true); // coercion
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'status', operator: 'not_equals', value: 'minor' }, { status: 'critical' }).passed, true);

    // greater_than, greater_than_or_equal
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'gallons', operator: 'greater_than', value: 500 }, { gallons: 1200 }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'gallons', operator: 'greater_than', value: 1200 }, { gallons: 1200 }).passed, false);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'gallons', operator: 'greater_than_or_equal', value: 1200 }, { gallons: '1200' }).passed, true);

    // less_than, less_than_or_equal
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'temp', operator: 'less_than', value: 20 }, { temp: 15 }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'temp', operator: 'less_than_or_equal', value: 15 }, { temp: 15 }).passed, true);

    // contains (string & array)
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'desc', operator: 'contains', value: 'diesel' }, { desc: 'Marine diesel fuel' }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'tags', operator: 'contains', value: 'oil' }, { tags: ['hazard', 'oil', 'marine'] }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'tags', operator: 'contains', value: 'fire' }, { tags: ['hazard', 'oil'] }).passed, false);

    // exists & is_empty
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'present', operator: 'exists' }, { present: 'yes' }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'missing', operator: 'exists' }, {}).passed, false);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'emptyStr', operator: 'is_empty' }, { emptyStr: '' }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'emptyArr', operator: 'is_empty' }, { emptyArr: [] }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'hasData', operator: 'is_empty' }, { hasData: 'something' }).passed, false);

    // Missing field / type safety
    assert.strictEqual(conditionEvaluator.evaluate({ field: 'nonexistent', operator: 'greater_than', value: 100 }, {}).passed, false);
  });

  // 18. Conditional Branching DAG Execution: TRUE branch executes, FALSE branch is SKIPPED
  await test('POST /api/v1/workflows/:id/run executes conditional TRUE branch and marks FALSE branch skipped', async () => {
    const branchDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: {
          fuel_gallons: { type: 'number', required: true },
          incident_text: { type: 'string', required: true },
        },
        required: ['fuel_gallons', 'incident_text'],
      },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'cond_severity',
          name: 'Check Hazard Severity',
          type: 'conditional',
          condition: {
            field: 'fuel_gallons',
            operator: 'greater_than_or_equal',
            value: 1000,
          },
          inputSchema: {
            type: 'object',
            properties: { fuel_gallons: { type: 'number', required: true } },
            required: ['fuel_gallons'],
          },
          outputSchema: {
            type: 'object',
            properties: { result: { type: 'boolean' }, decision: { type: 'string' } },
          },
          mappings: [
            { targetField: 'fuel_gallons', sourceNodeId: '$workflow_input', sourceField: 'fuel_gallons' },
          ],
          position: { x: 50, y: 150 },
        },
        {
          id: 'branch_major_spill',
          name: 'Major Spill Response Plan',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Draft MAJOR disaster containment for {{fuel_gallons}} gal:\n{{incident_text}}',
          inputSchema: {
            type: 'object',
            properties: { fuel_gallons: { type: 'number' }, incident_text: { type: 'string' } },
          },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [
            { targetField: 'fuel_gallons', sourceNodeId: '$workflow_input', sourceField: 'fuel_gallons' },
            { targetField: 'incident_text', sourceNodeId: '$workflow_input', sourceField: 'incident_text' },
          ],
          position: { x: 300, y: 50 },
        },
        {
          id: 'branch_minor_spill',
          name: 'Routine Containment Protocol',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Draft minor containment protocol for {{fuel_gallons}} gal.',
          inputSchema: {
            type: 'object',
            properties: { fuel_gallons: { type: 'number' } },
          },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [
            { targetField: 'fuel_gallons', sourceNodeId: '$workflow_input', sourceField: 'fuel_gallons' },
          ],
          position: { x: 300, y: 250 },
        },
      ],
      edges: [
        { id: 'e_true', source: 'cond_severity', target: 'branch_major_spill', sourceHandle: 'true' },
        { id: 'e_false', source: 'cond_severity', target: 'branch_minor_spill', sourceHandle: 'false' },
      ],
    };

    const createRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Conditional Hazard Triage Pipeline',
        description: 'Dynamically routes between major and minor disaster response based on fuel volume.',
        stepDefinitions: branchDef,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const wf = await createRes.json();

    // Run with fuel_gallons = 1200 (>= 1000 => TRUE)
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${wf.id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        inputs: {
          fuel_gallons: 1200,
          incident_text: 'Tug adrift with 1,200 gallons marine diesel.',
        },
      }),
    });
    assert.strictEqual(runRes.status, 200);
    const runData = await runRes.json();
    assert.strictEqual(runData.status, 'completed');

    // Verify branch decisions telemetry
    assert.ok(runData.branchDecisions && runData.branchDecisions.length === 1);
    assert.strictEqual(runData.branchDecisions[0].decision, 'true');

    // Verify branch_major_spill executed successfully
    assert.strictEqual(runData.nodeOutputs.branch_major_spill.status, 'success');
    assert.ok(runData.nodeOutputs.branch_major_spill.responseText);

    // Verify branch_minor_spill was explicitly SKIPPED
    assert.strictEqual(runData.nodeOutputs.branch_minor_spill.status, 'skipped');
    assert.strictEqual(runData.nodeOutputs.branch_minor_spill.skipped, true);
    assert.ok(runData.skippedNodes.some((s: any) => s.nodeId === 'branch_minor_spill'));
  });

  // 19. Inactive Branch Checkpoint Bypassing
  await test('Human approval gate in an inactive (skipped) conditional branch does not block the workflow', async () => {
    const branchWithGateDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: { is_emergency: { type: 'boolean', required: true } },
        required: ['is_emergency'],
      },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'cond_emergency',
          name: 'Check Emergency Flag',
          type: 'conditional',
          condition: { field: 'is_emergency', operator: 'equals', value: true },
          inputSchema: { type: 'object', properties: { is_emergency: { type: 'boolean' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'boolean' } } },
          mappings: [{ targetField: 'is_emergency', sourceNodeId: '$workflow_input', sourceField: 'is_emergency' }],
          position: { x: 50, y: 100 },
        },
        {
          id: 'emergency_checkpoint',
          name: 'Emergency Consequential Gate',
          type: 'approval_gate',
          requiresHumanApproval: true,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          mappings: [],
          position: { x: 300, y: 50 },
        },
        {
          id: 'routine_action',
          name: 'Routine Autonomous Log',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Log routine status.',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [],
          position: { x: 300, y: 200 },
        },
      ],
      edges: [
        { id: 'e_emer_true', source: 'cond_emergency', target: 'emergency_checkpoint', sourceHandle: 'true' },
        { id: 'e_emer_false', source: 'cond_emergency', target: 'routine_action', sourceHandle: 'false' },
      ],
    };

    const createRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Emergency Gate Branching Workflow',
        stepDefinitions: branchWithGateDef,
      }),
    });
    const wf = await createRes.json();

    // Run with is_emergency = false => emergency_checkpoint is SKIPPED and run should complete immediately!
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${wf.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ inputs: { is_emergency: false } }),
    });
    const runData = await runRes.json();
    assert.strictEqual(runRes.status, 200);
    assert.strictEqual(runData.status, 'completed', 'Workflow should complete because checkpoint branch was inactive');
    assert.strictEqual(runData.nodeOutputs.emergency_checkpoint.status, 'skipped');
    assert.strictEqual(runData.nodeOutputs.routine_action.status, 'success');
  });

  // 20. Compound Logical Conditions (AND, OR, NOT, Nested Groups, Short-Circuit, Max Depth)
  await test('ConditionEvaluator evaluates compound AND, OR, NOT conditions with short-circuiting and max depth limit', async () => {
    const { conditionEvaluator } = await import('../core/workflows/evaluator.ts');

    // AND evaluation
    const andCond = {
      combinator: 'AND' as const,
      conditions: [
        { field: 'fuel_gallons', operator: 'greater_than' as const, value: 500 },
        { field: 'hazard_type', operator: 'equals' as const, value: 'chemical' },
      ],
    };
    assert.strictEqual(conditionEvaluator.evaluate(andCond, { fuel_gallons: 600, hazard_type: 'chemical' }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate(andCond, { fuel_gallons: 300, hazard_type: 'chemical' }).passed, false);
    assert.strictEqual(conditionEvaluator.evaluate(andCond, { fuel_gallons: 600, hazard_type: 'oil' }).passed, false);

    // OR evaluation
    const orCond = {
      combinator: 'OR' as const,
      conditions: [
        { field: 'is_emergency', operator: 'equals' as const, value: true },
        { field: 'evacuate_required', operator: 'equals' as const, value: true },
      ],
    };
    assert.strictEqual(conditionEvaluator.evaluate(orCond, { is_emergency: true, evacuate_required: false }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate(orCond, { is_emergency: false, evacuate_required: true }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate(orCond, { is_emergency: false, evacuate_required: false }).passed, false);

    // NOT evaluation
    const notCond = {
      combinator: 'NOT' as const,
      conditions: [
        { field: 'is_safe', operator: 'equals' as const, value: true },
      ],
    };
    assert.strictEqual(conditionEvaluator.evaluate(notCond, { is_safe: false }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate(notCond, { is_safe: true }).passed, false);

    // Nested Compound Group: (risk_score >= 70 AND attendance < 60) OR previous_failures >= 2
    const complexCond = {
      combinator: 'OR' as const,
      conditions: [
        {
          combinator: 'AND' as const,
          conditions: [
            { field: 'risk_score', operator: 'greater_than_or_equal' as const, value: 70 },
            { field: 'attendance', operator: 'less_than' as const, value: 60 },
          ],
        },
        { field: 'previous_failures', operator: 'greater_than_or_equal' as const, value: 2 },
      ],
    };
    assert.strictEqual(conditionEvaluator.evaluate(complexCond, { risk_score: 75, attendance: 50, previous_failures: 0 }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate(complexCond, { risk_score: 50, attendance: 90, previous_failures: 3 }).passed, true);
    assert.strictEqual(conditionEvaluator.evaluate(complexCond, { risk_score: 50, attendance: 50, previous_failures: 1 }).passed, false);

    // Short-circuit verification: AND stops on first false without evaluating subsequent conditions
    const shortCircuitAnd = {
      combinator: 'AND' as const,
      conditions: [
        { field: 'failing_step', operator: 'equals' as const, value: 'expected' },
        { field: 'unreached_step', operator: 'equals' as const, value: 'anything' },
      ],
    };
    const andRes = conditionEvaluator.evaluate(shortCircuitAnd, { failing_step: 'actual' });
    assert.strictEqual(andRes.passed, false);
    assert.strictEqual(andRes.subResults?.length, 1, 'AND must short-circuit on first failure');

    // Max Nesting Depth (depth > 5 throws Error)
    let deepCond: any = { field: 'base', operator: 'equals', value: 1 };
    for (let d = 0; d < 6; d++) {
      deepCond = { combinator: 'AND', conditions: [deepCond] };
    }
    assert.throws(
      () => conditionEvaluator.evaluate(deepCond, { base: 1 }),
      /Condition nesting depth limit exceeded/
    );
  });

  // 21. Switch / Case Multi-Way Branching Execution
  await test('Switch / Case node routes execution to matched case handle and skips non-selected branches', async () => {
    const switchWfDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', required: true },
          incident_text: { type: 'string', required: true },
        },
        required: ['severity', 'incident_text'],
      },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'switch_node',
          name: 'Triage Severity Router',
          type: 'switch',
          switchConfig: {
            field: 'severity',
            cases: [
              { id: 'c_low', value: 'LOW', label: 'Low Risk', handle: 'handle_low' },
              { id: 'c_med', value: 'MEDIUM', label: 'Medium Risk', handle: 'handle_med' },
              { id: 'c_high', value: 'HIGH', label: 'High Risk', handle: 'handle_high' },
            ],
            defaultHandle: 'handle_default',
          },
          inputSchema: {
            type: 'object',
            properties: { severity: { type: 'string' } },
          },
          outputSchema: {
            type: 'object',
            properties: { decision: { type: 'string' } },
          },
          mappings: [
            { targetField: 'severity', sourceNodeId: '$workflow_input', sourceField: 'severity' },
          ],
          position: { x: 50, y: 150 },
        },
        {
          id: 'step_low',
          name: 'Monitoring Workflow',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Execute routine monitoring for: {{incident_text}}',
          inputSchema: { type: 'object', properties: { incident_text: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [{ targetField: 'incident_text', sourceNodeId: '$workflow_input', sourceField: 'incident_text' }],
          position: { x: 300, y: 50 },
        },
        {
          id: 'step_med',
          name: 'Investigation Workflow',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Dispatch field investigation for: {{incident_text}}',
          inputSchema: { type: 'object', properties: { incident_text: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [{ targetField: 'incident_text', sourceNodeId: '$workflow_input', sourceField: 'incident_text' }],
          position: { x: 300, y: 150 },
        },
        {
          id: 'step_high',
          name: 'Intervention Workflow',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Initiate emergency disaster intervention for: {{incident_text}}',
          inputSchema: { type: 'object', properties: { incident_text: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [{ targetField: 'incident_text', sourceNodeId: '$workflow_input', sourceField: 'incident_text' }],
          position: { x: 300, y: 250 },
        },
      ],
      edges: [
        { id: 'e_low', source: 'switch_node', target: 'step_low', sourceHandle: 'handle_low' },
        { id: 'e_med', source: 'switch_node', target: 'step_med', sourceHandle: 'handle_med' },
        { id: 'e_high', source: 'switch_node', target: 'step_high', sourceHandle: 'handle_high' },
      ],
    };

    const createRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Multi-Way Severity Router Pipeline',
        stepDefinitions: switchWfDef,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const wf = await createRes.json();

    // Run with severity: 'MEDIUM' -> should execute step_med, skip step_low and step_high
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${wf.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        inputs: {
          severity: 'MEDIUM',
          incident_text: 'Medium coastal oil slick spotted.',
        },
      }),
    });
    assert.strictEqual(runRes.status, 200);
    const runData = await runRes.json();
    assert.strictEqual(runData.status, 'completed');

    // Switch decision recorded
    assert.ok(runData.branchDecisions && runData.branchDecisions.length >= 1);
    assert.strictEqual(runData.branchDecisions[0].decision, 'handle_med');

    // Selected step executed
    assert.strictEqual(runData.nodeOutputs.step_med.status, 'success');
    assert.ok(runData.nodeOutputs.step_med.responseText);

    // Non-selected branches skipped
    assert.strictEqual(runData.nodeOutputs.step_low.status, 'skipped');
    assert.strictEqual(runData.nodeOutputs.step_high.status, 'skipped');
  });

  // 22. Switch / Case Fallback to Default Branch
  await test('Switch node routes to default branch when no case values match', async () => {
    const switchDefaultDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: { category: { type: 'string', required: true } },
        required: ['category'],
      },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'sw_cat',
          name: 'Category Switch',
          type: 'switch',
          switchConfig: {
            field: 'category',
            cases: [
              { id: 'c_cargo', value: 'CARGO', handle: 'cargo_handle' },
            ],
            defaultHandle: 'default',
          },
          inputSchema: { type: 'object', properties: { category: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { decision: { type: 'string' } } },
          mappings: [{ targetField: 'category', sourceNodeId: '$workflow_input', sourceField: 'category' }],
          position: { x: 50, y: 100 },
        },
        {
          id: 'step_cargo',
          name: 'Cargo Handler',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Handle cargo.',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [],
          position: { x: 300, y: 50 },
        },
        {
          id: 'step_fallback',
          name: 'General Default Handler',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Handle unknown category default.',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [],
          position: { x: 300, y: 150 },
        },
      ],
      edges: [
        { id: 'e_cargo', source: 'sw_cat', target: 'step_cargo', sourceHandle: 'cargo_handle' },
        { id: 'e_default', source: 'sw_cat', target: 'step_fallback', sourceHandle: 'default' },
      ],
    };

    const createRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Switch Fallback Pipeline',
        stepDefinitions: switchDefaultDef,
      }),
    });
    const wf = await createRes.json();

    // Run with unrecognized category: 'PASSENGER'
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${wf.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ inputs: { category: 'PASSENGER' } }),
    });
    const runData = await runRes.json();
    assert.strictEqual(runRes.status, 200);
    assert.strictEqual(runData.branchDecisions[0].decision, 'default');
    assert.strictEqual(runData.nodeOutputs.step_cargo.status, 'skipped');
    assert.strictEqual(runData.nodeOutputs.step_fallback.status, 'success');
  });

  // 23. Switch Validation: Duplicate Case Values Rejected
  await test('Workflow definition validator rejects switch nodes with duplicate case values', async () => {
    const duplicateSwitchDef = {
      version: '2.0',
      inputSchema: { type: 'object', properties: { severity: { type: 'string' } } },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'sw_dup',
          name: 'Duplicate Case Switch',
          type: 'switch',
          switchConfig: {
            field: 'severity',
            cases: [
              { id: 'c1', value: 'HIGH', handle: 'h1' },
              { id: 'c2', value: 'HIGH', handle: 'h2' }, // DUPLICATE VALUE
            ],
          },
          inputSchema: { type: 'object', properties: { severity: { type: 'string' } } },
          outputSchema: { type: 'object', properties: {} },
          mappings: [],
          position: { x: 50, y: 100 },
        },
        {
          id: 'step_target',
          name: 'Target Step',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'Handle target',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          mappings: [],
          position: { x: 300, y: 100 },
        },
      ],
      edges: [
        { id: 'e1', source: 'sw_dup', target: 'step_target', sourceHandle: 'h1' },
      ],
    };

    const valRes = await fetch(`${BASE_URL}/api/v1/workflows/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ workflowDefinition: duplicateSwitchDef }),
    });
    const valData = await valRes.json();
    assert.strictEqual(valData.valid, false);
    assert.ok(valData.errors.some((e: string) => e.includes('Duplicate case value detected')));
  });

  // 24. Nested Workflow Invocation and Context Binding
  await test('Nested workflow invokes child pipeline, maps inputs, binds outputs, and tracks child run ID', async () => {
    // 1. Create child workflow
    const childDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: { sub_prompt: { type: 'string', required: true } },
        required: ['sub_prompt'],
      },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'child_ai_step',
          name: 'Child AI Processing',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'CHILD PIPELINE PROCESSED: {{sub_prompt}}',
          inputSchema: { type: 'object', properties: { sub_prompt: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [{ targetField: 'sub_prompt', sourceNodeId: '$workflow_input', sourceField: 'sub_prompt' }],
          position: { x: 50, y: 100 },
        },
      ],
      edges: [],
    };

    const childCreateRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Modular Child Pipeline',
        stepDefinitions: childDef,
      }),
    });
    const childWf = await childCreateRes.json();

    // 2. Create parent workflow invoking child
    const parentDef = {
      version: '2.0',
      inputSchema: {
        type: 'object',
        properties: { parent_incident: { type: 'string', required: true } },
        required: ['parent_incident'],
      },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'nested_sub_node',
          name: 'Invoke Child Workflow Step',
          type: 'nested_workflow',
          nestedWorkflowConfig: {
            childWorkflowId: childWf.id,
            childWorkflowName: 'Modular Child Pipeline',
          },
          inputSchema: {
            type: 'object',
            properties: { sub_prompt: { type: 'string', required: true } },
            required: ['sub_prompt'],
          },
          outputSchema: {
            type: 'object',
            properties: { responseText: { type: 'string' } },
          },
          mappings: [
            { targetField: 'sub_prompt', sourceNodeId: '$workflow_input', sourceField: 'parent_incident' },
          ],
          position: { x: 50, y: 100 },
        },
        {
          id: 'parent_downstream',
          name: 'Parent Synthesis Step',
          type: 'ai_generation',
          targetModel: 'demo-simulator',
          promptTemplate: 'FINAL SYNTHESIS USING CHILD OUTPUT:\n{{child_result}}',
          inputSchema: {
            type: 'object',
            properties: { child_result: { type: 'string', required: true } },
            required: ['child_result'],
          },
          outputSchema: { type: 'object', properties: { responseText: { type: 'string' } } },
          mappings: [
            { targetField: 'child_result', sourceNodeId: 'nested_sub_node', sourceField: 'responseText' },
          ],
          position: { x: 300, y: 100 },
        },
      ],
      edges: [
        { id: 'e_nest', source: 'nested_sub_node', target: 'parent_downstream' },
      ],
    };

    const parentCreateRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Parent Orchestrator Pipeline',
        stepDefinitions: parentDef,
      }),
    });
    assert.strictEqual(parentCreateRes.status, 201);
    const parentWf = await parentCreateRes.json();

    // 3. Execute parent workflow
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${parentWf.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ inputs: { parent_incident: 'Harbor oil contamination telemetry' } }),
    });
    const runData = await runRes.json();
    assert.strictEqual(runRes.status, 200);
    assert.strictEqual(runData.status, 'completed');

    // Verify child execution run reference is recorded
    assert.ok(runData.nodeOutputs.nested_sub_node);
    assert.ok(runData.nodeOutputs.nested_sub_node._childRunId);
    assert.strictEqual(runData.nodeOutputs.nested_sub_node.status, 'completed');

    // Verify downstream parent step consumed child output
    assert.strictEqual(runData.nodeOutputs.parent_downstream.status, 'success');
    assert.ok(runData.nodeOutputs.parent_downstream.responseText);
  });

  // 25. Nested Workflow Recursion Cycle and Max Call Stack Depth Guard
  await test('Nested workflow execution prevents recursion cycles and enforces max depth 3', async () => {
    // 1. Direct recursion validation test: workflow invokes itself
    const wfA = await (await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Recursion Test Workflow A',
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'node_dummy',
              name: 'Dummy Step',
              type: 'ai_generation',
              targetModel: 'demo-simulator',
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    })).json();

    // Update A to call itself
    const selfRes = await fetch(`${BASE_URL}/api/v1/workflows/${wfA.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'node_self',
              name: 'Self Calling Step',
              type: 'nested_workflow',
              nestedWorkflowConfig: { childWorkflowId: wfA.id },
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    });
    const selfData = await selfRes.json();
    assert.strictEqual(selfRes.status, 400);
    assert.ok(selfData.validationErrors.some((e: string) => e.includes('Direct recursive cycle detected')));

    // 2. Transitive recursion cycle during execution (A calls B, B calls A)
    const wfB = await (await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Recursion Test Workflow B',
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'b_invokes_a',
              name: 'B Invokes A',
              type: 'nested_workflow',
              nestedWorkflowConfig: { childWorkflowId: wfA.id },
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    })).json();

    // Update A to invoke B
    await fetch(`${BASE_URL}/api/v1/workflows/${wfA.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'a_invokes_b',
              name: 'A Invokes B',
              type: 'nested_workflow',
              nestedWorkflowConfig: { childWorkflowId: wfB.id },
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    });

    // Run A -> A invokes B -> B invokes A -> Caught by callStack cycle detector
    const cycleRunRes = await fetch(`${BASE_URL}/api/v1/workflows/${wfA.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ inputs: {} }),
    });
    const cycleData = await cycleRunRes.json();
    assert.strictEqual(cycleRunRes.status, 200); // Route returns 200 with run result status = failed
    assert.strictEqual(cycleData.status, 'failed');
    assert.ok(cycleData.error.includes('Recursive nested workflow call detected') || cycleData.error.includes('Recursive workflow cycle'));

    // 3. Call stack depth limit (Chain of 3 nested workflows hitting depth 3 limit)
    // Create chain: L3
    const wfL3 = await (await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Depth Level 3 Pipeline',
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'l3_node',
              name: 'L3 Leaf Step',
              type: 'ai_generation',
              targetModel: 'demo-simulator',
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    })).json();

    // L2 calls L3
    const wfL2 = await (await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Depth Level 2 Pipeline',
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'l2_node',
              name: 'L2 Calls L3',
              type: 'nested_workflow',
              nestedWorkflowConfig: { childWorkflowId: wfL3.id },
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    })).json();

    // L1 calls L2
    const wfL1 = await (await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Depth Level 1 Pipeline',
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'l1_node',
              name: 'L1 Calls L2',
              type: 'nested_workflow',
              nestedWorkflowConfig: { childWorkflowId: wfL2.id },
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    })).json();

    // L0 calls L1 (L0 -> L1 -> L2 -> L3: L2 attempting to invoke L3 exceeds depth budget 3)
    const wfL0 = await (await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Depth Level 0 Root Pipeline',
        stepDefinitions: {
          version: '2.0',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          nodes: [
            {
              id: 'l0_node',
              name: 'L0 Calls L1',
              type: 'nested_workflow',
              nestedWorkflowConfig: { childWorkflowId: wfL1.id },
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
              mappings: [],
              position: { x: 50, y: 100 },
            },
          ],
          edges: [],
        },
      }),
    })).json();

    const depthRunRes = await fetch(`${BASE_URL}/api/v1/workflows/${wfL0.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ inputs: {} }),
    });
    const depthRunData = await depthRunRes.json();
    assert.strictEqual(depthRunRes.status, 200);
    assert.strictEqual(depthRunData.status, 'failed');
    assert.ok(depthRunData.error.includes('depth limit exceeded') || depthRunData.error.includes('max call stack depth'));
  });

  // 26. Human Approval Inside Nested Child Workflow Propagates to Parent
  await test('Human approval gate inside nested child workflow halts parent workflow with pending_approval', async () => {
    // 1. Create child workflow containing an approval gate
    const childWithGateDef = {
      version: '2.0',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'child_gate',
          name: 'Child Consequential Gate',
          type: 'approval_gate',
          requiresHumanApproval: true,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          mappings: [],
          position: { x: 50, y: 100 },
        },
      ],
      edges: [],
    };

    const childRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Child Pipeline with Checkpoint', stepDefinitions: childWithGateDef }),
    });
    const childWf = await childRes.json();

    // 2. Parent workflow invoking this child
    const parentDef = {
      version: '2.0',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      nodes: [
        {
          id: 'parent_nest',
          name: 'Invoke Gated Child',
          type: 'nested_workflow',
          nestedWorkflowConfig: { childWorkflowId: childWf.id },
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          mappings: [],
          position: { x: 50, y: 100 },
        },
      ],
      edges: [],
    };

    const parentRes = await fetch(`${BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Parent of Gated Child', stepDefinitions: parentDef }),
    });
    const parentWf = await parentRes.json();

    // 3. Run parent workflow -> must halt with pending_approval!
    const runRes = await fetch(`${BASE_URL}/api/v1/workflows/${parentWf.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ inputs: {} }),
    });
    const runData = await runRes.json();
    assert.strictEqual(runRes.status, 200);
    assert.strictEqual(runData.status, 'pending_approval');
    assert.ok(runData.message.includes('awaiting operator authorization'));
  });

  console.log(`\n[RESULTS] ${passed}/${total} security and verification tests passed successfully.`);
  process.exit(passed === total ? 0 : 1);
}

runApiVerification().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
