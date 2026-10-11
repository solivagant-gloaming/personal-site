/**
 * 通用滑动窗口限流器（进程内存）。
 *
 * 用途：公开写接口防刷。注意 Serverless 下每个实例各存一份计数，
 * 所以它只是「减速带」，不是硬保证——必须配合蜜罐、最小填写耗时、长度上限一起用。
 */

/** @type {Map<string, number[]>} key -> 命中时间戳列表 */
const buckets = new Map();

const MAX_WINDOW_MS = 60 * 60 * 1000; // 只保留 1 小时内的痕迹

setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => now - t < MAX_WINDOW_MS);
    if (alive.length) buckets.set(key, alive);
    else buckets.delete(key);
  }
}, 10 * 60 * 1000).unref?.();

/**
 * 记一次命中。超过额度返回 allowed:false（本次不计入）。
 * @param {string} key 限流维度，如 `quote:1.2.3.4`
 * @param {number} max 窗口内允许次数
 * @param {number} windowMs 窗口长度
 */
export function hit(key, max, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

  if (hits.length >= max) {
    buckets.set(key, hits);
    return {
      allowed: false,
      retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000),
    };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, remaining: max - hits.length };
}

/** 取客户端 IP（Vercel 走 x-forwarded-for）。 */
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
