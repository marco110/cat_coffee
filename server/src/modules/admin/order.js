const express = require('express');
const db = require('../../db');
const { query, one } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { rangeToSql } = require('../../utils/time');
const { sid } = require('../../utils/misc');
const orderService = require('../../services/order');

const router = express.Router();

/** 全平台订单查询（只读） */
router.get(
  '/order/list',
  adminAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const where = ['o.deleted_at IS NULL'];
    const params = [];
    if (req.query.storeId) {
      where.push('o.store_id = ?');
      params.push(req.query.storeId);
    }
    if (req.query.keyword) {
      where.push('(o.order_no LIKE ? OR o.pickup_code LIKE ? OR s.name LIKE ?)');
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    if (req.query.status) {
      where.push('o.status = ?');
      params.push(req.query.status);
    }
    if (req.query.range) {
      const r = rangeToSql(req.query.range, req.query.startDate, req.query.endDate, 'o.created_at');
      where.push(r.where);
      params.push(...r.params);
    }
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM order_main o WHERE ${wsql}`, params);
    const rows = await query(
      `SELECT o.*, s.name AS store_name FROM order_main o LEFT JOIN store s ON s.id = o.store_id
       WHERE ${wsql} ORDER BY o.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(
      res,
      page(
        rows.map((o) => ({
          id: sid(o.id),
          orderNo: o.order_no,
          storeId: sid(o.store_id),
          storeName: o.store_name || '',
          orderType: o.order_type,
          tableNo: o.table_no,
          pickupCode: o.pickup_code,
          status: o.status,
          statusText: orderService.STATUS_TEXT[o.status] || o.status,
          payStatus: o.pay_status,
          payAmount: n(o.pay_amount),
          itemCount: Number(o.item_count),
          createdAt: o.created_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

router.get(
  '/order/:orderId(\\d+)',
  adminAuth,
  wrap(async (req, res) => {
    const o = await one('SELECT * FROM order_main WHERE id = ? AND deleted_at IS NULL', [req.params.orderId]);
    if (!o) throw new BizError(CODES.NOT_FOUND, '订单不存在');
    return ok(res, await orderService.buildOrderVO(db, o, 'ADMIN'));
  })
);

router.get(
  '/order/export',
  adminAuth,
  wrap(async (req, res) => {
    const r = rangeToSql(req.query.range || '30d', req.query.startDate, req.query.endDate, 'o.created_at');
    const params = [...r.params];
    let extra = '';
    if (req.query.storeId) {
      extra = ' AND o.store_id = ?';
      params.push(req.query.storeId);
    }
    const rows = await query(
      `SELECT o.*, s.name AS store_name FROM order_main o LEFT JOIN store s ON s.id = o.store_id
       WHERE o.deleted_at IS NULL AND ${r.where}${extra} ORDER BY o.id DESC LIMIT 5000`,
      params
    );
    const lines = [['门店', '订单号', '类型', '桌号/取餐码', '状态', '实付金额', '下单时间'].join(',')];
    rows.forEach((o) => {
      lines.push(
        [
          o.store_name || '',
          o.order_no,
          o.order_type === 'DINE_IN' ? '堂食' : '打包',
          o.table_no || o.pickup_code || '',
          orderService.STATUS_TEXT[o.status],
          n(o.pay_amount),
          o.created_at,
        ].join(',')
      );
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    return res.send(`\uFEFF${lines.join('\n')}`);
  })
);

/** 订单统计 */
router.get(
  '/order/stat',
  adminAuth,
  wrap(async (req, res) => {
    const r = rangeToSql(req.query.range || 'today', req.query.startDate, req.query.endDate, 'created_at');
    const row = await one(
      `SELECT COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue FROM order_main
       WHERE deleted_at IS NULL AND status = 'COMPLETED' AND ${r.where}`,
      r.params
    );
    return ok(res, { orderCount: Number(row.order_count), revenue: n(row.revenue) });
  })
);

module.exports = router;
