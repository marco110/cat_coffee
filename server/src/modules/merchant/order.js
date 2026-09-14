const express = require('express');
const db = require('../../db');
const { query, one } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql, waitedMinutes, rangeToSql } = require('../../utils/time');
const { sid, maskPhone } = require('../../utils/misc');
const orderService = require('../../services/order');
const { operationLog } = require('../../services/log');

const router = express.Router();

const STATUS_GROUP = {
  PENDING: ['PENDING'],
  MAKING: ['ACCEPTED', 'MAKING'],
  READY: ['READY'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED', 'REJECTED'],
};

/** 订单列表 */
router.get(
  '/order/list',
  merchantAuth,
  wrap(async (req, res) => {
    const storeId = req.storeId;
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const where = ['o.store_id = ?', 'o.deleted_at IS NULL'];
    const params = [storeId];

    const status = req.query.status || '';
    if (STATUS_GROUP[status]) {
      where.push(`o.status IN (${STATUS_GROUP[status].map(() => '?').join(',')})`);
      params.push(...STATUS_GROUP[status]);
    } else if (status && status !== 'ALL') {
      where.push('o.status = ?');
      params.push(status);
    }
    if (req.query.orderType) {
      where.push('o.order_type = ?');
      params.push(req.query.orderType);
    }
    if (req.query.tableNo) {
      where.push('o.table_no LIKE ?');
      params.push(`%${req.query.tableNo}%`);
    }
    if (req.query.keyword) {
      where.push('(o.order_no LIKE ? OR o.pickup_code LIKE ? OR o.user_phone LIKE ?)');
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    if (req.query.startDate && req.query.endDate) {
      where.push('o.created_at >= ? AND o.created_at <= ?');
      params.push(`${req.query.startDate} 00:00:00`, `${req.query.endDate} 23:59:59`);
    }
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM order_main o WHERE ${wsql}`, params);
    const rows = await query(
      `SELECT o.* FROM order_main o WHERE ${wsql} ORDER BY o.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const timeout = Number(req.store.order_timeout_minutes || 3);
    const list = [];
    for (const o of rows) {
      const items = await query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [o.id]);
      const user = await one('SELECT phone FROM user WHERE id = ?', [o.user_id]);
      list.push({
        id: sid(o.id),
        orderNo: o.order_no,
        orderType: o.order_type,
        tableNo: o.table_no,
        pickupCode: o.pickup_code,
        status: o.status,
        statusText: orderService.STATUS_TEXT[o.status] || o.status,
        payStatus: o.pay_status,
        payStatusText: orderService.PAY_STATUS_TEXT[o.pay_status] || o.pay_status,
        goodsAmount: n(o.goods_amount),
        payAmount: n(o.pay_amount),
        itemCount: Number(o.item_count),
        peopleCount: Number(o.people_count),
        remark: o.remark || '',
        userPhone: user ? maskPhone(user.phone) : '',
        waitedMinutes: waitedMinutes(o.created_at),
        isTimeout: o.status === 'PENDING' && waitedMinutes(o.created_at) > timeout,
        modifyCount: Number(o.modify_count),
        createdAt: o.created_at,
        buttons: orderService.orderButtons(o, 'MERCHANT'),
        items: items.map((i) => ({
          id: sid(i.id),
          dishName: i.dish_name,
          dishId: sid(i.dish_id),
          dishCover: i.dish_cover,
          quantity: Number(i.quantity),
          unitPrice: n(i.unit_price),
          subtotal: n(i.subtotal),
          specText: i.spec_text || '',
          remark: i.remark || '',
        })),
      });
    }
    return ok(res, page(list, Number(total.c), p, pageSize));
  })
);

/** 导出订单 CSV（需在 /order/:orderId 之前注册） */
router.get(
  '/order/export',
  merchantAuth,
  wrap(async (req, res) => {
    const r = rangeToSql(req.query.range || 'today', req.query.startDate, req.query.endDate, 'o.created_at');
    const rows = await query(
      `SELECT o.* FROM order_main o WHERE o.store_id = ? AND o.deleted_at IS NULL AND ${r.where} ORDER BY o.id DESC LIMIT 5000`,
      [req.storeId, ...r.params]
    );
    const header = ['订单号', '类型', '桌号/取餐码', '状态', '收款状态', '商品金额', '实付金额', '件数', '下单时间'];
    const lines = [header.join(',')];
    rows.forEach((o) => {
      lines.push(
        [
          o.order_no,
          o.order_type === 'DINE_IN' ? '堂食' : '打包',
          o.table_no || o.pickup_code || '',
          orderService.STATUS_TEXT[o.status],
          orderService.PAY_STATUS_TEXT[o.pay_status],
          n(o.goods_amount),
          n(o.pay_amount),
          o.item_count,
          o.created_at,
        ].join(',')
      );
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    return res.send(`\uFEFF${lines.join('\n')}`);
  })
);

/** 订单详情 */
router.get(
  '/order/:orderId',
  merchantAuth,
  wrap(async (req, res) => {
    const o = await orderService.getOrderForMerchant(db, req.params.orderId, req.storeId);
    const vo = await orderService.buildOrderVO(db, o, 'MERCHANT');
    const user = await one('SELECT phone, nickname, avatar FROM user WHERE id = ?', [o.user_id]);
    vo.userPhone = user ? maskPhone(user.phone) : '';
    vo.userNickname = user ? user.nickname || '微信用户' : '';
    return ok(res, vo);
  })
);

/** 状态流转日志 */
router.get(
  '/order/:orderId/logs',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query('SELECT * FROM order_log WHERE order_id = ? AND store_id = ? ORDER BY id ASC', [
      req.params.orderId,
      req.storeId,
    ]);
    return ok(
      res,
      rows.map((r) => ({
        id: sid(r.id),
        action: r.action,
        title: orderService.TIMELINE_TITLE[r.action] || r.action,
        fromStatus: r.from_status,
        toStatus: r.to_status,
        operatorType: r.operator_type,
        operatorName: r.operator_name,
        remark: r.remark,
        createdAt: r.created_at,
      }))
    );
  })
);

/** 改单记录 */
router.get(
  '/order/:orderId/modify-logs',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM order_modify_log WHERE order_id = ? AND store_id = ? ORDER BY id DESC',
      [req.params.orderId, req.storeId]
    );
    return ok(
      res,
      rows.map((r) => ({
        id: sid(r.id),
        operatorName: r.operator_name,
        changeSummary: r.change_summary,
        amountBefore: n(r.amount_before),
        amountAfter: n(r.amount_after),
        amountChange: n(r.amount_change),
        needRefund: n(r.need_refund),
        remark: r.remark,
        beforeSnapshot: r.before_snapshot,
        afterSnapshot: r.after_snapshot,
        createdAt: r.created_at,
      }))
    );
  })
);

