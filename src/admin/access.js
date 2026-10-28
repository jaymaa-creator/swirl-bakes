import { handleReports } from './reports.js';
import { handlePhotos } from './photos.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const keySets = new Map();
export const isAdminPath = (path) => path === '/admin' || path.startsWith('/admin/') || path === '/api/admin' || path.startsWith('/api/admin/');
const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

export async function handleAdmin(request, env, loadMenu) {
  const path = new URL(request.url).pathname;
  const issuer = env.ADMIN_ACCESS_ISSUER;
  const audience = env.ADMIN_ACCESS_AUD;
  const emails = (env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') || !audience || emails.length !== 2 || new Set(emails).size !== 2) {
    return reply({ error: 'Admin sign-in is not configured yet.' }, 503);
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) return reply({ error: 'Please sign in through the admin Google login.' }, 401);
  let payload;
  try {
    if (!keySets.has(issuer)) keySets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    ({ payload } = await jwtVerify(token, keySets.get(issuer), {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'],
    }));
  } catch {
    return reply({ error: 'Your admin session could not be verified. Please sign in again.' }, 401);
  }
  if (typeof payload.email !== 'string' || !emails.includes(payload.email.toLowerCase())) return reply({ error: 'This Google account does not have admin access.' }, 403);
  if (path === '/api/admin/reports') return handleReports(request, env);
  if (['/api/admin/menu', '/api/admin/photos/upload', '/api/admin/photos/publish'].includes(path)) return handlePhotos(request, env, loadMenu, payload.email);
  if (request.method !== 'GET' && request.method !== 'HEAD') return reply({ error: 'Method not allowed' }, 405);
  if (path === '/api/admin/session') return reply({ email: payload.email, role: 'admin', environment: env.ISOLATED_TEST_BACKEND === true ? 'test' : 'production', reportsEnabled: true }, 200);
  if (path.startsWith('/api/')) return reply({ error: 'Not found' }, 404);
  const asset = await env.ASSETS.fetch(request);
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
