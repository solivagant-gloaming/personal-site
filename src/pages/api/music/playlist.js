import { fetchPlaylist, NETEASE_PLAYLIST_ID } from '../../../lib/netease.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function GET() {
  if (!NETEASE_PLAYLIST_ID) return json({ error: '未配置歌单 ID' }, 500);
  try {
    const pl = await fetchPlaylist(NETEASE_PLAYLIST_ID);
    return json({ ...pl });
  } catch (err) {
    return json({ error: '歌单获取失败：' + err.message }, 502);
  }
}
