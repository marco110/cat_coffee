const express = require('express');
const db = require('../../db');
const { query, one, exec, tx } = db;
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n } = require('../../utils/money');
const { nowSql } = require('../../utils/time');
const { sid, maskPhone } = require('../../utils/misc');
const { hash, randomPassword } = require('../../utils/password');
const { operationLog } = require('../../services/log');

const router = express.Router();

const INFO_FIELDS = [
  'name', 'logo', 'cover', 'intro', 'announcement', 'phone', 'province', 'city', 'district', 'address',
  'longitude', 'latitude', 'businessHoursStart', 'businessHoursEnd',
];
const CONFIG_FIELDS = [
  'allowDineIn', 'allowTakeaway', 'needScanTable', 'autoAcceptOrder', 'orderTimeoutMinutes',
  'memberEnabled', 'memberDiscountStackable', 'pointsEnabled', 'pointsRate', 'pointsDeductRatio',
  'pointsDeductMaxRate', 'pointsDeductStep', 'growthRate', 'pickupCodePrefix', 'showSales',
  'showSoldOutDish', 'hotSalesThreshold',
];

const FIELD_MAP = {
  allowDineIn: 'allow_dine_in',
  allowTakeaway: 'allow_takeaway',
  needScanTable: 'need_scan_table',
  autoAcceptOrder: 'auto_accept_order',
  orderTimeoutMinutes: 'order_timeout_minutes',
  memberEnabled: 'member_enabled',
  memberDiscountStackable: 'member_discount_stackable',
  pointsEnabled: 'points_enabled',
  pointsRate: 'points_rate',
  pointsDeductRatio: 'points_deduct_ratio',
  pointsDeductMaxRate: 'points_deduct_max_rate',
  pointsDeductStep: 'points_deduct_step',
  growthRate: 'growth_rate',
  pickupCodePrefix: 'pickup_code_prefix',
  showSales: 'show_sales',
  showSoldOutDish: 'show_sold_out_dish',
  hotSalesThreshold: 'hot_sales_threshold',
  businessHoursStart: 'business_hours_start',
  businessHoursEnd: 'business_hours_end',
};

function formatStore(s) {
  return {
    id: sid(s.id),
    name: s.name,
    logo: s.logo || '',
    cover: s.cover || '',
    intro: s.intro || '',
    announcement: s.announcement || '',
    phone: s.phone || '',
    province: s.province || '',
    city: s.city || '',
    district: s.district || '',
    address: s.address || '',
    longitude: s.longitude === null ? null : n(s.longitude),
    latitude: s.latitude === null ? null : n(s.latitude),
    businessHoursStart: s.business_hours_start,
    businessHoursEnd: s.business_hours_end,
    businessStatus: Number(s.business_status),
    allowDineIn: Number(s.allow_dine_in),
    allowTakeaway: Number(s.allow_takeaway),
    needScanTable: Number(s.need_scan_table),
    autoAcceptOrder: Number(s.auto_accept_order),
    orderTimeoutMinutes: Number(s.order_timeout_minutes),
    memberEnabled: Number(s.member_enabled),
    memberDiscountStackable: Number(s.member_discount_stackable),
    pointsEnabled: Number(s.points_enabled),
    pointsRate: n(s.points_rate),
    pointsDeductRatio: Number(s.points_deduct_ratio),
    pointsDeductMaxRate: n(s.points_deduct_max_rate),
    pointsDeductStep: Number(s.points_deduct_step),
    growthRate: n(s.growth_rate),
    pickupCodePrefix: s.pickup_code_prefix,
    showSales: Number(s.show_sales),
    showSoldOutDish: Number(s.show_sold_out_dish),
    hotSalesThreshold: Number(s.hot_sales_threshold),
    status: Number(s.status),
  };
}

router.get('/store/info', merchantAuth, wrap(async (req, res) => ok(res, formatStore(req.store))));

router.put(
  '/store/info',
  merchantAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    await buildUpdate(req.store.id, b, INFO_FIELDS);
    await logOp(req, '编辑门店信息');
    return ok(res, { ok: true }, '保存成功');
  })
);

router.put(
  '/store/config',
  merchantAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    await buildUpdate(req.store.id, b, CONFIG_FIELDS);
    await logOp(req, '编辑经营配置');
    return ok(res, { ok: true }, '保存成功');
  })
);

async function buildUpdate(storeId, body, fields) {
  const sets = [];
  const params = [];
  fields.forEach((f) => {
    if (body[f] === undefined) return;
    const col = FIELD_MAP[f] || f.replace(/([A-Z])/g, '_$1').toLowerCase();
    sets.push(`${col} = ?`);
    params.push(typeof body[f] === 'boolean' ? (body[f] ? 1 : 0) : body[f]);
  });
  if (!sets.length) return;
  sets.push('updated_at = ?');
  params.push(nowSql(), storeId);
  await exec(`UPDATE store SET ${sets.join(', ')} WHERE id = ?`, params);
}

