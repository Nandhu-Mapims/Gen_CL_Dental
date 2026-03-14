const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

/**
 * Sanitize MongoDB URI for logging: mask password.
 * e.g. mongodb://user:secret@host:27017/db -> mongodb://user:****@host:27017/db
 */
function sanitizeUriForLog(uri) {
  if (!uri || typeof uri !== 'string') return '(invalid)';
  return uri.replace(/:([^:@]+)@/, ':****@');
}

const connectDB = async (retries = 10, delay = 2000) => {
  const sanitized = sanitizeUriForLog(MONGO_URI);
  const dbName = (MONGO_URI.match(/\/([^/?]+)(\?|$)/) || [])[1] || '(unknown)';
  console.log('Attempting to connect to MongoDB at', sanitized, '→ database:', dbName);

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('✅ MongoDB connected successfully (database:', dbName + ')');
      return;
    } catch (err) {
      const errorMsg = err.message || err.toString();
      console.error(`MongoDB connection attempt ${i + 1}/${retries} failed:`, errorMsg);

      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error('❌ Failed to connect to MongoDB after all retries');
        console.error('Please ensure:');
        console.error('  1. MongoDB container is running and reachable');
        console.error('  2. MONGO_URI is correct (host, credentials, database)');
        console.error('  3. In Docker Compose, backend and mongo are on the same network');
        if (errorMsg.includes('ENOTFOUND')) {
          console.error('  4. DNS resolution failed - check service name (e.g. mongo) in MONGO_URI');
        }
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
