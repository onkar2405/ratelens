require("dotenv").config();
const express = require("express");
const { connectRedis } = require("./lib/redis");
const { connectKafka } = require("./lib/kafka");
const { connectDb } = require("./lib/db");
const authMiddleware = require("./middleware/auth");
const rateLimiterMiddleware = require("./middleware/rateLimiter");
const proxyMiddleware = require("./middleware/proxy");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(express.json());

// Health check (no auth needed)
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Admin API — key management (no rate limiting on admin)
app.use("/admin", adminRoutes);

// All API routes — auth → rate limit → proxy
// Order matters: auth sets req.apiKey, rate limiter reads it
app.use("/api", authMiddleware, rateLimiterMiddleware, proxyMiddleware);

async function start() {
  await connectDb();
  await connectRedis();
  await connectKafka();

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Gateway running on port ${port}`));
}

start().catch((err) => {
  console.error("Failed to start gateway:", err);
  process.exit(1);
});
