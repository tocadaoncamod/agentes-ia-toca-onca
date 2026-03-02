// api/health.js - Health check endpoint
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
