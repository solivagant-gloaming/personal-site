export const prerender = false;

import { query } from '../../../db/mysql';
import { hit, clientIp } from '../../../lib/rate-limit';

/**
 * 公开投稿接口：任何人可以往「拾句」扔一句好句子。
 *
 * 写入时固定 status='pending'——先落待审区，由 /admin/quotes 通过后才会上墙。
 * 防刷是分层的（蜜罐 + 最小填写耗时 + IP 限流 + 长度上限），
 * 单看任何一层都能被绕过，叠在一起能把脚本刷子挡在门外。
 */

const LIMITS = {
  content: 300,   // 句子
  source: 60,     // 出处
  submitter: 20,  // 署名
};

const MIN_FILL_MS = 1500;                // 从打开浮层到提交的最短耗时，比这快当作机器人
const WINDOW_MS = 10 * 60 * 1000;        // 限流窗口
const MAX_PER_WINDOW = 5;                // 每 IP 每窗口最多投 5 句

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** 归一化输入：统一换行、剥掉控制字符、压掉多余空行、按字段截断。 */
function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function makeExcerpt(content) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 150);
}

export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  // ① 蜜罐：真人在界面上看不见这个字段，填了必是脚本。
  //    静默返回成功，不给机器人任何「被识破」的反馈。
  if (body.website) {
    return json({ success: true }, 201);
  }

  // ② 最小填写耗时：页面渲染时间随表单一起提交，秒填秒交的直接丢弃。
  const startedAt = Number(body.startedAt);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return json({ error: '提交得太快了，再读一眼你写的句子？' }, 400);
  }

  // ③ 按 IP 限流
  const ip = clientIp(request);
  const gate = hit(`quote:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!gate.allowed) {
    return json(
      { error: `投递太频繁了，请 ${Math.ceil(gate.retryAfter / 60)} 分钟后再来` },
      429
    );
  }

  // ④ 内容校验
  const content = clean(body.content, LIMITS.content);
  const source = clean(body.source, LIMITS.source);
  const submitter = clean(body.submitter, LIMITS.submitter);

  if (content.length < 2) {
    return json({ error: '句子不能为空' }, 400);
  }

  const title = source || '佚名';
  const slug = `quote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const metadata = JSON.stringify({
    source,
    submitter,
    submittedAt: new Date().toISOString(),
  });

  try {
    await query(
      `INSERT INTO notes (type, title, slug, content, excerpt, course, tags, metadata, status)
       VALUES ('quote', ?, ?, ?, ?, '', '[]', ?, 'pending')`,
      [title, slug, content, makeExcerpt(content), metadata]
    );
  } catch (err) {
    console.error('[quotes/submit] 入库失败:', err.message);
    return json({ error: '服务器开小差了，稍后再试' }, 500);
  }

  return json({ success: true }, 201);
}
