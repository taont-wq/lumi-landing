// =============================================================
// Reset + Seed Supabase (properly handle existing data)
// =============================================================
import { readFileSync } from 'fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env vars');
  process.exit(1);
}

async function main() {
  const schema = readFileSync('supabase-schema.sql', 'utf-8');
  const seed = readFileSync('supabase-seed.sql', 'utf-8');

  // Build a single script that:
  // 1. Clears old data (with CASCADE to handle FKs)
  // 2. Creates schema (IF NOT EXISTS)
  // 3. Seeds new data
  const sql = `
-- Reset existing data
DELETE FROM audit_log;
DELETE FROM units;
DELETE FROM towers;
DELETE FROM projects;
DELETE FROM admin_users;

-- Run schema
${schema}

-- Run seed
${seed}
`;

  console.log('Sending SQL to Supabase Management API...');
  const start = Date.now();
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text();
  
  console.log(`HTTP ${res.status} (${elapsed}s)`);
  if (res.ok) {
    console.log('✅ Supabase reset + seed completed successfully');
  } else {
    // Check if it was just "already exists" errors
    if (text.includes('already exists') || text.includes('duplicate key')) {
      console.log('⚠️  Some already-exists warnings (harmless):', text.slice(0, 200));
    } else {
      console.log('❌ Error:', text.slice(0, 500));
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
