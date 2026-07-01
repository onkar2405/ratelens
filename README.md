# RateLens

A distributed API key management and rate limiting platform.  
Built to demonstrate real-world system design: Redis, Kafka, PostgreSQL, Memcached, API Gateway pattern.

## Demo
<video src="https://github.com/user-attachments/assets/153d2871-f3b2-4f3d-afdf-adff43247735"></video>

## Architecture

```
Client → API Gateway → Redis (rate limit check)
                     → Dummy Backend (proxied request)
                     → Kafka (async usage event)
                          → Consumer Worker → PostgreSQL
                                           → Memcached (cache invalidation)
Dashboard → Admin API → PostgreSQL / Memcached
```

## Services

| Service        | Port  | Description                          |
|----------------|-------|--------------------------------------|
| Gateway        | 3000  | API Gateway — auth, rate limit, proxy|
| Dummy Backend  | 4000  | Proxied backend with sample endpoints|
| PostgreSQL     | 5432  | Persistent store for keys + events   |
| Redis          | 6379  | Sliding window rate limiter          |
| Kafka          | 9092  | Usage event stream                   |
| Memcached      | 11211 | Dashboard quota cache                |
| Kafka UI       | 8080  | Visual Kafka topic browser           |

## Getting started

### 1. Start infrastructure
```bash
docker-compose up -d
```
Wait ~20 seconds for Kafka to be ready.

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Start services (3 terminals)
```bash
# Terminal 1
npm run gateway

# Terminal 2
npm run worker

# Terminal 3
npm run backend
```

### 4. Run verification
```bash
node test-week1.js
```

### 5. Check Kafka UI
Open http://localhost:8080 — you should see usage events flowing into the `usage-events` topic.

## API Reference

### Admin API

```bash
# Create a key
curl -X POST http://localhost:3000/admin/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "tier": "test"}'

# List keys
curl http://localhost:3000/admin/keys

# Revoke a key
curl -X DELETE http://localhost:3000/admin/keys/:id

# Change tier
curl -X PATCH http://localhost:3000/admin/keys/:id \
  -H "Content-Type: application/json" \
  -d '{"tier": "pro"}'
```

### Using a key
```bash
curl http://localhost:3000/api/users \
  -H "x-api-key: rl_your_key_here"
```

## Key design decisions

**Why Redis for rate limiting, not Postgres?**  
Redis `INCR` is atomic — no race conditions possible at high concurrency. Postgres row-level locks under the same pattern would serialize requests and become a bottleneck.

**Why Kafka instead of writing usage directly to Postgres?**  
The hot path (serving the request) should not wait for analytics writes. Kafka decouples them — the gateway emits an event in <1ms and moves on. The worker batches and writes asynchronously.

**Why Memcached for the dashboard, not Redis?**  
Quota summaries are read-heavy and can tolerate 30s staleness. Memcached is simpler and faster for pure read cache. Redis is reserved for the rate limiter where atomic operations matter.

## Tiers

| Tier        | Limit       | Window |
|-------------|-------------|--------|
| test        | 10 requests | 1 min  |
| free        | 100 requests| 1 day  |
| pro         | 10,000 req  | 1 day  |
| enterprise  | Unlimited   | —      |
