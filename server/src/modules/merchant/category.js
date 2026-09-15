const express = require('express');
const db = require('../../db');
const { query, one, exec, tx } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const { sid } = require('../../utils/misc');
const { operationLog } = require('../../services/log');

const router = express.Router();

/** 分类列表（含菜品数量） */
router.get(
  '/category/list',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM category WHERE store_id = ? AND deleted_at IS NULL ORDER BY sort, id',
      [req.storeId]
    );
    const counts = await query(
      `SELECT category_id, COUNT(1) AS c FROM dish WHERE store_id = ? AND deleted_at IS NULL GROUP BY category_id`,
      [req.storeId]
    );
    const map = new Map(counts.map((c) => [String(c.category_id), Number(c.c)]));
    return ok(
      res,
      rows.map((c) => ({
        id: sid(c.id),
        name: c.name,
        icon: c.icon || '',
        sort: Number(c.sort),
        status: Number(c.status),
        dishCount: map.get(String(c.id)) || 0,
      }))
    );
  })
);

router.post(
  '/category',
  merchantAuth,
  wrap(async (req, res) => {
    const { name, icon, sort, status } = req.body || {};
    if (!name) throw new BizError(CODES.BAD_PARAM, '请填写分类名称');
    const ins = await exec(
      'INSERT INTO category (store_id, name, icon, sort, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      [req.storeId, String(name).slice(0, 20), icon || '', Number(sort || 0), status === 0 ? 0 : 1, nowSql(), nowSql()]
    );
    await logOp(req, 'CREATE', `新增分类：${name}`, ins.insertId);
    return ok(res, { id: sid(ins.insertId) }, '新增成功');
  })
);

/** 批量排序（必须放在 /category/:categoryId 之前，否则会被 :categoryId 匹配掉） */
router.put(
  '/category/sort',
  merchantAuth,
  wrap(async (req, res) => {
    const list = (req.body || {}).list || [];
    await tx(async (conn) => {
      for (const it of list) {
        await conn.exec('UPDATE category SET sort = ?, updated_at = ? WHERE id = ? AND store_id = ?', [
          Number(it.sort || 0),
          nowSql(),
          it.id,
          req.storeId,
        ]);
      }
    });
    return ok(res, { ok: true }, '排序已保存');
  })
);

router.put(
  '/category/:categoryId',
  merchantAuth,
  wrap(async (req, res) => {
    const c = await getCategory(req);
    const { name, icon, sort, status } = req.body || {};
    await exec(
      'UPDATE category SET name = ?, icon = ?, sort = ?, status = ?, updated_at = ? WHERE id = ?',
      [
        name === undefined ? c.name : String(name).slice(0, 20),
        icon === undefined ? c.icon : icon,
        sort === undefined ? c.sort : Number(sort),
        status === undefined ? c.status : (status ? 1 : 0),
        nowSql(),
        c.id,
      ]
    );
    await logOp(req, 'UPDATE', `编辑分类：${c.name}`, c.id);
    return ok(res, { id: sid(c.id) }, '保存成功');
  })
);

router.put(
  '/category/:categoryId/status',
  merchantAuth,
  wrap(async (req, res) => {
    const c = await getCategory(req);
    const status = Number((req.body || {}).status) ? 1 : 0;
    await exec('UPDATE category SET status = ?, updated_at = ? WHERE id = ?', [status, nowSql(), c.id]);
    return ok(res, { status }, status ? '已启用' : '已停用');
  })
);

router.delete(
  '/category/:categoryId',
  merchantAuth,
  wrap(async (req, res) => {
    const c = await getCategory(req);
    const count = await one(
      'SELECT COUNT(1) AS c FROM dish WHERE category_id = ? AND deleted_at IS NULL',
      [c.id]
    );
    if (Number(count.c) > 0) throw new BizError(CODES.CONFLICT, '该分类下仍有菜品，请先移除或删除菜品');
    await exec('UPDATE category SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), c.id]);
    await logOp(req, 'DELETE', `删除分类：${c.name}`, c.id);
    return ok(res, { ok: true }, '删除成功');
  })
);

async function getCategory(req) {
  const c = await one('SELECT * FROM category WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
    req.params.categoryId,
    req.storeId,
  ]);
  if (!c) throw new BizError(CODES.NOT_FOUND, '分类不存在');
  return c;
}

function logOp(req, action, description, targetId) {
  return operationLog({
    req,
    operatorType: 'MERCHANT',
    operatorId: req.storeUser.id,
    operatorName: req.storeUser.real_name,
    storeId: req.storeId,
    module: 'CATEGORY',
    action,
    description,
    targetId,
  });
}

module.exports = router;
