const express = require('express');
const db = require('../../db');
const { query, one, exec, tx } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql } = require('../../utils/time');
const { sid, json } = require('../../utils/misc');
const { displaySales } = require('../../services/price');
const { operationLog } = require('../../services/log');

const router = express.Router();

/** 规格保存：整体覆盖式提交（事务内先删后插） */
async function saveSpecs(conn, storeId, dishId, groups) {
  const oldGroups = await conn.query('SELECT id FROM dish_spec_group WHERE dish_id = ?', [dishId]);
  const ids = oldGroups.map((g) => g.id);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await conn.exec(`DELETE FROM dish_spec_item WHERE group_id IN (${ph})`, ids);
  }
  await conn.exec('DELETE FROM dish_spec_group WHERE dish_id = ?', [dishId]);
  let hasSpec = 0;
  for (const [gi, g] of (groups || []).entries()) {
    if (!g.name) continue;
    const ins = await conn.exec(
      'INSERT INTO dish_spec_group (store_id, dish_id, name, is_required, multi_select, sort, status, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?)',
      [storeId, dishId, String(g.name).slice(0, 20), g.isRequired === false ? 0 : 1, g.multiSelect ? 1 : 0, Number(g.sort || gi), nowSql(), nowSql()]
    );
    hasSpec = 1;
    for (const [ii, it] of (g.items || []).entries()) {
      if (!it.name) continue;
      await conn.exec(
        'INSERT INTO dish_spec_item (store_id, dish_id, group_id, name, extra_price, is_default, sort, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)',
        [
          storeId,
          dishId,
          ins.insertId,
          String(it.name).slice(0, 20),
          n(it.extraPrice),
          it.isDefault ? 1 : 0,
          Number(it.sort || ii),
          nowSql(),
          nowSql(),
        ]
      );
    }
  }
  await conn.exec('UPDATE dish SET has_spec = ?, updated_at = ? WHERE id = ?', [hasSpec, nowSql(), dishId]);
}