const ACTIONS = {
  accept: { action: 'ACCEPT', text: '接单' },
  reject: { action: 'REJECT', text: '拒单' },
  making: { action: 'MAKE', text: '开始制作' },
  ready: { action: 'READY', text: '出品完成' },
  complete: { action: 'COMPLETE', text: '确认完成' },
  cancel: { action: 'CANCEL', text: '取消订单' },
};

Object.entries(ACTIONS).forEach(([path, cfg]) => {
  router.post(
    `/order/:orderId/${path}`,
    merchantAuth,
    wrap(async (req, res) => {
      const r = await orderService.transition({
        orderId: req.params.orderId,
        storeId: req.storeId,
        action: cfg.action,
        operatorType: 'MERCHANT',
        operatorId: req.storeUser.id,
        operatorName: req.storeUser.real_name,
        extra: { reason: (req.body || {}).reason || (req.body || {}).remark || '' },
      });
      await operationLog({
        req,
        operatorType: 'MERCHANT',
        operatorId: req.storeUser.id,
        operatorName: req.storeUser.real_name,
        storeId: req.storeId,
        module: 'ORDER',
        action: 'STATUS_CHANGE',
        description: `${cfg.text}：订单 ${req.params.orderId}`,
        targetId: req.params.orderId,
      });
      return ok(res, { status: r.status, ...pickStatusTime(r) }, `${cfg.text}成功`);
    })
  );
});

function pickStatusTime(r) {
  const o = r.order || {};
  return {
    acceptedAt: o.accepted_at,
    makingAt: o.making_at,
    readyAt: o.ready_at,
    completedAt: o.completed_at,
    cancelledAt: o.cancelled_at,
  };
}

/** 标记已收款 */
router.post(
  '/order/:orderId/pay',
  merchantAuth,
  wrap(async (req, res) => {
    const r = await orderService.markPaid({
      orderId: req.params.orderId,
      storeId: req.storeId,
      operatorId: req.storeUser.id,
      paidAmount: (req.body || {}).paidAmount,
      remark: (req.body || {}).remark,
    });
    return ok(res, r, '已标记为收款');
  })
);

/** 改单 */
router.post(
  '/order/:orderId/modify',
  merchantAuth,
  wrap(async (req, res) => {
    const r = await orderService.modifyOrder({
      orderId: req.params.orderId,
      storeId: req.storeId,
      operatorId: req.storeUser.id,
      operatorName: req.storeUser.real_name,
      body: req.body || {},
    });
    await operationLog({
      req,
      operatorType: 'MERCHANT',
      operatorId: req.storeUser.id,
      operatorName: req.storeUser.real_name,
      storeId: req.storeId,
      module: 'ORDER',
      action: 'UPDATE',
      description: r.changeSummary,
      targetId: req.params.orderId,
      content: req.body,
    });
    return ok(res, r, '改单成功');
  })
);

/** 打印小票（P2 占位） */
router.post(
  '/order/:orderId/print',
  merchantAuth,
  wrap(async (req, res) => ok(res, { printed: false, msg: '小票打印为 P2 功能，暂未接入' }))
);

module.exports = router;
