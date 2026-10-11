export const prerender = false;

import { query } from '../../../db/mysql';
import { requireAdmin } from '../../../lib/api-auth.js';

/**
 * 待审拾句列表（仅管理员）。
 * 公开的 /api/contents 只吐 status='published'，所以待审内容必须走这里拿。
 */
export async function GET({ cookies }) {
  try {
    requireAdmin(cookies);
  } catch (response) {
    return response;
  }

  const pending = await query(
    `SELECT id, title, slug, content, excerpt, metadata, created_at
     FROM notes
     WHERE type = 'quote' AND status = 'pending'
     ORDER BY created_at ASC`
  );

  const stats = await query(
    `SELECT
       SUM(status = 'pending')   AS pendingTotal,
       SUM(status = 'published') AS publishedTotal
     FROM notes WHERE type = 'quote'`
  );

  return new Response(
    JSON.stringify({
      pending,
      pendingTotal: Number(stats[0]?.pendingTotal || 0),
      publishedTotal: Number(stats[0]?.publishedTotal || 0),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
