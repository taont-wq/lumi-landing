// =============================================================
// LUMI ADMIN — Quản lý căn hộ
// =============================================================
// Xác thực: Bearer token (login → JWT-like HMAC token)
// Không hardcode URL, không hardcode secret
// =============================================================

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api' : '/api'; // same-origin trên production, local cũng same-origin nếu dùng Vercel
// Lưu ý: nếu dev với static server riêng, set API = 'http://localhost:3000/api'

// State
let token = localStorage.getItem('lumi_admin_token') || '';
let currentUser = null;
let currentPage = 1;
let currentFilter = '';
let currentFeatured = '';
let currentSearch = '';

// =============================================================
// INIT
// =============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showApp();
    loadUnits();
    loadProjectSelect();
  }
  bindEvents();
});

function bindEvents() {
  document.getElementById('login-form')?.addEventListener('submit', onLogin);
  document.getElementById('logout-btn')?.addEventListener('click', onLogout);
  document.getElementById('filter-status')?.addEventListener('change', onFilterChange);
  document.getElementById('filter-featured')?.addEventListener('change', onFilterChange);
  document.getElementById('search-input')?.addEventListener('input', debounce(onSearchChange, 400));
  document.getElementById('add-unit-btn')?.addEventListener('click', () => openForm());
  document.getElementById('modal-close-btn')?.addEventListener('click', closeForm);
  document.getElementById('modal-overlay')?.addEventListener('click', closeForm);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeForm);
  document.getElementById('unit-form')?.addEventListener('submit', onSaveUnit);
  document.getElementById('unit-project')?.addEventListener('change', onProjectChange);

  // Live preview + upload + change-password
  document.getElementById('unit-form')?.addEventListener('input', updatePreview);
  document.getElementById('unit-form')?.addEventListener('change', updatePreview);
  document.getElementById('unit-images-file')?.addEventListener('change', onImagesUpload);
  document.getElementById('unit-floorplan-file')?.addEventListener('change', onFloorPlanUpload);
  document.getElementById('changepw-btn')?.addEventListener('click', openChangePw);
  document.getElementById('changepw-close-btn')?.addEventListener('click', closeChangePw);
  document.getElementById('changepw-overlay')?.addEventListener('click', closeChangePw);
  document.getElementById('changepw-cancel-btn')?.addEventListener('click', closeChangePw);
  document.getElementById('changepw-form')?.addEventListener('submit', onSaveChangePw);
}

// =============================================================
// LOGIN
// =============================================================
async function onLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showError(errorEl, 'Vui lòng nhập email và mật khẩu');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang đăng nhập...';
  errorEl.classList.remove('visible');

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      showError(errorEl, data.error || 'Đăng nhập thất bại');
      return;
    }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('lumi_admin_token', token);
    showApp();
    loadUnits();
    loadProjectSelect();
    showToast('Đăng nhập thành công', 'success');
  } catch (err) {
    showError(errorEl, 'Không thể kết nối đến máy chủ');
    console.error('Login error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
}

function onLogout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('lumi_admin_token');
  showLogin();
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
}

// =============================================================
// UI SWITCH
// =============================================================
function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app-layout').classList.remove('active');
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-layout').classList.add('active');
  const info = document.getElementById('admin-user-info');
  if (currentUser) info.textContent = `${currentUser.email} (${currentUser.role})`;
}

// =============================================================
// ADMIN API CALL
// =============================================================
async function apiAdmin(path, options = {}) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired — redirect login
    onLogout();
    showToast('Phiên đăng nhập hết hạn', 'error');
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

  return data;
}

