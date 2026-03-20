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
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBase = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const openaiImageModel = process.env.OPENAI_IMAGE_MODEL || process.env.OPENAI_MODEL;
  const openaiImageEndpoint = process.env.OPENAI_IMAGE_ENDPOINT;

  if (!key && !openaiKey) {
    return res.status(500).json({ error: 'AI key not configured' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    if (openaiKey && openaiImageModel) {
      const url = openaiImageEndpoint || `${openaiBase}/images/generations`;
      const isChatEndpoint = /\/chat\/completions\/?$/.test(url);

      const body = isChatEndpoint
        ? {
            model: openaiImageModel,
            messages: [
              {
                role: 'system',
                content:
                  'You are an image generator. Output MUST be ONLY a single data URL (data:image/...;base64,...) and nothing else. No markdown, no code fences. The image MUST be a PNG with a fully transparent background (alpha channel).'
              },
              {
                role: 'user',
                content: `Generate an image of: ${prompt}\nRequirements: (1) PNG format, (2) background fully transparent (alpha channel), (3) subject isolated with clean edges, (4) no solid/gradient background, no shadow, no floor.\nReturn ONLY a single data URL starting with data:image/ and nothing else.`
              }
            ],
            temperature: 0.2
          }
        : {
            model: openaiImageModel,
            prompt,
            size: '1024x1024',
            response_format: 'b64_json'
          };

      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`
        },
        body: JSON.stringify(body)
      });

      const text = await r.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { error: text || 'Non-JSON response' };
      }
      if (!r.ok) {
        return res.status(r.status).json({ error: data?.error || data || 'Upstream error' });
      }

      // Images API mode
      let imageBase64 = data?.data?.[0]?.b64_json;

      // Chat-completions (or any text) mode: try to extract a data URL from assistant content
      // We do this even if isChatEndpoint is false, because some proxies may still return chat-shaped payloads.
      if (!imageBase64) {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          const trimmed = content.trim();
          // direct data url or markdown image
          const m = trimmed.match(/data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)/s);
          if (m?.[1]) imageBase64 = m[1].replace(/\s+/g, '').trim();
        }
      }

      if (!imageBase64) {
        return res.status(500).json({ error: data?.error || 'No image returned' });
      }

      return res.status(200).json({ imageBase64 });
    }

    if (!key) {
      return res.status(500).json({ error: 'GOOGLE_AI_API_KEY not configured' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${key}`;
    const payload = { instances: { prompt }, parameters: { sampleCount: 1 } };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { error: text || 'Non-JSON response' };
    }
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error || data || 'Upstream error' });
    }

    const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBase64) {
      return res.status(500).json({ error: data?.error || 'No image returned' });
    }

    return res.status(200).json({ imageBase64 });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
