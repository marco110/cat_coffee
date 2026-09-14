/**
 * 全局错误码与业务异常
 * code = 0 成功，其余见《00-README 4.2 错误码表》
 */
const CODES = {
  SUCCESS: 0,
  BAD_PARAM: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
  PHONE_NOT_BOUND: 1001,
  STORE_CLOSED: 1002,
  DISH_UNAVAILABLE: 1003,
  ORDER_STATUS_INVALID: 1004,
  COUPON_UNAVAILABLE: 1005,
  POINTS_NOT_ENOUGH: 1006,
  TABLE_INVALID: 1007,
  LOGIN_FAILED: 1008,
  ACCOUNT_LOCKED: 1009,
  RATE_LIMIT: 1010,
  MERCHANT_DISABLED: 2001,
};

class BizError extends Error {
  constructor(code, msg, data = null) {
    super(msg || '业务异常');
    this.name = 'BizError';
    this.code = code;
    this.data = data;
  }
}

const badRequest = (msg, data) => new BizError(CODES.BAD_PARAM, msg, data);
const notFound = (msg) => new BizError(CODES.NOT_FOUND, msg || '资源不存在');
const forbidden = (msg) => new BizError(CODES.FORBIDDEN, msg || '无权限');

module.exports = { CODES, BizError, badRequest, notFound, forbidden };
