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
 * token 来源：优先使用调用方传入的 token 列表（按门店/人员维度配置），
 * 列表为空时退回全局 config.pushplus.tokens（兼容旧的 env 配置）。
 * 支持多 token 逐个一对一点推送；配了 topic 则走群组推送（只推一次）。
 * 只做通知用，任何失败都只记日志，绝不向上抛出影响下单主流程。
 *
 * @param {{title:string, content:string, tokens?:string[], topic?:string}} opt
 */
async function pushplus({ title, content, tokens, topic }) {
  const cfg = config.pushplus;
  if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
  // 优先按人员/门店维度传入的 token；否则退回全局 env 配置
  let list = (tokens || []).filter(Boolean);
  if (!list.length) list = (cfg.tokens || []).filter(Boolean);
  if (!list.length) {
    logger.warn('未配置 PushPlus token，跳过推送');
    return { skipped: true, reason: 'no-token' };
  }

  // 群组推送：topic 存在时只需推一次（用第一个 token 作为发送者）
  if (topic || cfg.topic) {
    return sendOne({ token: list[0], title, content, topic: topic || cfg.topic, api: cfg.api });
  }

  // 多 token：逐个一对一推送（并发，互不影响）
  const results = await Promise.all(
    list.map((token) => sendOne({ token, title, content, api: cfg.api }))
  );
  const ok = results.filter((r) => r && Number(r.code) === 200).length;
  logger.info(`PushPlus 多账号推送完成：${ok}/${list.length} 成功`);
  return results;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { pushplus, escapeHtml };
