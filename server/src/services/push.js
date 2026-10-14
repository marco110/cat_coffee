const config = require('../config');
const logger = require('../common/logger');

const TIMEOUT_MS = 8000;

/**
 * 向单个 token 发送一条 PushPlus 消息（群组推送时 token + topic 组合）
 */
async function sendOne({ token, title, content, topic, api }) {
  const body = {
    token,
    title: String(title || '消息通知').slice(0, 100),
    content: String(content || ''),
    template: 'html',
  };
  if (topic) body.topic = topic;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(api, {
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
      logger.info('PushPlus 推送成功:', body.title, 'token=***' + token.slice(-6));
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

/**
 * PushPlus 推送：https://www.pushplus.plus
 * 支持多 token（多个接收账号）逐一对点推送；配了 topic 则走群组推送（只推一次）
 * 只做通知用，任何失败都只记日志，绝不向上抛出影响下单主流程
 *
 * @param {{title:string, content:string, topic?:string}} opt
 */
async function pushplus({ title, content, topic }) {
  const cfg = config.pushplus;
  if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
  const tokens = (cfg.tokens || []).filter(Boolean);
  if (!tokens.length) {
    logger.warn('未配置 PushPlus token，跳过推送');
    return { skipped: true, reason: 'no-token' };
  }

  // 群组推送：topic 存在时只需推一次（用第一个 token 作为发送者）
  if (topic || cfg.topic) {
    return sendOne({ token: tokens[0], title, content, topic: topic || cfg.topic, api: cfg.api });
  }

  // 多 token：逐个一对一推送（并发，互不影响）
  const results = await Promise.all(
    tokens.map((token) => sendOne({ token, title, content, api: cfg.api }))
  );
  const ok = results.filter((r) => r && Number(r.code) === 200).length;
  logger.info(`PushPlus 多账号推送完成：${ok}/${tokens.length} 成功`);
  return results;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { pushplus, escapeHtml };