// =============================================================
// LOAD UNITS
// =============================================================
async function loadUnits() {
  const tbody = document.getElementById('units-tbody');
  const loading = document.getElementById('table-loading');
  const content = document.getElementById('table-content');

  if (!tbody || !loading || !content) return;

  loading.style.display = 'block';
  content.style.display = 'none';

  try {
    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', 30);
    if (currentFilter) params.set('status', currentFilter);
    if (currentFeatured) params.set('featured', currentFeatured);
    if (currentSearch) params.set('search', currentSearch);

    const result = await apiAdmin(`/admin/units?${params}`);

    loading.style.display = 'none';
    content.style.display = 'block';

    if (!result.data?.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="9">Không có căn hộ nào</td></tr>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(u => `
      <tr>
        <td><strong>${esc(u.code)}</strong></td>
        <td>${esc(u.project?.name || '—')}</td>
        <td>${esc(u.tower?.name || '—')}</td>
        <td>${u.area ? u.area + 'm²' : '—'}</td>
        <td>${u.bedrooms || '—'}</td>
        <td><span class="status-badge status-${esc(u.status)}">${statusLabel(u.status)}</span></td>
        <td style="white-space:nowrap;font-size:0.75rem;color:#9CA3AF">${u.updated_at ? new Date(u.updated_at).toLocaleDateString('vi-VN') : '—'}</td>
        <td style="text-align:center">
          <button class="btn btn-sm ${u.is_featured ? 'btn-primary' : 'btn-secondary'}"
            onclick="toggleFeatured('${u.id}', ${u.is_featured ? 'false' : 'true'})"
            title="${u.is_featured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}">
            ${u.is_featured ? '★' : '☆'}
          </button>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn btn-secondary btn-sm" onclick="editUnit('${u.id}')">Sửa</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUnit('${u.id}',${JSON.stringify(u.code)})">Xoá</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Pagination
    renderPagination(result.totalPages, result.page);
  } catch (err) {
    console.error('Load units error:', err);
    loading.style.display = 'none';
    content.style.display = 'block';
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Lỗi tải dữ liệu</td></tr>';
  }
}

function renderPagination(totalPages, current) {
  const el = document.getElementById('pagination');
  if (!el || totalPages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, current + 2);

  if (start > 1) html += `<button class="page-btn" onclick="goPage(1)">1</button>`;
  if (start > 2) html += `<button class="page-btn" disabled>...</button>`;

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }

  if (end < totalPages - 1) html += `<button class="page-btn" disabled>...</button>`;
  if (end < totalPages) html += `<button class="page-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;

  el.innerHTML = html;
}

window.goPage = function(page) {
  currentPage = page;
  loadUnits();
};

// =============================================================
// FILTERS
// =============================================================
function onFilterChange() {
  currentFilter = document.getElementById('filter-status').value;
  currentFeatured = document.getElementById('filter-featured').value;
  currentPage = 1;
  loadUnits();
}

function onSearchChange() {
  currentSearch = document.getElementById('search-input').value.trim();
  currentPage = 1;
  loadUnits();
}

// =============================================================
// LOAD PROJECT/TOWER SELECTS
// =============================================================
async function loadProjectSelect() {
  const select = document.getElementById('unit-project');
  if (!select) return;

  try {
    const projects = await apiAdmin('/admin/projects');
    // Fallback: nếu không có endpoint admin/projects, dùng public
    if (!projects?.length) {
      const pub = await fetch(`${API}/projects`).then(r => r.json());
      select.innerHTML = '<option value="">— Chọn dự án —</option>'
        + pub.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
      return;
    }
    select.innerHTML = '<option value="">— Chọn dự án —</option>'
      + projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  } catch (err) {
    console.error('Load projects error:', err);
    select.innerHTML = '<option value="">Không thể tải dự án</option>';
  }
}

async function loadTowerSelect(projectId) {
  const select = document.getElementById('unit-tower');
  if (!select) return;

  if (!projectId) {
    select.innerHTML = '<option value="">Chọn dự án trước</option>';
    select.disabled = true;
    return;
  }

  select.disabled = true;
  select.innerHTML = '<option value="">Đang tải...</option>';

  try {
    const towers = await apiAdmin(`/admin/towers?project=${encodeURIComponent(projectId)}`);
    // Fallback: public API
    if (!towers?.length) {
      const pub = await fetch(`${API}/towers?project=${encodeURIComponent(projectId)}`).then(r => r.json());
      select.innerHTML = '<option value="">— Chọn toà —</option>'
        + pub.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
      select.disabled = false;
      return;
    }
    select.innerHTML = '<option value="">— Chọn toà —</option>'
      + towers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    select.disabled = false;
  } catch (err) {
    console.error('Load towers error:', err);
    select.innerHTML = '<option value="">Lỗi tải</option>';
  }
}

function onProjectChange() {
  const projectId = document.getElementById('unit-project').value;
  loadTowerSelect(projectId);
}

// =============================================================
// CRUD — CREATE / EDIT
// =============================================================
let editingUnitId = null;

function openForm(unitData = null) {
  editingUnitId = unitData?.id || null;

  document.getElementById('modal-title').textContent = editingUnitId ? 'Sửa căn hộ' : 'Thêm căn hộ';
  document.getElementById('unit-modal').classList.add('active');
  document.getElementById('modal-overlay').classList.add('active');

  if (unitData) {
    document.getElementById('unit-code').value = unitData.code || '';
    document.getElementById('unit-status').value = unitData.status || 'draft';
    document.getElementById('unit-area').value = unitData.area || '';
    document.getElementById('unit-bedrooms').value = unitData.bedrooms || '';
    document.getElementById('unit-floor').value = unitData.floor || '';
    document.getElementById('unit-style').value = unitData.style || '';
    document.getElementById('unit-desc').value = unitData.description || '';
    document.getElementById('unit-images').value = (unitData.images || []).join('\n');
    document.getElementById('unit-floor-plan').value = unitData.floor_plan || '';
    document.getElementById('unit-sort-order').value = unitData.sort_order || '';
    document.getElementById('unit-features').value = (unitData.features || []).join('\n');
    document.getElementById('unit-featured').checked = unitData.is_featured === true;
    document.getElementById('unit-videos').value = (unitData.videos || []).map(v => v.url).join('\n');

    // Load và select project/tower
    if (unitData.project_id) {
      loadProjectSelect().then(() => {
        document.getElementById('unit-project').value = unitData.project_id;
        loadTowerSelect(unitData.project_id).then(() => {
          if (unitData.tower_id) {
            document.getElementById('unit-tower').value = unitData.tower_id;
          }
        });
      });
    }
  } else {
    document.getElementById('unit-form').reset();
    loadProjectSelect();
    document.getElementById('unit-tower').innerHTML = '<option value="">Chọn dự án trước</option>';
    document.getElementById('unit-tower').disabled = true;
  }
  updatePreview();
}

window.editUnit = async function(id) {
  try {
    const result = await apiAdmin(`/admin/units/detail/${id}`);
    // Fallback: dùng public detail nếu không có endpoint admin
    if (!result) {
      const pub = await fetch(`${API}/units/${encodeURIComponent(id)}`).then(r => r.json());
      openForm(pub);
      return;
    }
    openForm(result);
  } catch (err) {
    console.error('Edit load error:', err);
    // Thử public API
    try {
      const pub = await fetch(`${API}/units/${encodeURIComponent(id)}`).then(r => r.json());
      openForm(pub);
    } catch {
      showToast('Không thể tải thông tin căn hộ', 'error');
    }
  }
};

function closeForm() {
  document.getElementById('unit-modal').classList.remove('active');
  document.getElementById('modal-overlay').classList.remove('active');
  editingUnitId = null;
}

// =============================================================
// SAVE UNIT
// =============================================================
async function onSaveUnit(e) {
  e.preventDefault();
  const btn = document.getElementById('modal-save-btn');

  const data = {
    code: document.getElementById('unit-code').value.trim(),
    status: document.getElementById('unit-status').value,
    project_id: document.getElementById('unit-project').value || null,
    tower_id: document.getElementById('unit-tower').value || null,
    area: parseFloat(document.getElementById('unit-area').value) || null,
    bedrooms: parseInt(document.getElementById('unit-bedrooms').value) || null,
    floor: document.getElementById('unit-floor').value.trim(),
    style: document.getElementById('unit-style').value.trim(),
    description: document.getElementById('unit-desc').value.trim(),
    images: document.getElementById('unit-images').value.split('\n').map(s => s.trim()).filter(Boolean),
    floor_plan: document.getElementById('unit-floor-plan').value.trim(),
    sort_order: parseInt(document.getElementById('unit-sort-order').value) || 0,
    features: document.getElementById('unit-features').value.split('\n').map(s => s.trim()).filter(Boolean),
    videos: parseVideos(document.getElementById('unit-videos').value),
    is_featured: document.getElementById('unit-featured').checked,
  };

  if (!data.code) {
    showToast('Mã căn là bắt buộc', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang lưu...';

  try {
    if (editingUnitId) {
      // Update — dùng POST + upsert logic (API tự xử lý)
      // Hoặc dùng PUT riêng
      await apiAdmin(`/admin/units/${editingUnitId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      showToast('Đã cập nhật căn hộ', 'success');
    } else {
      await apiAdmin('/admin/units', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      showToast('Đã thêm căn hộ mới', 'success');
    }

    closeForm();
    loadUnits();
  } catch (err) {
    showToast(err.message || 'Lưu thất bại', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingUnitId ? 'Cập nhật' : 'Lưu';
  }
}

// =============================================================
// DELETE UNIT
// =============================================================
window.deleteUnit = function(id, code) {
  if (!confirm(`Xoá căn ${code}? Hành động này không thể hoàn tác.`)) return;

  apiAdmin(`/admin/units/${id}`, { method: 'DELETE' })
    .then(() => {
      showToast(`Đã xoá căn ${code}`, 'success');
      loadUnits();
    })
    .catch(err => showToast(err.message || 'Xoá thất bại', 'error'));
};

// =============================================================
// FEATURED TOGGLE
// =============================================================
window.toggleFeatured = async function(id, newValue) {
  try {
    const isFeatured = newValue === 'true' || newValue === true;
    await apiAdmin(`/admin/units/featured/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_featured: isFeatured }),
    });
    showToast(isFeatured ? 'Đã đánh dấu nổi bật' : 'Đã bỏ nổi bật', 'success');
    loadUnits();
  } catch (err) {
    showToast(err.message || 'Thao tác thất bại', 'error');
  }
};

// =============================================================
// CHANGE PASSWORD
// =============================================================
function openChangePw() {
  document.getElementById('changepw-form').reset();
  document.getElementById('changepw-error').classList.remove('visible');
  document.getElementById('changepw-modal').classList.add('active');
  document.getElementById('changepw-overlay').classList.add('active');
}

function closeChangePw() {
  document.getElementById('changepw-modal').classList.remove('active');
  document.getElementById('changepw-overlay').classList.remove('active');
}

async function onSaveChangePw(e) {
  e.preventDefault();
  const btn = document.getElementById('changepw-save-btn');
  const err = document.getElementById('changepw-error');
  err.classList.remove('visible');

  const cur = document.getElementById('changepw-current').value;
  const neu = document.getElementById('changepw-new').value;
  const confirm = document.getElementById('changepw-confirm').value;

  if (!cur || !neu) { showError(err, 'Vui lòng nhập đầy đủ'); return; }
  if (neu.length < 6) { showError(err, 'Mật khẩu mới ít nhất 6 ký tự'); return; }
  if (neu !== confirm) { showError(err, 'Mật khẩu xác nhận không khớp'); return; }

  btn.disabled = true;
  btn.textContent = 'Đang lưu...';
  try {
    const res = await fetch(`${API}/admin/change-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: cur, new_password: neu }),
    });
    const data = await res.json();
    if (!res.ok) { showError(err, data.error || 'Thất bại'); return; }
    showToast('Đổi mật khẩu thành công', 'success');
    closeChangePw();
  } catch {
    showError(err, 'Không thể kết nối đến máy chủ');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đổi mật khẩu';
  }
}

// =============================================================
// UPLOAD (ảnh / PDF) → Supabase Storage qua API
// =============================================================
async function uploadFiles(files, folder, onDone) {
  const fd = new FormData();
  files.forEach(f => fd.append('file', f));
  fd.append('folder', folder);
  try {
    const res = await fetch(`${API}/admin/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Upload thất bại', 'error'); return; }
    onDone(data.urls || []);
    showToast('Upload thành công', 'success');
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload thất bại', 'error');
  }
}

async function onImagesUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  await uploadFiles(files, 'images', (urls) => {
    const ta = document.getElementById('unit-images');
    const existing = ta.value.trim() ? ta.value.trim().split('\n') : [];
    ta.value = [...existing, ...urls].join('\n');
    updatePreview();
  });
  e.target.value = '';
}

async function onFloorPlanUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  await uploadFiles(files, 'floorplans', (urls) => {
    if (urls[0]) {
      document.getElementById('unit-floor-plan').value = urls[0];
      updatePreview();
    }
  });
  e.target.value = '';
}

// =============================================================
// LIVE PREVIEW
// =============================================================
function updatePreview() {
  const el = document.getElementById('unit-preview');
  if (!el) return;

  const code = document.getElementById('unit-code').value.trim();
  const status = document.getElementById('unit-status').value;
  const images = document.getElementById('unit-images').value.split('\n').map(s => s.trim()).filter(Boolean);
  const area = document.getElementById('unit-area').value.trim();
  const bedrooms = document.getElementById('unit-bedrooms').value.trim();
  const floor = document.getElementById('unit-floor').value.trim();
  const style = document.getElementById('unit-style').value.trim();
  const desc = document.getElementById('unit-desc').value.trim();
  const features = document.getElementById('unit-features').value.split('\n').map(s => s.trim()).filter(Boolean);
  const floorPlan = document.getElementById('unit-floor-plan').value.trim();
  const videos = parseVideos(document.getElementById('unit-videos').value);

  const mainImg = images[0] || '';
  const thumbs = images.slice(0, 6).map(src => `<img src="${esc(src)}" alt="">`).join('');
  const meta = [area ? `${area}m²` : '', bedrooms ? `${bedrooms} PN` : '', floor ? `Tầng ${esc(floor)}` : '', style ? esc(style) : '']
    .filter(Boolean).map(m => `<span>${m}</span>`).join('');

  el.innerHTML = `
    <div class="pv-eyebrow">Xem trước</div>
    <div class="pv-card">
      <div class="pv-image">
        ${mainImg ? `<img src="${esc(mainImg)}" alt="${esc(code)}">` : `<div class="pv-placeholder">${esc(code) || 'Căn hộ'}</div>`}
        <span class="pv-badge ${esc(status)}">${statusLabel(status)}</span>
      </div>
      ${thumbs ? `<div class="pv-thumbs">${thumbs}</div>` : ''}
      <div class="pv-body">
        <h4>${esc(code) || 'Mã căn'}</h4>
        ${meta ? `<div class="pv-meta">${meta}</div>` : ''}
        ${desc ? `<p class="pv-desc">${esc(desc)}</p>` : ''}
        ${features.length ? `<div class="pv-features">${features.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
        <div class="pv-links">
          ${floorPlan ? `<span class="pv-link">📄 Mặt bằng</span>` : ''}
          ${videos.length ? `<span class="pv-link">🎬 ${videos.length} video</span>` : ''}
        </div>
      </div>
    </div>`;
}

function parseVideos(text) {
  return text.split('\n').map(s => s.trim()).filter(Boolean).map(url => ({ type: videoType(url), url }));
}

function videoType(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  return 'other';
}

// =============================================================
// HELPERS
// =============================================================
function statusLabel(status) {
  const labels = { published: 'Đã thi công', draft: 'Nháp', hidden: 'Ẩn', sold: 'Đang thi công' };
  return labels[status] || status;
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}
