// =============================================================
// Create admin user for Lumi Design
// Usage: node scripts/create-admin.mjs
// =============================================================
// This script generates a bcrypt hash and outputs the SQL
// you need to run in Supabase SQL Editor.
// =============================================================

const email = process.argv[2] || 'admin@lumidesign.vn';
const password = process.argv[3] || 'admin123';

async function main() {
  // Dynamically import bcryptjs (lightweight, no native deps)
  let bcrypt;
  try {
    bcrypt = await import('bcryptjs');
  } catch {
    console.error('bcryptjs not installed. Install it:');
    console.error('  npm install bcryptjs');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  console.log(`
-- ============================================================
-- Admin user for Lumi Design
-- Email: ${email}
-- Password: ${password}
-- IMPORTANT: Change password after first login!
-- Run this in Supabase SQL Editor:
-- ============================================================

INSERT INTO admin_users (email, password_hash, role, is_active)
VALUES (
  '${email}',
  '${hash}',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  is_active = true;

-- Verify:
SELECT id, email, role, is_active, created_at FROM admin_users;
`);
}

main().catch(console.error);
