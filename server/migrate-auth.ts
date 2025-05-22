/**
 * Migration script to set up the new authentication system
 * This safely transitions from the old user system to Replit Auth
 */
import { db } from "./db";
import { sql } from "drizzle-orm";

export async function migrateToAuth() {
  try {
    console.log("🔄 Migrating to new authentication system...");

    // Create sessions table for Replit Auth
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar PRIMARY KEY,
        sess jsonb NOT NULL,
        expire timestamp NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);
    `);

    // Recreate users table with new Replit Auth structure
    await db.execute(sql`
      DROP TABLE IF EXISTS users CASCADE;
    `);

    await db.execute(sql`
      CREATE TABLE users (
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

    // Update files table to use varchar for user_id
    await db.execute(sql`
      ALTER TABLE files 
      ALTER COLUMN user_id TYPE varchar;
    `);

    // Update grading_jobs table to use varchar for user_id
    await db.execute(sql`
      ALTER TABLE grading_jobs
      ADD COLUMN IF NOT EXISTS user_id varchar;
    `);

    console.log("✅ Authentication migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateToAuth()
    .then(() => {
      console.log("🎉 Ready for user accounts and payment plans!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to migrate:", error);
      process.exit(1);
    });
}