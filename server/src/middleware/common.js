const { BizError, CODES } = require('../common/errors');
const logger = require('../common/logger');

/** 请求日志 */
function requestLog(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const cost = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${cost}ms`);
  });
  next();
}

function notFound(req, _res, next) {
  next(new BizError(CODES.NOT_FOUND, `接口不存在：${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof BizError) {
    if (err.code >= 500) logger.error(err);
    return res.json({
      code: err.code,
      msg: err.message,
      data: err.data === undefined ? null : err.data,
      timestamp: Date.now(),
    });
  }
  logger.error(`[Unhandled] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({
    code: CODES.SERVER_ERROR,
    msg: err.message || '服务器内部错误',
    data: null,
    timestamp: Date.now(),
  });
}

/** 简易内存限流：key -> { count, resetAt } */
const buckets = new Map();
function rateLimit({ key, windowMs = 5000, max = 1, code = CODES.RATE_LIMIT, msg = '操作过于频繁，请稍后再试' }) {
  return (req, _res, next) => {
    const k = typeof key === 'function' ? key(req) : key;
    const now = Date.now();
    const b = buckets.get(k);
    if (!b || b.resetAt < now) {
      buckets.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (b.count >= max) return next(new BizError(code, msg));
    b.count += 1;
    return next();
  };
}

module.exports = { requestLog, notFound, errorHandler, rateLimit };
