// api/search.js - Web search proxy (SerpAPI or placeholder)

const MAX_BODY_BYTES = 8 * 1024; // 8 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getRateLimitKey(req);
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({ error: 'Too many requests. Please try again in a minute.' });
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  if (!serpApiKey) {
    return res.status(503).json({
      error:
        'Search is not configured. Set the SERPAPI_KEY environment variable on the server.',
      configured: false,
    });
  }

  let query;
  if (req.method === 'GET') {
    query = req.query?.q;
  } else {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Request body too large.' });
    }
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      query = body?.q || body?.query;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res
      .status(400)
      .json({ error: 'Missing search query. Provide "q" parameter.' });
  }

  if (query.length > 500) {
    return res.status(400).json({ error: 'Search query too long (max 500 chars).' });
  }

  const serpUrl = new URL('https://serpapi.com/search');
  serpUrl.searchParams.set('q', query.trim());
  serpUrl.searchParams.set('api_key', serpApiKey);
  serpUrl.searchParams.set('engine', 'google');
  serpUrl.searchParams.set('num', '5');

  let upstream;
  try {
    upstream = await fetch(serpUrl.toString());
  } catch (err) {
    return res
      .status(502)
      .json({ error: 'Failed to reach search provider.', detail: err.message });
  }

  const data = await upstream.json();

  if (!upstream.ok) {
    const msg = data?.error || `Search API error (HTTP ${upstream.status})`;
    return res.status(upstream.status >= 500 ? 502 : upstream.status).json({
      error: msg,
    });
  }

  const results = (data.organic_results || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
  }));

  res.status(200).json({ results, query: query.trim() });
}
