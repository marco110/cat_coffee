const express = require('express');
const db = require('../../db');
const { query, one, scalar } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { n } = require('../../utils/money');
const { rangeToSql, resolveRange, addDays } = require('../../utils/time');
const { sid } = require('../../utils/misc');
const { displaySales } = require('../../services/price');

const router = express.Router();

async function summary(storeId, range, start, end) {
  const r = rangeToSql(range, start, end, 'created_at');
  const row = await one(
    `SELECT COUNT(1) AS order_count,
            IFNULL(SUM(pay_amount), 0) AS revenue,
            IFNULL(SUM(goods_amount), 0) AS goods_amount,
            IFNULL(SUM(member_discount_amount), 0) AS member_discount,
            IFNULL(SUM(coupon_discount_amount), 0) AS coupon_discount,
            IFNULL(SUM(points_discount_amount), 0) AS points_discount,
            IFNULL(SUM(item_count), 0) AS item_count
     FROM order_main
     WHERE store_id = ? AND deleted_at IS NULL AND status = 'COMPLETED' AND ${r.where}`,
    [storeId, ...r.params]
  );
  const paidRow = await one(
    `SELECT COUNT(1) AS paid_count, IFNULL(SUM(pay_amount),0) AS paid_amount FROM order_main
     WHERE store_id = ? AND deleted_at IS NULL AND pay_status = 'PAID' AND ${r.where}`,
    [storeId, ...r.params]
  );
  const newMember = Number(
    await scalar(
      `SELECT COUNT(1) AS c FROM user_member WHERE store_id = ? AND created_at >= ? AND created_at <= ?`,
      [storeId, `${r.start} 00:00:00`, `${r.end} 23:59:59`]
    )
  );
  const orderCount = Number(row.order_count);
  const revenue = n(row.revenue);
  return {
    orderCount,
    revenue,
    avgOrderAmount: orderCount ? Math.round((revenue / orderCount) * 100) / 100 : 0,
    goodsAmount: n(row.goods_amount),
    memberDiscount: n(row.member_discount),
    couponDiscount: n(row.coupon_discount),
    pointsDiscount: n(row.points_discount),
    itemCount: Number(row.item_count),
    paidCount: Number(paidRow.paid_count),
    paidAmount: n(paidRow.paid_amount),
    newMember,
  };
}

/** 经营概览 */
router.get(
  '/stat/overview',
  merchantAuth,
  wrap(async (req, res) => {
    const { range = 'today', startDate, endDate } = req.query;
    const cur = await summary(req.storeId, range, startDate, endDate);
    const r = resolveRange(range, startDate, endDate);
    const days = Math.max(1, Math.round((new Date(r.end) - new Date(r.start)) / 86400000) + 1);
    const prev = await summary(req.storeId, 'custom', addDays(r.start, -days), addDays(r.start, -1));
    return ok(res, {
      range,
      ...cur,
      compare: {
        orderCount: cur.orderCount - prev.orderCount,
        revenue: Math.round((cur.revenue - prev.revenue) * 100) / 100,
        newMember: cur.newMember - prev.newMember,
      },
    });
  })
);

