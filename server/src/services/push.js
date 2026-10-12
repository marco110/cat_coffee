const config = require('../config');
const logger = require('../common/logger');

const TIMEOUT_MS = 8000;

/**
 * PushPlus 推送：https://www.pushplus.plus
 * 只做通知用，任何失败都只记日志，绝不向上抛出影响下单主流程
 *
 * @param {{title:string, content:string, topic?:string}} opt
 */
async function pushplus({ title, content, topic }) {
  const cfg = config.pushplus;
  if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
  if (!cfg.token) {
    logger.warn('未配置 PushPlus token，跳过推送');
    return { skipped: true, reason: 'no-token' };
  }
  const body = {
    token: cfg.token,
    title: String(title || '消息通知').slice(0, 100),
    content: String(content || ''),
    template: 'html',
  };
  // 一对一推送不需要 topic；传了则走群组推送
  const t = topic || cfg.topic;
  if (t) body.topic = t;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(cfg.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { code: -1, msg: text };
    }
    if (Number(data.code) === 200) {
      logger.info('PushPlus 推送成功:', body.title);
    } else {
      logger.warn('PushPlus 推送失败:', text.slice(0, 200));
    }
    return data;
  } catch (e) {
    logger.warn('PushPlus 请求异常:', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { pushplus, escapeHtml };
