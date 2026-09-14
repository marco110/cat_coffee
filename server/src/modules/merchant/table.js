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

/** 桌位列表（含在用状态） */
router.get(
  '/table/list',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM table_info WHERE store_id = ? AND deleted_at IS NULL ORDER BY sort, id',
      [req.storeId]
    );
    const using = await query(
      `SELECT table_id FROM order_main WHERE store_id = ? AND deleted_at IS NULL
       AND status IN ('PENDING','ACCEPTED','MAKING','READY') AND table_id IS NOT NULL`,
      [req.storeId]
    );
    const set = new Set(using.map((u) => String(u.table_id)));
    return ok(
      res,
      rows.map((t) => ({
        id: sid(t.id),
        tableNo: t.table_no,
        area: t.area || '',
        seats: Number(t.seats),
        status: Number(t.status),
        sort: Number(t.sort),
        inUse: set.has(String(t.id)),
        qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          `s${req.storeId}t${t.id}`
        )}`,
        scene: `s${req.storeId}t${t.id}`,
      }))
    );
  })
);

router.post(
  '/table',
  merchantAuth,
  wrap(async (req, res) => {
    const { tableNo, area, seats, sort } = req.body || {};
    if (!tableNo) throw new BizError(CODES.BAD_PARAM, '请填写桌号');
    const exist = await one('SELECT id FROM table_info WHERE store_id = ? AND table_no = ? AND deleted_at IS NULL', [
      req.storeId,
      tableNo,
    ]);
    if (exist) throw new BizError(CODES.CONFLICT, '该桌号已存在');
    const ins = await exec(
      'INSERT INTO table_info (store_id, table_no, area, seats, sort, status, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)',
      [req.storeId, String(tableNo).slice(0, 10), area || '', Number(seats || 2), Number(sort || 0), nowSql(), nowSql()]
    );
    await logOp(req, 'CREATE', `新增桌位：${tableNo}`, ins.insertId);
    return ok(res, { id: sid(ins.insertId) }, '新增成功');
  })
);

/** 批量新增：A1~A6 */
router.post(
  '/table/batch',
  merchantAuth,
  wrap(async (req, res) => {
    const { prefix = 'A', start = 1, end = 6, area = '', seats = 2 } = req.body || {};
    const s = Number(start);
    const e = Number(end);
    if (!s || !e || e < s || e - s > 50) throw new BizError(CODES.BAD_PARAM, '批量范围不合法（单次最多 50 张）');
    let created = 0;
    await tx(async (conn) => {
      for (let i = s; i <= e; i += 1) {
        const tableNo = `${prefix}${i}`;
        const exist = await conn.one(
          'SELECT id FROM table_info WHERE store_id = ? AND table_no = ? AND deleted_at IS NULL',
          [req.storeId, tableNo]
        );
        if (exist) continue;
        await conn.exec(
          'INSERT INTO table_info (store_id, table_no, area, seats, sort, status, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)',
          [req.storeId, tableNo, area, Number(seats), i, nowSql(), nowSql()]
        );
        created += 1;
      }
    });
    return ok(res, { created }, `成功新增 ${created} 张桌位`);
  })
);

router.put(
  '/table/:tableId',
  merchantAuth,
  wrap(async (req, res) => {
    const t = await getTable(req);
    const { tableNo, area, seats, sort } = req.body || {};
    await exec('UPDATE table_info SET table_no = ?, area = ?, seats = ?, sort = ?, updated_at = ? WHERE id = ?', [
      tableNo === undefined ? t.table_no : String(tableNo).slice(0, 10),
      area === undefined ? t.area : area,
      seats === undefined ? t.seats : Number(seats),
      sort === undefined ? t.sort : Number(sort),
      nowSql(),
      t.id,
    ]);
    return ok(res, { ok: true }, '保存成功');
  })
);

router.put(
  '/table/:tableId/status',
  merchantAuth,
  wrap(async (req, res) => {
    const t = await getTable(req);
    if (Number(t.status) === 1) {
      const using = await one(
        `SELECT id FROM order_main WHERE store_id = ? AND table_id = ? AND status IN ('PENDING','ACCEPTED','MAKING','READY') AND deleted_at IS NULL LIMIT 1`,
        [req.storeId, t.id]
      );
      if (using) throw new BizError(CODES.CONFLICT, '该桌位有进行中的订单，无法停用');
    }
    const status = Number((req.body || {}).status) ? 1 : 0;
    await exec('UPDATE table_info SET status = ?, updated_at = ? WHERE id = ?', [status, nowSql(), t.id]);
    return ok(res, { status }, status ? '已启用' : '已停用');
  })
);

router.delete(
  '/table/:tableId',
  merchantAuth,
  wrap(async (req, res) => {
    const t = await getTable(req);
    const used = await one('SELECT id FROM order_main WHERE table_id = ? LIMIT 1', [t.id]);
    if (used) throw new BizError(CODES.CONFLICT, '该桌位已有历史订单，建议停用而非删除');
    await exec('UPDATE table_info SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), t.id]);
    return ok(res, { ok: true }, '删除成功');
  })
);

/** 桌位二维码（返回 scene 供前端生成） */
router.get(
  '/table/:tableId/qrcode',
  merchantAuth,
  wrap(async (req, res) => {
    const t = await getTable(req);
    const scene = `s${req.storeId}t${t.id}`;
    return ok(res, {
      scene,
      tableNo: t.table_no,
      url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scene)}`,
      storeName: req.store.name,
    });
  })
);

router.post(
  '/table/print-qrcodes',
  merchantAuth,
  wrap(async (req, res) => ok(res, { printed: false, msg: '桌贴打印为 P2 功能' }))
);

async function getTable(req) {
  const t = await one('SELECT * FROM table_info WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
    req.params.tableId,
    req.storeId,
  ]);
  if (!t) throw new BizError(CODES.NOT_FOUND, '桌位不存在');
  return t;
}

function logOp(req, action, description, targetId) {
  return operationLog({ req, operatorType: 'MERCHANT', operatorId: req.storeUser.id, operatorName: req.storeUser.real_name, storeId: req.storeId, module: 'TABLE', action, description, targetId });
}

module.exports = router;
