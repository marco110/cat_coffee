const express = require('express');
const db = require('../../db');
const { query, one, exec, tx } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql } = require('../../utils/time');
const { sid, randomCode, maskPhone } = require('../../utils/misc');
const { operationLog } = require('../../services/log');

const router = express.Router();

/** 券活动列表 */
router.get(
  '/coupon/list',
  merchantAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query, 20);
    const where = ['store_id = ?', 'deleted_at IS NULL'];
    const params = [req.storeId];
    if (req.query.keyword) {
      where.push('name LIKE ?');
      params.push(`%${req.query.keyword}%`);
    }
    if (req.query.status) {
      where.push('status = ?');
      params.push(req.query.status);
    }
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM coupon WHERE ${wsql}`, params);
    const rows = await query(`SELECT * FROM coupon WHERE ${wsql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    return ok(res, page(rows.map(formatCoupon), Number(total.c), p, pageSize));
  })
);

router.get(
  '/coupon/:couponId',
  merchantAuth,
  wrap(async (req, res) => ok(res, formatCoupon(await getCoupon(req))))
);

/** 发放记录 */
router.get(
  '/coupon/:couponId/records',
  merchantAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query, 20);
    const total = await one('SELECT COUNT(1) AS c FROM user_coupon WHERE coupon_id = ?', [req.params.couponId]);
    const rows = await query(
      `SELECT uc.*, u.nickname, u.phone FROM user_coupon uc LEFT JOIN user u ON u.id = uc.user_id
       WHERE uc.coupon_id = ? ORDER BY uc.id DESC LIMIT ${limit} OFFSET ${offset}`,
      [req.params.couponId]
    );
    return ok(
      res,
      page(
        rows.map((r) => ({
          id: sid(r.id),
          userNickname: r.nickname || '微信用户',
          userPhone: maskPhone(r.phone),
          status: r.status,
          source: r.source,
          receivedAt: r.received_at,
          usedAt: r.used_at,
          expireAt: r.expire_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

/** 统计 */
router.get(
  '/coupon/stats',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      `SELECT c.id, c.name,
              COUNT(uc.id) AS issued,
              SUM(uc.status = 'UNUSED') AS unused,
              SUM(uc.status = 'USED') AS used,
              SUM(uc.status = 'EXPIRED') AS expired
       FROM coupon c LEFT JOIN user_coupon uc ON uc.coupon_id = c.id
       WHERE c.store_id = ? AND c.deleted_at IS NULL
       GROUP BY c.id ORDER BY c.id DESC LIMIT 20`,
      [req.storeId]
    );
    return ok(
      res,
      rows.map((r) => ({
        id: sid(r.id),
        name: r.name,
        issued: Number(r.issued || 0),
        unused: Number(r.unused || 0),
        used: Number(r.used || 0),
        expired: Number(r.expired || 0),
      }))
    );
  })
);

router.post(
  '/coupon',
  merchantAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    validateCoupon(b);
    const ins = await exec(
      `INSERT INTO coupon (store_id, name, type, threshold_amount, discount_amount, discount_rate,
        max_discount_amount, scope_type, valid_type, valid_start, valid_end, valid_days, total_count,
        per_user_limit, issued_count, used_count, is_public, status, description, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,?)`,
      [
        req.storeId,
        String(b.name).slice(0, 20),
        b.type,
        n(b.thresholdAmount),
        n(b.discountAmount),
        b.type === 'DISCOUNT' ? n(b.discountRate) : null,
        n(b.maxDiscountAmount),
        b.scopeType === 'SPECIFIC' ? 'SPECIFIC' : 'ALL',
        b.validType === 'FIXED' ? 'FIXED' : 'DAYS',
        b.validType === 'FIXED' ? b.validStart : null,
        b.validType === 'FIXED' ? b.validEnd : null,
        b.validType === 'DAYS' ? Number(b.validDays || 7) : 0,
        Number(b.totalCount || 0),
        Number(b.perUserLimit || 1),
        b.isPublic === false ? 0 : 1,
        'RUNNING',
        b.description || '',
        req.storeUser.id,
        nowSql(),
        nowSql(),
      ]
    );
    await logOp(req, 'CREATE', `新增优惠券：${b.name}`, ins.insertId);
    return ok(res, { id: sid(ins.insertId) }, '创建成功');
  })
);

router.put(
  '/coupon/:couponId',
  merchantAuth,
  wrap(async (req, res) => {
    const c = await getCoupon(req);
    const b = req.body || {};
    if (Number(c.used_count) > 0) throw new BizError(CODES.CONFLICT, '该券已被核销，禁止修改');
    validateCoupon({ ...b, type: b.type || c.type });
    await exec(
      `UPDATE coupon SET name = ?, threshold_amount = ?, discount_amount = ?, discount_rate = ?,
        max_discount_amount = ?, total_count = ?, per_user_limit = ?, is_public = ?, description = ?, updated_at = ?
       WHERE id = ?`,
      [
        b.name === undefined ? c.name : String(b.name).slice(0, 20),
        b.thresholdAmount === undefined ? c.threshold_amount : n(b.thresholdAmount),
        b.discountAmount === undefined ? c.discount_amount : n(b.discountAmount),
        b.discountRate === undefined ? c.discount_rate : n(b.discountRate),
        b.maxDiscountAmount === undefined ? c.max_discount_amount : n(b.maxDiscountAmount),
        b.totalCount === undefined ? c.total_count : Number(b.totalCount),
        b.perUserLimit === undefined ? c.per_user_limit : Number(b.perUserLimit),
        b.isPublic === undefined ? c.is_public : b.isPublic ? 1 : 0,
        b.description === undefined ? c.description : b.description,
        nowSql(),
        c.id,
      ]
    );
    await logOp(req, 'UPDATE', `编辑优惠券：${c.name}`, c.id);
    return ok(res, { id: sid(c.id) }, '保存成功');
  })
);

