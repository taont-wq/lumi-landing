// =============================================================
// Input validation + whitelist — không trust user input
// =============================================================

const ALLOWED_UNIT_FIELDS = [
  'code', 'project_id', 'tower_id', 'sort_order',
  'floor', 'room_number', 'area', 'bedrooms',
  'style', 'description', 'status',
  'features', 'images', 'floor_plan', 'videos',
  'zalo_conversation_id',
];

const ALLOWED_PROJECT_FIELDS = [
  'name', 'slug', 'description', 'thumbnail', 'sort_order', 'status',
];

const ALLOWED_TOWER_FIELDS = [
  'project_id', 'name', 'slug', 'sort_order', 'status',
];

// Kiểu dữ liệu cho từng field
const FIELD_TYPES = {
  code:          { type: 'string', maxLen: 20, transform: v => v.toUpperCase() },
  project_id:    { type: 'uuid' },
  tower_id:      { type: 'uuid' },
  sort_order:    { type: 'integer', min: 0, max: 99999 },
  floor:         { type: 'string', maxLen: 10 },
  room_number:   { type: 'string', maxLen: 10 },
  area:          { type: 'numeric', min: 0, max: 99999 },
  bedrooms:      { type: 'integer', min: 0, max: 50 },
  style:         { type: 'string', maxLen: 100 },
  description:   { type: 'string', maxLen: 2000 },
  status:        { type: 'enum', values: ['draft', 'published', 'hidden', 'sold'] },
  features:      { type: 'array', itemType: 'string', maxItems: 50 },
  images:        { type: 'array', itemType: 'string', maxItems: 50, maxItemLen: 500 },
  floor_plan:    { type: 'string', maxLen: 500 },
  videos:        { type: 'array', maxItems: 20 },
  zalo_conversation_id: { type: 'string', maxLen: 100 },
  name:          { type: 'string', maxLen: 200 },
  slug:          { type: 'string', maxLen: 100, pattern: /^[a-z0-9-]+$/ },
  thumbnail:     { type: 'string', maxLen: 500 },
  email:         { type: 'string', maxLen: 255 },
  password_hash: { type: 'string', maxLen: 255 },
  role:          { type: 'enum', values: ['admin', 'editor'] },
  is_active:     { type: 'boolean' },
};

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Validate và sanitize input theo field list + type definitions.
 * Trả về { data, errors }.
 * data: object chỉ chứa các field cho phép, đã được transform/trim.
 * errors: mảng lỗi (nếu có).
 */
function sanitize(body, allowedFields) {
  if (!body || typeof body !== 'object') {
    return { data: null, errors: ['Body phải là JSON object'] };
  }

  const data = {};
  const errors = [];

  for (const field of allowedFields) {
    if (body[field] === undefined || body[field] === null) continue;

    const def = FIELD_TYPES[field];
    if (!def) {
      continue; // skip unknown fields silently
    }

    let value = body[field];

    switch (def.type) {
      case 'string': {
        value = String(value).trim();
        if (def.maxLen && value.length > def.maxLen) {
          errors.push(`"${field}" vượt quá ${def.maxLen} ký tự`);
          continue;
        }
        if (def.pattern && !def.pattern.test(value)) {
          errors.push(`"${field}" sai định dạng`);
          continue;
        }
        if (def.transform) value = def.transform(value);
        data[field] = value;
        break;
      }
      case 'uuid': {
        if (!isUUID(String(value))) {
          errors.push(`"${field}" không phải UUID hợp lệ`);
          continue;
        }
        data[field] = value;
        break;
      }
      case 'integer': {
        const intVal = parseInt(value, 10);
        if (isNaN(intVal)) {
          errors.push(`"${field}" phải là số nguyên`);
          continue;
        }
        if (def.min !== undefined && intVal < def.min) {
          errors.push(`"${field}" phải >= ${def.min}`);
          continue;
        }
        if (def.max !== undefined && intVal > def.max) {
          errors.push(`"${field}" phải <= ${def.max}`);
          continue;
        }
        data[field] = intVal;
        break;
      }
      case 'numeric': {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          errors.push(`"${field}" phải là số`);
          continue;
        }
        if (def.min !== undefined && numVal < def.min) {
          errors.push(`"${field}" phải >= ${def.min}`);
          continue;
        }
        if (def.max !== undefined && numVal > def.max) {
          errors.push(`"${field}" phải <= ${def.max}`);
          continue;
        }
        data[field] = numVal;
        break;
      }
      case 'boolean': {
        if (typeof value === 'boolean') {
          data[field] = value;
        } else if (value === 'true' || value === '1') {
          data[field] = true;
        } else if (value === 'false' || value === '0') {
          data[field] = false;
        } else {
          errors.push(`"${field}" phải là boolean`);
          continue;
        }
        break;
      }
      case 'enum': {
        if (!def.values.includes(value)) {
          errors.push(`"${field}" phải là một trong: ${def.values.join(', ')}`);
          continue;
        }
        data[field] = value;
        break;
      }
      case 'array': {
        if (!Array.isArray(value)) {
          errors.push(`"${field}" phải là mảng`);
          continue;
        }
        if (def.maxItems && value.length > def.maxItems) {
          errors.push(`"${field}" tối đa ${def.maxItems} phần tử`);
          continue;
        }
        if (def.itemType === 'string') {
          value = value.map(v => {
            const s = String(v).trim();
            return def.maxItemLen ? s.slice(0, def.maxItemLen) : s;
          });
        }
        data[field] = value;
        break;
      }
      default:
        data[field] = value;
    }
  }

  return { data, errors };
}

// Kiểm tra field bắt buộc
function requireFields(data, required) {
  const missing = required.filter(f => data[f] === undefined || data[f] === null);
  if (missing.length > 0) {
    return `Thiếu field bắt buộc: ${missing.join(', ')}`;
  }
  return null;
}

export { sanitize, requireFields, ALLOWED_UNIT_FIELDS, ALLOWED_PROJECT_FIELDS, ALLOWED_TOWER_FIELDS };
