import Fastify from 'fastify';
import cors from '@fastify/cors';
import Redis from 'ioredis';
import { db, initDatabase } from './db.js';
import { products } from './schema.js';
import { eq } from 'drizzle-orm';
import {
  timeRoute,
  cacheHits,
  cacheMisses,
  dbReads,
  register,
} from './metrics.js';

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', err => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

const CACHE_TTL = 30;

// Simulate realistic network latency for demo purposes
const SIMULATE_DB_LATENCY_MS = 50; // Typical database query over network
const SIMULATE_CACHE_LATENCY_MS = 2; // Redis is fast but not instant

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getProductRow(route: string, sku: string) {
  await sleep(SIMULATE_DB_LATENCY_MS); // Simulate DB network latency
  const [row] = await db.select().from(products).where(eq(products.sku, sku));
  dbReads.inc({ route }, 1);
  return row;
}

// Main product endpoint with cache-aside pattern
app.get('/cache/:sku', async (req, reply) => {
  const end = timeRoute('GET', '/cache/:sku');
  try {
    const sku = (req.params as any).sku;
    const key = `product:${sku}`;
    await sleep(SIMULATE_CACHE_LATENCY_MS); // Simulate cache network latency
    const cached = await redis.get(key);
    if (cached) {
      cacheHits.inc({ route: '/cache/:sku' });
      end(200);
      return reply.send({ ...JSON.parse(cached), cached: true });
    }
    cacheMisses.inc({ route: '/cache/:sku' });
    const row = await getProductRow('/cache/:sku', sku);
    await redis.set(key, JSON.stringify(row), 'EX', CACHE_TTL);
    end(200);
    return reply.send({ ...row, cached: false });
  } catch (e: any) {
    end(500);
    return reply.status(500).send({ error: e.message });
  }
});

// Direct database endpoint (no cache) for comparison
app.get('/nocache/:sku', async (req, reply) => {
  const end = timeRoute('GET', '/nocache/:sku');
  try {
    const row = await getProductRow('/nocache/:sku', (req.params as any).sku);
    end(200);
    return reply.send({ ...row, cached: false });
  } catch (e: any) {
    end(500);
    return reply.status(500).send({ error: e.message });
  }
});

// Simulate load - generates traffic to warm cache
app.post('/simulate-load', async (req, reply) => {
  const end = timeRoute('POST', '/simulate-load');
  try {
    const { count = 10 } = req.body as { count?: number };

    // Generate requests to warm cache
    const promises = [];
    for (let i = 1; i <= count; i++) {
      promises.push(
        fetch(`http://localhost:3000/cache/SKU-${i}`).catch(() => null)
      );
    }
    await Promise.all(promises);

    end(200);
    return reply.send({
      success: true,
      message: `Generated ${count} requests to warm cache`,
    });
  } catch (e: any) {
    end(500);
    return reply.status(500).send({ error: e.message });
  }
});

app.get('/metrics', async (_, reply) => {
  const body = await register.metrics();
  reply.header('Content-Type', register.contentType);
  return reply.send(body);
});

// Reset endpoint - clears all cache, metrics, and optionally database
app.post('/reset', async (_request, reply) => {
  const timer = timeRoute('POST', '/reset');

  try {
    // Clear Redis cache
    await redis.flushdb();
    console.log('Redis cache cleared');

    // Reset Prometheus metrics
    cacheHits.reset();
    cacheMisses.reset();
    dbReads.reset();
    console.log('Prometheus metrics reset');

    timer(200);

    return reply.send({
      success: true,
      message:
        'Reset completed. Note: Grafana charts show historical data from Prometheus and will clear as the 1-minute time window passes.',
      cleared: {
        cache: true,
        metrics: true,
      },
      note: 'Charts will be empty in ~60 seconds as old data ages out of the 1-minute window.',
    });
  } catch (e: any) {
    timer(500);
    console.error('Reset error:', e.message);
    return reply.status(500).send({ error: e.message });
  }
});

// Initialize database and start server
await initDatabase();
await app.listen({ port: 3000, host: '0.0.0.0' });
console.log(`Fastify backend running on :3000`);
