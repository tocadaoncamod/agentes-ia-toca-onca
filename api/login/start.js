// api/login/start.js - Secure placeholder for authentication
// Real credential handling must be implemented with a proper auth provider.

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(503).json({
    error: 'Authentication is not configured.',
    detail:
      'This endpoint is a placeholder. Configure an identity provider (e.g., Supabase Auth, Auth0) and implement login logic here.',
    configured: false,
  });
}
