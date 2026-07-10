// =============================================================
// Deploy Supabase SQL via Management API
// =============================================================
import { readFileSync } from 'fs';

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env vars');
  process.exit(1);
}

async function main() {
  const schema = readFileSync('supabase-schema.sql', 'utf-8');
  const seed = readFileSync('supabase-seed.sql', 'utf-8');
  const sql = schema + '\n' + seed;

  const body = JSON.stringify({ query: sql });

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body,
    }
  );

  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  if (res.ok) {
    console.log('✅ Supabase SQL executed successfully');
  } else {
    console.log('❌ Failed:', text);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
