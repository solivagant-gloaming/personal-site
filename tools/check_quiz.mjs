/**
 * check_quiz.mjs — 校验 public/quiz/*.json 题目数据
 *
 * 用法：node tools/check_quiz.mjs
 * 校验：JSON 可解析、字段完整、选项 >=2、answer 索引合法、id 全局唯一。
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUIZ_DIR = join(__dirname, '..', 'public', 'quiz');

function errs(quiz) {
  const out = [];
  if (!quiz || typeof quiz !== 'object') return ['不是对象'];
  if (!Array.isArray(quiz.modules) || !quiz.modules.length) return ['modules 为空'];
  const seen = new Set();
  let qcount = 0;
  for (const m of quiz.modules) {
    if (!m.no || !m.name) out.push('模块缺 no/name');
    if (!Array.isArray(m.questions) || !m.questions.length) { out.push(`模块 ${m.no} questions 为空`); continue; }
    for (const q of m.questions) {
      qcount++;
      if (!q.id || seen.has(q.id)) out.push(`id 缺失或重复: ${q.id}`);
      seen.add(q.id);
      if (!q.q || !String(q.q).trim()) out.push(`${q.id} 缺题目`);
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((o) => !String(o).trim())) out.push(`${q.id} options 非法`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length || 0)) out.push(`${q.id} answer 越界`);
      if (!q.explain) out.push(`${q.id} 缺解析`);
    }
  }
  out.unshift(`共 ${qcount} 题`);
  return out;
}

let ok = 0, bad = 0;
for (const f of readdirSync(QUIZ_DIR).filter((f) => f.endsWith('.json'))) {
  const p = join(QUIZ_DIR, f);
  let quiz;
  try { quiz = JSON.parse(readFileSync(p, 'utf-8')); }
  catch (e) { console.log(`❌ ${f}: JSON 解析失败 — ${e.message}`); bad++; continue; }
  const es = errs(quiz);
  if (es.length === 1) { console.log(`✅ ${f}: ${es[0]}`); ok++; }
  else { console.log(`❌ ${f}:`); for (const e of es.slice(1)) console.log(`    - ${e}`); bad++; }
}
console.log(`\n${ok} 通过 / ${bad} 失败`);
process.exit(bad ? 1 : 0);
