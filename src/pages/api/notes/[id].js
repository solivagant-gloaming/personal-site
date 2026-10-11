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

const STATUSES = ['published', 'draft', 'pending'];

/**
 * Update a note — requires admin auth.
 * 局部更新：只写请求体里真正出现的字段。
 * （审核拾句就靠这个——只发一个 status，不会顺手把标题正文覆盖成 undefined。）
 */
export async function PUT({ params, request, cookies }) {
  try {
    requireAdmin(cookies);
  } catch (response) {
    return response;
  }

  const id = parseInt(params.id);
  if (!id) {
    return new Response(JSON.stringify({ error: '无效的 ID' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { title, content, course, tags, metadata, status } = body;

  const fields = [];
  const vals = [];

  if (title !== undefined) {
    fields.push('title = ?');
    vals.push(title);
  }
  if (content !== undefined) {
    fields.push('content = ?');
    vals.push(content || '');
    fields.push('excerpt = ?');
    vals.push(
      (content || '').replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\n/g, ' ').trim().substring(0, 150)
    );
  }
  if (course !== undefined) {
    fields.push('course = ?');
    vals.push(course || '');
  }
  if (tags !== undefined) {
    fields.push('tags = ?');
    vals.push(JSON.stringify(tags || []));
  }
  if (metadata !== undefined && metadata !== null) {
    fields.push('metadata = ?');
    vals.push(typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
  }
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: '无效的状态值' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    fields.push('status = ?');
    vals.push(status);
  }

  if (fields.length === 0) {
    return new Response(JSON.stringify({ error: '没有要更新的字段' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  vals.push(id);
  await query(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, vals);

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
