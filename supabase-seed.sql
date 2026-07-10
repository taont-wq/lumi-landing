-- =============================================================
-- LUMI DESIGN — Seed Data
-- Real projects/towers from noithatlumi.vn
-- Run this in Supabase SQL Editor after schema setup
-- =============================================================

-- === PROJECTS ===
INSERT INTO projects (id, name, slug, description, sort_order, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Vinhomes Ocean Park',       'vinhomes-ocean-park',   'Khu đô thị Vinhomes Ocean Park 1 tại Gia Lâm, Hà Nội — không gian sống xanh ven hồ.',     1, 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'Vinhomes Smart City',       'vinhomes-smart-city',   'Khu đô thị thông minh Vinhomes Smart City tại Tây Mỗ, Nam Từ Liêm, Hà Nội.',                 2, 'active'),
  ('a0000000-0000-0000-0000-000000000003', 'Ecopark',                   'ecopark',               'Đô thị sinh thái Ecopark tại Văn Giang, Hưng Yên — không gian xanh đẳng cấp.',                3, 'active')
ON CONFLICT (id) DO NOTHING;

-- === TOWERS ===
-- Vinhomes Ocean Park
INSERT INTO towers (id, project_id, name, slug, sort_order, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'A1',   'a1',   1, 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'A2',   'a2',   2, 'active'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'A3',   'a3',   3, 'active'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'SM Zone - The Charm', 'sm-zone-the-charm', 4, 'active'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'B4',   'b4',   5, 'active')
ON CONFLICT (id) DO NOTHING;

-- Vinhomes Smart City
INSERT INTO towers (id, project_id, name, slug, sort_order, status) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'A3',   'a3',   1, 'active'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'SA5 - The Sakura', 'sa5-the-sakura', 2, 'active'),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002', 'B2',   'b2',   3, 'active')
ON CONFLICT (id) DO NOTHING;

