// =============================================================
// Verify Supabase data
// =============================================================
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env vars');
  process.exit(1);
}

async function query(sql) {
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
  return await res.json();
}

async function main() {
  console.log('=== Projects ===');
  const projects = await query('SELECT id, name, sort_order FROM projects ORDER BY sort_order');
  console.log(JSON.stringify(projects, null, 2));

  console.log('\n=== Towers ===');
  const towers = await query('SELECT t.id, t.name, p.name as project FROM towers t JOIN projects p ON p.id = t.project_id ORDER BY p.sort_order, t.sort_order');
  console.log(JSON.stringify(towers, null, 2));

  console.log('\n=== Units ===');
  const units = await query('SELECT COUNT(*) as cnt FROM units');
  console.log(JSON.stringify(units, null, 2));
  
  const published = await query("SELECT COUNT(*) as cnt FROM units WHERE status = 'published'");
  console.log('Published:', JSON.stringify(published, null, 2));

  console.log('\n=== Admins ===');
  const admins = await query('SELECT id, email, role, is_active FROM admin_users');
  console.log(JSON.stringify(admins, null, 2));
}

main().catch(console.error);
