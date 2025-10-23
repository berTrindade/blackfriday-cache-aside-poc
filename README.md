# Black Friday Cache-Aside POC

A demonstration of the cache-aside pattern for high-traffic scenarios like Black Friday sales. This project showcases how Redis caching can improve performance by 16x compared to direct database access, with realistic simulated latencies (50ms database, 2ms cache).

## The Black Friday Challenge

Imagine it's Black Friday, and your e-commerce site expects traffic to spike 50x normal levels. Customers are racing to grab limited deals, and every millisecond counts. Without caching, your database becomes the bottleneck—each product lookup takes ~50ms, limiting you to ~185 requests/second per connection. With 10,000 concurrent users, that's disaster.

This POC demonstrates how the cache-aside pattern solves this: by caching product data in Redis, response times drop to ~3ms, and throughput jumps to ~2,900 requests/second—a **16x improvement**. Your database stays healthy, customers stay happy, and sales keep flowing.

## Architecture

This is a pnpm monorepo containing:

- **Backend**: Fastify API server with Prometheus metrics
- **Frontend**: React application with embedded Grafana charts
- **Infrastructure**: Docker services for PostgreSQL, Redis, Prometheus, and Grafana

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd blackfriday-cache-aside-poc
pnpm install

# Start infrastructure (Redis, PostgreSQL, Prometheus, Grafana)
pnpm run docker:infra

# Start backend (in separate terminal)
pnpm run backend:dev

# Start frontend (in separate terminal)
pnpm run frontend:dev
```

### Access Points

| Service    | URL                   | Description          |
| ---------- | --------------------- | -------------------- |
| Frontend   | http://localhost:5173 | Main application UI  |
| Backend    | http://localhost:3000 | API server           |
| Grafana    | http://localhost:3001 | Monitoring dashboard |
| Prometheus | http://localhost:9090 | Metrics collection   |

## Testing the Cache-Aside Pattern

### Option 1: Manual Testing (Interactive)

1. **Open the frontend**: http://localhost:5173
2. **Click "Simulate Load"**: Generates traffic to warm up the cache
3. **Watch the metrics update**:
   - Cache Hits/Misses counters increase
   - "From Cache" percentage climbs toward 90%+
   - Grafana chart shows throughput spikes
4. **Click "Reset Cache & Charts"**: Clears everything to start fresh

### Option 2: Automated Benchmark (Terminal)

Run the automated benchmark script that compares cached vs non-cached performance:

```bash
pnpm benchmark
```

**Expected Results:**

```
Throughput:
  No Cache:     ~185 req/sec
  With Cache:   ~2,900 req/sec
  Speedup:      16x faster with cache

Latency (Average):
  No Cache:     ~53 ms
  With Cache:   ~3 ms
  Reduction:    94.5% lower latency
```

The benchmark runs for ~25 seconds total:

1. First 10 seconds: Tests the cache endpoint (first miss, then all hits)
2. 5 second pause
3. Next 10 seconds: Tests direct database access (no cache)

### Option 3: Direct API Testing (cURL)

Test individual endpoints to understand the cache-aside flow:

```bash
# First request - Cache miss (goes to database)
curl http://localhost:3000/cache/SKU-1

# Second request - Cache hit (served from Redis)
curl http://localhost:3000/cache/SKU-1

# Direct database access (bypasses cache)
curl http://localhost:3000/nocache/SKU-1

# View Prometheus metrics
curl http://localhost:3000/metrics

# Generate load to warm cache (10 requests)
curl -X POST http://localhost:3000/simulate-load \
  -H "Content-Type: application/json" \
  -d '{"count": 10}'

