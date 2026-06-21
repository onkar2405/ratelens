const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function connectDb() {
  const client = await pool.connect();
  console.log("Postgres connected");
  client.release();
}

module.exports = { pool, connectDb };
