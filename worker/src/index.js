require("dotenv").config();
const { Kafka } = require("kafkajs");
const { Pool } = require("pg");
const memjs = require("memjs");

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const memcached = memjs.Client.create(process.env.MEMCACHED_URL);

const kafka = new Kafka({
  clientId: "ratelens-worker",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const BATCH_FLUSH_MS = parseInt(process.env.BATCH_FLUSH_MS) || 5000;

let batch = [];
let flushTimer = null;

async function flushBatch() {
  if (batch.length === 0) return;

  const toFlush = [...batch];
  batch = [];

  try {
    // Build bulk insert
    const values = toFlush.map((e, i) => {
      const base = i * 5;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    }).join(", ");

    const params = toFlush.flatMap((e) => [
      e.key_id, e.endpoint, e.method, e.status_code, e.latency_ms
    ]);

    await pool.query(
      `INSERT INTO usage_events (key_id, endpoint, method, status_code, latency_ms)
       VALUES ${values}`,
      params
    );

    // Invalidate Memcached quota cache for each unique key
    const uniqueKeys = [...new Set(toFlush.map((e) => e.key_id))];
    await Promise.all(
      uniqueKeys.map((keyId) => memcached.delete(`quota:${keyId}`))
    );

    console.log(`Flushed ${toFlush.length} events to Postgres`);
  } catch (err) {
    console.error("Batch flush failed:", err);
    // Put events back — simple retry
    batch = [...toFlush, ...batch];
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushBatch, BATCH_FLUSH_MS);
}

async function start() {
  await consumer.connect();
  console.log("Kafka consumer connected");

  await consumer.subscribe({
    topic: process.env.KAFKA_TOPIC_USAGE,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      batch.push(event);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      } else {
        scheduleFlush();
      }
    },
  });

  console.log("Worker listening for usage events...");
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