-- Ecopark
INSERT INTO towers (id, project_id, name, slug, sort_order, status) VALUES
  ('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'SF3 - Sky Forest', 'sf3-sky-forest', 1, 'active'),
  ('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000003', 'The Golden',       'the-golden',     2, 'active')
ON CONFLICT (id) DO NOTHING;

-- === UNITS ===
-- Vinhomes Ocean Park - A1
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'A1.0102', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1',  48.5, 1, 'Hiện đại',    'Căn hộ 1 phòng ngủ view công viên, ban công Đông Nam thoáng mát.',    'published', '["Hồ bơi","Công viên trung tâm","An ninh 24/7"]', 1),
  ('c0000000-0000-0000-0000-000000000002', 'A1.0506', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '5',  65.0, 2, 'Hiện đại',    'Căn hộ 2 phòng ngủ rộng rãi, nội thất cơ bản, view hồ điều hòa.',    'published', '["Hồ bơi","Công viên trung tâm","Sân vườn"]',        2),
  ('c0000000-0000-0000-0000-000000000003', 'A1.1208', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '12', 82.0, 3, 'Tân cổ điển', 'Căn hộ 3 phòng ngủ cao cấp, view toàn cảnh Vinhomes, nội thất cao cấp.', 'published', '["Hồ bơi","Công viên trung tâm","An ninh 24/7","Khu BBQ"]', 3);

-- Vinhomes Ocean Park - A2
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000004', 'A2.0304', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '3',  55.0, 1, 'Hiện đại',    'Căn hộ 1PN+ ban công Nam, nội thất liền tường, thích hợp đầu tư.',     'published', '["Hồ bơi","Công viên","An ninh 24/7","Gara"]',      1),
  ('c0000000-0000-0000-0000-000000000005', 'A2.0710', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '7',  72.5, 2, 'Hiện đại',    'Căn hộ 2PN góc, view 2 mặt thoáng, cửa sổ lớn lấy sáng tự nhiên.',    'published', '["Hồ bơi","Công viên","Khu vui chơi trẻ em","Gara"]', 2),
  ('c0000000-0000-0000-0000-000000000006', 'A2.1502', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '15', 90.0, 3, 'Tân cổ điển', 'Căn hộ 3PN cao tầng, nội thất gỗ tự nhiên, view hồ trung tâm.',        'published', '["Hồ bơi","Công viên","An ninh 24/7","Gara","Khu BBQ"]', 3);

-- Vinhomes Ocean Park - A3 (the most referenced in blog)
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000007', 'A3.0406', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', '4',  58.0, 2, 'Hiện đại',    'Căn hộ 2PN, giá tốt, phù hợp gia đình trẻ. View công viên nội khu.',    'published', '["Hồ bơi","Công viên trung tâm","Khu vui chơi"]',   1),
  ('c0000000-0000-0000-0000-000000000008', 'A3.0703', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', '7',  75.0, 2, 'Tân cổ điển', 'Căn hộ 2PN tân cổ điển, nội thất cao cấp, ban công Đông Nam.',          'published', '["Hồ bơi","Công viên trung tâm","An ninh 24/7","Gara"]', 2),
  ('c0000000-0000-0000-0000-000000000009', 'A3.0806', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', '8',  82.5, 3, 'Tân cổ điển', 'Căn hộ 3PN rộng, view hồ trực diện, nội thất đầy đủ cao cấp.',         'published', '["Hồ bơi","Công viên","An ninh 24/7","Khu BBQ","Sân vườn"]', 3),
  ('c0000000-0000-0000-0000-000000000010', 'A3.1205', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', '12', 95.0, 3, 'Tân cổ điển', 'Căn hộ góc 3PN siêu rộng, nội thất nhập khẩu, view toàn cảnh.',          'published', '["Hồ bơi","Công viên","An ninh 24/7","Khu BBQ","Gara","Phòng gym"]', 4);

-- Vinhomes Ocean Park - SM Zone The Charm
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000011', 'SM.0105', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', '1',  50.0, 1, 'Hiện đại',    'Studio cao cấp, full nội thất, phù hợp cho thuê hoặc đầu tư.',           'published', '["Hồ bơi","Công viên","An ninh 24/7","Trung tâm thương mại"]', 1),
  ('c0000000-0000-0000-0000-000000000012', 'SM.0812', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', '8',  68.0, 2, 'Hiện đại',    'Căn hộ 2PN khu The Charm, thiết kế thông minh, tiết kiệm không gian.', 'published', '["Hồ bơi","Công viên","An ninh 24/7","Khu vui chơi"]',  2);

-- Vinhomes Smart City - A3
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000013', 'SW-A3.0206', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000010', '2',  54.0, 1, 'Hiện đại',    'Căn hộ 1PN, giá rẻ, phù hợp sinh viên hoặc người độc thân.',           'published', '["An ninh 24/7","Gara","Siêu thị","Công viên"]',     1),
  ('c0000000-0000-0000-0000-000000000014', 'SW-A3.0512', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000010', '5',  70.5, 2, 'Hiện đại',    'Căn hộ 2PN view trung tâm thương mại, tiện ích xung quanh đầy đủ.',    'published', '["Hồ bơi","An ninh 24/7","Gara","Siêu thị","Công viên"]', 2),
  ('c0000000-0000-0000-0000-000000000015', 'SW-A3.0918', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000010', '9',  88.0, 3, 'Tân cổ điển', 'Căn hộ 3PN view toà nhà landmark, thiết kế sang trọng đẳng cấp.',       'published', '["Hồ bơi","An ninh 24/7","Gara","Khu BBQ","Phòng gym"]', 3);

-- Vinhomes Smart City - SA5 The Sakura
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000016', 'SA5.0304', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000011', '3',  62.0, 2, 'Hiện đại',    'Căn hộ 2PN The Sakura, thiết kế Nhật Bản tối giản, tinh tế.',           'published', '["Hồ bơi","Công viên","An ninh 24/7","Vườn Nhật"]',  1),
  ('c0000000-0000-0000-0000-000000000017', 'SA5.0710', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000011', '7',  85.0, 3, 'Tân cổ điển', 'Căn hộ 3PN rộng, nội thất gỗ tự nhiên, ban công rộng, nhiều cây xanh.', 'published', '["Hồ bơi","Công viên","An ninh 24/7","Vườn Nhật","Gara"]', 2);

-- Ecopark - SF3 Sky Forest
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000018', 'SF3.0102', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000020', '1',  45.0, 1, 'Hiện đại',    'Căn hộ 1PN view vườn sinh thái, không gian yên tĩnh, gần gũi thiên nhiên.', 'published', '["Hồ bơi","Sân vườn","An ninh 24/7","Công viên"]', 1),
  ('c0000000-0000-0000-0000-000000000019', 'SF3.0512', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000020', '5',  78.0, 2, 'Hiện đại',    'Căn hộ 2PN view sông, không gian thoáng mát, ban công rộng.',          'published', '["Hồ bơi","Sân vườn","An ninh 24/7","Công viên","Khu BBQ"]', 2);

-- Ecopark - The Golden
INSERT INTO units (id, code, project_id, tower_id, floor, area, bedrooms, style, description, status, features, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000020', 'G-0206', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000021', '2',  52.0, 1, 'Hiện đại',    'Căn hộ 1PN cao cấp khu The Golden, nội thất nhập khẩu, sang trọng.',   'published', '["Hồ bơi","An ninh 24/7","Gara","Công viên","Spa"]', 1),
  ('c0000000-0000-0000-0000-000000000021', 'G-0715', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000021', '7',  95.0, 3, 'Tân cổ điển', 'Căn hộ 3PN flagship, nội thất cao cấp nhất, view biệt thự Ecopark.',   'published', '["Hồ bơi","An ninh 24/7","Gara","Công viên","Spa","Phòng gym"]', 2);

-- === ADMIN USER ===
-- Email:    admin@lumidesign.vn
-- Password: admin123
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO admin_users (email, password_hash, role, is_active)
VALUES (
  'admin@lumidesign.vn',
  '$2b$10$VaswkkkPQUDA/SjZrLp1auVEK80uRReSMGOLgRRhUL08C6puiOL3S',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  is_active = true;

-- === MIGRATION: add is_featured column (idempotent for existing tables) ===
alter table units add column if not exists is_featured boolean default false not null;

-- === MARK FEATURED UNITS ===
-- Top-tier units across projects marked as featured for the featured section
UPDATE units SET is_featured = true WHERE code IN (
  'A1.1208',  -- Vinhomes Ocean Park - A1 - 3PN tân cổ điển
  'A3.0806',  -- Vinhomes Ocean Park - A3 - 3PN tân cổ điển, view hồ
  'A3.0703',  -- Vinhomes Ocean Park - A3 - 2PN tân cổ điển (popular)
  'SA5.0710', -- Vinhomes Smart City - SA5 The Sakura - 3PN tân cổ điển
  'G-0715'    -- Ecopark - The Golden - 3PN flagship
);

-- === VERIFICATION ===
-- Paste these into SQL Editor after running seed:
-- SELECT 'projects' as tbl, count(*)::text as cnt FROM projects
-- UNION ALL SELECT 'towers', count(*) FROM towers
-- UNION ALL SELECT 'units', count(*) FROM units
-- UNION ALL SELECT 'admins', count(*) FROM admin_users;