/** 趋势 */
router.get(
  '/stat/trend',
  merchantAuth,
  wrap(async (req, res) => {
    const { range = '7d', startDate, endDate } = req.query;
    const r = rangeToSql(range, startDate, endDate, 'created_at');
    const rows = await query(
      `SELECT DATE(created_at) AS d, COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue
       FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status = 'COMPLETED' AND ${r.where}
       GROUP BY DATE(created_at) ORDER BY d`,
      [req.storeId, ...r.params]
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

/** 热销菜品 TOP10 */
router.get(
  '/stat/top-dishes',
  merchantAuth,
  wrap(async (req, res) => {
    const { range = '7d', startDate, endDate } = req.query;
    const r = rangeToSql(range, startDate, endDate, 'o.created_at');
    const rows = await query(
      `SELECT oi.dish_id, oi.dish_name, oi.dish_cover, SUM(oi.quantity) AS total_qty,
              IFNULL(SUM(oi.subtotal),0) AS total_amount
       FROM order_item oi JOIN order_main o ON o.id = oi.order_id
       WHERE oi.store_id = ? AND o.status = 'COMPLETED' AND o.deleted_at IS NULL AND ${r.where}
       GROUP BY oi.dish_id, oi.dish_name, oi.dish_cover
       ORDER BY total_qty DESC LIMIT 10`,
      [req.storeId, ...r.params]
    );
    return ok(
      res,
      rows.map((x) => ({
        dishId: sid(x.dish_id),
        name: x.dish_name,
        cover: x.dish_cover,
        quantity: Number(x.total_qty),
        amount: n(x.total_amount),
      }))
    );
  })
);

/** 时段分布 */
router.get(
  '/stat/peak-hours',
  merchantAuth,
  wrap(async (req, res) => {
    const { range = '7d', startDate, endDate } = req.query;
    const r = rangeToSql(range, startDate, endDate, 'created_at');
    const rows = await query(
      `SELECT DATE(created_at) AS d, HOUR(created_at) AS h, COUNT(1) AS c
       FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status = 'COMPLETED' AND ${r.where}
       GROUP BY d, h`,
      [req.storeId, ...r.params]
    );
    const totalMap = {};
    const dayMap = new Map();
    rows.forEach((x) => {
      totalMap[x.h] = (totalMap[x.h] || 0) + Number(x.c);
      if (!dayMap.has(x.d)) dayMap.set(x.d, true);
    });
    const dayCount = Math.max(1, dayMap.size);
    const distribution = [];
    for (let h = 0; h < 24; h += 1) {
      const total = totalMap[h] || 0;
      distribution.push({ hour: h, count: total, avgCount: Math.round((total / dayCount) * 10) / 10 });
    }
    const peak = distribution.reduce((a, b) => (b.count > a.count ? b : a), distribution[0]);
    return ok(res, { distribution, peakHour: peak ? `${peak.hour}:00-${peak.hour + 1}:00` : '-', peakCount: peak ? peak.count : 0 });
  })
);

/** 会员统计 */
router.get(
  '/stat/member',
  merchantAuth,
  wrap(async (req, res) => {
    const total = Number(await scalar('SELECT COUNT(1) AS c FROM user_member WHERE store_id = ?', [req.storeId]));
    const levels = await query(
      `SELECT l.name, COUNT(m.id) AS c FROM member_level l LEFT JOIN user_member m ON m.level_id = l.id
       WHERE l.store_id = ? AND l.deleted_at IS NULL GROUP BY l.id, l.name ORDER BY l.growth_threshold`,
      [req.storeId]
    );
    const active = Number(
      await scalar(
        "SELECT COUNT(DISTINCT user_id) AS c FROM order_main WHERE store_id = ? AND status = 'COMPLETED' AND created_at >= ?",
        [req.storeId, `${addDays(new Date().toISOString().slice(0, 10), -30)} 00:00:00`]
      )
    );
    const couponUsed = Number(
      await scalar(
        `SELECT COUNT(1) AS c FROM user_coupon WHERE store_id = ? AND status = 'USED'`,
        [req.storeId]
      )
    );
    return ok(res, {
      total,
      active30d: active,
      couponUsed,
      levels: levels.map((l) => ({ name: l.name, count: Number(l.c) })),
    });
  })
);

/** 导出经营数据 CSV */
router.get(
  '/stat/export',
  merchantAuth,
  wrap(async (req, res) => {
    const { range = '30d', startDate, endDate } = req.query;
    const r = rangeToSql(range, startDate, endDate, 'created_at');
    const rows = await query(
      `SELECT DATE(created_at) AS d, COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue
       FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status = 'COMPLETED' AND ${r.where}
       GROUP BY DATE(created_at) ORDER BY d`,
      [req.storeId, ...r.params]
    );
    const lines = ['日期,订单数,营业额'];
    rows.forEach((x) => lines.push(`${x.d},${x.order_count},${n(x.revenue)}`));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=stats.csv');
    return res.send(`\uFEFF${lines.join('\n')}`);
  })
);

/** 全部菜品销量（用于对照） */
router.get(
  '/stat/dish-sales',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT id, name, base_sales, sales FROM dish WHERE store_id = ? AND deleted_at IS NULL ORDER BY (base_sales + sales) DESC LIMIT 50',
      [req.storeId]
    );
    return ok(res, rows.map((d) => ({ dishId: sid(d.id), name: d.name, sales: displaySales(d) })));
  })
);

module.exports = router;
