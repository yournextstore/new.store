import { Pool } from 'pg';

let pool: Pool;

try {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
  }
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    // Add SSL config if needed for Neon or other providers
    // ssl: { rejectUnauthorized: false } // Example for Neon, adjust as necessary
  });

  // Test connection on initialization (optional but recommended)
  pool
    .query('SELECT NOW()')
    .then(() => {
      console.log('Database pool connected successfully.');
    })
    .catch((err) => {
      console.error('Database pool connection failed:', err);
      // Depending on requirements, you might want to throw or handle differently
    });
} catch (error) {
  console.error('Failed to initialize database pool:', error);
  // Handle critical initialization error - maybe the app can't run without DB?
  // For now, log the error. The absence of the pool will cause errors later.
  pool = null as any; // Set pool to null/invalid state if init fails
}

export { pool };
