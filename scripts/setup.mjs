// =============================================================
// LUMI DESIGN — Full Setup Script
// =============================================================
// 1. Reads schema SQL and seed SQL from disk
// 2. Generates a real bcrypt hash for the admin user
// 3. Outputs the complete SQL to run in Supabase SQL Editor
// =============================================================
// Usage: node scripts/setup.mjs
// =============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function main() {
  // Read schema
  const schemaPath = resolve(ROOT, 'supabase-schema.sql');
  if (!existsSync(schemaPath)) {
    console.error('Schema file not found:', schemaPath);
    process.exit(1);
  }
  const schema = readFileSync(schemaPath, 'utf-8');

  // Read seed
  const seedPath = resolve(ROOT, 'supabase-seed.sql');
  if (!existsSync(seedPath)) {
    console.error('Seed file not found:', seedPath);
    process.exit(1);
  }
  const seed = readFileSync(seedPath, 'utf-8');

  // Generate admin password hash
  const email = 'admin@lumidesign.vn';
  const password = 'admin123';
  let bcrypt;
  try {
    bcrypt = await import('bcryptjs');
  } catch {
    console.error('bcryptjs not installed. Run: npm install bcryptjs');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);

  console.log('-- ============================================================');
  console.log(`-- LUMI DESIGN — Full Database Setup`);
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log('-- ============================================================');
  console.log();
  console.log('-- 1. SCHEMA');
  console.log(schema);
  console.log();
  console.log('-- 2. SEED DATA');
  // Replace placeholder hash with real one
  const seedFixed = seed.replace(
    /'\\\$2b\\\$10\\$[A-Za-z0-9./]+'/,
    `'${hash}'`
  );
  console.log(seedFixed);
  console.log();
  console.log('-- 3. VERIFICATION');
  console.log(`SELECT count(*) as projects FROM projects;`);
  console.log(`SELECT count(*) as towers FROM towers;`);
  console.log(`SELECT count(*) as units FROM units;`);
  console.log(`SELECT count(*) as admins FROM admin_users;`);
}

main().catch(console.error);
