const express = require('express');
const db = require('../../db');
const { query, one } = db;
const { wrap, customerAuth } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/common');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n, toYuan } = require('../../utils/money');
const { sid, json } = require('../../utils/misc');
const { resolveItems, computePrice } = require('../../services/price');
const memberService = require('../../services/member');
const orderService = require('../../services/order');

const router = express.Router();

/** 校验手机号已绑定 */
async function requireBoundPhone(userId) {
  const user = await one('SELECT * FROM user WHERE id = ?', [userId]);
  if (!user || !user.phone) throw new BizError(CODES.PHONE_NOT_BOUND, '请先授权手机号');
  return user;
}

/** 重新计算一次价格（预览与下单共用） */
async function calc({ userId, storeId, body }) {
  const store = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [storeId]);
  if (!store || Number(store.status) !== 1) throw new BizError(CODES.NOT_FOUND, '门店不存在');
  const { items, goodsAmountCents } = await resolveItems(db, storeId, body.items || []);
  const mInfo = await memberService.getMemberInfo(db, userId, storeId);
  const member = {
    levelId: mInfo.levelId,
    levelName: mInfo.levelName,
    discountRate: mInfo.discountRate,
    points: mInfo.points,
  };
  let coupon = null;
  if (body.userCouponId) {
    const uc = await one(
      `SELECT uc.*, c.name, c.type, c.threshold_amount, c.discount_amount, c.discount_rate, c.max_discount_amount, c.status AS coupon_status
       FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id
       WHERE uc.id = ? AND uc.user_id = ? AND uc.store_id = ? AND uc.status = 'UNUSED'`,
      [body.userCouponId, userId, storeId]
    );
    if (uc && uc.coupon_status === 'RUNNING') coupon = { ...uc, userCouponId: uc.id, id: uc.coupon_id };
  }
  const result = computePrice({
    store,
    member,
    coupon,
    usePoints: !!body.usePoints,
    pointsUsed: Number(body.pointsUsed || 0),
    goodsAmountCents,
  });
  return { store, items, goodsAmountCents, member, result };
}

/** 结算预览 */
router.post(
  '/order/preview',
  customerAuth,
  wrap(async (req, res) => {
    const userId = req.auth.sub;
    const { storeId } = req.body || {};
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const { result } = await calc({ userId, storeId, body: req.body });
    const availableCoupons = await listAvailableCoupons(userId, storeId, result.detail.goodsAmount);
    return ok(res, {
      priceDetail: result.detail,
      availableCoupons,
      pointsInfo: result.pointsInfo,
    });
  })
);

async function listAvailableCoupons(userId, storeId, goodsAmount) {
  const rows = await query(
    `SELECT uc.id AS userCouponId, uc.expire_at, uc.status, c.*
     FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id
     WHERE uc.user_id = ? AND uc.store_id = ? AND uc.status = 'UNUSED' AND c.deleted_at IS NULL
     ORDER BY c.discount_amount DESC, uc.id DESC`,
    [userId, storeId]
  );
  const now = Date.now();
  return rows.map((r) => {
    let usable = true;
    let unusableReason = null;
    if (r.coupon_status && r.coupon_status !== 'RUNNING') {
      usable = false;
      unusableReason = '优惠券已结束';
    } else if (r.status !== 'RUNNING') {
      usable = false;
      unusableReason = '优惠券不可用';
    } else if (r.expire_at && new Date(`${String(r.expire_at).replace(' ', 'T')}Z`).getTime() - 8 * 3600e3 < now) {
      usable = false;
      unusableReason = '优惠券已过期';
    } else if (goodsAmount < n(r.threshold_amount)) {
      usable = false;
      unusableReason = `未满 ${n(r.threshold_amount).toFixed(2)} 元可用`;
    }
    return {
      userCouponId: sid(r.userCouponId),
      name: r.name,
      type: r.type,
      thresholdAmount: n(r.threshold_amount),
      discountAmount: n(r.discount_amount),
      discountRate: r.type === 'DISCOUNT' ? n(r.discount_rate) : null,
      maxDiscountAmount: n(r.max_discount_amount),
      expireAt: r.expire_at,
      description: r.description || '',
      usable,
      unusableReason,
    };
  });
}

/** 提交订单（单用户 10 秒 1 次，防重复提交） */
router.post(
  '/order',
  customerAuth,
  rateLimit({ key: (req) => `order:${req.auth.sub}`, windowMs: 10000, max: 1, msg: '下单过于频繁，请稍后再试' }),
  wrap(async (req, res) => {
    const userId = req.auth.sub;
    const user = await requireBoundPhone(userId);
    const body = { ...(req.body || {}), phone: user.phone };
    const storeId = body.storeId;
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const data = await orderService.createOrder({ userId, storeId, body });
    return ok(res, data, '下单成功');
  })
);

