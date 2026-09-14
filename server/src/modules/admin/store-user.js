const express = require('express');
const db = require('../../db');
const { query, one, exec } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const { sid, maskPhone, isPhone } = require('../../utils/misc');
const { hash, randomPassword } = require('../../utils/password');
const { operationLog } = require('../../services/log');

const router = express.Router();

/** 店主账号列表 */
router.get(
  '/store-user/list',
  adminAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const where = ['u.deleted_at IS NULL'];
    const params = [];
    if (req.query.storeId) {
      where.push('u.store_id = ?');
      params.push(req.query.storeId);
    }
    if (req.query.keyword) {
      where.push('(u.phone LIKE ? OR u.real_name LIKE ? OR s.name LIKE ?)');
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    if (req.query.status) {
      where.push('u.status = ?');
      params.push(req.query.status);
    }
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM store_user u WHERE ${wsql}`, params);
    const rows = await query(
      `SELECT u.*, s.name AS store_name FROM store_user u LEFT JOIN store s ON s.id = u.store_id
       WHERE ${wsql} ORDER BY u.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return ok(
      res,
      page(
        rows.map((u) => ({
          id: sid(u.id),
          storeId: sid(u.store_id),
          storeName: u.store_name || '',
          phone: maskPhone(u.phone),
          realName: u.real_name || '',
          role: u.role,
          isOwner: Number(u.is_owner),
          status: Number(u.status),
          isInitPassword: Number(u.is_init_password),
          loginFailCount: Number(u.login_fail_count),
          lockedUntil: u.locked_until,
          lastLoginAt: u.last_login_at,
          createdAt: u.created_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

router.post(
  '/store-user',
  adminAuth,
  wrap(async (req, res) => {
    const { storeId, phone, realName, role } = req.body || {};
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '请选择所属门店');
    if (!isPhone(phone)) throw new BizError(CODES.BAD_PARAM, '请填写正确的手机号');
    const store = await one('SELECT id FROM store WHERE id = ? AND deleted_at IS NULL', [storeId]);
    if (!store) throw new BizError(CODES.NOT_FOUND, '门店不存在');
    const exist = await one('SELECT id FROM store_user WHERE phone = ? AND deleted_at IS NULL', [phone]);
    if (exist) throw new BizError(CODES.CONFLICT, '该手机号已注册');
    const pwd = randomPassword();
    const ins = await exec(
      `INSERT INTO store_user (store_id, phone, password, real_name, role, is_owner, is_init_password, status, created_at, updated_at)
       VALUES (?,?,?,?,?,0,1,1,?,?)`,
      [storeId, phone, hash(pwd), realName || '', role || 'CLERK', nowSql(), nowSql()]
    );
    await operationLog({ req, operatorType: 'ADMIN', operatorId: req.admin.id, operatorName: req.admin.username, storeId, module: 'STORE_USER', action: 'CREATE', description: `新增店员：${phone}`, targetId: ins.insertId });
    return ok(res, { id: sid(ins.insertId), initPassword: pwd }, '新增成功');
  })
);

router.put(
  '/store-user/:userId',
  adminAuth,
  wrap(async (req, res) => {
    const u = await getUser(req);
    const { realName, role, status } = req.body || {};
    await exec('UPDATE store_user SET real_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?', [
      realName === undefined ? u.real_name : realName,
      role === undefined ? u.role : role,
      status === undefined ? u.status : (status ? 1 : 0),
      nowSql(),
      u.id,
    ]);
    await operationLog({ req, operatorType: 'ADMIN', operatorId: req.admin.id, operatorName: req.admin.username, storeId: u.store_id, module: 'STORE_USER', action: 'UPDATE', description: `编辑账号：${u.phone}`, targetId: u.id });
    return ok(res, { ok: true }, '保存成功');
  })
);

router.post(
  '/store-user/:userId/reset-password',
  adminAuth,
  wrap(async (req, res) => {
    const u = await getUser(req);
    const pwd = randomPassword();
    await exec(
      'UPDATE store_user SET password = ?, is_init_password = 1, login_fail_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?',
      [hash(pwd), nowSql(), u.id]
    );
    await operationLog({ req, operatorType: 'ADMIN', operatorId: req.admin.id, operatorName: req.admin.username, storeId: u.store_id, module: 'STORE_USER', action: 'UPDATE', description: `重置密码：${u.phone}`, targetId: u.id });
    return ok(res, { initPassword: pwd, phone: u.phone }, '重置成功');
  })
);

router.post(
  '/store-user/:userId/unlock',
  adminAuth,
  wrap(async (req, res) => {
    const u = await getUser(req);
    await exec('UPDATE store_user SET login_fail_count = 0, locked_until = NULL, status = 1, updated_at = ? WHERE id = ?', [
      nowSql(),
      u.id,
    ]);
    return ok(res, { ok: true }, '已解锁');
  })
);

router.delete(
  '/store-user/:userId',
  adminAuth,
  wrap(async (req, res) => {
    const u = await getUser(req);
    if (Number(u.is_owner) === 1) throw new BizError(CODES.CONFLICT, '店主账号不可删除');
    await exec('UPDATE store_user SET deleted_at = ?, status = 0, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), u.id]);
    return ok(res, { ok: true }, '删除成功');
  })
);

async function getUser(req) {
  const u = await one('SELECT * FROM store_user WHERE id = ? AND deleted_at IS NULL', [req.params.userId]);
  if (!u) throw new BizError(CODES.NOT_FOUND, '账号不存在');
  return u;
}

module.exports = router;
