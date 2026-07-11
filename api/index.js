// =============================================================
// LUMI DESIGN — Hono API Server
// =============================================================
// Dependencies: chỉ hono (14KB)
// Triết lý: không dùng Supabase SDK, fetch REST trực tiếp
// =============================================================
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import bcrypt from 'bcryptjs';
import { sanitize, requireFields, ALLOWED_UNIT_FIELDS } from './validate.js';
import { sendZalo, parseNewUnit } from './zalo.js';

const app = new Hono();

// =============================================================
// MIDDLEWARE
// =============================================================

// CORS — cho phép same-origin (admin page + API cùng domain trên Vercel)
// và các domain đã biết. Fallback: echo origin nếu là same-origin request.
const ALLOWED_ORIGINS = [
  'https://noithatlumi.vn',
  'https://lumidesign.vercel.app',
  'https://landingpage-eta-livid.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use('/api/*', cors({
  origin: (origin) => {
    // Same-origin (origin undefined) hoặc trong whitelist → cho phép
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return origin;
    // Fallback: echo lại origin để tránh block same-origin trên Vercel preview
    return origin;
  },
  maxAge: 86400,
}));

// Rate limit cơ bản (in-memory, mất khi Vercel cold start)
const rateLimitStore = new Map();
const RATE_LIMITS = {
  public:  { windowMs: 60000, max: 60 },
  admin:   { windowMs: 60000, max: 20 },
  zalo:    { windowMs: 60000, max: 30 },
};

function rateLimit(c, tier = 'public') {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const cfg = RATE_LIMITS[tier];
  const key = `${ip}:${tier}`;

  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + cfg.windowMs };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  // Dọn dẹp store mỗi 100 request (tránh memory leak)
  if (rateLimitStore.size > 1000) {
    const cutoff = now - 120000;
    for (const [k, v] of rateLimitStore) {
      if (v.reset < cutoff) rateLimitStore.delete(k);
    }
  }

  if (entry.count > cfg.max) return true; // blocked
  return false;
}

// =============================================================
// ADMIN AUTH — HMAC-based token (node:crypto, reliable on Vercel)
// =============================================================
import { createHmac, timingSafeEqual } from 'node:crypto';

// Tạo token cho admin user
// Format: base64url(payload).base64url(hmac_signature)
async function createAdminToken(userId, role) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;

  const payload = `${userId}:${Date.now() + 86400000}:${role}`; // 24h expiry
  const payloadB64 = Buffer.from(payload, 'utf-8').toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

// Verify và decode admin token
// Trả về { userId, role } hoặc null
async function verifyAdminToken(token) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || !token) return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, sigExpected] = parts;
    const sigActual = createHmac('sha256', secret).update(payloadB64).digest('base64url');

    // Constant-time compare để tránh timing attack
    const a = Buffer.from(sigExpected, 'base64url');
    const b = Buffer.from(sigActual, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const parts2 = payloadStr.split(':');
    if (parts2.length < 3) return null;

    const expiry = parseInt(parts2[1], 10);
    if (isNaN(expiry) || Date.now() > expiry) return null;

    return { userId: parts2[0], role: parts2[2] };
  } catch (_) {
    return null;
  }
}

// Middleware: require admin token
async function requireAdmin(c) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return 'UNAUTHORIZED';

  const token = auth.slice(7);
  const user = await verifyAdminToken(token);

  // Fallback: cho phép ADMIN_SECRET trực tiếp (server-to-server)
  if (!user && token === process.env.ADMIN_SECRET) {
    return null; // OK — dùng secret trực tiếp
  }

  if (!user) return 'UNAUTHORIZED';

  c.set('adminUser', user);
  return null; // OK
}

// Middleware: require admin role 'admin' (không phải 'editor')
async function requireSuperAdmin(c) {
  const err = await requireAdmin(c);
  if (err) return err;

  const user = c.get('adminUser');
  if (!user || user.role !== 'admin') return 'FORBIDDEN';
  return null;
}

// =============================================================
// SUPABASE HELPERS — REST API không SDK
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Gọi Supabase REST với role anon (public).
 * Chỉ SELECT được units status='published' nhờ RLS.
 */
async function sbPublic(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const { headers: optHeaders, ...rest } = options;
  return fetch(url, {
    method: rest.method || 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept': 'application/json',
      ...(optHeaders || {}),
    },
    ...rest,
  });
}

