const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

redis.on("error", (err) => console.error("Redis error:", err));

async function connectRedis() {
  await redis.ping();
  console.log("Redis connected");
}

module.exports = { redis, connectRedis };
