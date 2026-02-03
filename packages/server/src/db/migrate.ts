import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  console.log('Running database migrations...');

  const sql = postgres(config.databaseUrl, {
    max: 1,
  });

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../../../../migrations/0001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute migration
    await sql.unsafe(migrationSQL);

    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
