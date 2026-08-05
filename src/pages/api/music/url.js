import { fetchSongUrl } from '../../../lib/netease.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

// 缓存直链结果 30 秒，防止连点反复打网易云
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  return fn().then(v => { cache.set(key, { t: Date.now(), v }); return v; });
}

export async function GET({ url }) {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: '缺少歌曲 id' }, 400);
  try {
    const songUrl = await cached(`url:${id}`, 30_000, () => fetchSongUrl(id));
    return json({ id, url: songUrl });
  } catch (err) {
    return json({ error: '直链获取失败' }, 502);
  }
}
