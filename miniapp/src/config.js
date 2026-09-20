// 后端服务地址：开发时可改成本机局域网 IP
export const BASE_URL = 'https://marco2026.site:30000/api';
export const STATIC_HOST = 'https://marco2026.site:30000';

/** 补全图片地址 */
export function fixUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `${STATIC_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
}
