// api/notify/telegram.js - Telegram notification endpoint

const MAX_BODY_BYTES = 4 * 1024; // 4 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

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

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(503).json({
      error: 'Telegram notifications are not configured.',
      detail:
        'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables on the server.',
      configured: false,
    });
  }

  const ip = getRateLimitKey(req);
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({ error: 'Too many requests. Please try again in a minute.' });
  }

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

  const message = body?.message || body?.text;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res
      .status(400)
      .json({ error: 'Missing "message" field in request body.' });
  }

  if (message.length > 4096) {
    return res
      .status(400)
      .json({ error: 'Message too long (Telegram limit: 4096 characters).' });
  }

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  let upstream;
  try {
    upstream = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.trim(),
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    return res
      .status(502)
      .json({ error: 'Failed to reach Telegram API.', detail: err.message });
  }

  const data = await upstream.json();

  if (!upstream.ok || !data.ok) {
    const msg =
      data?.description || `Telegram API error (HTTP ${upstream.status})`;
    return res.status(502).json({ error: msg });
  }

  res.status(200).json({ sent: true, messageId: data.result?.message_id });
}
