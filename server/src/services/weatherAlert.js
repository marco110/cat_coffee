const config = require('../config');
const db = require('../db');
const logger = require('../common/logger');
const { pushplus, escapeHtml } = require('./push');

const TIMEOUT_MS = 10000;

/**
 * 拉取和风天气预警（青岛，固定坐标）
 * 接口返回参考 https://dev.qweather.com/docs/api/warning/weather-alert/
 * 成功返回预警数组（已规整），无预警或异常时返回 []
 */
async function fetchAlerts() {
  const { apiUrl, apiKey } = config.weather;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'X-QW-Api-Key': apiKey },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      logger.warn('[weather] 和风天气预警接口返回非 JSON（可能鉴权/网关错误）：', text.slice(0, 300));
      return [];
    }
    // 兼容多种返回形态：
    //   1) { code:'200', warning:[...] }        标准封装
    //   2) [ {...}, {...} ]                      直接返回预警数组（weatheralert/v1/current）
    //   3) { data:{ warning:[...] } }             嵌套封装
    //   4) { warning:[...] } / { alerts:[...] }
    let arr;
    if (Array.isArray(data)) {
      arr = data;
    } else {
      arr = data.warning || data.alerts || (data.data && (data.data.warning || data.data.alerts));
    }
    // 仅当既不是预警数组、又无预警字段、且 code 非 200 时才判为异常
    if (arr === undefined && String(data.code) !== '200') {
      logger.warn('[weather] 和风天气预警接口返回异常：', text.slice(0, 500));
      return [];
    }
    if (arr && !Array.isArray(arr)) arr = [arr];
    return arr || [];
  } catch (e) {
    logger.warn('[weather] 拉取天气预警失败:', e.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 取「开启消息通知且配置了 PushPlus token」的店员 token 列表（跨全部门店）
 * @returns {Promise<string[]>}
 */
async function getNotifyTokens() {
  const rows = await db.query(
    `SELECT pushplus_token FROM store_user
     WHERE deleted_at IS NULL AND status = 1 AND notify_enabled = 1
       AND pushplus_token IS NOT NULL AND pushplus_token <> ''`
  );
  return rows.map((r) => r.pushplus_token).filter(Boolean);
}

/** 时间格式化：ISO(含 Z / +08:00) -> 本地(Asia/Shanghai) "YYYY-MM-DD HH:mm" */
function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const s = d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return s.replace(/\//g, '-');
  }
  // 兜底：直接去掉 T 与时区后缀
  return String(t)
    .replace('T', ' ')
    .replace(/[Zz]$/, '')
    .replace(/\+.*$/, '')
    .replace(/\.\d+.*$/, '');
}

/** 渲染单条预警为 HTML 片段（PushPlus 使用 html 模板）
 *  兼容和风 v7 warning 与 v1 alerts 两套字段名 */
function renderAlert(w) {
  // 标题：v1 alerts 用 headline，v7 退化为 title，再退化为「类型+预警」
  const typeName = (w.eventType && w.eventType.name) || w.event || w.type || '';
  const title = w.headline || w.title || (typeName ? `${typeName}预警` : '天气预警');
  const lines = [`<b>${escapeHtml(title)}</b>`];
  if (typeName) lines.push(`预警类型：${escapeHtml(typeName)}`);
  // 发布单位：v1 alerts 用 senderName，v7 退化为 sender
  const sender = w.senderName || w.sender;
  const pubTime = w.issuedTime || w.pubTime || w.updateTime || w.publishTime;
  const startTime = w.effectiveTime || w.startTime || w.onsetTime;
  const endTime = w.expireTime || w.endTime || w.expiresTime;
  const text = w.description || w.text || '';
  if (pubTime) lines.push(`发布时间：${escapeHtml(fmtTime(pubTime))}`);
  if (text) lines.push(`<br/>${escapeHtml(text).replace(/\n/g, '<br/>')}`);
  return lines.join('<br/>');
}

/**
 * 定时任务：拉取天气预警，推送给开启通知的店员
 * 仅在有生效预警时才推送（无预警不骚扰）；每半小时轮询一次，
 * 但只有「生效预警集合」发生变化（新增/解除/内容变更）时才真正推送，避免重复刷屏。
 */
let lastAlertSig = '';
async function pushWeatherAlert() {
  try {
    if (!config.weather.enabled) {
      logger.info('[weather] 天气预警推送未开启，跳过');
      return;
    }
    const alerts = await fetchAlerts();
    // 仅在「生效预警集合」发生变化时才推送，避免每半小时重复刷屏
    const sig = alerts.map((a) => a.id || a.title).sort().join('|');
    if (alerts.length && sig === lastAlertSig) {
      logger.info('[weather] 预警无变化，跳过推送');
      return;
    }
    lastAlertSig = sig;
    if (!alerts.length) {
      logger.info('[weather] 当前无生效天气预警，跳过推送');
      return;
    }
    const tokens = await getNotifyTokens();
    if (!tokens.length) {
      logger.info('[weather] 无开启通知的店员（未配置 token 或未开启通知），跳过推送');
      return;
    }
    const { title, content } = buildContent(alerts);
    await pushplus({ title, content, tokens });
    logger.info(`[weather] 天气预警推送完成，共 ${alerts.length} 条，接收人 ${tokens.length}`);
  } catch (e) {
    logger.error('[weather] 天气预警推送失败：', e.message);
  }
}

/**
 * 用预警数组拼装 PushPlus 推送内容（标题 + HTML 正文）
 * 抽出来便于预览/单测复用，保证「实际推送」与「预览」完全一致
 * @param {Array} alerts 已规整的预警数组
 * @returns {{title:string, content:string}}
 */
function buildContent(alerts) {
  const head = '<div style="text-align:center"><b>天气预警播报</b></div><hr/>';
  const body = alerts.map((w) => renderAlert(w)).join('<hr/>');
  const title = `天气预警播报（${alerts.length}条生效）`.slice(0, 100);
  return { title, content: head + body };
}

module.exports = { pushWeatherAlert, fetchAlerts, getNotifyTokens, renderAlert, buildContent };
