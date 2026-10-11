import { defineMiddleware } from 'astro:middleware';
import { verifyToken, COOKIE_NAME } from './lib/auth.js';

/**
 * 后台登录门禁。
 *
 * 为什么放在中间件而不是 Admin 布局里：布局是渲染期组件，等它执行时响应流已经
 * 开始往浏览器写，此时再 `Astro.redirect()` 会抛 ResponseSentError —— 这不是
 * 「写法不够优雅」，是根本来不及。中间件在渲染前执行，重定向才是有效的。
 *
 * 只管页面路由。/api/admin/* 由各自的 requireAdmin() 自行把关。
 */
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  const isAdminPage =
    pathname === '/admin' || pathname.startsWith('/admin/');
  if (!isAdminPage || pathname === '/admin/login') {
    return next();
  }

  const token = context.cookies.get(COOKIE_NAME)?.value;
  if (!token || !verifyToken(token)) {
    return context.redirect('/admin/login');
  }

  return next();
});
