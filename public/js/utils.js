// =============================================================
// LUMI DESIGN — Utilities
// =============================================================
// API client, config loader, error handler
// Không hardcode URL — tự động detect môi trường
// =============================================================

const API = (() => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    // Khi dev local, Vercel chạy function riêng
    return '/api';
  }
  return '/api'; // production same-origin
})();

// Cache đơn giản cho config (session)
let configCache = null;

/**
 * Lấy site config từ API. Cache trong sessionStorage.
 */
async function getConfig() {
  if (configCache) return configCache;
  try {
    const cached = sessionStorage.getItem('lumi_config');
    if (cached) {
      configCache = JSON.parse(cached);
      return configCache;
    }
  } catch (_) { /* ignore */ }

  try {
    const res = await fetch(`${API}/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    configCache = await res.json();
    try {
      sessionStorage.setItem('lumi_config', JSON.stringify(configCache));
    } catch (_) { /* quota exceeded */ }
    return configCache;
  } catch (err) {
    console.error('Failed to load config:', err);
    // Fallback — không hardcode, trả object rỗng
    return { phone: '', company: 'Lumi Design', siteUrl: '' };
  }
}

/**
 * Fetch API với error handling + timeout
 */
async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10000);

  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timeout');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Render loading state cho select element
 */
function setLoading(el, label = 'Đang tải...') {
  if (!el) return;
  el.innerHTML = `<option value="">${label}</option>`;
  el.disabled = true;
}

/**
 * Render error state cho select element
 */
function setError(el, label = 'Không thể tải dữ liệu') {
  if (!el) return;
  el.innerHTML = `<option value="">${label}</option>`;
  el.disabled = true;
}

/**
 * Render empty state
 */
function setEmpty(el, label = 'Không có dữ liệu') {
  if (!el) return;
  el.innerHTML = `<option value="">${label}</option>`;
  el.disabled = true;
}

/**
 * Format số
 */
function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export { API, getConfig, apiFetch, setLoading, setError, setEmpty, formatNumber };
