const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { pool } = require("../lib/db");
const { v4: uuidv4 } = require("uuid");

// Generate a new API key
function generateApiKey() {
  return `rl_${crypto.randomBytes(24).toString("hex")}`;
}

// POST /admin/keys — create a new key
router.post("/keys", async (req, res) => {
  const { name, tier = "free", owner_email } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  const rawKey = generateApiKey();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const result = await pool.query(
    `INSERT INTO api_keys (id, key_hash, name, tier, owner_email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, tier, status, created_at`,
    [uuidv4(), keyHash, name, tier, owner_email]
  );

  // Return the raw key ONCE — we never store it
  res.status(201).json({
    ...result.rows[0],
    key: rawKey,
    message: "Store this key safely. It will not be shown again.",
  });
});

// GET /admin/keys — list all keys (without raw keys obviously)
router.get("/keys", async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, tier, status, owner_email, created_at, revoked_at
     FROM api_keys ORDER BY created_at DESC`
  );
  res.json(result.rows);
});

// DELETE /admin/keys/:id — revoke a key
router.delete("/keys/:id", async (req, res) => {
  const result = await pool.query(
    `UPDATE api_keys SET status = 'revoked', revoked_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING id, name`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Key not found or already revoked" });
  }

  res.json({ message: "Key revoked", ...result.rows[0] });
});

// PATCH /admin/keys/:id — change tier
router.patch("/keys/:id", async (req, res) => {
  const { tier } = req.body;
  if (!tier) return res.status(400).json({ error: "tier is required" });

  const result = await pool.query(
    `UPDATE api_keys SET tier = $1 WHERE id = $2
     RETURNING id, name, tier`,
    [tier, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Key not found" });
  }

  res.json(result.rows[0]);
});

module.exports = router;
