const util = require('util');

const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

function write(level, args) {
  const time = new Date().toISOString();
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
