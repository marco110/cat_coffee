/**
 * 金额工具：所有计算以「分」为单位，避免浮点误差
 */

/** 任意值转数字（数据库 DECIMAL 返回字符串） */
function n(v, def = 0) {
  if (v === null || v === undefined || v === '') return def;
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
}

/** 元 -> 分 */
function toCent(v) {
  return Math.round(n(v) * 100);
}

/** 分 -> 元（保留两位） */
function toYuan(cent) {
  return Math.round(cent) / 100;
}

/** 格式化为两位小数字符串 */
function fmt(v) {
  return n(v).toFixed(2);
}

module.exports = { n, toCent, toYuan, fmt };