/**
 * Gọi Supabase REST với service_role (admin).
 * Bypass RLS — chỉ dùng trong admin API.
 */
async function sbAdmin(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const { headers: optHeaders, ...rest } = options;
  return fetch(url, {
    method: rest.method || 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept': 'application/json',
      ...(optHeaders || {}),
    },
    ...rest,
  });
}

/**
 * Ghi audit log (dùng service key)
 */
async function logAudit(action, target, performedBy = 'system', metadata = {}, ip = '') {
  try {
    await sbAdmin('audit_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ action, target, performed_by: performedBy, metadata, ip }),
    });
  } catch (err) {
    // Audit fail không block business logic
    console.error('Audit log error:', err.message);
  }
}

// =============================================================
// PUBLIC API ROUTES
// =============================================================

/**
 * GET /api/config — site config (từ env, không hardcode)
 */
app.get('/api/config', (c) => {
  return c.json({
    phone: process.env.PHONE_NUMBER || '',
    company: process.env.SITE_NAME || 'Lumi Design',
    companyFull: 'CÔNG TY TNHH KIẾN TRÚC & NỘI THẤT LUMI DESIGN',
    tagline: 'Nâng tầm cuộc sống',
    siteUrl: process.env.SITE_URL || '',
    logo: process.env.LOGO_URL || '',
    zalo_oa_id: process.env.ZALO_OA_ID || '',
  });
});

/**
 * GET /api/projects — danh sách dự án (active)
 */
