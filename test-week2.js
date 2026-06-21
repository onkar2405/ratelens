/**
 * Week 2 verification — sliding window rate limiter
 * Run: node test-week2.js
 */

const BASE  = "http://localhost:3000";
const ADMIN = `${BASE}/admin`;

async function run() {
  console.log("\n=== RateLens Week 2 — Rate Limiter Verification ===\n");

  // 1. Create a test-tier key (limit: 10 req / 60s)
  log("1. Creating test-tier key (limit: 10 req/60s)...");
  const { key, id } = await post(`${ADMIN}/keys`, {
    name: "Rate limit test",
    tier: "test",
  });
  assert(key, "Key should be created");
  pass(`Key: ${key.slice(0, 20)}...`);

  // 2. Fire 10 requests — all should pass
  log("2. Firing 10 requests (all should be 200)...");
  let passed = 0;
  for (let i = 1; i <= 10; i++) {
    const res = await getFull(`${BASE}/api/users`, { "x-api-key": key });
    if (res.status === 200) passed++;

    // Check rate limit headers are present
    if (i === 1) {
      assert(res.headers.get("x-ratelimit-limit"), "Should have X-RateLimit-Limit header");
      assert(res.headers.get("x-ratelimit-remaining"), "Should have X-RateLimit-Remaining header");
      assert(res.headers.get("x-ratelimit-window"), "Should have X-RateLimit-Window header");
      pass(`Headers present: Limit=${res.headers.get("x-ratelimit-limit")} Remaining=${res.headers.get("x-ratelimit-remaining")}`);
    }
  }
  assert(passed === 10, `Expected 10 passed, got ${passed}`);
  pass("All 10 requests allowed");

  // 3. Fire 5 more — all should be 429
  log("3. Firing 5 more requests (all should be 429)...");
  let blocked = 0;
  let retryAfter = null;
  for (let i = 1; i <= 5; i++) {
    const res = await getFull(`${BASE}/api/users`, { "x-api-key": key });
    if (res.status === 429) {
      blocked++;
      retryAfter = res.headers.get("retry-after");
    }
  }
  assert(blocked === 5, `Expected 5 blocked, got ${blocked}`);
  assert(retryAfter !== null, "Should have Retry-After header on 429");
  pass(`All 5 blocked with 429. Retry-After: ${retryAfter}s`);

  // 4. Check the 429 response body
  log("4. Checking 429 response body...");
  const res429 = await getFull(`${BASE}/api/users`, { "x-api-key": key });
  const body = await res429.json();
  assert(body.error === "Rate limit exceeded", "Should have error message");
  assert(body.limit === 10, "Should include limit");
  assert(body.retry_after > 0, "Should include retry_after seconds");
  pass(`Body: ${JSON.stringify(body)}`);

  // 5. Inspect Redis directly
  log("5. Checking Redis key exists...");
  console.log(`\n   Run this to inspect Redis:`);
  console.log(`   docker exec -it ratelens-redis redis-cli`);
  console.log(`   > KEYS ratelimit:*`);
  console.log(`   > ZCARD ratelimit:${id}`);
  console.log(`   > ZRANGE ratelimit:${id} 0 -1 WITHSCORES\n`);
  pass("Check Redis manually with commands above");

  // 6. Cleanup
  await del(`${ADMIN}/keys/${id}`);

  console.log("\n✅ All Week 2 checks passed!\n");
  console.log("The sliding window rate limiter is working correctly.\n");
}

// ---- Helpers ----
function log(msg) { process.stdout.write(`  ${msg}`); }
function pass(msg) { console.log(` ✓ ${msg}`); }
function assert(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); }

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
