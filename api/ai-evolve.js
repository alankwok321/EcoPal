import crypto from 'crypto';
import { kv } from '@vercel/kv';
import { waitUntil } from '@vercel/functions';

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;
const bucket = new Map();
const JOB_TTL_SECONDS = 60 * 60; // 1 hour

function hit(ip) {
  const now = Date.now();
  const arr = bucket.get(ip) || [];
  const filtered = arr.filter((t) => now - t < RATE_WINDOW_MS);
  filtered.push(now);
  bucket.set(ip, filtered);
  return filtered.length;
}

async function generateImage(prompt, env) {
  const {
    key,
    openaiKey,
    openaiBase,
    openaiImageModel,
    openaiImageEndpoint,
  } = env;

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
      throw new Error(data?.error || data || 'Upstream error');
    }

    let imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) {
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        const trimmed = content.trim();
        const m = trimmed.match(/data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)/s);
        if (m?.[1]) imageBase64 = m[1].replace(/\s+/g, '').trim();
      }
    }

    if (!imageBase64) {
      throw new Error(data?.error || 'No image returned');
    }

    return imageBase64;
  }

  if (!key) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
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
    throw new Error(data?.error || data || 'Upstream error');
  }

  const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!imageBase64) {
    throw new Error(data?.error || 'No image returned');
  }

  return imageBase64;
}

async function processJob(jobKey, prompt, env) {
  await kv.set(
    jobKey,
    { status: 'running', updatedAt: Date.now() },
    { ex: JOB_TTL_SECONDS }
  );

  try {
    const imageBase64 = await generateImage(prompt, env);
    await kv.set(
      jobKey,
      { status: 'done', imageBase64, updatedAt: Date.now() },
      { ex: JOB_TTL_SECONDS }
    );
  } catch (e) {
    await kv.set(
      jobKey,
      { status: 'error', error: e.message || 'Server error', updatedAt: Date.now() },
      { ex: JOB_TTL_SECONDS }
    );
  }
}

export default async function handler(req, res) {
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

  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing job id' });
    }
    const jobKey = `ai-evolve:${id}`;
    const job = await kv.get(jobKey);
    if (!job) {
      return res.status(404).json({ error: 'Job not found or expired' });
    }
    return res.status(200).json(job);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  const jobId = crypto.randomUUID();
  const jobKey = `ai-evolve:${jobId}`;

  await kv.set(
    jobKey,
    { status: 'queued', createdAt: Date.now() },
    { ex: JOB_TTL_SECONDS }
  );

  waitUntil(
    processJob(jobKey, prompt, {
      key,
      openaiKey,
      openaiBase,
      openaiImageModel,
      openaiImageEndpoint,
    })
  );

  return res.status(202).json({ jobId });
}
