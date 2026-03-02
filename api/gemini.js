// api/gemini.js - Secure Gemini API proxy
// Never exposes GEMINI_API_KEY to the client.

const MAX_BODY_BYTES = 32 * 1024; // 32 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per IP per window

/** Simple in-memory rate-limit store (resets on cold start). */
const ipHits = new Map();

function getRateLimitKey(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(503)
      .json({ error: 'Gemini API key not configured on server.' });
  }

  const ip = getRateLimitKey(req);
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({ error: 'Too many requests. Please try again in a minute.' });
  }

  // Enforce body size limit
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request body too large.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  // Build a Gemini-compatible request
  let geminiPayload;

  if (body.contents) {
    // Already in Gemini format
    geminiPayload = body;
  } else if (body.prompt || body.system) {
    // Simplified format: { prompt, system, model? }
    const parts = [];
    if (body.system) {
      parts.push({ text: String(body.system) });
    }
    if (body.prompt) {
      parts.push({ text: String(body.prompt) });
    }
    geminiPayload = {
      contents: [{ parts }],
      generationConfig: body.generationConfig || {},
    };
  } else {
    return res
      .status(400)
      .json({ error: 'Body must include "contents" or "prompt".' });
  }

  // Validate final payload size as JSON
  const payloadStr = JSON.stringify(geminiPayload);
  if (payloadStr.length > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large.' });
  }

  const model = body.model || 'gemini-1.5-flash';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  let upstream;
  try {
    upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
    });
  } catch (err) {
    return res
      .status(502)
      .json({ error: 'Failed to reach Gemini API.', detail: err.message });
  }

  const data = await upstream.json();

  if (!upstream.ok) {
    const msg =
      data?.error?.message || `Gemini API error (HTTP ${upstream.status})`;
    return res.status(upstream.status >= 500 ? 502 : upstream.status).json({
      error: msg,
    });
  }

  // Extract the generated text
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

  res.status(200).json({ text });
}
