import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

const { DATABASE_URL } = process.env;

export const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      user: 'blackfriday',
      password: 'blackfriday123',
      host: 'localhost',
      port: 5432,
      database: 'blackfriday',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

export const db = drizzle(pool, { schema });

// Auto-create tables on startup
export async function initDatabase() {
  try {
    // Create products table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        price INTEGER NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        inventory INTEGER NOT NULL DEFAULT 100,
        category VARCHAR(100),
        brand VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create product variants table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        variant_name VARCHAR(100) NOT NULL,
        sku VARCHAR(64) UNIQUE NOT NULL,
        price_modifier INTEGER NOT NULL DEFAULT 0,
        inventory INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // Create inventory locations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_locations (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        warehouse VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        reserved INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // Create product reviews table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        review_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // Create price history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        price INTEGER NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}