/** 菜品列表 */
router.get(
  '/dish/list',
  merchantAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query, 20);
    const where = ['store_id = ?', 'deleted_at IS NULL'];
    const params = [req.storeId];
    if (req.query.categoryId) {
      where.push('category_id = ?');
      params.push(req.query.categoryId);
    }
    if (req.query.keyword) {
      where.push('name LIKE ?');
      params.push(`%${req.query.keyword}%`);
    }
    if (req.query.status === 'ON') where.push('status = 1');
    if (req.query.status === 'OFF') where.push('status = 0');
    if (req.query.soldOut === '1') where.push('sold_out = 1');
    if (req.query.soldOut === '0') where.push('sold_out = 0');
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM dish WHERE ${wsql}`, params);
    const rows = await query(`SELECT * FROM dish WHERE ${wsql} ORDER BY sort, id LIMIT ${limit} OFFSET ${offset}`, params);
    const categories = await query('SELECT id, name FROM category WHERE store_id = ? AND deleted_at IS NULL', [req.storeId]);
    const cmap = new Map(categories.map((c) => [String(c.id), c.name]));
    return ok(
      res,
      page(
        rows.map((d) => ({
          id: sid(d.id),
          name: d.name,
          cover: d.cover || '',
          categoryId: sid(d.category_id),
          categoryName: cmap.get(String(d.category_id)) || '',
          price: n(d.price),
          originalPrice: d.original_price === null ? null : n(d.original_price),
          unit: d.unit,
          sales: displaySales(d),
          tags: json(d.tags, []) || [],
          isRecommend: Number(d.is_recommend),
          hasSpec: Number(d.has_spec),
          soldOut: Number(d.sold_out),
          status: Number(d.status),
          sort: Number(d.sort),
          stockMode: d.stock_mode,
          dailyLimit: Number(d.daily_limit),
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

/** 菜品详情（含规格） */
router.get(
  '/dish/:dishId',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    const groups = await query('SELECT * FROM dish_spec_group WHERE dish_id = ? ORDER BY sort, id', [d.id]);
    const groupIds = groups.map((g) => g.id);
    let items = [];
    if (groupIds.length) {
      const ph = groupIds.map(() => '?').join(',');
      items = await query(`SELECT * FROM dish_spec_item WHERE group_id IN (${ph}) ORDER BY sort, id`, groupIds);
    }
    return ok(res, {
      id: sid(d.id),
      categoryId: sid(d.category_id),
      name: d.name,
      cover: d.cover || '',
      images: json(d.images, []) || [],
      description: d.description || '',
      price: n(d.price),
      originalPrice: d.original_price === null ? null : n(d.original_price),
      unit: d.unit,
      baseSales: Number(d.base_sales),
      tags: json(d.tags, []) || [],
      isRecommend: Number(d.is_recommend),
      stockMode: d.stock_mode,
      dailyLimit: Number(d.daily_limit),
      soldOut: Number(d.sold_out),
      status: Number(d.status),
      sort: Number(d.sort),
      specGroups: groups.map((g) => ({
        id: sid(g.id),
        name: g.name,
        isRequired: Number(g.is_required),
        multiSelect: Number(g.multi_select),
        sort: Number(g.sort),
        items: items
          .filter((i) => String(i.group_id) === String(g.id))
          .map((i) => ({
            id: sid(i.id),
            name: i.name,
            extraPrice: n(i.extra_price),
            isDefault: Number(i.is_default),
            sort: Number(i.sort),
          })),
      })),
    });
  })
);

router.post(
  '/dish',
  merchantAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.name) throw new BizError(CODES.BAD_PARAM, '请填写菜品名称');
    if (!b.categoryId) throw new BizError(CODES.BAD_PARAM, '请选择分类');
    const price = n(b.price);
    if (price <= 0) throw new BizError(CODES.BAD_PARAM, '请填写正确的售价');
    if (b.originalPrice && n(b.originalPrice) <= price) {
      throw new BizError(CODES.BAD_PARAM, '划线原价需大于售价');
    }
    let id;
    await tx(async (conn) => {
      const ins = await conn.exec(
        `INSERT INTO dish (store_id, category_id, name, cover, images, description, price, original_price, unit,
          base_sales, tags, is_recommend, stock_mode, daily_limit, sold_out, status, sort, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.storeId,
          b.categoryId,
          String(b.name).slice(0, 30),
          b.cover || '',
          JSON.stringify(b.images || []),
          b.description || '',
          price,
          b.originalPrice ? n(b.originalPrice) : null,
          b.unit || '份',
          Number(b.baseSales || 0),
          JSON.stringify(b.tags || []),
          b.isRecommend ? 1 : 0,
          b.stockMode === 'DAILY_LIMIT' ? 'DAILY_LIMIT' : 'UNLIMITED',
          Number(b.dailyLimit || 0),
          b.soldOut ? 1 : 0,
          b.status === 0 ? 0 : 1,
          Number(b.sort || 0),
          nowSql(),
          nowSql(),
        ]
      );
      id = ins.insertId;
      await saveSpecs(conn, req.storeId, id, b.specGroups);
    });
    await logOp(req, 'CREATE', `新增菜品：${b.name}`, id);
    return ok(res, { id: sid(id) }, '新增成功');
  })
);

