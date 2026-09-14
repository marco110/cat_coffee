const express = require('express');
const db = require('../../db');
const { query, one, exec, tx, scalar } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql, rangeToSql } = require('../../utils/time');
const { sid, maskPhone, isPhone } = require('../../utils/misc');
const { hash, randomPassword } = require('../../utils/password');
const { operationLog } = require('../../services/log');

const router = express.Router();

const DEFAULT_LEVELS = [
  { name: '普通会员', levelValue: 1, growthThreshold: 0, discount: 1.0 },
  { name: '银卡会员', levelValue: 2, growthThreshold: 100, discount: 0.95 },
  { name: '金卡会员', levelValue: 3, growthThreshold: 300, discount: 0.9 },
  { name: '黑卡会员', levelValue: 4, growthThreshold: 1000, discount: 0.85 },
];
const DEFAULT_CATEGORIES = ['热门推荐', '经典咖啡', '非咖啡', '甜点', '轻食'];

/** 新建门店：门店 + 店主账号 + 默认等级 + 默认分类 */
router.post(
  '/store',
  adminAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.name) throw new BizError(CODES.BAD_PARAM, '请填写门店名称');
    if (!isPhone(b.ownerPhone)) throw new BizError(CODES.BAD_PARAM, '请填写正确的店主手机号');
    const exist = await one('SELECT id FROM store_user WHERE phone = ? AND deleted_at IS NULL', [b.ownerPhone]);
    if (exist) throw new BizError(CODES.CONFLICT, '该手机号已是其他门店账号');

    const pwd = randomPassword();
    let storeId;
    let userId;
    await tx(async (conn) => {
      const ins = await conn.exec(
        `INSERT INTO store (name, logo, cover, intro, announcement, phone, province, city, district, address,
          business_hours_start, business_hours_end, business_status, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
        [
          String(b.name).slice(0, 50),
          b.logo || '',
          b.cover || '',
          b.intro || '',
          b.announcement || '',
          b.phone || '',
          b.province || '',
          b.city || '',
          b.district || '',
          b.address || '',
          b.businessHoursStart || '09:00',
          b.businessHoursEnd || '22:00',
          Number(b.businessStatus) === 1 ? 1 : 0,
          nowSql(),
          nowSql(),
        ]
      );
      storeId = ins.insertId;
      const uins = await conn.exec(
        `INSERT INTO store_user (store_id, phone, password, real_name, role, is_init_password, status, created_at, updated_at)
         VALUES (?,?,?,?,'OWNER',1,1,?,?)`,
        [storeId, b.ownerPhone, hash(pwd), b.ownerName || '店主', nowSql(), nowSql()]
      );
      userId = uins.insertId;
      for (const l of DEFAULT_LEVELS) {
        await conn.exec(
          `INSERT INTO member_level (store_id, name, level_value, growth_threshold, discount, is_default, status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,1,?,?)`,
          [storeId, l.name, l.levelValue, l.growthThreshold, l.discount, l.name === '普通会员' ? 1 : 0, nowSql(), nowSql()]
        );
      }
      for (const [i, name] of DEFAULT_CATEGORIES.entries()) {
        await conn.exec(
          'INSERT INTO category (store_id, name, sort, status, created_at, updated_at) VALUES (?,?,?,1,?,?)',
          [storeId, name, i, nowSql(), nowSql()]
        );
      }
    });
    await operationLog({ req, operatorType: 'ADMIN', operatorId: req.admin.id, operatorName: req.admin.username, storeId, module: 'STORE', action: 'CREATE', description: `新建门店：${b.name}`, targetId: storeId });
    return ok(res, { storeId: sid(storeId), ownerAccount: b.ownerPhone, initPassword: pwd, ownerUserId: sid(userId) }, '开通成功');
  })
);

/** 门店列表 */
router.get(
  '/store/list',
  adminAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query);
    const where = ['s.deleted_at IS NULL'];
    const params = [];
    if (req.query.keyword) {
      where.push('(s.name LIKE ? OR su.phone LIKE ? OR su.real_name LIKE ?)');
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    if (req.query.status) {
      where.push('s.status = ?');
      params.push(req.query.status);
    }
    if (req.query.businessStatus) {
      where.push('s.business_status = ?');
      params.push(req.query.businessStatus);
    }
    if (req.query.city) {
      where.push('s.city LIKE ?');
      params.push(`%${req.query.city}%`);
    }
    const wsql = where.join(' AND ');
    const total = await one(`SELECT COUNT(1) AS c FROM store s WHERE ${wsql}`, params);
    const rows = await query(
      `SELECT s.*, su.real_name AS owner_name, su.phone AS owner_phone
       FROM store s LEFT JOIN store_user su ON su.store_id = s.id AND su.role = 'OWNER' AND su.deleted_at IS NULL
       WHERE ${wsql} ORDER BY s.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const list = [];
    for (const s of rows) {
      const today = rangeToSql('today', null, null, 'created_at');
      const orderCount = Number(await scalar(`SELECT COUNT(1) AS c FROM order_main WHERE store_id = ? AND deleted_at IS NULL AND ${today.where}`, [s.id, ...today.params]));
      const dishCount = Number(await scalar('SELECT COUNT(1) AS c FROM dish WHERE store_id = ? AND deleted_at IS NULL', [s.id]));
      const tableCount = Number(await scalar('SELECT COUNT(1) AS c FROM table_info WHERE store_id = ? AND deleted_at IS NULL', [s.id]));
      list.push({
        id: sid(s.id),
        name: s.name,
        logo: s.logo || '',
        phone: s.phone || '',
        city: s.city || '',
        district: s.district || '',
        address: s.address || '',
        businessStatus: Number(s.business_status),
        status: Number(s.status),
        ownerName: s.owner_name || '',
        ownerPhone: maskPhone(s.owner_phone),
        todayOrderCount: orderCount,
        dishCount,
        tableCount,
        createdAt: s.created_at,
      });
    }
    return ok(res, page(list, Number(total.c), p, pageSize));
  })
);

