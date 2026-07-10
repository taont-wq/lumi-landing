// =============================================================
// Force seed: delete old data + insert new data
// Schema is already in place
// =============================================================
import { readFileSync } from 'fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env vars');
  process.exit(1);
}

async function runQuery(label, sql) {
  console.log(`▶️ ${label}...`);
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
  const text = await res.text();
  if (res.ok) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ❌ ${label}:`, text.slice(0, 300));
    process.exit(1);
  }
}

async function main() {
  // Step 1: Clear old data (in order to respect FKs)
  await runQuery('Delete old data', `
    DELETE FROM audit_log;
    DELETE FROM units;
    DELETE FROM towers;
    DELETE FROM projects;
    DELETE FROM admin_users;
  `);

  // Step 2: Insert projects
  const seedSQL = readFileSync('supabase-seed.sql', 'utf-8');
  // Extract only the INSERT...SELECT parts, skipping CREATE/ALTER/COMMENT
  // Since the seed file is mostly INSERT statements, just run it directly
  await runQuery('Insert seed data', seedSQL);

  console.log('\n✅ Supabase seed complete!');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
