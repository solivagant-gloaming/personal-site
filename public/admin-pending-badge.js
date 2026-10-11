/**
 * 后台侧边栏「投稿审核」待审计数徽标。
 *
 * 后台各页是彼此独立的 HTML 文档、没有共用布局，所以把徽标做成一个共享脚本：
 * 每页只要一行 <script is:inline src="/admin-pending-badge.js" defer></script>，
 * 脚本自己找到导航里的 /admin/quotes 链接并挂上数字。
 * 计数为 0 时不显示任何东西——没投稿就别占视线。
 */
(function () {
  function boot() {
    var link = document.querySelector('.side-nav a[href="/admin/quotes"]');
    if (!link || link.querySelector('.nav-badge')) return;

    // 样式由脚本注入，避免每个后台页各自重复一份
    if (!document.getElementById('nav-badge-style')) {
      var style = document.createElement('style');
      style.id = 'nav-badge-style';
      style.textContent =
        '.side-nav a { position: relative; }' +
        '.nav-badge {' +
        '  position: absolute; right: .9rem; top: 50%; transform: translateY(-50%);' +
        '  background: #c17f59; color: #fff; font-size: .68rem; font-weight: 600;' +
        '  line-height: 1; padding: .28em .5em; border-radius: 9px;' +
        '}' +
        // 窄屏侧边栏会折叠成图标条，徽标仍要看得见
        '@media (max-width: 768px) { .nav-badge { right: .25rem; font-size: .6rem; padding: .2em .35em; } }';
      document.head.appendChild(style);
    }

    fetch('/api/admin/pending-count', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        var n = data && data.pending;
        if (!n) return;
        var badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.title = n + ' 句待审';
        link.appendChild(badge);
      })
      .catch(function () { /* 徽标拿不到就算了，不能拖累后台页面本身 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
