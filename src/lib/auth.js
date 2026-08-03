import { createHmac, randomBytes } from 'node:crypto';

/**
 * Read env var from both import.meta.env (Vite build-time) and process.env (runtime).
 * Vercel's "Sensitive" env vars are only available via process.env at runtime.
 */
function getEnv(name) {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  return undefined;
}

/**
 * HMAC signing secret for admin tokens.
 *
 * SECURITY: ADMIN_SECRET must be a long (64+ hex chars) random string.
 * Set as a Vercel environment variable and NEVER hardcoded.
 */
function getSecret() {
  const secret = getEnv('ADMIN_SECRET');
  if (secret) return secret;
  // Development fallback: random per-process secret
  if (!getSecret._devSecret) {
    getSecret._devSecret = randomBytes(32).toString('hex');
  }
  return getSecret._devSecret;
}

const COOKIE_NAME = 'admin_token';
const MAX_AGE = 4 * 60 * 60; // 4 hours

export function createToken(username) {
  const expiry = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${username}:${expiry}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon < 0) return null;

    const signature = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const [username, expiryStr] = payload.split(':');

    if (!username || !expiryStr) return null;

    // Check expiry
    if (Math.floor(Date.now() / 1000) > parseInt(expiryStr)) return null;

    // Verify HMAC (constant-time comparison)
    const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (signature.length !== expectedSig.length) return null;

    let diff = 0;
    for (let i = 0; i < signature.length; i++) {
      diff |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (diff !== 0) return null;

    return username;
  } catch {
    return null;
  }
}

/**
 * Cookie options for the admin token.
 */
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  };
}

export { COOKIE_NAME, MAX_AGE, getEnv };