router.put(
  '/coupon/:couponId/status',
  merchantAuth,
  wrap(async (req, res) => {
    const c = await getCoupon(req);
    const status = String((req.body || {}).status || '').toUpperCase();
    if (!['RUNNING', 'PAUSED', 'ENDED'].includes(status)) {
      throw new BizError(CODES.BAD_PARAM, '状态不合法');
    }
    if (status === 'ENDED') {
      await exec("UPDATE user_coupon SET status = 'EXPIRED', updated_at = ? WHERE coupon_id = ? AND status = 'UNUSED'", [
        nowSql(),
        c.id,
      ]);
    }
    await exec('UPDATE coupon SET status = ?, updated_at = ? WHERE id = ?', [status, nowSql(), c.id]);
    return ok(res, { status }, '操作成功');
  })
);

router.delete(
  '/coupon/:couponId',
  merchantAuth,
  wrap(async (req, res) => {
    const c = await getCoupon(req);
    if (Number(c.used_count) > 0) throw new BizError(CODES.CONFLICT, '该券已有核销记录，建议停用而非删除');
    await exec("UPDATE coupon SET deleted_at = ?, status = 'ENDED', updated_at = ? WHERE id = ?", [nowSql(), nowSql(), c.id]);
    return ok(res, { ok: true }, '删除成功');
  })
);

/** 定向发放 */
router.post(
  '/coupon/grant',
  merchantAuth,
  wrap(async (req, res) => {
    const { couponId, userIds } = req.body || {};
    if (!couponId || !userIds || !userIds.length) throw new BizError(CODES.BAD_PARAM, '请选择券与发放对象');
    const coupon = await one('SELECT * FROM coupon WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [couponId, req.storeId]);
    if (!coupon) throw new BizError(CODES.NOT_FOUND, '优惠券不存在');
    let count = 0;
    await tx(async (conn) => {
      for (const uid of userIds) {
        const exist = await conn.one('SELECT id FROM user_coupon WHERE coupon_id = ? AND user_id = ?', [coupon.id, uid]);
        if (exist) continue;
        let expireAt = null;
        if (coupon.valid_type === 'DAYS') {
          expireAt = nowSql(new Date(Date.now() + Number(coupon.valid_days) * 86400000));
        } else {
          expireAt = coupon.valid_end;
        }
        await conn.exec(
          `INSERT INTO user_coupon (coupon_id, user_id, store_id, code, status, source, expire_at, received_at, created_at, updated_at)
           VALUES (?,?,?,?, 'UNUSED', 'GRANT', ?, ?, ?, ?)`,
          [coupon.id, uid, req.storeId, randomCode(12), expireAt, nowSql(), nowSql(), nowSql()]
        );
        count += 1;
      }
      await conn.exec('UPDATE coupon SET issued_count = issued_count + ? WHERE id = ?', [count, coupon.id]);
    });
    await logOp(req, 'GRANT', `定向发放优惠券：${coupon.name}，共 ${count} 人`, coupon.id);
    return ok(res, { count }, `发放成功，共 ${count} 人`);
  })
);

function validateCoupon(b) {
  if (!b.name) throw new BizError(CODES.BAD_PARAM, '请填写券名称');
  if (!['FULL_REDUCE', 'CASH', 'DISCOUNT'].includes(b.type)) {
    throw new BizError(CODES.BAD_PARAM, '券类型不合法');
  }
  if (b.type === 'FULL_REDUCE' && n(b.thresholdAmount) <= 0) {
    throw new BizError(CODES.BAD_PARAM, '满减券需设置使用门槛');
  }
  if (b.type === 'FULL_REDUCE' && n(b.discountAmount) <= 0) {
    throw new BizError(CODES.BAD_PARAM, '满减券需设置减免金额');
  }
  if (b.type === 'CASH' && n(b.discountAmount) <= 0) {
    throw new BizError(CODES.BAD_PARAM, '代金券需设置抵扣金额');
  }
  if (b.type === 'DISCOUNT') {
    const rate = n(b.discountRate);
    if (rate <= 0 || rate >= 1) throw new BizError(CODES.BAD_PARAM, '折扣率需在 0 ~ 1 之间');
  }
}

function formatCoupon(c) {
  return {
    id: sid(c.id),
    name: c.name,
    type: c.type,
    thresholdAmount: n(c.threshold_amount),
    discountAmount: n(c.discount_amount),
    discountRate: c.discount_rate === null ? null : n(c.discount_rate),
    maxDiscountAmount: n(c.max_discount_amount),
    scopeType: c.scope_type,
    validType: c.valid_type,
    validStart: c.valid_start,
    validEnd: c.valid_end,
    validDays: Number(c.valid_days),
    totalCount: Number(c.total_count),
    perUserLimit: Number(c.per_user_limit),
    issuedCount: Number(c.issued_count),
    usedCount: Number(c.used_count),
    isPublic: Number(c.is_public),
    status: c.status,
    description: c.description || '',
    createdAt: c.created_at,
  };
}

async function getCoupon(req) {
  const c = await one('SELECT * FROM coupon WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
    req.params.couponId,
    req.storeId,
  ]);
  if (!c) throw new BizError(CODES.NOT_FOUND, '优惠券不存在');
  return c;
}

function logOp(req, action, description, targetId) {
  return operationLog({ req, operatorType: 'MERCHANT', operatorId: req.storeUser.id, operatorName: req.storeUser.real_name, storeId: req.storeId, module: 'COUPON', action, description, targetId });
}

module.exports = router;
