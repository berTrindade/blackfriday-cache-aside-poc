import Fastify from 'fastify';
import cors from '@fastify/cors';
import Redis from 'ioredis';
import { db, initDatabase } from './db.js';
import {
  products,
  product_variants,
  inventory_locations,
  product_reviews,
  price_history,
} from './schema.js';
import { eq, sql, avg } from 'drizzle-orm';
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

// Enriched product data interface
interface EnrichedProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  discount: number;
  inventory: number;
  category: string | null;
  brand: string | null;
  description: string | null;
  // Enriched fields from queries
  variants: Array<{
    name: string;
    sku: string;
    price: number;
    inventory: number;
  }>;
  totalInventory: number;
  warehouseStock: Array<{
    warehouse: string;
    available: number;
  }>;
  avgRating: number | null;
  reviewCount: number;
  priceHistory: Array<{
    price: number;
    discount: number;
  }>;
  finalPrice: number;
  savings: number;
  cached?: boolean;
}

// Fetch and enrich product data with multiple queries
async function getEnrichedProduct(
  route: string,
  sku: string
): Promise<EnrichedProduct | null> {
  // Main product query
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.sku, sku));
  dbReads.inc({ route }, 1);

  if (!product) return null;

  // Query variants
  const variantsData = await db
    .select()
    .from(product_variants)
    .where(eq(product_variants.product_id, product.id));
  dbReads.inc({ route }, 1);

  // Query inventory across warehouses
  const inventoryData = await db
    .select()
    .from(inventory_locations)
    .where(eq(inventory_locations.product_id, product.id));
  dbReads.inc({ route }, 1);

  // Query reviews and calculate average rating
  const reviewData = await db
    .select({
      avgRating: avg(product_reviews.rating),
      count: sql<number>`count(*)::int`,
    })
    .from(product_reviews)
    .where(eq(product_reviews.product_id, product.id));
  dbReads.inc({ route }, 1);

  // Query recent price history
  const historyData = await db
    .select()
    .from(price_history)
    .where(eq(price_history.product_id, product.id))
    .orderBy(price_history.changed_at)
    .limit(5);
  dbReads.inc({ route }, 1);

  // Calculate total available inventory across all warehouses
  const totalInventory = inventoryData.reduce(
    (sum, loc) => sum + (loc.quantity - loc.reserved),
    0
  );

  // Calculate final price with discount
  const finalPrice = Math.round(product.price * (1 - product.discount / 100));
  const savings = product.price - finalPrice;

  // Build enriched product object
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    discount: product.discount,
    inventory: product.inventory,
    category: product.category || null,
    brand: product.brand || null,
    description: product.description || null,
    variants: variantsData.map(v => ({
      name: v.variant_name,
      sku: v.sku,
      price: product.price + v.price_modifier,
      inventory: v.inventory,
    })),
    totalInventory,
    warehouseStock: inventoryData.map(loc => ({
      warehouse: loc.warehouse,
      available: loc.quantity - loc.reserved,
    })),
    avgRating: reviewData[0]?.avgRating
      ? Number(reviewData[0].avgRating)
      : null,
    reviewCount: reviewData[0]?.count || 0,
    priceHistory: historyData.map(h => ({
      price: h.price,
      discount: h.discount,
    })),
    finalPrice,
    savings,
  };
}

// Main product endpoint with cache-aside pattern
app.get('/cache/:sku', async (req, reply) => {
  const end = timeRoute('GET', '/cache/:sku');
  try {
    const sku = (req.params as any).sku;
    const key = `product:${sku}`;

    // Check cache first
    const cached = await redis.get(key);
    if (cached) {
      cacheHits.inc({ route: '/cache/:sku' });
      end(200);
      const data = JSON.parse(cached);
      return reply.send({ ...data, cached: true });
    }

    // Cache miss - fetch from database with enrichment
    cacheMisses.inc({ route: '/cache/:sku' });
    const enrichedProduct = await getEnrichedProduct('/cache/:sku', sku);

    if (!enrichedProduct) {
      end(404);
      return reply.status(404).send({ error: 'Product not found' });
    }

    // Store enriched data in cache
    await redis.set(key, JSON.stringify(enrichedProduct), 'EX', CACHE_TTL);
    end(200);
    return reply.send({ ...enrichedProduct, cached: false });
  } catch (e: any) {
    end(500);
    return reply.status(500).send({ error: e.message });
  }
});

// Direct database endpoint (no cache) for comparison
app.get('/nocache/:sku', async (req, reply) => {
  const end = timeRoute('GET', '/nocache/:sku');
  try {
    const enrichedProduct = await getEnrichedProduct(
      '/nocache/:sku',
      (req.params as any).sku
    );

    if (!enrichedProduct) {
      end(404);
      return reply.status(404).send({ error: 'Product not found' });
    }

    end(200);
    return reply.send({ ...enrichedProduct, cached: false });
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
