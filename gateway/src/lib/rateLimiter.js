const { redis } = require("./redis");

/**
 * Sliding window rate limiter using Redis sorted sets.
 *
 * For each API key we maintain a sorted set:
 *   Key:    ratelimit:{key_id}
 *   Member: unique request id (timestamp:random)
 *   Score:  request timestamp in milliseconds
 *
 * On every request we run a Lua script atomically that:
 *   1. Removes members outside the current window
 *   2. Counts remaining members
 *   3. If over limit → returns {allowed: false}
 *   4. Else → adds current request → returns {allowed: true}
 *
 * Why Lua? Redis executes Lua scripts atomically — no other
 * command can run between our steps. This prevents race conditions
 * where two requests both read count=99 and both get allowed through.
 */

const slidingWindowScript = `
  local key        = KEYS[1]
  local now        = tonumber(ARGV[1])
  local window_ms  = tonumber(ARGV[2])
  local limit      = tonumber(ARGV[3])
  local req_id     = ARGV[4]

  local window_start = now - window_ms

  -- Step 1: remove requests outside the current window
  redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

  -- Step 2: count requests inside the window
  local count = redis.call('ZCARD', key)

  -- Step 3: check against limit (0 = unlimited for enterprise)
  if limit > 0 and count >= limit then
    -- get the oldest request score so we can tell client when to retry
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_ts = oldest[2] or now
    local retry_after = math.ceil((tonumber(oldest_ts) + window_ms - now) / 1000)
    return {0, count, limit, retry_after}
  end

  -- Step 4: add current request to the window
  redis.call('ZADD', key, now, req_id)

  -- Set TTL so keys auto-expire (no manual cleanup needed)
  redis.call('PEXPIRE', key, window_ms)

  return {1, count + 1, limit, 0}
`;

/**
 * Check and record a request for a given API key.
 *
 * @param {string} keyId       - UUID of the API key
 * @param {number} limit       - max requests allowed in window
 * @param {number} windowSecs  - window size in seconds
 * @returns {{ allowed: boolean, count: number, limit: number, retryAfter: number }}
 */
async function checkRateLimit(keyId, limit, windowSecs) {
  // Enterprise tier (limit = 0) → always allow, skip Redis
  if (limit === 0) {
    return { allowed: true, count: 0, limit: 0, retryAfter: 0 };
  }

  const now       = Date.now();
  const windowMs  = windowSecs * 1000;
  const reqId     = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  const redisKey  = `ratelimit:${keyId}`;

  const [allowed, count, lim, retryAfter] = await redis.eval(
    slidingWindowScript,
    1,           // number of keys
    redisKey,    // KEYS[1]
    now,         // ARGV[1]
    windowMs,    // ARGV[2]
    limit,       // ARGV[3]
    reqId        // ARGV[4]
  );

  return {
    allowed:    allowed === 1,
    count:      count,
    limit:      lim,
    retryAfter: retryAfter,
  };
}

module.exports = { checkRateLimit };
