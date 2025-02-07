import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a pool that can be used by connect-pg-simple for session storage
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create drizzle database instance for queries
export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});