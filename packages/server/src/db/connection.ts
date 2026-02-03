import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';
import { config } from '../config.js';

// Create postgres connection
const queryClient = postgres(config.databaseUrl, {
  max: config.database.maxConnections,
  idle_timeout: config.database.idleTimeout,
  connect_timeout: config.database.connectTimeout,
});

// Create drizzle instance
export const db = drizzle(queryClient, { schema });

// Export for cleanup
export const closeDatabase = async () => {
  await queryClient.end();
};
