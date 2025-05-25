import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
const result = dotenv.config();

// Provide helpful messages for local development
if (result.error) {
  // Only show warning in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('\x1b[33m%s\x1b[0m', 'Warning: No .env file found. Using environment variables from the system.');
    console.log('\x1b[33m%s\x1b[0m', 'You can create an .env file based on .env.example for local development.');
  }
}

// Configuration object with defaults
export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration 
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  },
  
  // AI service API keys
  ai: {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY, 
    anthropic: process.env.ANTHROPIC_API_KEY
  },
  
  // File upload configuration
  uploads: {
    directory: path.join(process.cwd(), 'uploads'),
    maxFileSize: 50 * 1024 * 1024, // 50MB
  },
  
  // Testing mode configuration
  testing: {
    useMockGrading: process.env.USE_MOCK_GRADING === 'true' || process.env.NODE_ENV === 'development'
  }
};

// Create uploads directory if it doesn't exist
if (!fs.existsSync(config.uploads.directory)) {
  fs.mkdirSync(config.uploads.directory, { recursive: true });
}

// Helper function to check if API keys are available
export function getAvailableAIServices(): string[] {
  const available = [];
  if (config.ai.gemini) available.push('gemini');
  if (config.ai.openai) available.push('openai');
  if (config.ai.anthropic) available.push('anthropic');
  return available;
}

// Helper for checking database configuration
export function isDatabaseConfigured(): boolean {
  return !!config.database.url;
}

export default config;