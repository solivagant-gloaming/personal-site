import { query } from '../../../db/mysql';
import { requireAdmin } from '../../../lib/api-auth.js';

export async function GET({ params }) {
  const id = parseInt(params.id);
  if (!id) {
    return new Response(JSON.stringify({ error: '无效的 ID' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = await query('SELECT * FROM notes WHERE id = ?', [id]);
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: '内容不存在' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(rows[0]), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Update a note — requires admin auth */
export async function PUT({ params, request, cookies }) {
  try {
    requireAdmin(cookies);
  } catch (response) {
    return response;
  }

  const id = parseInt(params.id);
  const body = await request.json();
  const { title, content, course, tags } = body;

  const excerpt = (content || '').replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\n/g, ' ').trim().substring(0, 150);

  await query(
    'UPDATE notes SET title = ?, content = ?, excerpt = ?, course = ?, tags = ? WHERE id = ?',
    [title, content || '', excerpt, course || '', JSON.stringify(tags || []), id]
  );

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Delete a note — requires admin auth */
export async function DELETE({ params, cookies }) {
  try {
    requireAdmin(cookies);
  } catch (response) {
    return response;
  }

  const id = parseInt(params.id);
  await query('DELETE FROM notes WHERE id = ?', [id]);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
