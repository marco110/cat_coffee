const express = require('express');
const db = require('../../db');
const { query, one } = db;
const { wrap, customerAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const memberService = require('../../services/member');

const router = express.Router();

/** 会员卡信息 */
router.get(
  '/member/info',
  customerAuth,
  wrap(async (req, res) => {
    const storeId = req.query.storeId || req.query.store_id;
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const info = await memberService.getMemberInfo(db, req.auth.sub, storeId);
    const levels = await query(
      'SELECT * FROM member_level WHERE store_id = ? AND status = 1 AND deleted_at IS NULL ORDER BY growth_threshold ASC',
      [storeId]
    );
    const idx = levels.findIndex((l) => String(l.id) === info.levelId);
    const next = levels[idx + 1] || null;
    return ok(res, {
      levelId: info.levelId,
      levelName: info.levelName,
      discountRate: info.discountRate,
      growth: info.growth,
      points: info.points,
      totalConsume: n(info.member.total_consume),
      orderCount: Number(info.member.order_count),
      levelIcon: info.level ? info.level.icon || '' : '',
      benefits: info.level ? info.level.benefits || '' : '',
      nextLevel: next
        ? {
            name: next.name,
            growthThreshold: Number(next.growth_threshold),
            discount: n(next.discount, 1),
            needGrowth: Math.max(0, Number(next.growth_threshold) - info.growth),
          }
        : null,
      createdAt: info.member.created_at,
    });
  })
);

/** 本店等级体系 */
router.get(
  '/member/levels',
  customerAuth,
  wrap(async (req, res) => {
    const storeId = req.query.storeId;
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const rows = await query(
      'SELECT * FROM member_level WHERE store_id = ? AND status = 1 AND deleted_at IS NULL ORDER BY growth_threshold ASC',
      [storeId]
    );
    return ok(
      res,
      rows.map((l) => ({
        id: String(l.id),
        name: l.name,
        levelValue: Number(l.level_value),
        growthThreshold: Number(l.growth_threshold),
        discount: n(l.discount, 1),
        icon: l.icon || '',
        benefits: l.benefits || '',
      }))
    );
  })
);

/** 积分明细 */
router.get(
  '/member/points-log',
  customerAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const storeId = req.query.storeId;
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '缺少 storeId');
    const where = ['user_id = ?', 'store_id = ?'];
    const params = [req.auth.sub, storeId];
    const total = await one(`SELECT COUNT(1) AS c FROM points_log WHERE ${where.join(' AND ')}`, params);
    const rows = await query(
      `SELECT * FROM points_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(
      res,
      page(
        rows.map((r) => ({
          id: String(r.id),
          type: r.type,
          typeText: { EARN: '消费获得', DEDUCT: '积分抵扣', REFUND: '取消退回', ADMIN: '店主调整' }[r.type] || r.type,
          points: Number(r.points),
          balance: Number(r.balance),
          remark: r.remark || '',
          createdAt: r.created_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

module.exports = router;
