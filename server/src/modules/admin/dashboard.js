const express = require('express');
const db = require('../../db');
const { query, one, scalar } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { n } = require('../../utils/money');
const { rangeToSql, dateSql, nowSql, addDays, resolveRange } = require('../../utils/time');
const { sid } = require('../../utils/misc');

const router = express.Router();

/** 平台总览 */
router.get(
  '/dashboard/overview',
  adminAuth,
  wrap(async (req, res) => {
    const storeTotal = Number(await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL'));
    const storeOpened = Number(
      await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND status = 1 AND business_status = 1')
    );
    const storeDisabled = Number(await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND status = 0'));
    const newStore7 = Number(
      await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND created_at >= ?', [
        nowSql(new Date(Date.now() - 7 * 86400000)),
      ])
    );
    const newStore30 = Number(
      await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND created_at >= ?', [
        nowSql(new Date(Date.now() - 30 * 86400000)),
      ])
    );
    const today = rangeToSql('today', null, null, 'created_at');
    const orderStat = await one(
      `SELECT COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue,
              SUM(pay_status = 'PAID') AS paid_count
       FROM order_main WHERE deleted_at IS NULL AND ${today.where}`,
      today.params
    );
    const pendingCount = Number(
      await scalar(
        "SELECT COUNT(1) AS c FROM order_main WHERE deleted_at IS NULL AND status = 'PENDING'"
      )
    );
    const memberTotal = Number(await scalar('SELECT COUNT(1) AS c FROM user_member'));
    const userTotal = Number(await scalar('SELECT COUNT(1) AS c FROM user WHERE status = 1'));
    return ok(res, {
      storeTotal,
      storeOpened,
      storeDisabled,
      newStore7,
      newStore30,
      todayOrderCount: Number(orderStat.order_count),
      todayRevenue: n(orderStat.revenue),
      todayPaidCount: Number(orderStat.paid_count || 0),
      pendingOrderCount: pendingCount,
      memberTotal,
      userTotal,
    });
  })
);

/** 近 7 天 / 30 天趋势 */
router.get(
  '/dashboard/trend',
  adminAuth,
  wrap(async (req, res) => {
    const { range = '7d' } = req.query;
    const r = rangeToSql(range, null, null, 'created_at');
    const rows = await query(
      `SELECT DATE(created_at) AS d, COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue
       FROM order_main WHERE deleted_at IS NULL AND ${r.where} GROUP BY DATE(created_at) ORDER BY d`,
      r.params
    );
    const map = new Map(rows.map((x) => [x.d, x]));
    const list = [];
    let cur = r.start;
    while (cur <= r.end) {
      const item = map.get(cur) || { order_count: 0, revenue: 0 };
      list.push({ date: cur, orderCount: Number(item.order_count), revenue: n(item.revenue) });
      cur = addDays(cur, 1);
    }
    return ok(res, { list });
  })
);

/** 门店排行（近 30 天营业额 TOP10） */
router.get(
  '/dashboard/store-rank',
  adminAuth,
  wrap(async (req, res) => {
    const r = rangeToSql('30d', null, null, 'o.created_at');
    const rows = await query(
      `SELECT o.store_id, s.name, COUNT(1) AS order_count, IFNULL(SUM(o.pay_amount),0) AS revenue
       FROM order_main o LEFT JOIN store s ON s.id = o.store_id
       WHERE o.deleted_at IS NULL AND o.status = 'COMPLETED' AND ${r.where}
       GROUP BY o.store_id, s.name ORDER BY revenue DESC LIMIT 10`,
      r.params
    );
    return ok(
      res,
      rows.map((x, i) => ({
        rank: i + 1,
        storeId: sid(x.store_id),
        storeName: x.name || '',
        orderCount: Number(x.order_count),
        revenue: n(x.revenue),
      }))
    );
  })
);

/** 门店活跃度 */
router.get(
  '/dashboard/activity',
  adminAuth,
  wrap(async (req, res) => {
    const r = rangeToSql('7d', null, null, 'created_at');
    const active = Number(
      await scalar(
        `SELECT COUNT(DISTINCT store_id) AS c FROM order_main WHERE deleted_at IS NULL AND ${r.where}`,
        r.params
      )
    );
    const total = Number(await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL'));
    const lowActive = await query(
      `SELECT s.id, s.name FROM store s
       WHERE s.deleted_at IS NULL AND s.status = 1
         AND (SELECT COUNT(1) FROM order_main o WHERE o.store_id = s.id AND o.deleted_at IS NULL AND ${r.where}) <= 3
       ORDER BY s.id DESC LIMIT 10`,
      r.params
    );
    return ok(res, {
      activeStore: active,
      totalStore: total,
      activityRate: total ? Math.round((active / total) * 1000) / 10 : 0,
      lowActiveStores: lowActive.map((s) => ({ storeId: sid(s.id), storeName: s.name })),
    });
  })
);

module.exports = router;
