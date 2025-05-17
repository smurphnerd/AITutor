import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import config from './config';

// Configure Neon database for WebSocket support
neonConfig.webSocketConstructor = ws;

// Check for database connection string
if (!config.database.url) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database or create an .env file?",
  );
}

// Create database connection pool
export const pool = new Pool({ connectionString: config.database.url });

// Initialize Drizzle ORM with our schema
export const db = drizzle({ client: pool, schema });