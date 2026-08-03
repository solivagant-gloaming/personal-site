/* pyworker.mjs — Python 判分 Worker（module worker）
   Pyodide 314+ 强制要求 module worker（经典 worker 会被其运行时检测拒绝），
   因此这里用 ES import 加载 UMD 入口 pyodide.js（side-effect 执行后暴露 globalThis.loadPyodide），
   不能用 importScripts。
   页面 → worker：{ id, stub, tests }
   worker → 页面：{ type:'ready' } 或 { id, ok, json } / { id, ok:false, error }
*/
import '/python/pyodide/pyodide.js'; // UMD side-effect：执行后 globalThis.loadPyodide 可用

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
  const { id, stub, tests, mode, code } = e.data;
  try {
    const py = await getPy();
    if (mode === 'run') {
      // 纯运行模式：执行用户代码看输出，不做任何 ✓/✗ 判定（模拟考试用）
      py.globals.set('_code', code);
      py.globals.set('_tests', tests || '');
      const out = py.runPython(
        'import json, io, sys\n' +
        '_ns = {}; _buf = io.StringIO(); _old = sys.stdout; sys.stdout = _buf\n' +
        'try:\n' +
        '    exec(_code, _ns)\n' +
        'except Exception as ex:\n' +
        '    sys.stdout = _old\n' +
        '    _r = {"ok": False, "error": "%s: %s" % (type(ex).__name__, ex)}\n' +
        'else:\n' +
        '    _lines = []\n' +
        '    if _tests:\n' +
        '        _t = {}; exec(_tests, _t)\n' +
        '        _fn = _t.get("FUNC"); _cases = list(_t.get("CASES") or [])\n' +
        '        if _fn in _ns and _cases:\n' +
        '            try:\n' +
        '                for _args, _ in _cases:\n' +
        '                    _args = tuple(_args) if isinstance(_args, (list, tuple)) else (_args,)\n' +
        '                    _lines.append("用例: " + repr(_ns[_fn](*_args)))\n' +
        '            except Exception as ex:\n' +
        '                _lines.append("调用报错: %s: %s" % (type(ex).__name__, ex))\n' +
        '    sys.stdout = _old\n' +
        '    _r = {"ok": True, "stdout": _buf.getvalue(), "sample": _lines}\n' +
        'json.dumps(_r, ensure_ascii=False)'
      );
      self.postMessage({ id, ok: true, json: out });
      return;
    }
    // 判分模式（grade）：协议与旧版一致
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
