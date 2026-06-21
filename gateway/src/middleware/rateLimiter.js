const { checkRateLimit } = require("../lib/rateLimiter");

/**
 * Rate limiting middleware.
 * Runs AFTER auth middleware (req.apiKey is already set).
 * Runs BEFORE proxy middleware.
 *
 * Adds these headers to every response:
 *   X-RateLimit-Limit     → max requests allowed in window
 *   X-RateLimit-Remaining → requests left in current window
 *   X-RateLimit-Window    → window size in seconds
 *   Retry-After           → seconds to wait (only on 429)
 */
async function rateLimiterMiddleware(req, res, next) {
  const { id, req_limit, window_seconds } = req.apiKey;

  const result = await checkRateLimit(id, req_limit, window_seconds);

  // Always set informational headers (same pattern as GitHub, Stripe APIs)
  res.set({
    "X-RateLimit-Limit":     result.limit,
    "X-RateLimit-Remaining": Math.max(0, result.limit - result.count),
    "X-RateLimit-Window":    `${window_seconds}s`,
  });

  if (!result.allowed) {
    res.set("Retry-After", result.retryAfter);

    return res.status(429).json({
      error:       "Rate limit exceeded",
      limit:       result.limit,
      window:      `${window_seconds}s`,
      retry_after: result.retryAfter,
    });
  }

  next();
}

module.exports = rateLimiterMiddleware;
