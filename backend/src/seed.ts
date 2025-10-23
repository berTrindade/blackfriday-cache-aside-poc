import { db } from './db.js';
import { products } from './schema.js';
import { eq } from 'drizzle-orm';

const base = Array.from({ length: 100 }).map((_, i) => ({
  sku: `SKU-${i + 1}`,
  name: `Product ${i + 1}`,
  price: 1000 + (i + 1) * 5,
  discount: 0,
  inventory: 1000 - (i + 1) * 2,
}));

await db
  .insert(products)
  .values(base)
  .onConflictDoNothing({ target: products.sku });
for (const p of base) {
  await db.update(products).set(p).where(eq(products.sku, p.sku));
}
console.log('seeded 100 products');