/** 是否存在进行中订单 */
router.get(
  '/order/ongoing',
  customerAuth,
  wrap(async (req, res) => {
    const rows = await query(
      `SELECT id, order_no, status, pickup_code, table_no, created_at FROM order_main
       WHERE user_id = ? AND status IN ('PENDING','ACCEPTED','MAKING','READY') AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.auth.sub]
    );
    return ok(res, {
      count: rows.length,
      latest: rows[0]
        ? {
            orderId: sid(rows[0].id),
            orderNo: rows[0].order_no,
            status: rows[0].status,
            tableNo: rows[0].table_no,
            pickupCode: rows[0].pickup_code,
            createdAt: rows[0].created_at,
          }
        : null,
    });
  })
);

/** 我的订单列表 */
router.get(
  '/order/list',
  customerAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const status = req.query.status || '';
    const where = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [req.auth.sub];
    if (status === 'ONGOING') {
      where.push("status IN ('PENDING','ACCEPTED','MAKING','READY')");
    } else if (status === 'COMPLETED') {
      where.push("status = 'COMPLETED'");
    } else if (status === 'CANCELLED') {
      where.push("status IN ('CANCELLED','REJECTED')");
    }
    const total = await one(
      `SELECT COUNT(1) AS c FROM order_main WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await query(
      `SELECT * FROM order_main WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const list = [];
    for (const o of rows) {
      const store = await one('SELECT name, logo FROM store WHERE id = ?', [o.store_id]);
      const items = await query('SELECT dish_name, dish_cover, quantity FROM order_item WHERE order_id = ?', [o.id]);
      list.push({
        id: sid(o.id),
        orderNo: o.order_no,
        storeName: store ? store.name : '',
        storeLogo: store ? store.logo : '',
        orderType: o.order_type,
        tableNo: o.table_no,
        pickupCode: o.pickup_code,
        status: o.status,
        statusText: orderService.STATUS_TEXT[o.status] || o.status,
        payStatus: o.pay_status,
        payAmount: n(o.pay_amount),
        itemCount: Number(o.item_count),
        dishes: items.map((i) => ({ name: i.dish_name, cover: i.dish_cover, quantity: Number(i.quantity) })),
        createdAt: o.created_at,
        buttons: orderService.orderButtons(o, 'CUSTOMER'),
      });
    }
    return ok(res, page(list, Number(total.c), p, pageSize));
  })
);

/** 订单详情 */
router.get(
  '/order/:orderId',
  customerAuth,
  wrap(async (req, res) => {
    const o = await one(
      'SELECT * FROM order_main WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [req.params.orderId, req.auth.sub]
    );
    if (!o) throw new BizError(CODES.NOT_FOUND, '订单不存在');
    return ok(res, await orderService.buildOrderVO(db, o, 'CUSTOMER'));
  })
);

/** 取消订单 */
router.post(
  '/order/:orderId/cancel',
  customerAuth,
  wrap(async (req, res) => {
    const o = await one(
      'SELECT * FROM order_main WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [req.params.orderId, req.auth.sub]
    );
    if (!o) throw new BizError(CODES.NOT_FOUND, '订单不存在');
    if (o.status !== 'PENDING') {
      throw new BizError(CODES.ORDER_STATUS_INVALID, '当前状态无法自助取消，请联系店员协商');
    }
    const r = await orderService.transition({
      orderId: o.id,
      storeId: o.store_id,
      action: 'CANCEL',
      operatorType: 'CUSTOMER',
      operatorId: req.auth.sub,
      extra: { reason: (req.body || {}).reason || '顾客取消' },
    });
    return ok(res, { status: r.status, cancelledAt: r.cancelled_at }, '订单已取消');
  })
);

/** 催单（P1，30 分钟内一次） */
router.post(
  '/order/:orderId/urge',
  customerAuth,
  rateLimit({ key: (req) => `urge:${req.params.orderId}`, windowMs: 30 * 60 * 1000, max: 1, msg: '30 分钟内只能催单一次' }),
  wrap(async (req, res) => {
    const o = await one(
      'SELECT * FROM order_main WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [req.params.orderId, req.auth.sub]
    );
    if (!o) throw new BizError(CODES.NOT_FOUND, '订单不存在');
    if (!['ACCEPTED', 'MAKING'].includes(o.status)) {
      throw new BizError(CODES.ORDER_STATUS_INVALID, '当前状态不支持催单');
    }
    await orderService.addOrderLog(db, {
      orderId: o.id,
      storeId: o.store_id,
      action: 'MODIFY',
      fromStatus: o.status,
      toStatus: o.status,
      operatorType: 'CUSTOMER',
      operatorId: req.auth.sub,
      remark: '顾客催单',
    });
    return ok(res, { urged: true }, '已提醒店员尽快出餐');
  })
);

/** 再来一单 */
router.get(
  '/order/:orderId/reorder',
  customerAuth,
  wrap(async (req, res) => {
    const o = await one(
      'SELECT * FROM order_main WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [req.params.orderId, req.auth.sub]
    );
    if (!o) throw new BizError(CODES.NOT_FOUND, '订单不存在');
    const items = await query('SELECT * FROM order_item WHERE order_id = ?', [o.id]);
    return ok(res, {
      storeId: sid(o.store_id),
      items: items.map((i) => ({
        dishId: sid(i.dish_id),
        quantity: Number(i.quantity),
        specItemIds: (json(i.spec_snapshot, []) || []).map((s) => s.itemId),
        addonIds: (json(i.addons, []) || []).map((a) => a.addonId),
        remark: i.remark || '',
      })),
    });
  })
);

module.exports = router;
