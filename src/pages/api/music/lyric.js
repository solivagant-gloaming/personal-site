import { fetchLyric } from '../../../lib/netease.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function GET({ url }) {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: '缺少歌曲 id' }, 400);
  try {
    const lrc = await fetchLyric(id);
    return json({ id, lrc });
  } catch (err) {
    return json({ error: '歌词获取失败' }, 502);
  }
}
