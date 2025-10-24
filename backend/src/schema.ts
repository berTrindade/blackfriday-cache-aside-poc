import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
} from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  price: integer('price').notNull(),
  discount: integer('discount').notNull().default(0),
  inventory: integer('inventory').notNull().default(100),
  category: varchar('category', { length: 100 }),
  brand: varchar('brand', { length: 100 }),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const product_variants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull(),
  variant_name: varchar('variant_name', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 64 }).notNull().unique(),
  price_modifier: integer('price_modifier').notNull().default(0),
  inventory: integer('inventory').notNull().default(0),
});

export const inventory_locations = pgTable('inventory_locations', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull(),
  warehouse: varchar('warehouse', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
});

export const product_reviews = pgTable('product_reviews', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull(),
  rating: integer('rating').notNull(),
  review_text: text('review_text'),
  created_at: timestamp('created_at').defaultNow(),
});

export const price_history = pgTable('price_history', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull(),
  price: integer('price').notNull(),
  discount: integer('discount').notNull().default(0),
  changed_at: timestamp('changed_at').defaultNow(),
});