app.get('/api/projects', async (c) => {
  try {
    if (rateLimit(c, 'public')) return c.json({ error: 'Too many requests' }, 429);

    const res = await sbPublic('projects?select=id,name,slug,description,thumbnail,sort_order&status=eq.active&order=sort_order.asc');
    if (!res.ok) {
      console.error('Supabase projects error:', res.status, await res.text().catch(() => ''));
      return c.json({ error: 'Failed to load projects' }, 502);
    }
    return c.json(await res.json());
  } catch (err) {
    console.error('GET /api/projects error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/towers?project=xxx — danh sách toà (lọc theo project)
 */
app.get('/api/towers', async (c) => {
  try {
    if (rateLimit(c, 'public')) return c.json({ error: 'Too many requests' }, 429);

    const projectId = c.req.query('project');
    if (!projectId) return c.json({ error: 'Missing project parameter' }, 400);

    const res = await sbPublic(
      `towers?select=id,name,slug,sort_order&project_id=eq.${encodeURIComponent(projectId)}&status=eq.active&order=sort_order.asc`
    );
    if (!res.ok) {
      console.error('Supabase towers error:', res.status);
      return c.json({ error: 'Failed to load towers' }, 502);
    }
    return c.json(await res.json());
  } catch (err) {
    console.error('GET /api/towers error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/units?tower=xxx&project=xxx&page=1&limit=20&search=xxx
 */
app.get('/api/units', async (c) => {
  try {
    if (rateLimit(c, 'public')) return c.json({ error: 'Too many requests' }, 429);

    const towerId = c.req.query('tower');
    const projectId = c.req.query('project');
    const search = c.req.query('search');
    const page = Math.max(1, parseInt(c.req.query('page')) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit')) || 20));
    const offset = (page - 1) * limit;

    let filter = 'status=eq.published';
    if (projectId) filter += `&project_id=eq.${encodeURIComponent(projectId)}`;
    if (towerId) filter += `&tower_id=eq.${encodeURIComponent(towerId)}`;
    if (search) filter += `&code=ilike.*${encodeURIComponent(search)}*`;

    const query = `units?select=*&${filter}&order=sort_order.asc,code.asc&limit=${limit}&offset=${offset}`;
    const countQuery = `units?select=id&${filter}&limit=0`;

    const [dataRes, countRes] = await Promise.all([
      sbPublic(query),
      sbPublic(countQuery, { method: 'HEAD', headers: { 'Prefer': 'count=exact' } }),
    ]);

    if (!dataRes.ok) {
      console.error('Supabase units error:', dataRes.status);
      return c.json({ error: 'Failed to load units' }, 502);
    }

    const total = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0');

    return c.json({
      data: await dataRes.json(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('GET /api/units error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/units/:idCode — chi tiết căn hộ (theo ID uuid hoặc code string)
 * Tự động detect: nếu param là UUID → tìm theo id, nếu không → tìm theo code
 */
app.get('/api/units/:idCode', async (c) => {
  try {
    if (rateLimit(c, 'public')) return c.json({ error: 'Too many requests' }, 429);

    const param = c.req.param('idCode');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

    let query;
    if (isUUID) {
      query = `units?select=*,project:project_id(name,slug),tower:tower_id(name,slug)&id=eq.${encodeURIComponent(param)}&limit=1`;
    } else {
      query = `units?select=*,project:project_id(name,slug),tower:tower_id(name,slug)&code=eq.${encodeURIComponent(param.toUpperCase())}&status=eq.published&limit=1`;
    }

    const res = await sbPublic(query);

    if (!res.ok) return c.json({ error: 'Failed to load unit' }, 502);

    const data = await res.json();
    if (!data.length) return c.json({ error: 'Unit not found' }, 404);

    return c.json(data[0]);
  } catch (err) {
    console.error('GET /api/units/:idCode error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/featured — căn hộ nổi bật (6 căn mới nhất)
 */
app.get('/api/featured', async (c) => {
  try {
    if (rateLimit(c, 'public')) return c.json({ error: 'Too many requests' }, 429);

    const res = await sbPublic(
      'units?select=id,code,area,bedrooms,style,images,project_id&is_featured=eq.true&status=eq.published&order=updated_at.desc&limit=6'
    );
    if (!res.ok) return c.json({ error: 'Failed to load featured' }, 502);

    return c.json(await res.json());
  } catch (err) {
    console.error('GET /api/featured error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// =============================================================
// ADMIN AUTH ROUTES
// =============================================================

/**
 * POST /api/admin/login — đăng nhập, trả về token
 */
app.post('/api/admin/login', async (c) => {
  try {
    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Email và password là bắt buộc' }, 400);

    // Tìm user trong admin_users
    const res = await sbAdmin(
      `admin_users?select=id,email,password_hash,role,is_active&email=eq.${encodeURIComponent(email)}&limit=1`
    );
    if (!res.ok) return c.json({ error: 'Login failed' }, 502);

    const users = await res.json();
    if (!users.length || !users[0].is_active) {
      return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401);
    }

    const user = users[0];

    // Verify password — dùng Web Crypto (constant-time compare)
    const pwMatch = await verifyPassword(password, user.password_hash);
    if (!pwMatch) {
      return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401);
    }

    // Tạo token
    const token = await createAdminToken(user.id, user.role);
    if (!token) return c.json({ error: 'Token creation failed' }, 500);

    // Update last_login
    await sbAdmin(`admin_users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ last_login: new Date().toISOString() }),
    });

    logAudit('admin.login', `user:${user.id}`, user.id, {}, c.req.header('x-forwarded-for') || '');

    return c.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('POST /api/admin/login error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper: verify bcrypt password
async function verifyPassword(plainText, hash) {
  try {
    return await bcrypt.compare(plainText, hash);
  } catch (_) {
    return false;
  }
}

// Helper: tạo bcrypt hash cho password (dùng khi tạo admin user)
// export để dùng trong seed script
async function hashPassword(plainText) {
  return bcrypt.hash(plainText, 10);
}

// =============================================================
// ADMIN API ROUTES (yêu cầu Bearer token)
// =============================================================

/**
 * POST /api/admin/units — tạo căn hộ mới
 */
app.post('/api/admin/units', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const body = await c.req.json();
    const { data, errors } = sanitize(body, ALLOWED_UNIT_FIELDS);
    if (errors.length > 0) return c.json({ error: 'Validation failed', details: errors }, 400);

    // Kiểm tra field bắt buộc (project_id/tower_id có thể null nếu tạo draft)
    const missing = requireFields(data, ['code']);
    if (missing) return c.json({ error: missing }, 400);

    // Kiểm tra trùng code
    const existing = await sbAdmin(`units?code=eq.${encodeURIComponent(data.code)}&select=id,status`);
    if (!existing.ok) return c.json({ error: 'Database query failed' }, 502);

    const existingData = await existing.json();
    if (existingData.length > 0) {
      // Update thay vì tạo mới
      const updateRes = await sbAdmin(`units?id=eq.${existingData[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text().catch(() => '');
        console.error('Supabase unit update error:', updateRes.status, errText);
        return c.json({ error: 'Failed to update unit' }, 502);
      }

      const updated = await updateRes.json();
      logAudit('unit.update', `unit:${updated[0]?.id || existingData[0].id}`, 'admin');

      return c.json({ updated: existingData[0].id, unit: updated[0] || null }, 200);
    }

    // Tạo mới
    const createRes = await sbAdmin('units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(data),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      console.error('Supabase unit create error:', createRes.status, errText);
      return c.json({ error: 'Failed to create unit' }, 502);
    }

    const created = await createRes.json();
    logAudit('unit.create', `unit:${created[0]?.id}`, 'admin');

    return c.json(created[0], 201);
  } catch (err) {
    console.error('POST /api/admin/units error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/admin/units/:id — xoá căn hộ
 */
app.delete('/api/admin/units/:id', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const id = c.req.param('id');
    if (!id || id.length !== 36) return c.json({ error: 'Invalid unit ID' }, 400);

    const res = await sbAdmin(`units?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return c.json({ error: 'Failed to delete unit' }, 502);

    logAudit('unit.delete', `unit:${id}`, 'admin');
    return c.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/admin/units error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/units — danh sách tất cả (cả draft/hidden)
 */
app.get('/api/admin/units', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const page = Math.max(1, parseInt(c.req.query('page')) || 1);
    const limit = Math.min(100, parseInt(c.req.query('limit')) || 50);
    const offset = (page - 1) * limit;
    const status = c.req.query('status');
    const search = c.req.query('search');
    const featured = c.req.query('featured');

    let filter = '';
    if (status) filter += `&status=eq.${encodeURIComponent(status)}`;
    if (search) filter += `&code=ilike.*${encodeURIComponent(search)}*`;
    if (featured === 'true') filter += '&is_featured=eq.true';
    if (featured === 'false') filter += '&is_featured=eq.false';

    const dataRes = await sbAdmin(
      `units?select=*,project:project_id(name,slug),tower:tower_id(name,slug)&order=updated_at.desc&limit=${limit}&offset=${offset}${filter}`
    );
    const countRes = await sbAdmin(`units?select=id&limit=0${filter}`, {
      method: 'HEAD',
      headers: { 'Prefer': 'count=exact' },
    });

    if (!dataRes.ok) return c.json({ error: 'Failed to load units' }, 502);

    const total = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0');
    return c.json({
      data: await dataRes.json(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('GET /api/admin/units error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/units/detail/:id — chi tiết căn hộ (admin: xem mọi status)
 */
app.get('/api/admin/units/detail/:id', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const id = c.req.param('id');
    if (!id || id.length !== 36) return c.json({ error: 'Invalid unit ID' }, 400);

    const res = await sbAdmin(
      `units?select=*,project:project_id(name),tower:tower_id(name)&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    if (!res.ok) return c.json({ error: 'Failed to load unit' }, 502);

    const data = await res.json();
    if (!data.length) return c.json({ error: 'Unit not found' }, 404);

    return c.json(data[0]);
  } catch (err) {
    console.error('GET /api/admin/units/detail/:id error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/admin/units/:id — cập nhật căn hộ
 */
app.put('/api/admin/units/:id', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const id = c.req.param('id');
    if (!id || id.length !== 36) return c.json({ error: 'Invalid unit ID' }, 400);

    const body = await c.req.json();
    const { data, errors } = sanitize(body, ALLOWED_UNIT_FIELDS);
    if (errors.length > 0) return c.json({ error: 'Validation failed', details: errors }, 400);

    if (!data.code) return c.json({ error: 'Code is required' }, 400);

    // Check tồn tại
    const existing = await sbAdmin(`units?id=eq.${encodeURIComponent(id)}&select=id,code`);
    if (!existing.ok) return c.json({ error: 'Database query failed' }, 502);
    const existingData = await existing.json();
    if (!existingData.length) return c.json({ error: 'Unit not found' }, 404);

    // Check trùng code (nếu đổi code)
    if (data.code !== existingData[0].code) {
      const dup = await sbAdmin(`units?code=eq.${encodeURIComponent(data.code)}&select=id`);
      const dupData = await dup.json();
      if (dupData.length > 0 && dupData[0].id !== id) {
        return c.json({ error: `Code "${data.code}" đã tồn tại` }, 409);
      }
    }

    const updateRes = await sbAdmin(`units?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => '');
      console.error('Supabase unit update error:', updateRes.status, errText);
      return c.json({ error: 'Failed to update unit' }, 502);
    }

    const updated = await updateRes.json();
    logAudit('unit.update', `unit:${id}`, 'admin');

    return c.json(updated[0] || updated, 200);
  } catch (err) {
    console.error('PUT /api/admin/units/:id error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /api/admin/units/featured/:id — toggle is_featured
 */
app.patch('/api/admin/units/featured/:id', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const id = c.req.param('id');
    if (!id || id.length !== 36) return c.json({ error: 'Invalid unit ID' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const isFeatured = body.is_featured === true || body.is_featured === 'true';

    const updateRes = await sbAdmin(`units?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ is_featured: isFeatured, updated_at: new Date().toISOString() }),
    });

    if (!updateRes.ok) return c.json({ error: 'Failed to update featured status' }, 502);

    const updated = await updateRes.json();
    logAudit('unit.featured_toggle', `unit:${id}`, 'admin');

    return c.json({ is_featured: isFeatured, unit: updated[0] });
  } catch (err) {
    console.error('PATCH /api/admin/units/featured/:id error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/projects — danh sách dự án cho admin (mọi status)
 */
app.get('/api/admin/projects', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const res = await sbAdmin('projects?select=id,name,slug,description,thumbnail,sort_order,status&order=sort_order.asc');
    if (!res.ok) return c.json({ error: 'Failed to load projects' }, 502);
    return c.json(await res.json());
  } catch (err) {
    console.error('GET /api/admin/projects error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/towers?project=xxx — danh sách toà cho admin (mọi status)
 */
app.get('/api/admin/towers', async (c) => {
  try {
    const authError = requireAdmin(c);
    if (authError) return c.json({ error: 'Unauthorized' }, 401);

    if (rateLimit(c, 'admin')) return c.json({ error: 'Too many requests' }, 429);

    const projectId = c.req.query('project');
    if (!projectId) return c.json({ error: 'Missing project parameter' }, 400);

    const res = await sbAdmin(
      `towers?select=id,name,slug,sort_order,status&project_id=eq.${encodeURIComponent(projectId)}&order=sort_order.asc`
    );
    if (!res.ok) return c.json({ error: 'Failed to load towers' }, 502);
    return c.json(await res.json());
  } catch (err) {
    console.error('GET /api/admin/towers error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// =============================================================
// ZALO BOT WEBHOOK
// =============================================================

app.post('/api/zalo/webhook', async (c) => {
  try {
    // Verify secret
    const secret = c.req.header('X-Bot-Api-Secret-Token') || c.req.header('x-zalo-secret');
    if (secret !== process.env.ZALO_SECRET) return c.json({}, 403);

    if (rateLimit(c, 'zalo')) return c.json({ error: 'Too many requests' }, 429);

    // Verify Zalo HMAC signature (nếu có header) — dùng Web Crypto API
    const signature = c.req.header('X-Zalo-Signature');
    if (process.env.ZALO_APP_SECRET && signature) {
      try {
        const rawBody = await c.req.raw.clone().text();
        const encoder = new TextEncoder();
        const keyData = encoder.encode(process.env.ZALO_APP_SECRET);
        const msgData = encoder.encode(rawBody);

        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' },
          false, ['sign']
        );
        const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        const expected = Array.from(new Uint8Array(sigBytes))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        if (signature !== expected) return c.json({}, 403);
      } catch (_err) {
        // Nếu crypto fail, fallback về secret check
        console.error('HMAC verification error:', _err.message);
      }
    }

    const body = await c.req.json();
    const { event_name, message: msg, sender } = body?.result || body || {};

    if (!event_name || !msg) return c.json({ ok: true });

    const senderId = sender?.id || msg?.chat?.id || msg?.chat_id;
    if (!senderId) return c.json({ ok: true });

    // --- Event: User gửi text — tra cứu căn hộ ---
    if (event_name === 'message.text.received' || event_name === 'user_send_text') {
      const text = (msg.text || msg.message || '').trim().toUpperCase();

      // Parse mã căn (VD: A2.1508, B4.0806)
      const codeMatch = text.match(/[A-Z0-9]+[.][0-9]+/);
      if (!codeMatch) {
        await sendZalo(senderId, 'Vui lòng gửi mã căn hộ (VD: A2.1508)');
        return c.json({ ok: true });
      }

      const code = codeMatch[0];
      const res = await sbPublic(
        `units?select=*,project:project_id(name),tower:tower_id(name)&code=eq.${encodeURIComponent(code)}&limit=1`
      );

      if (!res.ok) {
        await sendZalo(senderId, '⚠️ Hệ thống đang bảo trì, vui lòng thử lại sau.');
        return c.json({ ok: true });
      }

      const data = await res.json();
      if (!data.length) {
        await sendZalo(senderId, `❌ Không tìm thấy căn ${code}. Vui lòng kiểm tra lại mã căn hộ.`);
        return c.json({ ok: true });
      }

      const u = data[0];
      const msgText = [
        `📋 *${u.code}*`,
        `🏢 ${u.project?.name || ''} — Tòa ${u.tower?.name || ''}`,
        `📍 Tầng ${u.floor} | ${u.area}m² | ${u.bedrooms}PN`,
        `🎨 Phong cách: ${u.style || 'Đang cập nhật'}`,
        u.floor_plan ? `📄 Mặt bằng: ${u.floor_plan}` : '',
        `📞 LH: ${process.env.PHONE_NUMBER || '058 929 4444'}`,
      ].filter(Boolean).join('\n');

      // Gửi tin nhắn + ảnh nếu có
      const firstImage = Array.isArray(u.images) && u.images.length > 0 ? u.images[0] : null;
      await sendZalo(senderId, msgText, firstImage ? { type: 'image', url: firstImage } : null);

      return c.json({ ok: true });
    }

    // --- Event: Sale gửi ảnh + caption — push căn mới ---
    if (event_name === 'message.image.received' || event_name === 'user_send_image') {
      const caption = msg.caption || '';
      if (!caption) {
        await sendZalo(senderId, 'Vui lòng gửi kèm mô tả (VD: Căn mới: B4.0806 | 75m² | 2PN)');
        return c.json({ ok: true });
      }

      const unitData = parseNewUnit(caption, msg.photo || msg.images || []);
      if (!unitData) {
        await sendZalo(senderId, '⚠️ Không thể parse thông tin. Định dạng: "Căn mới: MÃ_CĂN | Diện_tích | Số_PN | Phong_cách"');
        return c.json({ ok: true });
      }

      // Resolve project/tower từ code prefix (VD: "B4.0806" → project "B4"?)
      // Fallback null nếu không tìm thấy — admin sẽ gán sau
      let projectId = null;
      let towerId = null;
      try {
        // Trích xuất tower prefix từ code (VD: "B4" từ "B4.0806")
        const prefix = (unitData.code || '').split('.')[0];
        if (prefix) {
          const towerRes = await sbPublic(
            `towers?select=id,project_id&slug=eq.${encodeURIComponent(prefix.toLowerCase())}&limit=1`
          );
          const towerData = await towerRes.json();
          if (towerData.length > 0) {
            towerId = towerData[0].id;
            projectId = towerData[0].project_id;
          }
        }

        // Kiểm tra trùng code trước
        const existing = await sbAdmin(`units?code=eq.${encodeURIComponent(unitData.code)}&select=id`);
        const existingArr = await existing.json();

        if (existingArr.length > 0) {
          await sendZalo(senderId, `✅ Căn ${unitData.code} đã tồn tại trong hệ thống (ID: ${existingArr[0].id}). Bỏ qua.`);
          return c.json({ ok: true });
        }
      } catch (err) {
        console.error('Zalo pre-check error:', err.message);
      }

      // Tạo unit draft (project_id/tower_id nullable — không FK violation)
      const createRes = await sbAdmin('units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({
          ...unitData,
          project_id: projectId,
          tower_id: towerId,
          zalo_conversation_id: String(senderId),
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '');
        console.error('Zalo create unit error:', createRes.status, errText);
        await sendZalo(senderId, '⚠️ Không thể tạo căn hộ do lỗi hệ thống. Vui lòng thử lại.');
        return c.json({ ok: true });
      }

      const created = await createRes.json();
      logAudit('unit.create', `unit:${created[0]?.id}`, `zalo:${senderId}`);

      await sendZalo(senderId,
        `✅ Đã tạo căn *${unitData.code}* (draft — chờ admin duyệt)\n` +
        `🆔 ID: ${created[0]?.id || 'N/A'}\n` +
        `👉 Admin vào /admin để gán dự án/toà nhà và publish.`
      );

      return c.json({ ok: true });
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error('Zalo webhook error:', err.message);
    // Không return lỗi cho Zalo (Zalo sẽ retry nếu thấy lỗi)
    return c.json({ ok: true });
  }
});

// =============================================================
// 404 CATCH-ALL
// =============================================================
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
