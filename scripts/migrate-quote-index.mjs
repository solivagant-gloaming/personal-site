/**
 * 迁移：把 notes 的唯一约束从 (title, course) 换成 (slug)
 *
 * 背景：idx_title_course 是给「管理后台自己写笔记」设计的（同一课程下不许重名）。
 * 拾句开放公开投稿后，没填出处的句子 title 统一是「佚名」、course 是空串，
 * 第二句就撞唯一键。唯一性本来就该由身份字段 slug 承担——种子脚本
 * （insert-quotes.mjs / migrate-v2.mjs）用显式 slug + INSERT IGNORE 去重，
 * 换成 UNIQUE(slug) 后幂等性完全不变。
 *
 * 运行: node scripts/migrate-quote-index.mjs
 * 回滚: ALTER TABLE notes DROP INDEX idx_slug;
 *       ALTER TABLE notes ADD UNIQUE KEY idx_title_course (title(190), course);
 */
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const env = {};
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 4000),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: { rejectUnauthorized: true },
});

const indexNames = async () => {
  const [rows] = await conn.query('SHOW INDEX FROM notes');
  return new Set(rows.map((r) => r.Key_name));
};

try {
  // ── 1. 前置校验：slug 不能有重复，否则建唯一索引会失败 ──
  const [dups] = await conn.query(
    `SELECT slug, COUNT(*) n FROM notes
     WHERE slug IS NOT NULL AND slug != ''
     GROUP BY slug HAVING n > 1`
  );
  if (dups.length) {
    console.error('❌ 存在重复 slug，先清理再迁移：');
    for (const d of dups) console.error(`   ${d.slug} × ${d.n}`);
    process.exit(1);
  }
  const [blanks] = await conn.query(
    `SELECT COUNT(*) n FROM notes WHERE slug IS NULL OR slug = ''`
  );
  console.log(`✅ slug 无重复（空值 ${blanks[0].n} 行，唯一索引允许多个 NULL）`);

  const before = await indexNames();

  // ── 2. 建 UNIQUE(slug) ──
  if (before.has('idx_slug')) {
    console.log('⏭️  idx_slug 已存在');
  } else {
    await conn.query('ALTER TABLE notes ADD UNIQUE KEY idx_slug (slug)');
    console.log('✅ 添加唯一索引 idx_slug (slug)');
  }

  // ── 3. 删掉压错字段的旧约束 ──
  if (before.has('idx_title_course')) {
    await conn.query('ALTER TABLE notes DROP INDEX idx_title_course');
    console.log('✅ 删除旧约束 idx_title_course (title, course)');
  } else {
    console.log('⏭️  idx_title_course 已不存在');
  }

  // ── 4. 验证 ──
  const after = await indexNames();
  console.log('\n📊 当前索引:', [...after].join(', '));
} catch (e) {
  console.error('❌ 迁移失败:', e.message);
  process.exit(1);
} finally {
  await conn.end();
}
