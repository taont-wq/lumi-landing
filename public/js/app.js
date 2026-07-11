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
let currentModalImages = []; // ảnh hiện tại trong modal chi tiết

// Inline SVG icons (thin-stroke, Heroicons-outline style)
const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.75 21h16.5M4.5 3h15M5.25 3v18M18.75 3v18M9 6.75h1.5M9 12h1.5M9 17.25h1.5M13.5 6.75h1.5M13.5 12h1.5M13.5 17.25h1.5"/></svg>',
  tower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.75 21h16.5M6 21V5a1 1 0 011-1h10a1 1 0 011 1v16M9 8.25h.008M15 8.25h.008M9 12h.008M15 12h.008M9 15.75h.008M15 15.75h.008"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 00-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-3.94-3.94c-.162-.441-.004-.928.38-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L8.25 3.102a1.125 1.125 0 00-1.091-.852H5.25A2.25 2.25 0 003 4.5v2.25z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>',
  zalo: '<svg viewBox="0 0 50 50" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M22.782 0.166H27.199c6.066 0 9.611.891 12.758 2.578a13.3 13.3 0 017.299 7.299c1.687 3.147 2.578 6.692 2.578 12.758v4.398c0 6.066-.891 9.611-2.578 12.758a13.3 13.3 0 01-7.299 7.299c-3.147 1.687-6.692 2.578-12.758 2.578h-4.398c-6.066 0-9.611-.891-12.758-2.578a13.3 13.3 0 01-7.299-7.299C1.057 36.81.166 33.265.166 27.199v-4.398c0-6.066.891-9.611 2.578-12.758a13.3 13.3 0 017.299-7.299C13.17 1.057 16.735.166 22.782.166z" fill="#0068FF"/><path opacity=".12" fill-rule="evenodd" clip-rule="evenodd" d="M49.834 26.474v.725c0 6.067-.891 9.612-2.578 12.759a13.3 13.3 0 01-7.299 7.298c-3.147 1.687-6.692 2.578-12.758 2.578h-4.398c-4.964 0-8.24-.596-10.99-1.738L7.275 43.427l42.559-16.953z" fill="#001A33"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7.779 43.589c2.323.257 5.227-.405 7.289-1.406 8.954 4.949 22.952 4.713 31.424-.71.329-.492.636-1.005.92-1.536 1.694-3.159 2.588-6.717 2.588-12.805v-4.414c0-6.089-.894-9.647-2.588-12.805-1.674-3.158-4.166-5.632-7.325-7.325-3.158-1.693-6.716-2.587-12.805-2.587h-4.433c-5.185 0-8.552.653-11.38 1.899-.155.138-.306.279-.455.422C2.717 10.32 2.087 27.66 9.123 37.078l.026.042c1.084 1.599.038 4.395-1.598 6.032-.266.247-.171.4.228.437z" fill="#fff"/><path d="M20.563 17h-9.725v2.085h6.749l-6.654 8.247c-.209.303-.36.587-.36 1.232v.53h9.175c.455 0 .834-.378.834-.833v-1.119h-6.256l6.256-7.848.341-.474c.36-.53.436-.986.436-1.536V17z" fill="#0068FF"/><path d="M32.942 29.095h1.383V17h-2.085v11.393c0 .38.303.702.702.702z" fill="#0068FF"/><path d="M25.814 19.692a4.739 4.739 0 100 9.479 4.739 4.739 0 000-9.479zm0 7.526a2.787 2.787 0 110-5.573 2.787 2.787 0 010 5.573z" fill="#0068FF"/><path d="M40.487 19.616a4.777 4.777 0 100 9.555 4.777 4.777 0 000-9.555zm0 7.602a2.806 2.806 0 110-5.611 2.806 2.806 0 010 5.611z" fill="#0068FF"/><path d="M29.456 29.094h1.119V19.957h-1.953v8.322c0 .436.38.815.834.815z" fill="#0068FF"/></svg>'
};

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
    unitGrid.innerHTML = renderSkeletons(6);
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
// SKELETON LOADERS
// =============================================================
function renderSkeletons(count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push(`
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-line w-60"></div>
          <div class="skeleton skeleton-line w-80"></div>
          <div class="skeleton skeleton-line w-40"></div>
        </div>
      </div>
    `);
  }
  return cards.join('');
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

  featuredGrid.innerHTML = renderSkeletons(4);

  try {
    const units = await apiFetch('/featured');
    if (!units?.length) return;

    featuredGrid.innerHTML = units.slice(0, 6).map((unit, i) => `
      <div class="featured-card${i % 2 === 1 ? ' offset' : ''}" onclick="openUnitModal('${escapeHtml(unit.id)}')">
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
  try {
    const modal = document.getElementById('unit-modal');
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    if (!modal || !content) return;

    content.innerHTML = '<div class="loading-spinner"></div>';
    modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const data = await apiFetch(`/units/${encodeURIComponent(unitId)}`);

    const projectName = data.project?.name || '';
    const towerName = data.tower?.name || '';
    const detailTitle = [escapeHtml(data.code), projectName, towerName].filter(Boolean).join(' — ');

    const images = Array.isArray(data.images) ? data.images : [];
    currentModalImages = images;
    const mainImg = images[0] || '';
    const videos = Array.isArray(data.videos) ? data.videos : [];

    const videosHtml = videos.length ? `
      <div class="modal-videos">
        <h3>Video tham khảo</h3>
        ${videos.map(v => {
          if (v.type === 'youtube') {
            const vid = v.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            return vid ? `<iframe src="https://www.youtube.com/embed/${vid[1]}" loading="lazy" allowfullscreen></iframe>` : '';
          }
          if (v.type === 'vimeo') {
            const vid = v.url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
            return vid ? `<iframe src="https://player.vimeo.com/video/${vid[1]}" loading="lazy" allowfullscreen></iframe>` : '';
          }
          if (v.type === 'tiktok') {
            return `<blockquote class="tiktok-embed" cite="${escapeHtml(v.url)}"><a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">Xem video TikTok</a></blockquote>`;
          }
          return `<a href="${escapeHtml(v.url)}" target="_blank" rel="noopener" class="btn btn-outline">${ICON.video}<span>Xem video</span></a>`;
        }).join('')}
      </div>` : '';

    content.innerHTML = `
      <button class="modal-close" onclick="closeUnitModal()">${ICON.close}</button>
      <div class="modal-grid">
        <div class="modal-media">
          <div class="modal-gallery-main">
            ${mainImg ? `<img id="modal-main-img" src="${escapeHtml(mainImg)}" alt="${escapeHtml(data.code)}" />` : `<div class="modal-gallery-empty">${escapeHtml(data.code)}</div>`}
          </div>
          ${images.length > 1 ? `<div class="modal-gallery-thumbs">${images.map((img, i) => `<button class="modal-thumb ${i === 0 ? 'active' : ''}" onclick="setGalleryImage(${i})"><img src="${escapeHtml(img)}" alt=""></button>`).join('')}</div>` : ''}
          ${data.floor_plan ? `<a href="${escapeHtml(data.floor_plan)}" target="_blank" rel="noopener" class="modal-floorplan">${ICON.doc}<span>Xem mặt bằng</span></a>` : ''}
          ${videosHtml}
        </div>
        <div class="modal-info">
          <div class="modal-eyebrow">Căn hộ nội thất cao cấp</div>
          <h2>${detailTitle}</h2>
          ${(projectName || towerName) ? `
            <div class="modal-location">
              ${projectName ? `<span>${ICON.building}<span>${escapeHtml(projectName)}</span></span>` : ''}
              ${towerName ? `<span>${ICON.tower}<span>Toà ${escapeHtml(towerName)}</span></span>` : ''}
            </div>
          ` : ''}
          <div class="modal-meta">
            ${data.area ? `<span>Diện tích<strong>${data.area}m²</strong></span>` : ''}
            ${data.bedrooms ? `<span>Phòng ngủ<strong>${data.bedrooms}PN</strong></span>` : ''}
            ${data.floor ? `<span>Tầng<strong>${escapeHtml(data.floor)}</strong></span>` : ''}
            ${data.style ? `<span>Phong cách<strong>${escapeHtml(data.style)}</strong></span>` : ''}
          </div>
          ${data.description ? `<p class="modal-desc">${escapeHtml(data.description)}</p>` : ''}
          ${data.features?.length ? `
            <div class="modal-features">
              <h3>Tiện ích</h3>
              <ul>${data.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          <div class="modal-contact">
            <a href="tel:${(window.contactPhone || '').replace(/\s/g, '')}" class="btn btn-primary">${ICON.phone}<span>Gọi ngay</span></a>
            <a href="https://zalo.me/${(window.zaloOA || '')}" target="_blank" rel="noopener" class="btn btn-zalo">${ICON.zalo}<span>Chat Zalo</span></a>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Load unit detail failed:', err);
    document.getElementById('modal-content').innerHTML = `
      <button class="modal-close" onclick="closeUnitModal()">${ICON.close}</button>
      <div class="modal-error">
        <p>Không thể tải thông tin căn hộ</p>
        <button class="btn" onclick="closeUnitModal()">Đóng</button>
      </div>`;
  }
};

window.setGalleryImage = function(index) {
  const img = currentModalImages[index];
  if (!img) return;
  const main = document.getElementById('modal-main-img');
  if (main) main.src = img;
  document.querySelectorAll('.modal-thumb').forEach((t, i) => t.classList.toggle('active', i === index));
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
  const labels = { published: 'Đã thi công', draft: 'Nháp', hidden: 'Ẩn', sold: 'Đang thi công' };
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
