const { BizError } = require('./errors');

/** 统一成功响应 */
function ok(res, data = null, msg = 'success') {
  return res.json({ code: 0, msg, data, timestamp: Date.now() });
}

/** 统一分页结构 */
function page(list, total, pageNum, pageSize) {
  return {
    list,
    total,
    page: Number(pageNum) || 1,
    pageSize: Number(pageSize) || 10,
  };
}

/** 取分页参数，pageSize 上限 50 */
function paging(query, defaultSize = 10) {
  const p = Math.max(1, parseInt(query.page, 10) || 1);
  const size = Math.min(50, Math.max(1, parseInt(query.pageSize, 10) || defaultSize));
  return { page: p, pageSize: size, offset: (p - 1) * size, limit: size };
}

/** 统一失败响应（一般不直接调用，抛 BizError 即可） */
function fail(res, err) {
  const e = err instanceof BizError ? err : new BizError(500, err.message);
  return res.json({ code: e.code, msg: e.msg || e.message, data: e.data, timestamp: Date.now() });
}

module.exports = { ok, fail, page, paging };