router.put(
  '/store/business-status',
  merchantAuth,
  wrap(async (req, res) => {
    const status = Number((req.body || {}).status) ? 1 : 0;
    await exec('UPDATE store SET business_status = ?, updated_at = ? WHERE id = ?', [status, nowSql(), req.storeId]);
    await logOp(req, status ? '门店开始营业' : '门店打烊');
    return ok(res, { businessStatus: status }, status ? '已开始营业' : '已打烊');
  })
);

/** 店内就餐码（P1） */
router.get(
  '/store/dining-code',
  merchantAuth,
  wrap(async (req, res) => {
    const scene = `s${req.storeId}t0`;
    return ok(res, {
      scene,
      url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scene)}`,
      storeName: req.store.name,
    });
  })
);

/** 店员账号列表 */
router.get(
  '/store-user/list',
  merchantAuth,
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM store_user WHERE store_id = ? AND deleted_at IS NULL ORDER BY id',
      [req.storeId]
    );
    return ok(
      res,
      rows.map((u) => ({
        id: sid(u.id),
        phone: maskPhone(u.phone),
        realName: u.real_name || '',
        role: u.role,
        isOwner: Number(u.is_owner),
        avatar: u.avatar || '',
        status: Number(u.status),
        isInitPassword: Number(u.is_init_password),
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
      }))
    );
  })
);

router.post(
  '/store-user',
  merchantAuth,
  wrap(async (req, res) => {
    const { phone, realName, role } = req.body || {};
    if (!/^1[3-9]\d{9}$/.test(String(phone || ''))) throw new BizError(CODES.BAD_PARAM, '请输入正确的手机号');
    const exist = await one('SELECT id FROM store_user WHERE phone = ? AND deleted_at IS NULL', [phone]);
    if (exist) throw new BizError(CODES.CONFLICT, '该手机号已注册');
    const pwd = randomPassword();
    const ins = await exec(
      `INSERT INTO store_user (store_id, phone, password, real_name, role, is_owner, is_init_password, status, created_at, updated_at)
       VALUES (?,?,?,?,?,0,1,1,?,?)`,
      [req.storeId, phone, hash(pwd), realName || '', role === 'MANAGER' ? 'MANAGER' : 'CLERK', nowSql(), nowSql()]
    );
    await logOp(req, `新增店员账号：${phone}`, ins.insertId);
    return ok(res, { id: sid(ins.insertId), initPassword: pwd }, '新增成功');
  })
);

router.put(
  '/store-user/:userId',
  merchantAuth,
  wrap(async (req, res) => {
    const u = await getStoreUser(req);
    const { realName, role, status } = req.body || {};
    await exec('UPDATE store_user SET real_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?', [
      realName === undefined ? u.real_name : realName,
      role === undefined ? u.role : role,
      status === undefined ? u.status : (status ? 1 : 0),
      nowSql(),
      u.id,
    ]);
    return ok(res, { ok: true }, '保存成功');
  })
);

router.post(
  '/store-user/:userId/reset-password',
  merchantAuth,
  wrap(async (req, res) => {
    const u = await getStoreUser(req);
    const pwd = randomPassword();
    await exec('UPDATE store_user SET password = ?, is_init_password = 1, login_fail_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?', [
      hash(pwd),
      nowSql(),
      u.id,
    ]);
    await logOp(req, `重置店员密码：${u.phone}`, u.id);
    return ok(res, { initPassword: pwd }, '重置成功');
  })
);

router.delete(
  '/store-user/:userId',
  merchantAuth,
  wrap(async (req, res) => {
    const u = await getStoreUser(req);
    if (Number(u.is_owner) === 1) throw new BizError(CODES.CONFLICT, '店主账号不可删除');
    await exec('UPDATE store_user SET deleted_at = ?, status = 0, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), u.id]);
    return ok(res, { ok: true }, '删除成功');
  })
);

async function getStoreUser(req) {
  const u = await one('SELECT * FROM store_user WHERE id = ? AND store_id = ? AND deleted_at IS NULL', [
    req.params.userId,
    req.storeId,
  ]);
  if (!u) throw new BizError(CODES.NOT_FOUND, '账号不存在');
  return u;
}

function logOp(req, description, targetId) {
  return operationLog({ req, operatorType: 'MERCHANT', operatorId: req.storeUser.id, operatorName: req.storeUser.real_name, storeId: req.storeId, module: 'STORE', action: 'UPDATE', description, targetId });
}

module.exports = router;
