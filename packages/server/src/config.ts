import { config as loadEnv } from 'dotenv';

loadEnv();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://trust:trust@localhost:5432/trust_infra',
  database: {
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30', 10),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10', 10),
  },

  // Authentication
  serviceApiKey: process.env.SERVICE_API_KEY || 'dev-service-key-change-in-production',

  // Security
  signatureTimestampWindow: parseInt(process.env.SIGNATURE_TIMESTAMP_WINDOW || '300', 10), // 5 minutes

  // Rate limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  prettyLogs: process.env.PRETTY_LOGS === 'true' || process.env.NODE_ENV === 'development',
};

export type Config = typeof config;
