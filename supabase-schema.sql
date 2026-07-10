-- =============================================================
-- LUMI DESIGN — Supabase Schema + RLS Policies
-- =============================================================
-- Triết lý: RLS ON cho tất cả bảng.
-- Public: chỉ SELECT units có status='published'
-- Admin (service_role): full CRUD qua API service key
-- Không dùng denormalize (project_slug, tower_slug) để tránh
-- data inconsistency. JOIN giữa units → towers → projects
-- đủ nhanh với < 10.000 units.
-- =============================================================

-- 0. EXTENSIONS
create extension if not exists "pgcrypto";

-- 1. PROJECTS
-- Lưu danh sách dự án (VD: Vinhomes Ocean Park, Smart City...)
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text default '',
  thumbnail   text default '',
  sort_order  integer default 0,
  status      text default 'active' check (status in ('active','hidden')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. TOWERS
-- Lưu danh sách toà nhà trong mỗi dự án
create table if not exists towers (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  slug        text not null,
  sort_order  integer default 0,
  status      text default 'active' check (status in ('active','hidden')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(project_id, slug)
);

-- 3. UNITS (core table)
-- Thông tin chi tiết từng căn hộ: hình ảnh, video, mặt bằng...
create table if not exists units (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,                    -- VD: B4.0806
  -- project_id và tower_id nullable để support Zalo push tạo draft trước
  -- khi admin gán dự án. Khi có giá trị, FK vẫn đảm bảo referential integrity.
  project_id  uuid references projects(id) on delete set null,
  tower_id    uuid references towers(id) on delete set null,
  sort_order  integer default 0,                -- thứ tự hiển thị
  floor       text default '',
  room_number text default '',
  area        numeric(7,2) default 0 check (area >= 0),
  bedrooms    integer default 0 check (bedrooms >= 0),
  style       text default '',                   -- phong cách: Hiện đại, Tân cổ điển...
  description text default '',
  status      text default 'draft' check (status in ('published','draft','hidden','sold')),
  features    jsonb default '[]'::jsonb not null,        -- ["hồ bơi","công viên",...]
  images      jsonb default '[]'::jsonb not null,        -- Cloudinary URLs
  floor_plan  text default '',                   -- Cloudinary PDF URL
  videos      jsonb default '[]'::jsonb not null,        -- [{type:"youtube",url:"..."}]
  zalo_conversation_id text default '',          -- trace Zalo push origin
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 4. ADMIN USERS
-- Tài khoản admin/editor đăng nhập vào admin panel
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null check (length(password_hash) > 30),  -- bcrypt hash
  role          text default 'editor' check (role in ('admin','editor')),
  is_active     boolean default true,
  last_login    timestamptz,
  created_at    timestamptz default now()
);

-- 5. AUDIT LOG
-- Ghi lại mọi hành động admin cho mục đích kiểm toán
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,            -- unit.create, unit.update, admin.login...
  target        text not null,            -- unit:<uuid>, project:<uuid>
  performed_by  text default 'system',    -- admin_user_id | 'system' | 'zalo:<user_id>'
  metadata      jsonb default '{}'::jsonb not null,
  ip            text default '',
  created_at    timestamptz default now()
);

-- =============================================================
-- INDEXES (cho query patterns thực tế)
-- =============================================================
create index idx_towers_project on towers(project_id, sort_order);
create index idx_units_filter on units(tower_id, status, sort_order);
create index idx_units_project on units(project_id, status);
create index idx_units_code on units(code);
create index idx_units_updated on units(updated_at desc);
create index idx_audit_created on audit_log(created_at desc);

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- Bật RLS cho tất cả bảng
alter table projects enable row level security;
alter table towers enable row level security;
alter table units enable row level security;
alter table admin_users enable row level security;
alter table audit_log enable row level security;

-- === PROJECTS ===
create policy "projects_public_read_active"
  on projects for select
  using (status = 'active');

create policy "projects_admin_all"
  on projects for all
  using (auth.role() = 'service_role');

-- === TOWERS ===
create policy "towers_public_read_active"
  on towers for select
  using (status = 'active');

create policy "towers_admin_all"
  on towers for all
  using (auth.role() = 'service_role');

-- === UNITS ===
-- Public: chỉ thấy published units
create policy "units_public_read_published"
  on units for select
  using (status = 'published');

-- Admin: thấy tất cả (kể cả draft/hidden/sold)
create policy "units_admin_select"
  on units for select
  using (auth.role() = 'service_role');

create policy "units_admin_insert"
  on units for insert
  with check (auth.role() = 'service_role');

create policy "units_admin_update"
  on units for update
  using (auth.role() = 'service_role');

create policy "units_admin_delete"
  on units for delete
  using (auth.role() = 'service_role');

-- === ADMIN_USERS ===
-- Tuyệt đối không public read
create policy "admin_users_admin_all"
  on admin_users for all
  using (auth.role() = 'service_role');

-- === AUDIT_LOG ===
-- Insert-only từ service_role
create policy "audit_log_admin_insert"
  on audit_log for insert
  with check (auth.role() = 'service_role');

create policy "audit_log_admin_select"
  on audit_log for select
  using (auth.role() = 'service_role');

-- =============================================================
-- AUTO-UPDATE updated_at
-- =============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated
  before update on projects for each row execute function update_updated_at();
create trigger trg_towers_updated
  before update on towers for each row execute function update_updated_at();
create trigger trg_units_updated
  before update on units for each row execute function update_updated_at();
