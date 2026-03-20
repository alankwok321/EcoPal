const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const bucket = new Map();

function hit(ip) {
  const now = Date.now();
  const arr = bucket.get(ip) || [];
  const filtered = arr.filter((t) => now - t < RATE_WINDOW_MS);
  filtered.push(now);
  bucket.set(ip, filtered);
  return filtered.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (hit(ip) > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const key = process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const openaiBase = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const openaiModel = process.env.OPENAI_VERIFY_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!key) {
    return res.status(500).json({ error: 'AI key not configured', verified: false, reason: 'AI 金鑰未設定' });
  }

  const { mimeType, data, taskName } = req.body || {};
  if (!mimeType || !data || !taskName) {
    return res.status(400).json({ error: 'Invalid payload', verified: false, reason: '缺少圖片或任務資訊' });
  }

  const prompt = `You are an AI verifying an eco-friendly action. The user claims this image shows: "${taskName}". Respond JSON only: {"verified": boolean, "reason": string}`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const url = `${openaiBase}/chat/completions`;
      const payload = {
        model: openaiModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${data}` },
              },
            ],
          },
        ],
        temperature: 0.2,
      };

      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });

      const raw = await r.text();
      let result = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch (e) {
        result = { error: raw || 'Non-JSON response' };
      }
      if (!r.ok) {
        return res
          .status(r.status)
          .json({ error: result?.error || result || 'Upstream error', verified: false, reason: 'AI 服務異常' });
      }

      const text = result?.choices?.[0]?.message?.content || '{}';
      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parsed = { verified: false, reason: 'AI 回傳格式異常' };
      }

      return res.status(200).json({
        verified: !!parsed.verified,
        reason: parsed.reason || 'AI 無法判斷',
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data } }] }],
      generationConfig: { responseMimeType: 'application/json' },
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();
    let result = {};
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch (e) {
      result = { error: raw || 'Non-JSON response' };
    }
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: result?.error || result || 'Upstream error', verified: false, reason: 'AI 服務異常' });
    }

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { verified: false, reason: 'AI 回傳格式異常' };
    }

    return res.status(200).json({
      verified: !!parsed.verified,
      reason: parsed.reason || 'AI 無法判斷',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error', verified: false, reason: 'AI 服務異常' });
  }
}
