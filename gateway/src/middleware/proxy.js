const { createProxyMiddleware } = require("http-proxy-middleware");
const { emitUsageEvent } = require("../lib/kafka");

const proxy = createProxyMiddleware({
  target: process.env.DUMMY_BACKEND_URL,
  changeOrigin: true,
  logLevel: "debug",
});

function proxyMiddleware(req, res, next) {
  req._startTime = Date.now();

  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const latency = Date.now() - req._startTime;
    console.log(
      "← Response sent, status:",
      res.statusCode,
      "latency:",
      latency,
    );

    emitUsageEvent({
      key_id: req.apiKey.id,
      endpoint: req.path,
      method: req.method,
      status_code: res.statusCode,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error("Kafka emit failed:", err));

    return originalEnd(...args);
  };

  proxy(req, res, next);
}

module.exports = proxyMiddleware;
