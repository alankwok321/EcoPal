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

  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!openaiKey && !googleKey) {
    return res.status(500).json({ error: 'AI key not configured' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    if (openaiKey) {
      const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }),
      });

      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error || 'Upstream error' });

      return res.status(200).json({
        text: data?.choices?.[0]?.message?.content || '',
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${googleKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = { error: raw || 'Non-JSON response' };
    }
    if (!r.ok) return res.status(r.status).json({ error: data?.error || data || 'Upstream error' });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
