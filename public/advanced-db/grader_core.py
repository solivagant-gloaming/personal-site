# -*- coding: utf-8 -*-
"""
grader_core.py — 纯判分逻辑（零依赖，本地 CPython 与浏览器 Pyodide 共用同一份）

测试文件约定（tests_exxx.py，位于每个模块的「练习」目录）：
    FUNC  = 'greet'            # 被测函数名
    TITLE = '输出问候语'        # 题目名（可选，缺省用文件名）
    CASES = [((参数...), 期望), ...]
    以下可选：
    STDIN        = ['5', '3']  # 输入类：喂给 sys.stdin / input()
    STDOUT       = '...'       # 输出类：比较运行后的 stdout（空白归一化）
    EXPECTED_EXC = ValueError  # 期望抛出的异常类型
    TIMEOUT      = 3           # 单题超时秒数（本地子进程用它做上限）
"""
import io
import sys


def _eq(a, b):
    """比较：float 用容差，其余按 ==。"""
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) < 1e-6
        except (TypeError, ValueError):
            return False
    return a == b


def _repr_of(x, limit=60):
    s = repr(x)
    return s if len(s) <= limit else s[:limit] + '…'


class _RedirectIO:
    """同时重定向 stdout/stderr，并可选喂入 stdin。用完恢复。"""

    def __init__(self, stdin_lines=None):
        self._buf = io.StringIO()
        self._stdin = io.StringIO('\n'.join(stdin_lines) + '\n') if stdin_lines else None
        self._old = {}

    def __enter__(self):
        self._old = {'out': sys.stdout, 'err': sys.stderr, 'in': sys.stdin}
        sys.stdout = self._buf
        sys.stderr = self._buf
        if self._stdin is not None:
            sys.stdin = self._stdin
        return self._buf

    def __exit__(self, *exc):
        sys.stdout = self._old['out']
        sys.stderr = self._old['err']
        sys.stdin = self._old['in']
        return False


def grade(ex_src, tests_src, stdin_lines=None):
    """运行一个练习，返回 {ok, results, stdout, error}。"""
    # 1) 读测试定义
    tns = {}
    exec(compile(tests_src, '<tests>', 'exec'), tns)
    func_name = tns.get('FUNC')
    cases = list(tns.get('CASES', []) or [])
    expected_stdout = tns.get('STDOUT')
    expected_exc = tns.get('EXPECTED_EXC')
    check_fn = tns.get('CHECK')  # 可选自定义判定器（SQL 等非 CASES 题型）
    stdin_lines = list(stdin_lines) if stdin_lines is not None else list(tns.get('STDIN') or [])

    # 2) 加载学生代码（重定向捕获 import 级打印，防止污染输出）
    ens = {}
    buf = io.StringIO()
    try:
        with _RedirectIO(stdin_lines) as buf:
            exec(compile(ex_src, '<exercise>', 'exec'), ens)
    except Exception as e:
        return {
            'ok': False, 'results': [],
            'stdout': buf.getvalue(),
            'error': '运行报错：%s: %s' % (type(e).__name__, e),
        }

    # 2.5) 自定义判定器（tests 定义了 CHECK 时走这里，支持 SQL 等结构化判分）
    if check_fn is not None:
        try:
            r = check_fn(ens)
        except Exception as e:
            return {
                'ok': False, 'results': [],
                'stdout': buf.getvalue(),
                'error': '判分器执行出错：%s: %s' % (type(e).__name__, e),
            }
        if isinstance(r, bool):
            r = {'ok': r, 'results': [{'passed': r, 'error': ''}]}
        return {
            'ok': bool(r.get('ok')),
            'results': r.get('results') or [],
            'stdout': buf.getvalue(),
            'error': r.get('error', ''),
        }

    fn = ens.get(func_name)
    if fn is None:
        return {
            'ok': False, 'results': [],
            'stdout': buf.getvalue(),
            'error': '未找到函数 %s（检查函数名是否与题目一致）' % func_name,
        }

    # 3) 逐用例判定
    results = []
    for args, expected in cases:
        args = tuple(args) if isinstance(args, (list, tuple)) else (args,)
        try:
            with _RedirectIO(stdin_lines) as _:
                got = fn(*args)
            if expected_exc is not None:
                results.append({'passed': False, 'expected': expected_exc.__name__, 'got': '未抛异常', 'error': ''})
            elif _eq(got, expected):
                results.append({'passed': True, 'expected': '', 'got': '', 'error': ''})
            else:
                results.append({'passed': False, 'expected': _repr_of(expected), 'got': _repr_of(got), 'error': ''})
        except Exception as e:
            if expected_exc is not None and isinstance(e, expected_exc):
                results.append({'passed': True, 'expected': '', 'got': '', 'error': ''})
            else:
                results.append({'passed': False, 'expected': _repr_of(expected), 'got': '', 'error': '%s: %s' % (type(e).__name__, e)})

    # 4) 输出类判定（模块级 print）
    if expected_stdout is not None:
        out = buf.getvalue()
        passed = _norm_ws(out) == _norm_ws(expected_stdout)
        results.append({'passed': passed, 'expected': _norm_ws(expected_stdout), 'got': _norm_ws(out), 'error': ''})

    ok = bool(results) and all(r['passed'] for r in results)
    return {'ok': ok, 'results': results, 'stdout': buf.getvalue(), 'error': ''}


def _norm_ws(s):
    return ' '.join(str(s).split())
