// =============================================================
// Zalo Bot helpers — send message, parse unit from caption
// =============================================================

const ZALO_API = 'https://openapi.zalo.me/v3/oa/message/cs';

/**
 * Gửi tin nhắn Zalo với retry logic
 */
async function sendZalo(chatId, text, attachment = null) {
  const accessToken = process.env.ZALO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('ZALO_ACCESS_TOKEN not configured');
    return null;
  }

  const payload = {
    recipient: { chat_id: String(chatId) },
    message: { text: String(text).slice(0, 2000) },
  };

  if (attachment) {
    payload.message.attachment = attachment;
  }

  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(ZALO_API, {
        method: 'POST',
        headers: {
          'access_token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) return await res.json();

      const errorText = await res.text();
      console.error(`Zalo API attempt ${i + 1} failed:`, res.status, errorText);

      // 4xx = không retry (lỗi request, không phải network)
      if (res.status >= 400 && res.status < 500) return null;
    } catch (err) {
      console.error(`Zalo API attempt ${i + 1} error:`, err.message);
    }

    if (i < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }

  return null;
}

/**
 * Parse tin nhắn từ Sale thành unit data.
 * Format kỳ vọng:
 *   "Căn mới: B4.0806 | Smart City | Tòa B4 | 75m² | 2PN | Hiện đại"
 *
 * ID dự án/toà được resolve từ cache API, không hardcode.
 */
function parseNewUnit(caption, photo) {
  if (!caption || typeof caption !== 'string') return null;

  const parts = caption.split('|').map(s => s.trim());
  if (parts.length < 3) return null;

  // Part 0: "Căn mới: B4.0806" hoặc "B4.0806"
  const codeMatch = parts[0].match(/(?:Căn mới[:\s]*)?([A-Z0-9]+[.][0-9]+)/i);
  if (!codeMatch) return null;

  const unit = {
    code: codeMatch[1].toUpperCase(),
    area: parseFloat(parts[3]?.replace('m²', '').trim()) || 0,
    bedrooms: parseInt(parts[4]?.replace('PN', '').trim()) || 0,
    style: parts[5] || '',
    images: [],
    status: 'draft',
  };

  // Lấy URL ảnh từ Zalo nếu có
  if (photo && Array.isArray(photo) && photo.length > 0) {
    unit.images = [photo[0].url || photo[0].image?.url || ''].filter(Boolean);
  }

  return unit;
}

export { sendZalo, parseNewUnit };
