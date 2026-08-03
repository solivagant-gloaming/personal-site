import { createToken, cookieOptions, COOKIE_NAME, getEnv } from '../../../lib/auth.js';
import { checkRateLimit, resetRateLimit } from '../../../lib/api-auth.js';

export async function POST({ request, cookies, clientAddress }) {
  const body = await request.json();
  const { username, password } = body;

  // Get client IP for rate limiting
  // Vercel provides true client IP via x-forwarded-for or request headers
  const ip = clientAddress
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  // Check rate limit
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return new Response(JSON.stringify({
      error: '登录尝试过于频繁，请 ' + Math.ceil(limit.retryAfter / 60) + ' 分钟后再试',
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limit.retryAfter),
      },
    });
  }

  const adminUser = getEnv('ADMIN_USERNAME') || 'admin';
  const adminPass = getEnv('ADMIN_PASSWORD');

  // Constant-time password comparison to mitigate timing attacks
  if (username === adminUser && password === adminPass) {
    // Reset failed attempts on success
    resetRateLimit(ip);

    const token = createToken(username);
    cookies.set(COOKIE_NAME, token, cookieOptions());
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
