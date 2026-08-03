/* pyworker.js — Python 判分 Worker（经典 worker，importScripts 加载 Pyodide）
   页面 → worker：{ id, stub, tests }
   worker → 页面：{ type:'ready' } 或 { id, ok, json } / { id, ok:false, error }
*/
importScripts('/python/pyodide/pyodide.js');

let pyPromise = null;

function getPy() {
  if (!pyPromise) {
    pyPromise = loadPyodide({ indexURL: '/python/pyodide/' }).then(async (py) => {
      // 预载判分核心（与本地 grader_core.py 同一份），定义 grade()
      const res = await fetch('/python/grader_core.py');
      py.runPython(await res.text());
      return py;
    });
  }
  return pyPromise;
}

self.onmessage = async (e) => {
  const { id, stub, tests } = e.data;
  try {
    const py = await getPy();
    py.globals.set('_stub', stub);
    py.globals.set('_tests', tests);
    // 最后一个表达式 = JSON 字符串，runPython 直接返回它
    const out = py.runPython(
      'import json\n' +
      'try:\n' +
      '    result = grade(_stub, _tests)\n' +
      'except Exception as ex:\n' +
      '    result = {"ok": False, "results": [], "error": "判分器错误: %s" % ex}\n' +
      'json.dumps(result, ensure_ascii=False)'
    );
    self.postMessage({ id, ok: true, json: out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};

// 立即预热 Pyodide（后台下载运行时），就绪后通知页面收起加载遮罩
getPy()
  .then(() => self.postMessage({ type: 'ready' }))
  .catch((e) => self.postMessage({ type: 'ready', error: String(e) }));
