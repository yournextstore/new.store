import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for serverless environments
neonConfig.webSocketConstructor = ws;

let pool: Pool;

try {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is not set.');
  }

  // Initialize the serverless pool
  pool = new Pool({
    connectionString,
    // Note: SSL configuration might be handled automatically by neonConfig
    // or may need specific settings depending on your Neon project setup.
    // ssl: { rejectUnauthorized: false } // Keep if needed, verify Neon docs
  });

  // Test connection on initialization (optional but recommended)
  pool
    .query('SELECT NOW()')
    .then(() => {
      console.log(
        'Main database pool connected successfully using serverless driver.',
      );
    })
    .catch((err) => {
      console.error('Main database pool connection failed:', err);
      // Depending on requirements, you might want to throw or handle differently
    });
} catch (error) {
  console.error('Failed to initialize main database pool:', error);
  // Handle critical initialization error - maybe the app can't run without DB?
  // For now, log the error. The absence of the pool will cause errors later.
  pool = null as any; // Set pool to null/invalid state if init fails
}

export { pool };
