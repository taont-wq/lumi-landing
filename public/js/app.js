// =============================================================
// LUMI DESIGN — Landing Page Main Script
// =============================================================
// 3-level filter: Dự án → Toà → Căn hộ
// Featured, Search, Contact
// =============================================================
import { API, getConfig, apiFetch, setLoading, setError, setEmpty } from './utils.js';

// --- DOM refs ---
const projectSelect = document.getElementById('project-select');
const towerSelect = document.getElementById('tower-select');
const unitGrid = document.getElementById('unit-grid');
const searchInput = document.getElementById('search-input');
const featuredGrid = document.getElementById('featured-grid');
const contactPhone = document.getElementById('contact-phone');
const loadMoreBtn = document.getElementById('load-more');

// State
let lastFilterRequest = 0;
let currentFilter = { project: '', tower: '', search: '' };
let currentPage = 1;
let totalPages = 1;
const PAGE_SIZE = 20;
const towerCache = new Map(); // projectId → towers[]

// =============================================================
// INIT
// =============================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([
      loadConfig(),
      loadProjects(),
      loadFeatured(),
    ]);
  } catch (err) {
    console.error('Init error:', err);
  }

  // Bind events
  projectSelect?.addEventListener('change', onProjectChange);
  towerSelect?.addEventListener('change', onTowerChange);
  searchInput?.addEventListener('input', debounce(onSearchChange, 150));
  loadMoreBtn?.addEventListener('click', loadMore);

  // Prefetch towers for first project (nếu có sẵn)
  if (projectSelect && projectSelect.options.length > 1) {
    const firstId = projectSelect.options[1].value;
    if (firstId && !towerCache.has(firstId)) {
      apiFetch(`/towers?project=${encodeURIComponent(firstId)}`)
        .then(towers => { if (towers) towerCache.set(firstId, towers); })
        .catch(() => {});
    }
  }
});

// =============================================================
// CONFIG
// =============================================================
async function loadConfig() {
  const config = await getConfig();
  if (config.phone) {
    if (contactPhone) {
      contactPhone.textContent = config.phone;
      contactPhone.href = `tel:${config.phone.replace(/\s/g, '')}`;
    }
    const phoneLinks = document.querySelectorAll('[data-phone]');
    phoneLinks.forEach(el => { el.textContent = config.phone; });
    window.contactPhone = config.phone; // FRONT-03: cho modal dùng
  }
  window.zaloOA = config.zalo_oa_id || '';
  window.siteUrl = config.site_url || 'https://noithatlumi.vn';
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear(); // FRONT-04

  // Set Zalo links
  const zaloOA = window.zaloOA;
  if (zaloOA) {
    const zaloLinks = document.querySelectorAll('#header-zalo, #contact-zalo');
    zaloLinks.forEach(el => {
      el.href = `https://zalo.me/${zaloOA}`;
    });
  }

  // Set logo if configured
  if (config.logo) {
    const logo = document.getElementById('header-logo');
    if (logo) {
      logo.innerHTML = `<img src="${escapeHtml(config.logo)}" alt="${escapeHtml(config.company)}" class="header-logo-img" style="height:36px;width:auto" />`;
      logo.style.display = 'flex';
    }
  }
}

