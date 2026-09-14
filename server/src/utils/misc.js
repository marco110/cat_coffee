const crypto = require('crypto');

/** 手机号脱敏 138****8888 */
function maskPhone(phone) {
  if (!phone) return '';
  const p = String(phone);
  if (p.length < 7) return p;
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

function isPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || ''));
}

/** 订单号：{yyyyMMddHHmmss}{storeId 后 2 位}{4 位随机数} 共 20 位 */
function buildOrderNo(storeId) {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (x) => String(x).padStart(2, '0');
  const ts = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(
    now.getUTCHours()
  )}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  const sid = String(storeId).slice(-2).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${ts}${sid}${rand}`;
}

function randomCode(len = 12) {
  return crypto.randomBytes(len).toString('hex').slice(0, len).toUpperCase();
}

/** 解析小程序码 scene：s{storeId}t{tableId} */
function parseScene(scene = '') {
  const m = /^s(\d+)t(\d+)$/.exec(String(scene).trim());
  if (!m) return { storeId: null, tableId: null };
  return { storeId: m[1], tableId: m[2] };
}

/** 取对象指定字段，未传则保留原值 */
function pick(source, fields) {
  const out = {};
  fields.forEach((f) => {
    if (source[f] !== undefined) out[f] = source[f];
  });
  return out;
}

/** JSON 字段安全解析 */
function json(v, def = null) {
  if (v === null || v === undefined) return def;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch (_) {
    return def;
  }
}

/** 统一把 id/金额等输出为字符串或数字 */
function sid(v) {
  return v === null || v === undefined ? null : String(v);
}

module.exports = { maskPhone, isPhone, buildOrderNo, randomCode, parseScene, pick, json, sid };
