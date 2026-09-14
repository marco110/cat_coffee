const express = require('express');
const { query, one } = require('../../db');
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { sid } = require('../../utils/misc');

const router = express.Router();

/** 操作日志 */
router.get(
  '/log/operation',
  adminAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const where = [];
    const params = [];
    if (req.query.operatorType) {
      where.push('operator_type = ?');
      params.push(req.query.operatorType);
    }
    if (req.query.storeId) {
      where.push('store_id = ?');
      params.push(req.query.storeId);
    }
    if (req.query.module) {
      where.push('module = ?');
      params.push(req.query.module);
    }
    if (req.query.action) {
      where.push('action = ?');
      params.push(req.query.action);
    }
    if (req.query.keyword) {
      where.push('description LIKE ?');
      params.push(`%${req.query.keyword}%`);
    }
    if (req.query.startDate && req.query.endDate) {
      where.push('created_at >= ? AND created_at <= ?');
      params.push(`${req.query.startDate} 00:00:00`, `${req.query.endDate} 23:59:59`);
    }
    const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await one(`SELECT COUNT(1) AS c FROM operation_log ${wsql}`, params);
    const rows = await query(
      `SELECT * FROM operation_log ${wsql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(
      res,
      page(
        rows.map((r) => ({
          id: sid(r.id),
          storeId: sid(r.store_id),
          operatorType: r.operator_type,
          operatorId: sid(r.operator_id),
          operatorName: r.operator_name,
          module: r.module,
          action: r.action,
          description: r.description,
          targetId: sid(r.target_id),
          ip: r.ip,
          createdAt: r.created_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

/** 登录日志 */
router.get(
  '/log/login',
  adminAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const where = [];
    const params = [];
    if (req.query.userType) {
      where.push('user_type = ?');
      params.push(req.query.userType);
    }
    if (req.query.account) {
      where.push('account LIKE ?');
      params.push(`%${req.query.account}%`);
    }
    if (req.query.result) {
      where.push('result = ?');
      params.push(req.query.result === '1' ? 1 : 0);
    }
    if (req.query.startDate && req.query.endDate) {
      where.push('created_at >= ? AND created_at <= ?');
      params.push(`${req.query.startDate} 00:00:00`, `${req.query.endDate} 23:59:59`);
    }
    const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await one(`SELECT COUNT(1) AS c FROM login_log ${wsql}`, params);
    const rows = await query(
      `SELECT * FROM login_log ${wsql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(
      res,
      page(
        rows.map((r) => ({
          id: sid(r.id),
          userType: r.user_type,
          userId: sid(r.user_id),
          account: r.account,
          storeId: sid(r.store_id),
          result: Number(r.result),
          failReason: r.fail_reason,
          ip: r.ip,
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