/** 批量排序 / 批量改状态（必须放在 /dish/:dishId 之前，否则会被 :dishId 匹配掉） */
router.put(
  '/dish/sort',
  merchantAuth,
  wrap(async (req, res) => {
    const list = (req.body || {}).list || [];
    await tx(async (conn) => {
      for (const it of list) {
        await conn.exec('UPDATE dish SET sort = ?, updated_at = ? WHERE id = ? AND store_id = ?', [
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
  '/dish/batch-status',
  merchantAuth,
  wrap(async (req, res) => {
    const { ids, status } = req.body || {};
    if (!ids || !ids.length) throw new BizError(CODES.BAD_PARAM, '请选择菜品');
    const ph = ids.map(() => '?').join(',');
    await exec(`UPDATE dish SET status = ?, updated_at = ? WHERE id IN (${ph}) AND store_id = ?`, [
      status ? 1 : 0,
      nowSql(),
      ...ids,
      req.storeId,
    ]);
    return ok(res, { ok: true }, '操作成功');
  })
);

/** 批量修改菜品所属分类 */
router.put(
  '/dish/batch-category',
  merchantAuth,
  wrap(async (req, res) => {
    const { ids, categoryId } = req.body || {};
    if (!ids || !ids.length) throw new BizError(CODES.BAD_PARAM, '请选择菜品');
    if (!categoryId) throw new BizError(CODES.BAD_PARAM, '请选择分类');
    const c = await one('SELECT id, name FROM category WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
      categoryId,
      req.storeId,
    ]);
    if (!c) throw new BizError(CODES.NOT_FOUND, '分类不存在');
    const ph = ids.map(() => '?').join(',');
    const r = await exec(
      `UPDATE dish SET category_id = ?, updated_at = ? WHERE id IN (${ph}) AND store_id = ? AND deleted_at IS NULL`,
      [categoryId, nowSql(), ...ids, req.storeId]
    );
    await logOp(req, 'UPDATE', `批量移动 ${r.affectedRows} 个菜品到分类：${c.name}`, c.id);
    return ok(res, { affected: r.affectedRows }, '已更新分类');
  })
);

router.put(
  '/dish/:dishId',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    const b = req.body || {};
    const price = b.price === undefined ? n(d.price) : n(b.price);
    if (b.originalPrice && n(b.originalPrice) <= price) {
      throw new BizError(CODES.BAD_PARAM, '划线原价需大于售价');
    }
    await tx(async (conn) => {
      await conn.exec(
        `UPDATE dish SET category_id = ?, name = ?, cover = ?, images = ?, description = ?, price = ?,
          original_price = ?, unit = ?, base_sales = ?, tags = ?, is_recommend = ?, stock_mode = ?,
          daily_limit = ?, sold_out = ?, status = ?, sort = ?, updated_at = ?
         WHERE id = ?`,
        [
          b.categoryId === undefined ? d.category_id : b.categoryId,
          b.name === undefined ? d.name : String(b.name).slice(0, 30),
          b.cover === undefined ? d.cover : b.cover,
          JSON.stringify(b.images === undefined ? json(d.images, []) : b.images),
          b.description === undefined ? d.description : b.description,
          price,
          b.originalPrice ? n(b.originalPrice) : null,
          b.unit === undefined ? d.unit : b.unit,
          b.baseSales === undefined ? d.base_sales : Number(b.baseSales),
          JSON.stringify(b.tags === undefined ? json(d.tags, []) : b.tags),
          b.isRecommend === undefined ? d.is_recommend : b.isRecommend ? 1 : 0,
          b.stockMode === undefined ? d.stock_mode : b.stockMode,
          b.dailyLimit === undefined ? d.daily_limit : Number(b.dailyLimit),
          b.soldOut === undefined ? d.sold_out : b.soldOut ? 1 : 0,
          b.status === undefined ? d.status : b.status ? 1 : 0,
          b.sort === undefined ? d.sort : Number(b.sort),
          nowSql(),
          d.id,
        ]
      );
      if (b.specGroups) await saveSpecs(conn, req.storeId, d.id, b.specGroups);
    });
    await logOp(req, 'UPDATE', `编辑菜品：${d.name}`, d.id);
    return ok(res, { id: sid(d.id) }, '保存成功');
  })
);

router.put(
  '/dish/:dishId/status',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    const status = Number((req.body || {}).status) ? 1 : 0;
    await exec('UPDATE dish SET status = ?, updated_at = ? WHERE id = ?', [status, nowSql(), d.id]);
    return ok(res, { status }, status ? '已上架' : '已下架');
  })
);

router.put(
  '/dish/:dishId/sold-out',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    const soldOut = Number((req.body || {}).soldOut) ? 1 : 0;
    await exec('UPDATE dish SET sold_out = ?, updated_at = ? WHERE id = ?', [soldOut, nowSql(), d.id]);
    return ok(res, { soldOut }, soldOut ? '已标记沽清' : '已取消沽清');
  })
);

