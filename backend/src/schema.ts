import { pgTable, serial, varchar, integer } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  price: integer('price').notNull(),
  discount: integer('discount').notNull().default(0),
  inventory: integer('inventory').notNull().default(100),
});
