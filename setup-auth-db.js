import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupDatabase() {
  try {
    console.log('🔄 Setting up authentication tables...');

    // Create sessions table for authentication
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar PRIMARY KEY,
        sess jsonb NOT NULL,
        expire timestamp NOT NULL
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);
    `);

    // Create users table with authentication fields (matching schema.ts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id varchar PRIMARY KEY,
        email varchar UNIQUE,
        first_name varchar,
        last_name varchar,
        profile_image_url varchar,
        stripe_customer_id varchar,
        stripe_subscription_id varchar,
        subscription_status varchar DEFAULT 'free',
        monthly_assessments integer DEFAULT 0,
        last_reset_date timestamp DEFAULT NOW(),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);

    // Add missing columns if they don't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS first_name varchar,
      ADD COLUMN IF NOT EXISTS last_name varchar,
      ADD COLUMN IF NOT EXISTS profile_image_url varchar,
      ADD COLUMN IF NOT EXISTS stripe_customer_id varchar,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar,
      ADD COLUMN IF NOT EXISTS subscription_status varchar DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS monthly_assessments integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_reset_date timestamp DEFAULT NOW();
    `);

    console.log('✅ Authentication tables created successfully!');
    console.log('🎉 You can now use the login functionality!');
    
  } catch (error) {
    console.error('❌ Failed to set up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();