require("dotenv").config();
const express = require("express");
const { connectRedis } = require("./lib/redis");
const { connectKafka } = require("./lib/kafka");
const { connectDb } = require("./lib/db");
const authMiddleware = require("./middleware/auth");
const proxyMiddleware = require("./middleware/proxy");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(express.json());

// Health check (no auth needed)
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Admin API — key management
app.use("/admin", adminRoutes);

// All other routes — auth + proxy to dummy backend
app.use("/api", authMiddleware, proxyMiddleware);

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
