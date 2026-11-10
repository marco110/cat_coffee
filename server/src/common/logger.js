const util = require('util');

const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

/** 日志时间戳：固定北京时间(UTC+8)，不依赖服务器系统时区、也不依赖 ICU 本地化格式 */
function stamp() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`;
}

function write(level, args) {
  const time = stamp();
  const msg = args
    .map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 4 })))
    .join(' ');
  // eslint-disable-next-line no-console
  console.log(`[${time}] [${LEVELS[level] || 'INFO'}] ${msg}`);
}

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
