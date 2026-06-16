const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "ratelens",
  password: "ratelens",
  database: "ratelens",
});

async function connectDb() {
  const client = await pool.connect();
  console.log("Postgres connected");
  client.release();
}

module.exports = { pool, connectDb };