# Reset cache and metrics
curl -X POST http://localhost:3000/reset
```

### Understanding the Metrics

**Cache Statistics:**

- **Cache Hits**: Requests served from Redis (fast)
- **Cache Misses**: Requests that went to database (slower)
- **From Cache %**: Percentage of requests served from cache (higher is better)

**Grafana Chart:**

- **Green line**: Throughput with cache (~2,900 req/sec)
- **Yellow line**: Throughput without cache (~185 req/sec)
- The 16x difference demonstrates the performance benefit

**Status Badge:**

- Appears when cache hit rate reaches 80%+
- Shows "Cache warmed up" with speedup multiplier

## Project Structure

```
.
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── server.ts       # Main server with cache-aside endpoints
│   │   ├── metrics.ts      # Prometheus metrics configuration
│   │   ├── db.ts           # PostgreSQL connection
│   │   └── schema.ts       # Database schema
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── App.tsx         # Main UI component
│   │   └── components/
│   │       └── GrafanaPanel.tsx  # Embedded Grafana charts
│   └── package.json
├── grafana/
│   └── provisioning/
│       ├── dashboards/
│       │   └── blackfriday.json  # Performance dashboard
│       └── datasources/
│           └── datasource.yml    # Prometheus connection
├── benchmark.mjs           # Automated performance test
├── docker-compose.infra.yml
├── docker-compose.yml
├── prometheus.yml
└── pnpm-workspace.yaml
```

## Key Endpoints

### Cache-Aside Pattern

- `GET /cache/:sku` - Implements cache-aside pattern (check cache, fallback to DB)
- `GET /nocache/:sku` - Direct database access (bypasses cache, for comparison)

### Load Generation & Testing

- `POST /simulate-load` - Generate traffic to warm up cache (body: `{ "count": 10 }`)

### Metrics & Control

- `GET /metrics` - Prometheus metrics endpoint
- `POST /reset` - Clear Redis cache and reset metrics

## How It Works

### Cache-Aside Flow

```
1. Request arrives for /cache/SKU-1
2. Check Redis: GET product:SKU-1
3. If found (cache hit):
   - Return immediately (~2ms)
4. If not found (cache miss):
   - Query PostgreSQL (~50ms)
   - Store in Redis with 30s TTL
   - Return result
5. Future requests served from cache until expiration
```

### Simulated Latencies

The backend includes realistic latency simulation to make the demo meaningful:

```typescript
SIMULATE_DB_LATENCY_MS = 50; // Typical database query over network
SIMULATE_CACHE_LATENCY_MS = 2; // Redis is fast but not instant
```

These delays make the performance difference visible and believable in a local environment.

## Technology Stack

**Backend:**

- Fastify 4.28.1 (API server)
- PostgreSQL with Drizzle ORM
- ioredis (Redis client)
- prom-client (Prometheus metrics)

**Frontend:**

- React 18
- Vite 5
- TypeScript
- Embedded Grafana panels

**Infrastructure:**

- Docker Compose
- PostgreSQL 16
- Redis 7
- Prometheus 2.45
- Grafana 11.2.2

**Benchmarking:**

- autocannon 7.15.0 (HTTP load testing)

## Development Scripts

```bash
# Infrastructure
pnpm run docker:infra      # Start infra services only
pnpm run docker:up         # Start all services
pnpm run docker:down       # Stop all services
pnpm docker:logs           # View logs

# Development
pnpm run backend:dev       # Start backend locally
pnpm run frontend:dev      # Start frontend locally

# Testing
pnpm benchmark             # Run performance comparison
pnpm test                  # Run unit tests
pnpm lint                  # Check code style
pnpm type-check            # TypeScript validation

# Build
pnpm build                 # Build all packages
pnpm clean                 # Clean build artifacts
```

## Troubleshooting

**Charts not showing data:**

- Run `pnpm benchmark` to generate traffic
- Charts show data for active traffic only (rate-based queries)
- Historical data appears during benchmark execution

**Backend not connecting:**

- Ensure infrastructure is running: `docker ps`
- Check DATABASE_URL and REDIS_URL in backend/.env
- Verify ports 5432 (PostgreSQL) and 6379 (Redis) are available

**Grafana dashboard empty:**

- Wait 15-30 seconds for Prometheus to scrape metrics
- Check Prometheus targets: http://localhost:9090/targets
- Verify backend metrics: http://localhost:3000/metrics

## Performance Metrics

**Typical Results:**

- Cache Hit Rate: 90%+ after warmup
- Throughput Improvement: 16x with cache
- Latency Reduction: 94.5% faster with cache
- Cache Response Time: ~3ms average
- Database Response Time: ~53ms average

## License

MIT
