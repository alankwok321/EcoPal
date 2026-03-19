const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;
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

  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GOOGLE_AI_API_KEY not configured' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${key}`;
    const payload = { instances: { prompt }, parameters: { sampleCount: 1 } };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error || 'Upstream error' });
    }

    const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBase64) {
      return res.status(500).json({ error: 'No image returned' });
    }

    return res.status(200).json({ imageBase64 });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