/** 门店详情 */
router.get(
  '/store/:storeId',
  adminAuth,
  wrap(async (req, res) => {
    const s = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [req.params.storeId]);
    if (!s) throw new BizError(CODES.NOT_FOUND, '门店不存在');
    const owner = await one("SELECT * FROM store_user WHERE store_id = ? AND role = 'OWNER' AND deleted_at IS NULL", [s.id]);
    const stats = await one(
      `SELECT COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue FROM order_main
       WHERE store_id = ? AND deleted_at IS NULL AND status = 'COMPLETED'`,
      [s.id]
    );
    const dishCount = Number(await scalar('SELECT COUNT(1) AS c FROM dish WHERE store_id = ? AND deleted_at IS NULL', [s.id]));
    const tableCount = Number(await scalar('SELECT COUNT(1) AS c FROM table_info WHERE store_id = ? AND deleted_at IS NULL', [s.id]));
    const memberCount = Number(await scalar('SELECT COUNT(1) AS c FROM user_member WHERE store_id = ?', [s.id]));
    return ok(res, {
      id: sid(s.id),
      name: s.name,
      logo: s.logo,
      cover: s.cover,
      intro: s.intro,
      announcement: s.announcement,
      phone: s.phone,
      province: s.province,
      city: s.city,
      district: s.district,
      address: s.address,
      longitude: s.longitude === null ? null : n(s.longitude),
      latitude: s.latitude === null ? null : n(s.latitude),
      businessHoursStart: s.business_hours_start,
      businessHoursEnd: s.business_hours_end,
      businessStatus: Number(s.business_status),
      status: Number(s.status),
      owner: owner
        ? { id: sid(owner.id), realName: owner.real_name, phone: owner.phone, status: Number(owner.status), lastLoginAt: owner.last_login_at }
        : null,
      stats: { orderCount: Number(stats.order_count), revenue: n(stats.revenue), dishCount, tableCount, memberCount },
      createdAt: s.created_at,
    });
  })
);

