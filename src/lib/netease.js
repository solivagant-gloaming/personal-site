// 网易云音乐 API 封装
// - 歌单 / 歌词 / 歌曲信息走官方公开接口
// - 音频直链必须走 weapi 加密接口 + 登录 cookie（网易云已全面锁死匿名播放）
// cookie 只存服务端环境变量，绝不进前端。
// 注意：HTTP 客户端用 axios（Node 原生 http 栈），undici fetch 会被网易云 WAF 重置。

import crypto from 'crypto';
import axios from 'axios';

function getEnv(name, fallback = '') {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name];
  if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
  return fallback;
}

export const NETEASE_COOKIE = getEnv('NETEASE_COOKIE');
export const NETEASE_PLAYLIST_ID = getEnv('NETEASE_PLAYLIST_ID', '');

const NETEAST_API = 'https://music.163.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// ── weapi 加密（网易云官方公钥，算法公开稳定） ──
const PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;
const NONCE = '0CoJUm6Qyw8W8jud';
const IV = Buffer.from('01020304050607080102030405060708', 'hex');

const _pubKey = crypto.createPublicKey(PEM);
const _keySize = (_pubKey.asymmetricKeyDetails?.modulusLength ?? 1024) / 8;

function aesEncrypt(text, secretKey) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(secretKey, 'utf8'), IV);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64');
}
function rsaEncrypt(secretKey) {
  const reversed = Buffer.from(secretKey.split('').reverse().join(''), 'hex');
  const padded = Buffer.concat([Buffer.alloc(_keySize - reversed.length), reversed]);
  return crypto.publicEncrypt({ key: _pubKey, padding: crypto.constants.RSA_NO_PADDING }, padded).toString('hex');
}
function weapi(payload) {
  const secretKey = crypto.randomBytes(8).toString('hex');
  return {
    params: aesEncrypt(aesEncrypt(JSON.stringify(payload), NONCE), secretKey),
    encSecKey: rsaEncrypt(secretKey),
  };
}

// ── 网络请求：axios + 空响应/错误重试（网易云 WAF 偶发 TCP 重置或空 200） ──
async function requestJson(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios({ url, timeout: 20000, ...options });
      const data = res.data;
      if (data === '' || data === null || data === undefined) throw new Error('empty response');
      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 700 * (i + 1)));
    }
  }
}

function plainHeaders(extraCookie = '') {
  return {
    'User-Agent': UA,
    'Referer': 'https://music.163.com/',
    'Cookie': [NETEASE_COOKIE, extraCookie].filter(Boolean).join('; '),
  };
}

// ── 音频直链 ──
// 2026-08 实测：weapi/player/url 对数据中心 IP（AWS/HK/新加坡）与高频本机 IP 一律返回空 200 蜜罐；
// 明文老接口 /api/song/enhance/player/url 未触发蜜罐，带登录 cookie 也能拿 VIP 直链。
// 故优先明文接口，失败再回退 weapi。返回统一转 https（页面为 https，http 混合内容会被浏览器拦截）。
function toHttps(u) { return u ? u.replace(/^http:\/\//, 'https://') : u; }

export async function fetchSongUrl(songId) {
  // ① 明文老接口（优先）
  try {
    const json = await requestJson(`${NETEAST_API}/api/song/enhance/player/url`, {
      params: { id: Number(songId), ids: `[${Number(songId)}]`, br: 320000 },
      headers: plainHeaders(),
    });
    const url = json?.data?.[0]?.url;
    if (url) return toHttps(url);
  } catch (e) {
    // 明文接口失败 → 回退 weapi
  }
  // ② weapi 加密接口（兜底）
  const form = new URLSearchParams(weapi({ ids: JSON.stringify([Number(songId)]), br: 999000 })).toString();
  const json = await requestJson(`${NETEAST_API}/weapi/song/enhance/player/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...plainHeaders() },
    data: form,
  });
  const data = json?.data?.[0];
  return data?.url ? toHttps(data.url) : null;
}

// ── 歌词（官方公开接口，返回 LRC 原文） ──
export async function fetchLyric(songId) {
  const json = await requestJson(`${NETEAST_API}/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`, {
    headers: plainHeaders(),
  });
  return json?.lrc?.lyric || '';
}

// ── 歌单（详情 + 全部曲目） ──
export async function fetchPlaylist(id) {
  const detail = await requestJson(`${NETEAST_API}/api/v6/playlist/detail?id=${id}`, { headers: plainHeaders() });
  const pl = detail?.playlist;
  if (!pl) throw new Error('歌单不存在或已设为私密');

  const trackIds = (pl.trackIds || []).map(t => t.id);
  const songs = [];
  for (let i = 0; i < trackIds.length; i += 30) {
    const batch = trackIds.slice(i, i + 30);
    const detailJson = await requestJson(
      `${NETEAST_API}/api/song/detail/?ids=${encodeURIComponent(JSON.stringify(batch))}&id=${batch[0]}`,
      { headers: plainHeaders() }
    );
    for (const s of detailJson?.songs || []) {
      const artists = s.artists || s.ar || [];
      songs.push({
        id: s.id,
        name: s.name || '',
        artist: artists.map(a => a.name).join(' / '),
        album: s.album?.name || '',
        cover: s.album?.picUrl || s.picUrl || '',
        duration: s.duration || 0,
        // 网易云 fee: 0=免费, 1/8=VIP/付费（缺失时按免费处理，避免误标 VIP）
        fee: s.fee ?? 0,
      });
    }
  }

  return {
    id: String(id),
    name: pl.name || '我的歌单',
    cover: pl.coverImgUrl || '',
    count: trackIds.length,
    tracks: songs,
  };
}
