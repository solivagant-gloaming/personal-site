import { COOKIE_NAME, cookieOptions } from '../../../lib/auth.js';

export async function POST({ cookies }) {
  // Clear the auth cookie by setting maxAge = 0
  cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
