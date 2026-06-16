/**
 * Week 1 verification script
 * Run after all services are up: node test-week1.js
 */

const BASE = "http://localhost:3000";
const ADMIN = `${BASE}/admin`;

async function run() {
  console.log("\n=== RateLens Week 1 Verification ===\n");

  // 1. Health check
  log("1. Gateway health check...");
  const health = await get(`${BASE}/health`);
  assert(health.status === "ok", "Gateway health check failed");
  pass("Gateway is up");

  // 2. Create a test-tier key
  log("2. Creating a test-tier API key...");
  const created = await post(`${ADMIN}/keys`, {
    name: "Test Key",
    tier: "test",
    owner_email: "dev@ratelens.local",
  });
  assert(created.key?.startsWith("rl_"), "Key should start with rl_");
  assert(created.id, "Should have an id");
  const { key, id } = created;
  pass(`Key created: ${key.slice(0, 16)}...`);

  // 3. Hit a proxied endpoint with valid key
  log("3. Hitting /api/users with valid key...");
  const users = await get(`${BASE}/api/users`, { "x-api-key": key });
  assert(users.data, "Should get data from dummy backend");
  pass("Proxied request succeeded");

  // 4. Hit without key — expect 401
  log("4. Hitting /api/users without key...");
  const noKey = await getFull(`${BASE}/api/users`);
  assert(noKey.status === 401, `Expected 401, got ${noKey.status}`);
  pass("401 returned without key");

  // 5. Hit with invalid key — expect 401
  log("5. Hitting with invalid key...");
  const badKey = await getFull(`${BASE}/api/users`, { "x-api-key": "rl_bad" });
  assert(badKey.status === 401, `Expected 401, got ${badKey.status}`);
  pass("401 returned for invalid key");

  // 6. List keys
  log("6. Listing all keys...");
  const keys = await get(`${ADMIN}/keys`);
  assert(Array.isArray(keys), "Should return array");
  assert(keys.some((k) => k.id === id), "Created key should appear in list");
  pass(`${keys.length} key(s) in system`);

  // 7. Revoke key
  log("7. Revoking key...");
  const revoked = await del(`${ADMIN}/keys/${id}`);
  assert(revoked.message?.includes("revoked"), "Should confirm revocation");
  pass("Key revoked");

  // 8. Hit with revoked key — expect 401
  log("8. Hitting with revoked key...");
  const revokedReq = await getFull(`${BASE}/api/users`, { "x-api-key": key });
  assert(revokedReq.status === 401, `Expected 401, got ${revokedReq.status}`);
  pass("401 returned for revoked key");

  console.log("\n✅ All Week 1 checks passed!\n");
  console.log("Next: Check Kafka UI at http://localhost:8080");
  console.log("      to confirm usage events are flowing.\n");
}

// ---- Helpers ----

function log(msg) { process.stdout.write(`  ${msg}`); }
function pass(msg) { console.log(` ✓ ${msg}`); }
function assert(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); }

async function get(url, headers = {}) {
  const res = await fetch(url, { headers });
  return res.json();
}

async function getFull(url, headers = {}) {
  return fetch(url, { headers });
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function del(url) {
  const res = await fetch(url, { method: "DELETE" });
  return res.json();
}

run().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
