const { pool } = require("../lib/db");
const crypto = require("crypto");

// Attaches key metadata to req.apiKey if valid, else 401
async function authMiddleware(req, res, next) {
  const rawKey = req.headers["x-api-key"];

  if (!rawKey) {
    return res.status(401).json({ error: "Missing x-api-key header" });
  }

  // Hash the incoming key to compare against stored hash
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const result = await pool.query(
    `SELECT ak.id, ak.tier, ak.status,
            qc.req_limit, qc.window_seconds
     FROM api_keys ak
     JOIN quota_config qc ON qc.tier = ak.tier
     WHERE ak.key_hash = $1`,
    [keyHash],
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  const key = result.rows[0];

  if (key.status === "revoked") {
    return res.status(401).json({ error: "API key has been revoked" });
  }

  // Attach key info for downstream middleware
  req.apiKey = key;
  next();
}

module.exports = authMiddleware;
