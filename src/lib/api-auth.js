import { verifyToken, COOKIE_NAME } from './auth.js';

/**
 * Middleware: require admin authentication for API route handlers.
 *
 * Usage:
 *   export async function POST({ request, cookies }) {
 *     try {
 *       requireAdmin(cookies);
 *       // ... handler logic
 *     } catch (response) {
 *       return response;
 *     }
 *   }
 *
 * Throws a Response object (caught by the handler and returned).
 */
export function requireAdmin(cookies) {
  const token = cookies?.get?.(COOKIE_NAME)?.value;
  if (!token) {
    throw new Response(JSON.stringify({ error: '未登录，请先登录管理后台' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const username = verifyToken(token);
  if (!username) {
    throw new Response(JSON.stringify({ error: '会话已过期或无效，请重新登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return username;
}

/**
 * Simple in-memory rate limiter.
 * Tracks attempts by IP address with sliding window.
 */
const attemptStore = new Map();

const RATE_LIMIT = {
  maxAttempts: 8,          // max failed attempts
  windowMs: 15 * 60 * 1000, // per 15-minute window
  banAfter: 20,            // 20+ failed attempts = 1 hour ban
  banDuration: 60 * 60 * 1000,
};

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptStore) {
    if (now - record.start > Math.max(RATE_LIMIT.windowMs, RATE_LIMIT.banDuration)) {
      attemptStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function checkRateLimit(ip) {
  const now = Date.now();
  const record = attemptStore.get(ip) || { count: 0, start: now, banned: false };

  // Check permanent ban within window
  if (record.banned) {
    if (now - record.start > RATE_LIMIT.banDuration) {
      // Reset ban
      attemptStore.delete(ip);
      return { allowed: true };
    }
    return { allowed: false, retryAfter: Math.ceil((RATE_LIMIT.banDuration - (now - record.start)) / 1000) };
  }

  // Reset window if expired
  if (now - record.start > RATE_LIMIT.windowMs) {
    record.count = 0;
    record.start = now;
  }

  record.count++;
  attemptStore.set(ip, record);

  if (record.count > RATE_LIMIT.banAfter) {
    record.banned = true;
    record.start = now; // reset timer for ban duration
    return { allowed: false, retryAfter: Math.ceil(RATE_LIMIT.banDuration / 1000) };
  }

  if (record.count > RATE_LIMIT.maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((RATE_LIMIT.windowMs - (now - record.start)) / 1000) };
  }

  return { allowed: true, remaining: RATE_LIMIT.maxAttempts - record.count };
}

export function resetRateLimit(ip) {
  attemptStore.delete(ip);
}