router.delete(
  '/dish/:dishId',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    await exec('UPDATE dish SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), d.id]);
    await logOp(req, 'DELETE', `删除菜品：${d.name}`, d.id);
    return ok(res, { ok: true }, '删除成功');
  })
);

/** 规格配置读写 */
router.get(
  '/dish/:dishId/spec',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    const groups = await query('SELECT * FROM dish_spec_group WHERE dish_id = ? ORDER BY sort, id', [d.id]);
    const groupIds = groups.map((g) => g.id);
    let items = [];
    if (groupIds.length) {
      const ph = groupIds.map(() => '?').join(',');
      items = await query(`SELECT * FROM dish_spec_item WHERE group_id IN (${ph}) ORDER BY sort, id`, groupIds);
    }
    return ok(
      res,
      groups.map((g) => ({
        id: sid(g.id),
        name: g.name,
        isRequired: Number(g.is_required),
        multiSelect: Number(g.multi_select),
        sort: Number(g.sort),
        items: items
          .filter((i) => String(i.group_id) === String(g.id))
          .map((i) => ({ id: sid(i.id), name: i.name, extraPrice: n(i.extra_price), isDefault: Number(i.is_default), sort: Number(i.sort) })),
      }))
    );
  })
);

router.put(
  '/dish/:dishId/spec',
  merchantAuth,
  wrap(async (req, res) => {
    const d = await getDish(req);
    await tx(async (conn) => {
      await saveSpecs(conn, req.storeId, d.id, (req.body || {}).specGroups);
    });
    return ok(res, { ok: true }, '规格已保存');
  })
);

/** 加料库（P2） */
router.get('/addon/list', merchantAuth, wrap(async (req, res) => {
  const rows = await query('SELECT * FROM addon WHERE store_id = ? AND deleted_at IS NULL ORDER BY sort, id', [req.storeId]);
  return ok(res, rows.map((a) => ({ id: sid(a.id), name: a.name, price: n(a.price), sort: Number(a.sort), status: Number(a.status) })));
}));

router.post('/addon', merchantAuth, wrap(async (req, res) => {
  const { name, price, sort } = req.body || {};
  if (!name) throw new BizError(CODES.BAD_PARAM, '请填写加料名称');
  const ins = await exec('INSERT INTO addon (store_id, name, price, sort, status, created_at, updated_at) VALUES (?,?,?,?,1,?,?)',
    [req.storeId, String(name).slice(0, 20), n(price), Number(sort || 0), nowSql(), nowSql()]);
  return ok(res, { id: sid(ins.insertId) }, '新增成功');
}));

router.put('/addon/:addonId', merchantAuth, wrap(async (req, res) => {
  const { name, price, sort, status } = req.body || {};
  await exec('UPDATE addon SET name = ?, price = ?, sort = ?, status = ?, updated_at = ? WHERE id = ? AND store_id = ?',
    [name, n(price), Number(sort || 0), status === 0 ? 0 : 1, nowSql(), req.params.addonId, req.storeId]);
  return ok(res, { ok: true }, '保存成功');
}));

router.delete('/addon/:addonId', merchantAuth, wrap(async (req, res) => {
  await exec('UPDATE addon SET deleted_at = ?, updated_at = ? WHERE id = ? AND store_id = ?', [nowSql(), nowSql(), req.params.addonId, req.storeId]);
  return ok(res, { ok: true }, '删除成功');
}));

async function getDish(req) {
  const d = await one('SELECT * FROM dish WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
    req.params.dishId,
    req.storeId,
  ]);
  if (!d) throw new BizError(CODES.NOT_FOUND, '菜品不存在');
  return d;
}

function logOp(req, action, description, targetId) {
  return operationLog({ req, operatorType: 'MERCHANT', operatorId: req.storeUser.id, operatorName: req.storeUser.real_name, storeId: req.storeId, module: 'DISH', action, description, targetId });
}

module.exports = router;
