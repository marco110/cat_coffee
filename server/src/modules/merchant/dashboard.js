const express = require('express');
const db = require('../../db');
const { query, one, scalar } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { n } = require('../../utils/money');
const { dateSql, nowSql } = require('../../utils/time');
const { sid } = require('../../utils/misc');

const router = express.Router();

const TODAY = ['DATE(created_at) = ?'];

/** 今日概览 */
router.get(
  '/dashboard/overview',
  merchantAuth,
  wrap(async (req, res) => {
    const storeId = req.storeId;
    const today = dateSql();
    const orderCount = Number(
      await scalar('SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND DATE(created_at) = ?', [storeId, today])
    );
    const revenue = n(
      await scalar(
        "SELECT IFNULL(SUM(pay_amount),0) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND pay_status = 'PAID' AND DATE(created_at) = ?",
        [storeId, today]
      )
    );
    const paidCount = Number(
      await scalar(
        "SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND pay_status = 'PAID' AND DATE(created_at) = ?",
        [storeId, today]
      )
    );
    const pendingCount = Number(
      await scalar("SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status = 'PENDING'", [storeId])
    );
    const memberCount = Number(
      await scalar('SELECT COUNT(1) AS c FROM user_member WHERE store_id = ?', [storeId])
    );
    return ok(res, {
      orderCount,
      revenue: Math.round(revenue * 100) / 100,
      paidCount,
      pendingCount,
      avgOrderAmount: paidCount ? Math.round((revenue / paidCount) * 100) / 100 : 0,
      memberCount,
      businessStatus: Number(req.store.business_status),
    });
  })
);

/** 轮询：待接单数量 + 最新订单摘要 */
router.get(
  '/dashboard/pending-count',
  merchantAuth,
  wrap(async (req, res) => {
    const storeId = req.storeId;
    const pendingCount = Number(
      await scalar("SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status = 'PENDING'", [storeId])
    );
    const last = await one(
      "SELECT id, order_no, table_no, pickup_code, created_at FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status = 'PENDING' ORDER BY id DESC LIMIT 1",
      [storeId]
    );
    return ok(res, {
      pendingCount,
      lastOrderId: last ? sid(last.id) : null,
      lastOrderNo: last ? last.order_no : null,
      lastOrderTable: last ? last.table_no || last.pickup_code : null,
      lastOrderAt: last ? last.created_at : null,
      serverTime: nowSql(),
    });
  })
);

/** 待处理事项汇总 */
router.get(
  '/dashboard/todo',
  merchantAuth,
  wrap(async (req, res) => {
    const storeId = req.storeId;
    const count = async (status) =>
      Number(
        await scalar(
          `SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND status${Array.isArray(status) ? ' IN (' + status.map(() => '?').join(',') + ')' : ' = ?'}`,
          [storeId, ...(Array.isArray(status) ? status : [status])]
        )
      );
    return ok(res, {
      pending: await count('PENDING'),
      making: await count(['ACCEPTED', 'MAKING']),
      ready: await count('READY'),
      unpaid: Number(
        await scalar(
          "SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND pay_status = 'UNPAID' AND status IN ('READY','COMPLETED')",
          [storeId]
        )
      ),
    });
  })
);

module.exports = router;
