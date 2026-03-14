/**
 * Single source of truth for environment configuration.
 * - Production (Docker): reads from process.env (set by container).
 * - Local dev: loads .env via dotenv, then reads process.env.
 */
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const loadDotenv = process.env.LOAD_DOTENV === 'true' || process.env.LOAD_DOTENV === '1';

if (!isProduction || loadDotenv) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

// Required
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!JWT_SECRET || String(JWT_SECRET).trim() === '') {
  console.error('❌ CRITICAL: JWT_SECRET is not set.');
  console.error('   Set JWT_SECRET in Docker environment or in .env for local dev.');
  console.error('   Example: JWT_SECRET=your-secret-at-least-32-chars');
  process.exit(1);
}

if (!MONGO_URI || String(MONGO_URI).trim() === '') {
  console.error('❌ CRITICAL: MONGO_URI is not set.');
  console.error('   Set MONGO_URI in Docker environment or in .env for local dev.');
  console.error('   Example: mongodb://admin:password@mongo:27017/mrd_audit?authSource=admin');
  process.exit(1);
}

module.exports = {
  PORT: Number(process.env.PORT) || 5000,
  JWT_SECRET,
  MONGO_URI,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