// =============================================================
// PROJECTS LOAD
// =============================================================
async function loadProjects() {
  if (!projectSelect) return;
  setLoading(projectSelect);

  try {
    const projects = await apiFetch('/projects');
    projectSelect.disabled = false;
    projectSelect.innerHTML = '<option value="">Chọn dự án</option>'
      + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (err) {
    console.error('Load projects failed:', err);
    setError(projectSelect);
  }
}

// =============================================================
// FILTER CASCADE với race condition guard
// =============================================================
async function onProjectChange() {
  const requestId = ++lastFilterRequest;
  const projectId = projectSelect?.value || '';
  currentFilter.project = projectId;
  currentFilter.tower = '';
  currentPage = 1;
  // Clear search text when project changes for faster feel
  if (searchInput) searchInput.value = '';

  // Reset tower select
  if (towerSelect) {
    if (!projectId) {
      towerSelect.innerHTML = '<option value="">Chọn dự án trước</option>';
      towerSelect.disabled = true;
      showUnitsSection(false);
      return;
    }
    setLoading(towerSelect, 'Đang tải toà...');
  }

  try {
    // Check cache first
    let towers = towerCache.get(projectId);
    if (!towers) {
      towers = await apiFetch(`/towers?project=${encodeURIComponent(projectId)}`);
      towerCache.set(projectId, towers);
    }

    // Discard stale response
    if (requestId !== lastFilterRequest) return;

    if (towerSelect) {
      towerSelect.disabled = false;
      towerSelect.innerHTML = '<option value="">Chọn toà</option>'
        + towers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    // Auto-load units nếu chỉ có 1 tower
    if (towers.length === 1 && towerSelect) {
      towerSelect.value = towers[0].id;
      await loadUnits(towers[0].id, projectId, requestId);
    } else {
      showUnitsSection(false);
    }
  } catch (err) {
    console.error('Load towers failed:', err);
    if (requestId === lastFilterRequest && towerSelect) {
      setError(towerSelect);
    }
  }
}

async function onTowerChange() {
  const requestId = ++lastFilterRequest;
  const towerId = towerSelect?.value || '';
  currentFilter.tower = towerId;
  currentPage = 1;

  await loadUnits(towerId, currentFilter.project, requestId);
}

async function onSearchChange() {
  const requestId = ++lastFilterRequest;
  currentFilter.search = searchInput?.value?.trim() || '';
  currentPage = 1;

  // Search kết hợp với filter hiện tại (project + tower)
  await loadUnits(currentFilter.tower, currentFilter.project, requestId, currentFilter.search);
}

// =============================================================
// UNITS LOAD
// =============================================================
async function loadUnits(towerId, projectId, requestId, search) {
  // Show units section khi có filter active
  const hasFilter = towerId || projectId || (search && search.length > 0);
  if (!hasFilter) {
    showUnitsSection(false);
    return;
  }

  showUnitsSection(true);

  if (unitGrid) {
    unitGrid.innerHTML = '<div class="loading-spinner"></div>';
  }

  const params = new URLSearchParams();
  params.set('page', currentPage);
  params.set('limit', PAGE_SIZE);

  if (towerId) params.set('tower', towerId);
  if (projectId) params.set('project', projectId);
  if (search) params.set('search', search);

  try {
    const result = await apiFetch(`/units?${params.toString()}`);

    // Discard stale response
    if (requestId && requestId !== lastFilterRequest) return;

    totalPages = result.totalPages || 1;
    renderUnits(result.data || []);

    // Load more button
    if (loadMoreBtn) {
      loadMoreBtn.style.display = currentPage < totalPages ? 'block' : 'none';
    }
  } catch (err) {
    console.error('Load units failed:', err);
    if (!requestId || requestId === lastFilterRequest) {
      renderUnits([]);
    }
  }
}

async function loadMore() {
  currentPage++;
  const params = new URLSearchParams();
  params.set('page', currentPage);
  params.set('limit', PAGE_SIZE);
  if (currentFilter.tower) params.set('tower', currentFilter.tower);
  if (currentFilter.project) params.set('project', currentFilter.project);
  if (currentFilter.search) params.set('search', currentFilter.search);

  try {
    const result = await apiFetch(`/units?${params.toString()}`);
    appendUnits(result.data || []);
    totalPages = result.totalPages || 1;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = currentPage < totalPages ? 'block' : 'none';
    }
  } catch (err) {
    console.error('Load more failed:', err);
    currentPage--; // rollback
  }
}

// =============================================================
// SECTION VISIBILITY
// =============================================================
function showUnitsSection(show) {
  const section = document.getElementById('units-section');
  if (!section) return;
  section.style.display = show ? 'block' : 'none';
}

// =============================================================
// RENDER
// =============================================================
function renderUnits(units) {
  if (!unitGrid) return;

  if (!units || units.length === 0) {
    unitGrid.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        </svg>
        <p>Chưa có căn hộ nào</p>
        <span>Thử thay đổi bộ lọc hoặc quay lại sau</span>
      </div>`;
    return;
  }

  unitGrid.innerHTML = units.map(unit => `
    <div class="unit-card" onclick="openUnitModal('${escapeHtml(unit.id)}')">
      <div class="unit-card-image">
        ${unit.images?.[0]
          ? `<img src="${escapeHtml(unit.images[0])}" alt="${escapeHtml(unit.code)}" loading="lazy" />`
          : `<div class="unit-card-placeholder">${escapeHtml(unit.code)}</div>`
        }
        <span class="unit-card-badge ${escapeHtml(unit.status)}">${statusLabel(unit.status)}</span>
      </div>
      <div class="unit-card-body">
        <h3 class="unit-card-code">${escapeHtml(unit.code)}</h3>
        <div class="unit-card-meta">
          <span>${unit.area ? unit.area + 'm²' : ''}</span>
          ${unit.bedrooms ? `<span>${unit.bedrooms} PN</span>` : ''}
          ${unit.floor ? `<span>Tầng ${escapeHtml(unit.floor)}</span>` : ''}
        </div>
        ${unit.style ? `<p class="unit-card-style">${escapeHtml(unit.style)}</p>` : ''}
      </div>
    </div>
  `).join('');
}

function appendUnits(units) {
  if (!unitGrid || !units?.length) return;
  unitGrid.insertAdjacentHTML('beforeend', units.map(unit => `
    <div class="unit-card" onclick="openUnitModal('${escapeHtml(unit.id)}')">
      <div class="unit-card-image">
        ${unit.images?.[0]
          ? `<img src="${escapeHtml(unit.images[0])}" alt="${escapeHtml(unit.code)}" loading="lazy" />`
          : `<div class="unit-card-placeholder">${escapeHtml(unit.code)}</div>`
        }
        <span class="unit-card-badge ${escapeHtml(unit.status)}">${statusLabel(unit.status)}</span>
      </div>
      <div class="unit-card-body">
        <h3 class="unit-card-code">${escapeHtml(unit.code)}</h3>
        <div class="unit-card-meta">
          ${unit.area ? `<span>${escapeHtml(String(unit.area))}m²</span>` : ''}
          ${unit.bedrooms ? `<span>${escapeHtml(String(unit.bedrooms))} PN</span>` : ''}
          ${unit.floor ? `<span>Tầng ${escapeHtml(unit.floor)}</span>` : ''}
        </div>
        ${unit.style ? `<p class="unit-card-style">${escapeHtml(unit.style)}</p>` : ''}
      </div>
    </div>
  `).join(''));
}

// =============================================================
// FEATURED
// =============================================================
async function loadFeatured() {
  if (!featuredGrid) return;

  try {
    const units = await apiFetch('/featured');
    if (!units?.length) return;

    featuredGrid.innerHTML = units.slice(0, 6).map(unit => `
      <div class="featured-card" onclick="openUnitModal('${escapeHtml(unit.id)}')">
        <div class="featured-card-image">
          ${unit.images?.[0]
            ? `<img src="${escapeHtml(unit.images[0])}" alt="${escapeHtml(unit.code)}" loading="lazy" />`
            : `<div class="unit-card-placeholder">${escapeHtml(unit.code)}</div>`
          }
        </div>
        <div class="featured-card-body">
          <h4>${escapeHtml(unit.code)}</h4>
          <p>${escapeHtml(String(unit.area || ''))}m² · ${escapeHtml(String(unit.bedrooms || ''))}PN · ${escapeHtml(unit.style || '')}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load featured failed:', err);
  }
}

// =============================================================
// MODAL (detail)
// =============================================================
window.openUnitModal = async function(unitId) {
  if (!unitId) return;
  // Chi tiết căn hộ — popup modal
  // Code này được gọi từ onclick trong HTML
  try {
    const modal = document.getElementById('unit-modal');
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    if (!modal || !content) return;

    content.innerHTML = '<div class="loading-spinner"></div>';
    modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Fetch unit detail — cần endpoint trả về chi tiết
    // Tạm thời dùng search by code từ featured card (ID là đủ)
    // Có thể dùng endpoint /api/units/:code
    // Vì có ID, dùng API tìm
    const data = await apiFetch(`/units/${encodeURIComponent(unitId)}`);

    const projectName = data.project?.name || '';
    const towerName = data.tower?.name || '';
    const detailTitle = [escapeHtml(data.code), projectName, towerName].filter(Boolean).join(' — ');

    content.innerHTML = `
      <button class="modal-close" onclick="closeUnitModal()">&times;</button>
      <div class="modal-gallery">
        ${(data.images || []).map(img =>
          `<img src="${escapeHtml(img)}" alt="${escapeHtml(data.code)}" loading="lazy" />`
        ).join('')}
      </div>
      <div class="modal-info">
        <h2>${detailTitle}</h2>
        ${(projectName || towerName) ? `
          <div class="modal-location">
            ${projectName ? `<span>🏢 ${escapeHtml(projectName)}</span>` : ''}
            ${towerName ? `<span>🏗️ Tòa ${escapeHtml(towerName)}</span>` : ''}
          </div>
        ` : ''}
        <div class="modal-meta">
          ${data.area ? `<span>Diện tích: <strong>${data.area}m²</strong></span>` : ''}
          ${data.bedrooms ? `<span>Phòng ngủ: <strong>${data.bedrooms}PN</strong></span>` : ''}
          ${data.floor ? `<span>Tầng: <strong>${escapeHtml(data.floor)}</strong></span>` : ''}
          ${data.style ? `<span>Phong cách: <strong>${escapeHtml(data.style)}</strong></span>` : ''}
        </div>
        ${data.description ? `<p class="modal-desc">${escapeHtml(data.description)}</p>` : ''}
        ${data.features?.length ? `
          <div class="modal-features">
            <h3>Tiện ích</h3>
            <ul>${data.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${data.floor_plan ? `
          <a href="${escapeHtml(data.floor_plan)}" target="_blank" rel="noopener" class="btn btn-outline">
            📄 Xem mặt bằng
          </a>
        ` : ''}
        ${data.videos?.length ? `
          <div class="modal-videos">
            <h3>Video</h3>
            ${data.videos.map(v => {
              if (v.type === 'youtube') {
                const vid = v.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                return vid
                  ? `<iframe src="https://www.youtube.com/embed/${vid[1]}" loading="lazy" allowfullscreen></iframe>`
                  : '';
              }
              if (v.type === 'tiktok') {
                return `<blockquote class="tiktok-embed" cite="${escapeHtml(v.url)}">...</blockquote>`;
              }
              return '';
            }).join('')}
          </div>
        ` : ''}
        <div class="modal-contact">
          <a href="tel:${(window.contactPhone || '').replace(/\s/g, '')}" class="btn btn-primary">
            📞 Gọi ngay
          </a>
          <a href="https://zalo.me/${(window.zaloOA || '')}" target="_blank" rel="noopener" class="btn btn-zalo">
            💬 Chat Zalo
          </a>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Load unit detail failed:', err);
    document.getElementById('modal-content').innerHTML = `
      <button class="modal-close" onclick="closeUnitModal()">&times;</button>
      <div class="modal-error">
        <p>Không thể tải thông tin căn hộ</p>
        <button class="btn" onclick="closeUnitModal()">Đóng</button>
      </div>`;
  }
};

window.closeUnitModal = function() {
  const modal = document.getElementById('unit-modal');
  const overlay = document.getElementById('modal-overlay');
  if (modal) modal.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
};

// Close on overlay click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modal-overlay');
  overlay?.addEventListener('click', closeUnitModal);
});

// =============================================================
// HELPERS
// =============================================================
function statusLabel(status) {
  const labels = { published: 'Đang bán', draft: 'Nháp', hidden: 'Ẩn', sold: 'Đã bán' };
  return labels[status] || status;
}

function escapeHtml(str) {
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
