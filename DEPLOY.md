# Hướng dẫn triển khai Lumi Design

Hệ thống landing page **siêu gọn** với Vanilla JS + Hono + Supabase + Cloudinary.  
Tổng footprint: ~500KB npm, 1 dependency (hono), không build step.

---

## Mục lục

- [1. Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
- [2. Supabase — Database](#2-supabase--database)
- [3. Cloudinary — Media CDN](#3-cloudinary--media-cdn)
- [4. Zalo OA — Bot tra cứu & push căn mới](#4-zalo-oa--bot-tra-cứu--push-căn-mới)
- [5. Vercel — Deploy code](#5-vercel--deploy-code)
- [6. Tạo admin user đầu tiên](#6-tạo-admin-user-đầu-tiên)
- [7. Kiểm tra toàn bộ hệ thống](#7-kiểm-tra-toàn-bộ-hệ-thống)
- [8. Troubleshooting](#8-troubleshooting)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────┐
│  Vercel (free plan)                          │
│                                              │
│  Static files    API (Hono)                  │
│  /index.html     GET  /api/config            │
│  /js/app.js      GET  /api/projects          │
│  /css/style.css  GET  /api/towers            │
│  /admin/         GET  /api/units             │
│                  GET  /api/featured          │
│                  POST /api/admin/login       │
│                  POST /api/admin/units       │
│                  POST /api/zalo/webhook      │
│                  ...                         │
└─────────┬─────────────────────┬──────────────┘
          │                     │
    ┌─────▼──────┐     ┌───────▼────────┐
    │  Supabase   │     │  Cloudinary    │
    │  Postgres   │     │  Media CDN     │
    │  REST API   │     │  25GB free     │
    └─────────────┘     └────────────────┘
                        ▲
               ┌────────┴────────┐
               │  Zalo OA Bot    │
               │  Webhook        │
               └─────────────────┘
```

### Services cần tạo

| Service | Gói free | Mục đích |
|---|---|---|
| Supabase | 500MB DB, REST API | Lưu projects, towers, units, admin_users, audit_log |
| Cloudinary | 25GB media, auto-optimize | Host ảnh nội thất, PDF mặt bằng |
| Zalo OA | Free | Bot tra cứu căn hộ, sale push căn mới |
| Vercel | 100GB bandwidth, 100k functions/mo | Host static + API |

---

## 2. Supabase — Database

### 2.1 Tạo project

1. Vào https://supabase.com → **Sign in** (GitHub account)
2. **New project** → điền:
   - **Name:** `lumi-landing`
   - **Database password:** tạo mật khẩu mạnh, **lưu lại**
   - **Region:** `Singapore` (gần VN nhất)
   - **Pricing plan:** Free
3. Đợi ~2 phút để project khởi tạo

### 2.2 Import schema

1. Trong Supabase Dashboard → **SQL Editor**
2. **New query** → paste nội dung file `supabase-schema.sql`
3. **Run** → chạy toàn bộ (tạo 5 tables + RLS + indexes + triggers)

Kiểm tra: Vào **Table Editor** → thấy 5 tables: `projects`, `towers`, `units`, `admin_users`, `audit_log`

### 2.3 Seed dữ liệu mẫu

Chạy SQL này trong SQL Editor để có dữ liệu test:

```sql
-- Dự án mẫu
INSERT INTO projects (id, name, slug, description, status, sort_order)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Vinhomes Smart City', 'vinhomes-smart-city', 'Khu đô thị thông minh tại Nam Từ Liêm, Hà Nội', 'active', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Vinhomes Riverside', 'vinhomes-riverside', 'Khu đô thị ven sông Hồng', 'active', 2);

-- Toà nhà mẫu
INSERT INTO towers (id, project_id, name, slug, status, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'B4', 'b4', 'active', 1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'B5', 'b5', 'active', 2);

-- Admin user mẫu (password: admin123)
-- Hash được tạo: SHA-256("admin123" + ADMIN_SECRET_prefix)
-- Sau khi deploy Vercel, dùng API để tạo user thật (xem bước 6)
```

### 2.4 Lấy API keys

1. Supabase Dashboard → **Project Settings** (⚙️) → **API**
2. Copy 3 giá trị:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (⚠️ giữ bí mật, chỉ dùng trong server)

> **Lưu ý:** `SERVICE_KEY` có quyền bypass RLS. **Không bao giờ** dùng ngoài API server.  
> Nếu bị lộ, revoke trong Supabase Settings → API → regenerate.

---

## 3. Cloudinary — Media CDN

### 3.1 Tạo tài khoản

1. Vào https://cloudinary.com → **Sign up free**
   - Email, password, **cloud name** tự chọn (VD: `lumi`)
2. Dashboard → **Account Details** → copy:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **Base URL** → `https://res.cloudinary.com/<cloud_name>/image/upload/`

### 3.2 Upload ảnh lên Cloudinary

**Cách 1 — Upload Widget (dễ, admin dùng):**
1. Cloudinary Dashboard → **Media Library** → **Upload**
2. Kéo thả ảnh → copy URL (VD: `https://res.cloudinary.com/<cloud>/image/upload/v12345/a2-01.jpg`)

**Cách 2 — Unsigned Upload Preset (cho admin panel):**
1. Cloudinary → **Settings** (⚙️) → **Upload** → **Upload presets**
2. **Add upload preset**:
   - **Preset name:** `lumi_preset`
   - **Signing Mode:** `Unsigned`
   - **Folder:** `lumi/`
3. **Save** → copy **Preset name**

Sau đó admin có thể upload ảnh trực tiếp từ form (cần thêm Cloudinary Upload Widget script vào admin page — xem thêm ở cuối tài liệu).

### 3.3 Tối ưu URL

Cloudinary tự động tối ưu ảnh. Thêm transform vào URL:

```
Gốc:      https://res.cloudinary.com/lumi/image/upload/a2-01.jpg
WebP:     https://res.cloudinary.com/lumi/image/upload/q_auto,f_auto/a2-01.jpg
Resize:   https://res.cloudinary.com/lumi/image/upload/w_800,q_auto/a2-01.jpg
PDF:      https://res.cloudinary.com/lumi/raw/upload/a2-floor-plan.pdf
```

---

## 4. Zalo OA — Bot tra cứu & push căn mới

### 4.1 Tạo Official Account (OA)

1. Vào https://oa.zalo.me → **Đăng ký OA**
   - Loại: **Doanh nghiệp**
   - Điền thông tin công ty
   - Chờ duyệt (thường 1-2 ngày)
2. Sau khi duyệt → vào https://developers.zalo.me
3. **Tạo ứng dụng mới**:
   - **Loại ứng dụng:** `Official Account`
   - **Tên:** `Lumi Design Bot`
   - **Mô tả:** Bot tra cứu căn hộ Lumi Design
4. Sau khi tạo → **Cài đặt** → **Official Account** → **Chọn OA** → kết nối OA với app

### 4.2 Lấy App ID & App Secret

1. https://developers.zalo.me → chọn app
2. **Thông tin ứng dụng**:
   - **App ID** → `ZALO_OA_ID` (số, VD: `123456789`)
   - **App Secret** → `ZALO_APP_SECRET` (dùng để verify webhook)

### 4.3 Lấy Access Token

**Cách 1 — Lấy token test (dùng luôn, hết hạn sau 90 ngày):**

1. https://developers.zalo.me → chọn app → **Official Account**
2. **Quản lý OA** → **Cấp quyền**
3. **Tạo mã truy cập OA** → copy `access_token`
4. Token này tồn tại 90 ngày. Hết hạn: lặp lại bước này.

**Cách 2 — Lấy token production (cần refresh):**

Chi tiết: https://developers.zalo.me/docs/api/official-account/xac-thuc/official-account-access-token

Tóm tắt:
1. Gửi OA admin vào link: `https://oauth.zaloapp.com/v4/oa/permission?app_id=<APP_ID>&redirect_url=<your-callback-url>`
2. OA admin approve → redirect về callback với `authorization_code`
3. Dùng code đó gọi API lấy token:
```bash
curl -X POST https://oauth.zaloapp.com/v4/oa/access_token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'app_id=<APP_ID>&grant_type=authorization_code&code=<AUTH_CODE>'
```
4. Response: `{ "access_token": "...", "refresh_token": "...", "expires_in": 7776000 }`
5. Lưu `access_token` vào Vercel env. Khi hết hạn, dùng refresh token lấy cái mới.

### 4.4 Cấu hình Webhook

1. https://developers.zalo.me → chọn app → **Cài đặt**
2. **Webhook URL:** nhập `https://<domain>/api/zalo/webhook`
   - Vercel preview: `https://lumidesign.vercel.app/api/zalo/webhook`
   - Production: `https://noithatlumi.vn/api/zalo/webhook`
3. **Webhook Secret:** tạo chuỗi 32 ký tự ngẫu nhiên
   ```
   openssl rand -hex 16
   ```
   Copy kết quả → `ZALO_SECRET`
4. **Chọn sự kiện:**
   - ☑ `user_send_text` (tra cứu căn hộ)
   - ☑ `user_send_image` (sale push căn mới)

### 4.5 Test Zalo Bot

1. Mở Zalo App → tìm OA của bạn
2. Gửi tin nhắn: `B4.0806`
   → Bot trả về: `📋 B4.0806 | Vinhomes Smart City — Tòa B4`
3. Gửi ảnh + caption: `Căn mới: X1.0102 | 65m² | 2PN | Hiện đại`
   → Bot trả về: `✅ Đã tạo căn X1.0102 (draft — chờ admin duyệt)`

### 4.6 Cập nhật Zalo Avatar & Thông tin

1. Vào https://oa.zalo.me → chọn OA
2. **Thiết lập** → **Thông tin OA**:
   - **Avatar:** Logo Lumi Design
   - **Mô tả:** "Bot tra cứu căn hộ cao cấp Lumi Design. Gửi mã căn (VD: B4.0806) để xem thông tin."
   - **Menu:** Có thể thêm link đến landing page, admin

### 4.7 Zalo API format

Nếu cần debug Zalo webhook:

**Zalo sends:**
```json
{
  "event_name": "user_send_text",
  "app_id": 123456789,
  "sender": { "id": "user_zalo_id" },
  "message": {
    "text": "B4.0806",
    "chat_id": "conversation_id"
  }
}
```

**Response cần trả về:**
```json
{ "ok": true }
```

> ⚠️ Luôn trả về `{ "ok": true }` kể cả khi lỗi. Nếu trả về HTTP error, Zalo sẽ retry liên tục.

---

## 5. Vercel — Deploy code

### 5.1 Push code lên GitHub

```bash
# Tạo repo trên GitHub trước
git remote add origin https://github.com/<user>/lumi-landing.git
git push -u origin main
```

### 5.2 Import vào Vercel

1. Vào https://vercel.com → **Add New...** → **Project**
2. Import repo `lumi-landing`
3. **Framework Preset:** `Other` (không build step)
4. **Root Directory:** để mặc định (`.`)
5. **Build & Development Settings:**
   - Build command: để trống
   - Output directory: để trống
6. **Environment Variables** — thêm tất cả (quan trọng):

| Variable | Giá trị | Ví dụ |
|---|---|---|
| `SUPABASE_URL` | Project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_KEY` | service_role key | `eyJhbGciOi...` |
| `ADMIN_SECRET` | 64 ký tự hex | `012345...abcdef` |
| `ZALO_OA_ID` | App ID | `123456789` |
| `ZALO_ACCESS_TOKEN` | OA access token | `xxx` |
| `ZALO_APP_SECRET` | App Secret | `xxx` |
| `ZALO_SECRET` | Webhook secret | `xxx` |
| `CLOUDINARY_CLOUD_NAME` | Cloud name | `lumi` |
| `CLOUDINARY_BASE_URL` | Base URL | `https://res.cloudinary.com/lumi/image/upload/` |
| `PHONE_NUMBER` | Số điện thoại | `058 929 4444` |
| `SITE_NAME` | Tên site | `Lumi Design` |
| `SITE_URL` | URL deploy | `https://lumidesign.vercel.app` |

6. **Deploy** → đợi ~1 phút

### 5.3 Kiểm tra sau deploy

```bash
# API — phải trả về JSON
curl https://<domain>/api/config
# → {"phone":"058 929 4444","company":"Lumi Design",...}

curl https://<domain>/api/projects
# → [{"id":"...","name":"Vinhomes Smart City",...}]

# Static — phải trả về HTML
curl https://<domain>/
# → <!DOCTYPE html>...

# Admin
curl https://<domain>/admin/
# → <!DOCTYPE html>...
```

### 5.4 Domain tùy chỉnh (subdomain)

1. Vercel Dashboard → project → **Domains**
2. Nhập `landing.noithatlumi.vn` → **Add**
3. Vercel hiển thị CNAME record. Vào DNS của `noithatlumi.vn` thêm:
   ```
   landing  CNAME  cname.vercel-dns.com
   ```
4. Đợi DNS propagate (5-30 phút)
5. Vào `.env.example` → update `SITE_URL=https://landing.noithatlumi.vn`
6. Cập nhật lại Vercel env variable `SITE_URL`
7. Cập nhật OG URLs trong `public/index.html` (og:url)

### 5.5 Security checklist

Sau khi deploy, kiểm tra:

```bash
# 1. Security headers
curl -I https://<domain>/ | findstr /i "x-content-type x-frame x-xss content-security"

# Expected:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: default-src 'self'; ...

# 2. CORS — API chỉ cho phép origin cụ thể
curl -H "Origin: https://evil.com" -I https://<domain>/api/config
# → Không có header Access-Control-Allow-Origin: *

# 3. HTTPS — tự động (Vercel mặc định)
```

---

## 6. Tạo admin user đầu tiên

Sau khi deploy Vercel, script tạo admin user:

### 6.1 Cài đặt công cụ

```bash
# Cài jq để parse JSON (Windows: winget install jq)
# Hoặc dùng PowerShell
```

### 6.2 Tạo admin user qua API

Gọi API từ terminal (thay `<DOMAIN>` bằng URL thật):

```bash
# Tạo user admin (gọi từ máy bạn, dùng ADMIN_SECRET trực tiếp)
# Admin_SECRET = giá trị bạn set trong Vercel env
ADMIN_SECRET="0123456789abcdef..."
DOMAIN="https://lumidesign.vercel.app"

# Băm password
# Dùng Node.js hoặc bash để tạo SHA-256 hash
```

**Cách đơn giản nhất — dùng Node.js chạy local:**

Tạo file `create-admin.mjs` (⚠️ xoá sau khi dùng):

```javascript
// create-admin.mjs — chạy 1 lần rồi xoá
const crypto = await import('node:crypto');

const email = 'admin@lumi.vn';
const password = 'Admin@123'; // đổi mật khẩu mạnh
const adminSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const supabaseUrl = 'https://xxx.supabase.co';
const supabaseServiceKey = 'eyJ...'; // service_role key

const salt = adminSecret.slice(0, 16);
const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

// Gọi Supabase REST trực tiếp
const res = await fetch(`${supabaseUrl}/rest/v1/admin_users`, {
  method: 'POST',
  headers: {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  },
  body: JSON.stringify({
    email,
    password_hash: hash,
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  }),
});

const data = await res.json();
console.log('Created:', JSON.stringify(data, null, 2));
```

Chạy:
```bash
node create-admin.mjs
# → Created: {"id":"uuid","email":"admin@lumi.vn",...}
```

> ⚠️ **Xoá file `create-admin.mjs` ngay sau khi tạo user xong!**  
> Không bao giờ commit file chứa secret/password.

### 6.3 Đăng nhập admin

1. Vào `https://<domain>/admin/`
2. Email: `admin@lumi.vn`
3. Password: `Admin@123`
4. Nếu thành công → thấy dashboard với danh sách căn hộ

---

## 7. Kiểm tra toàn bộ hệ thống

### 7.1 Landing Page

- [ ] **`GET /`** — trả về HTML đúng, không lỗi console
- [ ] **Dropdown dự án** — load danh sách projects từ API
- [ ] **Chọn dự án** → load toà
- [ ] **Chọn toà** → load căn hộ
- [ ] **Tìm kiếm** — gõ mã căn, filter hoạt động
- [ ] **Featured** — hiển thị 6 căn mới nhất
- [ ] **Click căn hộ** — modal hiển thị chi tiết (ảnh, thông tin, video, contact)
- [ ] **Responsive** — test trên mobile (dưới 768px)
- [ ] **Số điện thoại** — hiển thị đúng, click được

### 7.2 Admin Panel

- [ ] **`GET /admin/`** — hiển thị form login
- [ ] **Login sai** — báo lỗi
- [ ] **Login đúng** — vào dashboard
- [ ] **Thêm căn hộ** — form validate, lưu được
- [ ] **Sửa căn hộ** — load đúng dữ liệu cũ
- [ ] **Xoá căn hộ** — confirm trước khi xoá
- [ ] **Filter trạng thái** — published/draft/hidden/sold
- [ ] **Tìm kiếm** — theo mã căn
- [ ] **Phân trang** — nếu nhiều hơn 30 căn

### 7.3 Zalo Bot

- [ ] **Webhook** — gửi text → nhận response
- [ ] **Tra mã đúng** — trả về thông tin căn hộ
- [ ] **Tra mã sai** — báo "Không tìm thấy"
- [ ] **Push ảnh + caption** — tạo unit draft
- [ ] **Push trùng code** — báo "đã tồn tại, bỏ qua"

### 7.4 Bảo mật

- [ ] **API public** — không lộ dữ liệu draft/hidden
- [ ] **API admin** — không Bearer token → 401
- [ ] **API admin** — token hết hạn → 401
- [ ] **Zalo webhook** — sai secret → 403
- [ ] **Rate limit** — request quá nhiều → 429
- [ ] **Security headers** — kiểm tra với curl -I

### 7.5 Performance

```bash
# Lighthouse test
# Mở Chrome DevTools → Lighthouse → Generate report

# API response time
curl -w "\n%{time_total}s\n" https://<domain>/api/projects
# Kỳ vọng: < 500ms

# Bundle size
# Mở DevTools → Network tab → reload
# JS: ~8KB, CSS: ~5KB, HTML: ~3KB
```

---

## 8. Troubleshooting

### Vercel — API trả về 502

```
Nguyên nhân: Env variable thiếu hoặc Supabase URL sai.
Fix: Vercel Dashboard → Project → Settings → Environment Variables → kiểm tra tất cả.

Hoặc: Function timeout (mặc định 10s, đủ cho Supabase)
Check: https://vercel.com/<project>/logs
```

### Supabase — "relation does not exist"

```
Nguyên nhân: Chưa chạy schema SQL hoặc chạy sai project.
Fix: Vào SQL Editor → chạy lại toàn bộ supabase-schema.sql
```

### Zalo Bot — không response

```
Nguyên nhân 1: Webhook URL sai hoặc không public.
Fix: Kiểm tra Zalo Developer → webhook URL có thể truy cập từ internet.

Nguyên nhân 2: ZALO_SECRET sai.
Fix: Secret trong .env phải khớp với secret trong Zalo Developer.

Nguyên nhân 3: Token hết hạn.
Fix: Làm lại bước 4.3 để lấy token mới.
```

### Zalo Bot — response "Hệ thống đang bảo trì"

```
Nguyên nhân: API không thể query Supabase.
Fix: Kiểm tra SUPABASE_ANON_KEY, SUPABASE_URL.
Kiểm tra RLS policies có cho phép SELECT units status='published' không.
```

### Admin — "Phiên đăng nhập hết hạn"

```
Token tồn tại 24h. Login lại.
Nếu hay gặp: kiểm tra thời gian trên server (Vercel UTC) so với client.
```

### Cloudinary — ảnh không load

```
Fix: Kiểm tra URL ảnh trong DB có đúng format Cloudinary không.
https://res.cloudinary.com/<cloud_name>/image/upload/<image.jpg>

Nếu dùng signed upload: cần API key + secret.
Nếu dùng unsigned: cần upload preset name.
```

### CORS — API không gọi được từ domain lạ

```
Kiểm tra vercel.json có ALLOWED_ORIGINS đúng không.
Nếu test từ Postman: CORS không ảnh hưởng (chỉ browser mới enforce).
```

---

## Phụ lục A: Lệnh hữu ích

```bash
# Tạo ADMIN_SECRET (dùng trong .env)
openssl rand -hex 32

# Kiểm tra API response time
curl -w "\nTime: %{time_total}s\n" https://<domain>/api/units?limit=1

# Kiểm tra security headers
curl -sI https://<domain>/api/config

# Test Zalo webhook (giả lập)
curl -X POST https://<domain>/api/zalo/webhook \
  -H 'Content-Type: application/json' \
  -H 'X-Bot-Api-Secret-Token: <ZALO_SECRET>' \
  -d '{"event_name":"user_send_text","sender":{"id":"test"},"message":{"text":"B4.0806"}}'

# Xem Vercel logs
vercel logs <deployment-url>
```

## Phụ lục B: Cập nhật Access Token Zalo (định kỳ)

Token Zalo OA hết hạn sau **90 ngày**. Lên lịch nhắc:

```bash
# Calendar reminder: 80 ngày sau deploy
# Làm lại bước 4.3 → copy token mới → cập nhật trong Vercel env
```

Để tránh manual, có thể viết một function refresh token tự động:
- Thêm endpoint `POST /api/admin/zalo/refresh-token`
- Gọi Zalo refresh token API
- Cập nhật env variable qua Vercel API (cần deploy mới)

Nhưng cách đơn giản nhất: lịch nhắc Calendar + 5 phút thủ công.
