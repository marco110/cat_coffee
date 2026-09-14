const OFFSET = 8 * 3600 * 1000; // 北京时间 UTC+8

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 当前北京时间 'YYYY-MM-DD HH:mm:ss' */
function nowSql(date = new Date()) {
  const d = new Date(date.getTime() + OFFSET);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** 当前北京日期 'YYYY-MM-DD' */
function dateSql(date = new Date()) {
  return nowSql(date).slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD HH:mm:ss' -> 时间戳(ms)，数据库存的是北京时间字符串 */
function parse(sqlTime) {
  if (!sqlTime) return 0;
  return new Date(`${String(sqlTime).replace(' ', 'T')}Z`).getTime() - OFFSET;
}

/** 已等待分钟数 */
function waitedMinutes(sqlTime) {
  if (!sqlTime) return 0;
  return Math.max(0, Math.floor((Date.now() - parse(sqlTime)) / 60000));
}

/** range: today / yesterday / 7d / 30d / custom */
function resolveRange(range = 'today', start, end) {
  const today = dateSql();
  switch (range) {
    case 'yesterday':
      return { start: addDays(today, -1), end: addDays(today, -1) };
    case '7d':
      return { start: addDays(today, -6), end: today };
    case '30d':
      return { start: addDays(today, -29), end: today };
    case 'custom':
      return { start: start || today, end: end || today };
    default:
      return { start: today, end: today };
  }
}

/** 日期区间 -> SQL 时间区间（闭区间到当日 23:59:59） */
function rangeToSql(range, start, end, dateField = 'created_at') {
  const r = resolveRange(range, start, end);
  return {
    where: `${dateField} >= ? AND ${dateField} <= ?`,
    params: [`${r.start} 00:00:00`, `${r.end} 23:59:59`],
    ...r,
  };
}

module.exports = { nowSql, dateSql, addDays, parse, waitedMinutes, resolveRange, rangeToSql };
