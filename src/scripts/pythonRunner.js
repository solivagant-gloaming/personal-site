/* pythonRunner.js — Pyodide 判分/运行共享器
   供 /python（日常练习）、/python/exam（模拟考试）、/advanced-db 三页复用。
   - grade(stub, tests)   判分模式（现有 pyworker 协议，返回 {ok, json}）
   - run(code, tests)     纯运行模式（看输出，不判分）
   协议：worker 就绪前调用会排队，就绪后自动执行；单次 9s 超时自动重置 worker。 */
export function createPythonRunner() {
  let worker = null;
  let runtimeReady = false;
  let readyWaiters = [];
  const waiters = new Map();
  const timers = new Map();
  const TIMEOUT_MS = 9000;

  function getWorker() {
    if (!worker) {
      const wUrl = '/python/' + 'pyworker.mjs';
      worker = new Worker(/* @vite-ignore */ wUrl, { type: 'module' });
      worker.onmessage = (e) => {
        if (e.data && e.data.type === 'ready') {
          runtimeReady = true;
          const ws = readyWaiters; readyWaiters = [];
          ws.forEach((w) => worker.postMessage(w.msg));
          return;
        }
        clearTimeout(timers.get(e.data.id)); timers.delete(e.data.id);
        const w = waiters.get(e.data.id);
        if (w) { waiters.delete(e.data.id); w.resolve(e.data); }
      };
      worker.onerror = () => {
        runtimeReady = false;
        const ws = readyWaiters; readyWaiters = [];
        ws.forEach((w) => w.reject(new Error('Python 运行时加载失败，请刷新页面重试。')));
        waiters.forEach((w) => w.reject(new Error('Python 运行时中断，请重试。')));
        waiters.clear();
      };
    }
    return worker;
  }

  function post(msg) {
    return new Promise((resolve, reject) => {
      const id = msg.id || 'r' + Math.random().toString(36).slice(2);
      msg.id = id;
      waiters.set(id, { resolve, reject });
      const w = getWorker();
      if (!runtimeReady) { readyWaiters.push({ msg }); return; }
      w.postMessage(msg);
      timers.set(id, setTimeout(() => {
        waiters.delete(id);
        if (worker) { worker.terminate(); worker = null; runtimeReady = false; }
        resolve({ ok: false, error: '⏱ 超时（可能死循环）——已自动重置，改一下再试' });
      }, TIMEOUT_MS));
    });
  }

  return {
    get ready() { return runtimeReady; },
    warmup() { try { getWorker(); } catch (e) {} },
    run(code, tests) { return post({ mode: 'run', code, tests }); },
    grade(stub, tests) { return post({ stub, tests }); },
  };
}
