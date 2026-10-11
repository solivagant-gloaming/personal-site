export const prerender = false;

import { query } from '../../../db/mysql';
import { requireAdmin } from '../../../lib/api-auth.js';

/**
 * 待审拾句数量（仅管理员）。
 * 后台侧边栏徽标用——只需要一个数字，不该把整份待审列表拉下来。
 */
export async function GET({ cookies }) {
  try {
    requireAdmin(cookies);
  } catch (response) {
    return response;
  }

  const rows = await query(
    `SELECT COUNT(*) AS n FROM notes WHERE type = 'quote' AND status = 'pending'`
  );

  return new Response(JSON.stringify({ pending: Number(rows[0]?.n || 0) }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
