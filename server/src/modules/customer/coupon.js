const express = require('express');
const db = require('../../db');
const { query, one, exec } = db;
const { wrap, customerAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql } = require('../../utils/time');
const { sid, randomCode } = require('../../utils/misc');

const router = express.Router();

/** 我的优惠券 status=UNUSED/USED/EXPIRED */
router.get(
  '/coupon/list',
  customerAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query, 20);
    const storeId = req.query.storeId;
    const status = req.query.status || 'UNUSED';
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const where = ['uc.user_id = ?', 'uc.store_id = ?'];
    const params = [req.auth.sub, storeId];
    if (status) {
      where.push('uc.status = ?');
      params.push(status);
    }
    const total = await one(
      `SELECT COUNT(1) AS c FROM user_coupon uc WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await query(
      `SELECT uc.*, c.name, c.type, c.threshold_amount, c.discount_amount, c.discount_rate,
              c.max_discount_amount, c.description, c.scope_type
       FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id
       WHERE ${where.join(' AND ')} ORDER BY uc.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(res, page(rows.map(formatCoupon), Number(total.c), p, pageSize));
  })
);

/** 结算可用券 */
router.get(
  '/coupon/available',
  customerAuth,
  wrap(async (req, res) => {
    const { storeId, amount } = req.query;
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const rows = await query(
      `SELECT uc.*, c.name, c.type, c.threshold_amount, c.discount_amount, c.discount_rate,
              c.max_discount_amount, c.description
       FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id
       WHERE uc.user_id = ? AND uc.store_id = ? AND uc.status = 'UNUSED' AND c.status = 'RUNNING'
         AND (uc.expire_at IS NULL OR uc.expire_at > ?)
       ORDER BY c.discount_amount DESC`,
      [req.auth.sub, storeId, nowSql()]
    );
    const goods = n(amount);
    return ok(
      res,
      rows.map((r) => {
        const usable = goods >= n(r.threshold_amount);
        return {
          ...formatCoupon(r),
          usable,
          unusableReason: usable ? null : `未满 ${n(r.threshold_amount).toFixed(2)} 元可用`,
        };
      })
    );
  })
);

/** 领券中心 */
router.get(
  '/coupon/center',
  customerAuth,
  wrap(async (req, res) => {
    const storeId = req.query.storeId;
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const rows = await query(
      `SELECT * FROM coupon WHERE store_id = ? AND deleted_at IS NULL AND is_public = 1 AND status = 'RUNNING'
       ORDER BY id DESC`,
      [storeId]
    );
    const claimed = await query(
      'SELECT coupon_id, COUNT(1) AS c FROM user_coupon WHERE user_id = ? AND store_id = ? GROUP BY coupon_id',
      [req.auth.sub, storeId]
    );
    const map = new Map(claimed.map((c) => [String(c.coupon_id), Number(c.c)]));
    return ok(
      res,
      rows.map((c) => ({
        id: String(c.id),
        name: c.name,
        type: c.type,
        thresholdAmount: n(c.threshold_amount),
        discountAmount: n(c.discount_amount),
        discountRate: c.type === 'DISCOUNT' ? n(c.discount_rate) : null,
        maxDiscountAmount: n(c.max_discount_amount),
        validStart: c.valid_start,
        validEnd: c.valid_end,
        validDays: Number(c.valid_days),
        description: c.description || '',
        claimedCount: map.get(String(c.id)) || 0,
        perUserLimit: Number(c.per_user_limit),
        canClaim: (map.get(String(c.id)) || 0) < Number(c.per_user_limit) && remainCount(c) !== 0,
      }))
    );
  })
);

function remainCount(c) {
  if (!Number(c.total_count)) return -1; // 不限量
  return Number(c.total_count) - Number(c.issued_count);
}

/** 领取优惠券 */
router.post(
  '/coupon/:couponId/claim',
  customerAuth,
  wrap(async (req, res) => {
    const coupon = await one(
      'SELECT * FROM coupon WHERE id = ? AND deleted_at IS NULL',
      [req.params.couponId]
    );
    if (!coupon) throw new BizError(CODES.NOT_FOUND, '优惠券不存在');
    if (coupon.status !== 'RUNNING') throw new BizError(CODES.COUPON_UNAVAILABLE, '该券当前不可领取');
    if (remainCount(coupon) === 0) throw new BizError(CODES.COUPON_UNAVAILABLE, '优惠券已被领完');
    const mine = await one(
      'SELECT COUNT(1) AS c FROM user_coupon WHERE coupon_id = ? AND user_id = ?',
      [coupon.id, req.auth.sub]
    );
    if (Number(mine.c) >= Number(coupon.per_user_limit)) {
      throw new BizError(CODES.COUPON_UNAVAILABLE, '已达每人限领数量');
    }
    const now = new Date();
    let expireAt = null;
    if (coupon.valid_type === 'DAYS') {
      expireAt = nowSql(new Date(now.getTime() + Number(coupon.valid_days) * 86400000));
    } else {
      expireAt = coupon.valid_end;
    }
    const ins = await exec(
      `INSERT INTO user_coupon (coupon_id, user_id, store_id, code, status, source, expire_at, received_at, created_at, updated_at)
       VALUES (?,?,?,?, 'UNUSED', 'CLAIM', ?, ?, ?, ?)`,
      [coupon.id, req.auth.sub, coupon.store_id, randomCode(12), expireAt, nowSql(), nowSql(), nowSql()]
    );
    await exec('UPDATE coupon SET issued_count = issued_count + 1 WHERE id = ?', [coupon.id]);
    return ok(res, { userCouponId: sid(ins.insertId) }, '领取成功');
  })
);

/** 券详情 */
router.get(
  '/coupon/:userCouponId',
  customerAuth,
  wrap(async (req, res) => {
    const row = await one(
      `SELECT uc.*, c.name, c.type, c.threshold_amount, c.discount_amount, c.discount_rate,
              c.max_discount_amount, c.description
       FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id
       WHERE uc.id = ? AND uc.user_id = ?`,
      [req.params.userCouponId, req.auth.sub]
    );
    if (!row) throw new BizError(CODES.NOT_FOUND, '优惠券不存在');
    return ok(res, formatCoupon(row));
  })
);

function formatCoupon(r) {
  return {
    userCouponId: sid(r.id),
    couponId: sid(r.coupon_id || r.id),
    name: r.name,
    type: r.type,
    thresholdAmount: n(r.threshold_amount),
    discountAmount: n(r.discount_amount),
    discountRate: r.discount_rate === null || r.discount_rate === undefined ? null : n(r.discount_rate),
    maxDiscountAmount: n(r.max_discount_amount),
    status: r.status,
    description: r.description || '',
    expireAt: r.expire_at,
    usedAt: r.used_at,
    receivedAt: r.received_at,
  };
}

module.exports = router;
