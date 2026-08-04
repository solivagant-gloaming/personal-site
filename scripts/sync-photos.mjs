// 旅游图集同步脚本：扫描 public/photos/，为每张新照片自动创建爱好记录
//
// 用法：
//   1. 把照片拷进 public/photos/（支持 jpg/jpeg/png/webp/gif/avif/svg）
//   2. node scripts/sync-photos.mjs
//   3. 新照片自动在 /hobbies 显示为照片卡；重复运行不会重复建卡
//
// 已有照片想改标题/描述：直接在管理后台 /admin 编辑对应爱好记录即可。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = path.resolve(__dirname, '..', 'public', 'photos');

// ---- 读 .env.local ----
const env = {};
for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const EXT_RE = /\.(jpe?g|png|webp|gif|avif|svg)$/i;

function readableTitle(filename) {
  const base = filename.replace(EXT_RE, '');
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(str) {
  const s = str.toLowerCase()
    .replace(/[^\w一-龥-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || `photo-${Date.now()}`;
}

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 4000),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: { rejectUnauthorized: true },
});

try {
  // 1. 扫描目录里的图片文件
  let files = [];
  try { files = fs.readdirSync(PHOTOS_DIR).filter(f => EXT_RE.test(f)); } catch { }
  if (files.length === 0) {
    console.log('ℹ️  public/photos/ 里没有图片，无需同步。');
    process.exit(0);
  }

  // 2. 找出已入库的照片路径（避免重复建卡）
  const [existing] = await conn.query(
    `SELECT id, title, metadata FROM notes WHERE type='hobby'`
  );
  const usedPaths = new Set();
  const usedSlugs = new Set();
  for (const row of existing) {
    usedSlugs.add(row.title.toLowerCase());
    try {
      const meta = JSON.parse(row.metadata || '{}');
      if (meta.image) usedPaths.add(meta.image.replace(/^\/photos\//, ''));
    } catch { }
  }

  // 3. 逐个插入新照片
  let added = 0, skipped = 0;
  for (const file of files) {
    if (usedPaths.has(file)) { skipped++; continue; }

    const title = readableTitle(file);
    let slug = slugify(title);
    let n = 2;
    while (usedSlugs.has(slug.toLowerCase())) slug = `${slugify(title)}-${n++}`;
    usedSlugs.add(slug.toLowerCase());

    await conn.query(
      `INSERT INTO notes (type, title, slug, content, excerpt, course, tags, status, metadata)
       VALUES ('hobby', ?, ?, ?, '', '', ?, 'published', ?)`,
      [
        title,
        slug,
        `（这张照片的说明待补充 —— 在管理后台编辑此记录，写下游玩的地点和故事）`,
        JSON.stringify(['旅行']),
        JSON.stringify({ image: `/photos/${file}` }),
      ]
    );
    console.log(`✅ 已建卡: ${file} → 「${title}」`);
    added++;
  }

  console.log(`\n完成：新增 ${added} 张照片卡，跳过 ${skipped} 张已存在。`);
  console.log(`查看: https://shengxia.dev/hobbies`);
} finally {
  await conn.end();
}