router.put(
  '/store/:storeId',
  adminAuth,
  wrap(async (req, res) => {
    const s = await getStore(req);
    const b = req.body || {};
    await exec(
      `UPDATE store SET name = ?, phone = ?, province = ?, city = ?, district = ?, address = ?,
        business_hours_start = ?, business_hours_end = ?, announcement = ?, logo = ?, cover = ?, intro = ?,
        longitude = ?, latitude = ?, updated_at = ? WHERE id = ?`,
      [
        b.name === undefined ? s.name : String(b.name).slice(0, 50),
        b.phone === undefined ? s.phone : b.phone,
        b.province === undefined ? s.province : b.province,
        b.city === undefined ? s.city : b.city,
        b.district === undefined ? s.district : b.district,
        b.address === undefined ? s.address : b.address,
        b.businessHoursStart === undefined ? s.business_hours_start : b.businessHoursStart,
        b.businessHoursEnd === undefined ? s.business_hours_end : b.businessHoursEnd,
        b.announcement === undefined ? s.announcement : b.announcement,
        b.logo === undefined ? s.logo : b.logo,
        b.cover === undefined ? s.cover : b.cover,
        b.intro === undefined ? s.intro : b.intro,
        b.longitude === undefined ? s.longitude : b.longitude,
        b.latitude === undefined ? s.latitude : b.latitude,
        nowSql(),
        s.id,
      ]
    );
    await logOp(req, `编辑门店：${s.name}`, s.id);
    return ok(res, { ok: true }, '保存成功');
  })
);

router.put(
  '/store/:storeId/status',
  adminAuth,
  wrap(async (req, res) => {
    const s = await getStore(req);
    const status = Number((req.body || {}).status) ? 1 : 0;
    await exec('UPDATE store SET status = ?, updated_at = ? WHERE id = ?', [status, nowSql(), s.id]);
    await logOp(req, `${status ? '启用' : '停用'}门店：${s.name}`, s.id);
    return ok(res, { status }, status ? '已启用' : '已停用');
  })
);

router.delete(
  '/store/:storeId',
  adminAuth,
  wrap(async (req, res) => {
    const s = await getStore(req);
    const using = await one(
      "SELECT id FROM order_main WHERE store_id = ? AND status IN ('PENDING','ACCEPTED','MAKING','READY') LIMIT 1",
      [s.id]
    );
    if (using) throw new BizError(CODES.CONFLICT, '该门店存在进行中的订单，无法删除');
    await exec('UPDATE store SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), s.id]);
    await logOp(req, `删除门店：${s.name}`, s.id);
    return ok(res, { ok: true }, '删除成功');
  })
);

/** 重置店主密码 */
router.post(
  '/store/:storeId/reset-password',
  adminAuth,
  wrap(async (req, res) => {
    const s = await getStore(req);
    const owner = await one("SELECT * FROM store_user WHERE store_id = ? AND role = 'OWNER' AND deleted_at IS NULL", [s.id]);
    if (!owner) throw new BizError(CODES.NOT_FOUND, '该门店无店主账号');
    const pwd = randomPassword();
    await exec(
      'UPDATE store_user SET password = ?, is_init_password = 1, login_fail_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?',
      [hash(pwd), nowSql(), owner.id]
    );
    await logOp(req, `重置店主密码：${owner.phone}`, s.id);
    return ok(res, { initPassword: pwd, phone: owner.phone }, '重置成功');
  })
);

/** 门店统计汇总（后台首页） */
router.get(
  '/store/stat',
  adminAuth,
  wrap(async (req, res) => {
    const total = Number(await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL'));
    const opened = Number(await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND business_status = 1 AND status = 1'));
    const disabled = Number(await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND status = 0'));
    const new30 = Number(
      await scalar('SELECT COUNT(1) AS c FROM store WHERE deleted_at IS NULL AND created_at >= ?', [
        nowSql(new Date(Date.now() - 30 * 86400000)),
      ])
    );
    return ok(res, { total, opened, disabled, newIn30Days: new30 });
  })
);

async function getStore(req) {
  const s = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [req.params.storeId]);
  if (!s) throw new BizError(CODES.NOT_FOUND, '门店不存在');
  return s;
}

function logOp(req, description, targetId) {
  return operationLog({ req, operatorType: 'ADMIN', operatorId: req.admin.id, operatorName: req.admin.username, storeId: req.params.storeId || 0, module: 'STORE', action: 'UPDATE', description, targetId });
}

module.exports = router;
module.exports.DEFAULT_LEVELS = DEFAULT_LEVELS;
