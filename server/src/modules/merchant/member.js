const express = require('express');
const db = require('../../db');
const { query, one, exec, tx } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql } = require('../../utils/time');
const { sid, maskPhone } = require('../../utils/misc');
const memberService = require('../../services/member');
const { operationLog } = require('../../services/log');

const router = express.Router();

/** 会员列表 */
router.get(
  '/member/list',
  merchantAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query, 20);
    const where = ['m.store_id = ?'];
    const params = [req.storeId];
    if (req.query.keyword) {
      where.push('(u.phone LIKE ? OR u.nickname LIKE ?)');
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    if (req.query.levelId) {
      where.push('m.level_id = ?');
      params.push(req.query.levelId);
    }
    if (req.query.minConsume) {
      where.push('m.total_consume >= ?');
      params.push(n(req.query.minConsume));
    }
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM user_member m JOIN user u ON u.id = m.user_id WHERE ${wsql}`, params);
    const rows = await query(
      `SELECT m.*, u.nickname, u.avatar, u.phone, l.name AS level_name, l.discount
       FROM user_member m
       JOIN user u ON u.id = m.user_id
       LEFT JOIN member_level l ON l.id = m.level_id
       WHERE ${wsql} ORDER BY m.total_consume DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(
      res,
      page(
        rows.map((m) => ({
          id: sid(m.id),
          userId: sid(m.user_id),
          nickname: m.nickname || '微信用户',
          avatar: m.avatar || '',
          phone: maskPhone(m.phone),
          levelId: sid(m.level_id),
          levelName: m.level_name || '普通会员',
          levelDiscount: n(m.discount, 1),
          growth: Number(m.growth),
          points: Number(m.points),
          totalConsume: n(m.total_consume),
          orderCount: Number(m.order_count),
          lastOrderAt: m.last_order_at,
          createdAt: m.created_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

router.get(
  '/member/:memberId',
  merchantAuth,
  wrap(async (req, res) => {
    const m = await one(
      `SELECT m.*, u.nickname, u.avatar, u.phone, l.name AS level_name, l.discount
       FROM user_member m JOIN user u ON u.id = m.user_id
       LEFT JOIN member_level l ON l.id = m.level_id
       WHERE m.id = ? AND m.store_id = ?`,
      [req.params.memberId, req.storeId]
    );
    if (!m) throw new BizError(CODES.NOT_FOUND, '会员不存在');
    const pointsLogs = await query('SELECT * FROM points_log WHERE user_id = ? AND store_id = ? ORDER BY id DESC LIMIT 20', [m.user_id, req.storeId]);
    const coupons = await query(
      'SELECT uc.*, c.name FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id WHERE uc.user_id = ? AND uc.store_id = ? ORDER BY uc.id DESC LIMIT 20',
      [m.user_id, req.storeId]
    );
    return ok(res, {
      id: sid(m.id),
      userId: sid(m.user_id),
      nickname: m.nickname || '微信用户',
      avatar: m.avatar,
      phone: maskPhone(m.phone),
      levelName: m.level_name || '普通会员',
      levelDiscount: n(m.discount, 1),
      growth: Number(m.growth),
      points: Number(m.points),
      totalConsume: n(m.total_consume),
      orderCount: Number(m.order_count),
      lastOrderAt: m.last_order_at,
      pointsLogs: pointsLogs.map((l) => ({
        id: sid(l.id),
        type: l.type,
        points: Number(l.points),
        balance: Number(l.balance),
        remark: l.remark,
        createdAt: l.created_at,
      })),
      coupons: coupons.map((c) => ({
        id: sid(c.id),
        name: c.name,
        status: c.status,
        expireAt: c.expire_at,
        usedAt: c.used_at,
      })),
    });
  })
);

/** 手动调整积分 / 成长值 */
router.post(
  '/member/adjust',
  merchantAuth,
  wrap(async (req, res) => {
    const { userId, points = 0, growth = 0, remark } = req.body || {};
    if (!userId) throw new BizError(CODES.BAD_PARAM, '请选择会员');
    if (!Number(points) && !Number(growth)) throw new BizError(CODES.BAD_PARAM, '请填写调整值');
    let balance = 0;
    await tx(async (conn) => {
      balance = await memberService.adjustPoints(conn, {
        userId,
        storeId: req.storeId,
        points,
        growth,
        remark,
        operatorId: req.storeUser.id,
      });
    });
    await operationLog({
      req,
      operatorType: 'MERCHANT',
      operatorId: req.storeUser.id,
      operatorName: req.storeUser.real_name,
      storeId: req.storeId,
      module: 'MEMBER',
      action: 'UPDATE',
      description: `手动调整会员积分 ${points} / 成长值 ${growth}`,
      targetId: userId,
      content: req.body,
    });
    return ok(res, { balance }, '调整成功');
  })
);

/** 等级体系 */
router.get(
  '/member/level/list',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM member_level WHERE store_id = ? AND deleted_at IS NULL ORDER BY growth_threshold ASC',
      [req.storeId]
    );
    return ok(
      res,
      rows.map((l) => ({
        id: sid(l.id),
        name: l.name,
        levelValue: Number(l.level_value),
        growthThreshold: Number(l.growth_threshold),
        discount: n(l.discount, 1),
        icon: l.icon,
        benefits: l.benefits,
        isDefault: Number(l.is_default),
        status: Number(l.status),
      }))
    );
  })
);

router.post(
  '/member/level',
  merchantAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.name) throw new BizError(CODES.BAD_PARAM, '请填写等级名称');
    const rate = n(b.discount, 1);
    if (rate <= 0 || rate > 1) throw new BizError(CODES.BAD_PARAM, '折扣需在 0 ~ 1 之间');
    const ins = await exec(
      `INSERT INTO member_level (store_id, name, level_value, growth_threshold, discount, icon, benefits, is_default, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,0,1,?,?)`,
      [
        req.storeId,
        String(b.name).slice(0, 20),
        Number(b.levelValue || 1),
        Number(b.growthThreshold || 0),
        rate,
        b.icon || '',
        b.benefits || '',
        nowSql(),
        nowSql(),
      ]
    );
    return ok(res, { id: sid(ins.insertId) }, '新增成功');
  })
);

