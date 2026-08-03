/**
 * merge_adb_quiz.mjs — 合并 quiz-staging/adb-*.json 生成 public/quiz/advanced-db.json
 *
 * 每个 ADB 模块子代理写入 public/quiz-staging/adb-0X.json（格式 {"no","name","questions"}），
 * 本脚本按模块号排序合并，输出到 public/quiz/advanced-db.json。
 *
 * 用法：node tools/merge_adb_quiz.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING = join(__dirname, '..', 'public', 'quiz-staging');
const OUT = join(__dirname, '..', 'public', 'quiz', 'advanced-db.json');

const files = readdirSync(STAGING).filter((f) => /^adb-\d+\.json$/.test(f));
files.sort(); // adb-01 < adb-02 < ... 字典序即数值序

const modules = [];
const seenIds = new Set();
let total = 0;
for (const f of files) {
  const mod = JSON.parse(readFileSync(join(STAGING, f), 'utf-8'));
  if (!mod.no || !mod.name || !Array.isArray(mod.questions) || !mod.questions.length) {
    console.error(`❌ ${f} 缺字段`);
    process.exit(1);
  }
  for (const q of mod.questions) {
    if (seenIds.has(q.id)) { console.error(`❌ 重复 id: ${q.id}`); process.exit(1); }
    seenIds.add(q.id);
  }
  total += mod.questions.length;
  modules.push({ no: mod.no, name: mod.name, questions: mod.questions });
  console.log(`✅ 模块 ${mod.no} ${mod.name} · ${mod.questions.length} 题`);
}

writeFileSync(OUT, JSON.stringify({ modules }, null, 2), 'utf-8');
console.log(`\n📦 已生成 ${OUT} · 共 ${total} 题 / ${modules.length} 个模块`);
