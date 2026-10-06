import { db, initDatabase } from './db.js';
import {
  products,
  product_variants,
  inventory_locations,
  product_reviews,
  price_history,
} from './schema.js';

// Initialize database tables first
await initDatabase();

const categories = [
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Sports',
  'Books',
  'Toys',
];
const brands = [
  'TechCorp',
  'FashionHub',
  'HomeStyle',
  'SportsPro',
  'ReadMore',
  'PlayTime',
];
const warehouses = ['US-East', 'US-West', 'EU-Central', 'Asia-Pacific'];

// Seed products
const baseProducts: Array<{
  sku: string;
  name: string;
  price: number;
  discount: number;
  inventory: number;
  category: string;
  brand: string;
  description: string;
}> = Array.from({ length: 100 }).map((_, i) => {
  const category = categories[i % categories.length];
  const brand = brands[i % brands.length];
  if (!category || !brand) {
    throw new Error('Missing category or brand');
  }
  return {
    sku: `SKU-${i + 1}`,
    name: `Black Friday Deal #${i + 1}`,
    price: Math.floor(1000 + Math.random() * 4000), // $10-$50 in cents
    discount: Math.floor(10 + Math.random() * 50), // 10-60% discount
    inventory: Math.floor(50 + Math.random() * 200), // 50-250 units
    category,
    brand,
    description: `Amazing ${category} product with special Black Friday pricing. Limited stock available!`,
  };
});

// Insert products
await db
  .insert(products)
  .values(baseProducts)
  .onConflictDoNothing({ target: products.sku });

// Get all products to use their IDs
const allProducts = await db.select().from(products);

// Seed product variants (2-3 variants per product)
const variants = [];
for (const product of allProducts) {
  const variantCount = 2 + Math.floor(Math.random() * 2); // 2-3 variants
  const variantTypes = ['Small', 'Medium', 'Large', 'XL'];
  const colors = ['Red', 'Blue', 'Black', 'White'];

  for (let i = 0; i < variantCount; i++) {
    const variantName =
      i < 2
        ? `${colors[i % colors.length]}`
        : `${variantTypes[i % variantTypes.length]}`;
    variants.push({
      product_id: product.id,
      variant_name: variantName,
      sku: `${product.sku}-${variantName.toUpperCase()}`,
      price_modifier: Math.floor(-200 + Math.random() * 400), // -$2 to +$2
      inventory: Math.floor(10 + Math.random() * 50),
    });
  }
}
await db.insert(product_variants).values(variants).onConflictDoNothing();

// Seed inventory across multiple warehouses
const inventoryData = [];
for (const product of allProducts) {
  for (const warehouse of warehouses) {
    inventoryData.push({
      product_id: product.id,
      warehouse,
      quantity: Math.floor(20 + Math.random() * 100),
      reserved: Math.floor(Math.random() * 10), // Some reserved for pending orders
    });
  }
}
await db.insert(inventory_locations).values(inventoryData);

// Seed product reviews (5-15 reviews per product)
const reviews: Array<{
  product_id: number;
  rating: number;
  review_text: string;
}> = [];
const reviewTexts = [
  'Great product! Highly recommend.',
  'Good value for money.',
  'Fast shipping and quality product.',
  'Exceeded my expectations!',
  'Perfect for Black Friday shopping.',
  'Excellent quality!',
  'Worth every penny.',
];
for (const product of allProducts) {
  const reviewCount = 5 + Math.floor(Math.random() * 11); // 5-15 reviews
  for (let i = 0; i < reviewCount; i++) {
    const randomIndex = Math.floor(Math.random() * reviewTexts.length);
    const text = reviewTexts[randomIndex];
    if (text) {
      reviews.push({
        product_id: product.id,
        rating: Math.floor(3 + Math.random() * 3), // 3-5 stars
        review_text: text,
      });
    }
  }
}
await db.insert(product_reviews).values(reviews);

// Seed price history (3-5 price changes per product to show Black Friday deals)
const priceHistoryData = [];
for (const product of allProducts) {
  const historyCount = 3 + Math.floor(Math.random() * 3); // 3-5 entries
  for (let i = 0; i < historyCount; i++) {
    priceHistoryData.push({
      product_id: product.id,
      price: product.price + Math.floor(-500 + Math.random() * 1000),
      discount: Math.floor(Math.random() * 30), // 0-30% discount in history
    });
  }
}
await db.insert(price_history).values(priceHistoryData);

console.log('Seeded database:');
console.log(`  - ${baseProducts.length} products`);
console.log(`  - ${variants.length} product variants`);
console.log(`  - ${inventoryData.length} inventory locations`);
console.log(`  - ${reviews.length} product reviews`);
console.log(`  - ${priceHistoryData.length} price history entries`);