router.put(
  '/member/level/:levelId',
  merchantAuth,
  wrap(async (req, res) => {
    const l = await one('SELECT * FROM member_level WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
      req.params.levelId,
      req.storeId,
    ]);
    if (!l) throw new BizError(CODES.NOT_FOUND, '等级不存在');
    const b = req.body || {};
    const rate = b.discount === undefined ? n(l.discount, 1) : n(b.discount, 1);
    if (rate <= 0 || rate > 1) throw new BizError(CODES.BAD_PARAM, '折扣需在 0 ~ 1 之间');
    await exec(
      `UPDATE member_level SET name = ?, level_value = ?, growth_threshold = ?, discount = ?, icon = ?, benefits = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        b.name === undefined ? l.name : String(b.name).slice(0, 20),
        b.levelValue === undefined ? l.level_value : Number(b.levelValue),
        b.growthThreshold === undefined ? l.growth_threshold : Number(b.growthThreshold),
        rate,
        b.icon === undefined ? l.icon : b.icon,
        b.benefits === undefined ? l.benefits : b.benefits,
        b.status === undefined ? l.status : (b.status ? 1 : 0),
        nowSql(),
        l.id,
      ]
    );
    return ok(res, { id: sid(l.id) }, '保存成功');
  })
);

router.delete(
  '/member/level/:levelId',
  merchantAuth,
  wrap(async (req, res) => {
    const l = await one('SELECT * FROM member_level WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
      req.params.levelId,
      req.storeId,
    ]);
    if (!l) throw new BizError(CODES.NOT_FOUND, '等级不存在');
    if (Number(l.is_default) === 1) throw new BizError(CODES.CONFLICT, '默认等级不可删除');
    const used = await one('SELECT COUNT(1) AS c FROM user_member WHERE level_id = ?', [l.id]);
    if (Number(used.c) > 0) throw new BizError(CODES.CONFLICT, '该等级下已有会员，不可删除');
    await exec('UPDATE member_level SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), l.id]);
    return ok(res, { ok: true }, '删除成功');
  })
);

module.exports = router;
