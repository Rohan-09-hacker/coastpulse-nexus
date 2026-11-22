import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runBlueprintsVerification() {
  console.log(`[BLUEPRINT TEST RUNNER] Testing NEXUS 3.0 Universal Industry Blueprints at ${BASE_URL}...`);

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

  let adminToken = '';
  let viewerToken = '';

  // 1. Registry completeness & consistent schema + workflow association
  await test('GET /api/v1/apps returns all 6 industry blueprints with consistent schemas and workflow associations', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/apps`);
    assert.strictEqual(res.status, 200);
    const apps = await res.json();
    assert.ok(Array.isArray(apps));
    assert.strictEqual(apps.length, 6, 'Expected 6 registered industry blueprints');

    const expectedIndustries = [
      'Education',
      'Healthcare',
      'Finance',
      'Cybersecurity',
      'Environmental',
      'Maritime',
    ];
    const returnedIndustries = apps.map((a: any) => a.blueprint?.industry);
    for (const ind of expectedIndustries) {
      assert.ok(returnedIndustries.includes(ind), `Missing industry blueprint: ${ind}`);
    }

    for (const app of apps) {
      assert.ok(app.name, 'Blueprint must have name');
      assert.ok(app.description, 'Blueprint must have description');
      assert.ok(app.blueprint?.inputSchema?.properties, `${app.id} missing inputSchema`);
      assert.ok(app.blueprint?.outputSchema?.properties, `${app.id} missing outputSchema`);
      assert.ok(app.blueprint?.workflowAssociation?.workflowId, `${app.id} missing workflowId`);
      assert.ok(app.blueprint?.workflowAssociation?.workflowName, `${app.id} missing workflowName`);
      assert.ok(app.blueprint?.fidelity?.label, `${app.id} missing fidelity label`);
      assert.ok(app.blueprint?.syntheticSampleInput, `${app.id} missing syntheticSampleInput`);
    }
  });

  // 2. Associated workflows exist in GET /api/v1/workflows
  await test('All 6 blueprint workflow IDs resolve to valid workflows in PGlite', async () => {
    const [appsRes, wfRes] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/apps`),
      fetch(`${BASE_URL}/api/v1/workflows`),
    ]);
    assert.strictEqual(appsRes.status, 200);
    assert.strictEqual(wfRes.status, 200);
    const apps = await appsRes.json();
    const workflows = await wfRes.json();
    const wfIds = new Set(workflows.map((w: any) => w.id));

    for (const app of apps) {
      const targetWfId = app.blueprint.workflowAssociation.workflowId;
      assert.ok(wfIds.has(targetWfId), `Associated workflow ${targetWfId} for ${app.id} not found`);
    }
  });

  // 3. Unauthenticated execution rejected
  await test('POST /api/v1/apps/:id/run rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/apps/education-intelligence/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useSyntheticDemo: true }),
    });
    assert.strictEqual(res.status, 401);
  });

  // Authenticate for RBAC & execution tests
  await test('Authenticate test admin and viewer accounts', async () => {
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
      adminToken = (await setupRes.json()).token;
    } else {
      const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin.security@coastpulse.internal',
          password: 'SuperSecurePassword2026!',
        }),
      });
      assert.strictEqual(loginRes.status, 200);
      adminToken = (await loginRes.json()).token;
    }

    const viewerEmail = `viewer.bp.${Date.now()}@coastpulse.internal`;
    const createViewer = await fetch(`${BASE_URL}/api/v1/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: viewerEmail,
        password: 'ViewerStrongPassword2026!',
        displayName: 'Audit Viewer',
        role: 'viewer',
      }),
    });
    assert.strictEqual(createViewer.status, 201);

    const viewerLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: viewerEmail,
        password: 'ViewerStrongPassword2026!',
      }),
    });
    assert.strictEqual(viewerLogin.status, 200);
    viewerToken = (await viewerLogin.json()).token;
  });

  // 4. RBAC check: viewer cannot execute blueprint workflow
  await test('POST /api/v1/apps/:id/run rejects viewer role with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/apps/education-intelligence/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ useSyntheticDemo: true }),
    });
    assert.strictEqual(res.status, 403);
  });

  // 5. Blueprint Schema Validation check
  await test('POST /api/v1/apps/:id/run rejects missing required schema inputs with 400', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/apps/healthcare-intelligence/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ inputs: {} }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Blueprint Schema Validation Failed');
  });

  // 6. Execute all 6 industry blueprints through NEXUS 2.2 workflow engine with synthetic demo data
  await test('All 6 industry blueprints execute through WorkflowEngine with fidelity labels & approval gates', async () => {
    const blueprintIds = [
      { id: 'education-intelligence', expectedStatus: 'completed' },
      { id: 'healthcare-intelligence', expectedStatus: 'pending_approval' },
      { id: 'finance-intelligence', expectedStatus: 'pending_approval' },
      { id: 'security-intelligence', expectedStatus: 'pending_approval' },
      { id: 'environmental-intelligence', expectedStatus: 'pending_approval' },
      { id: 'coastal-intelligence', expectedStatus: 'pending_approval' },
    ];

    for (const bp of blueprintIds) {
      const runRes = await fetch(`${BASE_URL}/api/v1/apps/${bp.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ useSyntheticDemo: true }),
      });
      assert.strictEqual(runRes.status, 200, `${bp.id} run failed`);
      const runData = await runRes.json();

      assert.strictEqual(runData.blueprintId, bp.id);
      assert.strictEqual(runData.usedSyntheticData, true);
      assert.strictEqual(runData.fidelity.isSimulated, true);
      assert.ok(runData.runId, `${bp.id} missing runId`);
      assert.strictEqual(runData.status, bp.expectedStatus, `${bp.id} unexpected status ${runData.status}`);

      if (bp.expectedStatus === 'pending_approval') {
        const approveRes = await fetch(`${BASE_URL}/api/v1/workflows/runs/${runData.runId}/approve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(approveRes.status, 200, `${bp.id} approval failed`);
        const approveData = await approveRes.json();
        assert.strictEqual(approveData.status, 'completed');
      }
    }
  });

  console.log(`\n[BLUEPRINT RESULTS] ${passed}/${total} targeted blueprint integration tests passed.`);
}

runBlueprintsVerification().catch((err) => {
  console.error('[BLUEPRINT TEST RUNNER ERROR]', err);
  process.exit(1);
});
