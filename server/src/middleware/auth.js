const { verify } = require('../utils/jwt');
const jwtUtil = require('../utils/jwt');
const { one } = require('../db');
const { BizError, CODES } = require('../common/errors');

/** 包装 async 路由，统一捕获异常 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 解析 Authorization: Bearer <token> */
function jwtAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new BizError(CODES.UNAUTHORIZED, '未登录或登录已失效'));
  try {
    req.auth = verify(token);
  } catch (e) {
    return next(new BizError(CODES.UNAUTHORIZED, '登录已过期，请重新登录'));
  }
  return next();
}

const requireType =
  (...types) =>
  (req, _res, next) => {
    if (!req.auth || !types.includes(req.auth.type)) {
      return next(new BizError(CODES.FORBIDDEN, '无权访问该接口'));
    }
    return next();
  };

/**
 * 门店隔离（关键安全设计）：
 * storeId 只从 token 解析出的 store_user 读取，禁止前端传参决定数据范围
 */
async function storeScope(req, _res, next) {
  try {
    const user = await one(
      'SELECT * FROM store_user WHERE id = ? AND deleted_at IS NULL',
      [req.auth.sub]
    );
    if (!user || Number(user.status) !== 1) {
      return next(new BizError(CODES.MERCHANT_DISABLED, '账号已被禁用，请联系管理员'));
    }
    const store = await one(
      'SELECT * FROM store WHERE id = ? AND deleted_at IS NULL',
      [user.store_id]
    );
    if (!store || Number(store.status) !== 1) {
      return next(new BizError(CODES.MERCHANT_DISABLED, '门店已停用，请联系管理员'));
    }
    req.storeId = String(user.store_id);
    req.storeUser = user;
    req.store = store;
    return next();
  } catch (e) {
    return next(e);
  }
}

async function adminScope(req, _res, next) {
  try {
    const admin = await one(
      'SELECT * FROM sys_admin WHERE id = ? AND deleted_at IS NULL',
      [req.auth.sub]
    );
    if (!admin || Number(admin.status) !== 1) {
      return next(new BizError(CODES.MERCHANT_DISABLED, '账号已被禁用'));
    }
    req.admin = admin;
    return next();
  } catch (e) {
    return next(e);
  }
}

const customerAuth = [jwtAuth, requireType('CUSTOMER')];
const merchantAuth = [jwtAuth, requireType('MERCHANT'), wrap(storeScope)];
const adminAuth = [jwtAuth, requireType('ADMIN'), wrap(adminScope)];

/** 刷新后的 token 过期秒数（返回给前端） */
function expiresInSeconds(type) {
  const map = { CUSTOMER: 7 * 24 * 3600, MERCHANT: 7 * 24 * 3600, ADMIN: 2 * 3600 };
  return map[type] || 0;
}

module.exports = {
  wrap,
  jwtAuth,
  requireType,
  storeScope,
  adminScope,
  customerAuth,
  merchantAuth,
  adminAuth,
  expiresInSeconds,
  sign: jwtUtil.sign,
};
