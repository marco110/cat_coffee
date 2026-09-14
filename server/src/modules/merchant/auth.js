const express = require('express');
const db = require('../../db');
const { one, exec } = db;
const { wrap, merchantAuth, sign, expiresInSeconds } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const { compare, hash } = require('../../utils/password');
const { maskPhone } = require('../../utils/misc');
const { loginLog, operationLog } = require('../../services/log');

const router = express.Router();

const LOCK_MINUTES = 15;
const MAX_FAIL = 5;

/** 店主登录 */
router.post(
  '/auth/login',
  wrap(async (req, res) => {
    const { phone, password } = req.body || {};
    if (!phone || !password) throw new BizError(CODES.BAD_PARAM, '请输入手机号与密码');
    const user = await one(
      'SELECT * FROM store_user WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    const ip = req.ip;
    if (!user) {
      await loginLog({ userType: 'MERCHANT', account: phone, result: false, failReason: '账号不存在', ip, userAgent: req.headers['user-agent'] });
      throw new BizError(CODES.LOGIN_FAILED, '账号或密码错误');
    }
    if (Number(user.status) !== 1) throw new BizError(CODES.MERCHANT_DISABLED, '账号已被禁用，请联系管理员');
    if (user.locked_until && new Date(`${String(user.locked_until).replace(' ', 'T')}Z`).getTime() - 8 * 3600e3 > Date.now()) {
      throw new BizError(CODES.ACCOUNT_LOCKED, `账号已锁定，请 ${LOCK_MINUTES} 分钟后重试`, {
        lockedUntil: user.locked_until,
      });
    }
    if (!compare(password, user.password)) {
      const failCount = Number(user.login_fail_count) + 1;
      const lock = failCount >= MAX_FAIL;
      await exec(
        'UPDATE store_user SET login_fail_count = ?, locked_until = ? WHERE id = ?',
        [failCount, lock ? nowSql(new Date(Date.now() + LOCK_MINUTES * 60000)) : null, user.id]
      );
      await loginLog({ userType: 'MERCHANT', userId: user.id, account: phone, storeId: user.store_id, result: false, failReason: '密码错误', ip, userAgent: req.headers['user-agent'] });
      if (lock) throw new BizError(CODES.ACCOUNT_LOCKED, `密码错误 ${MAX_FAIL} 次，账号已锁定 ${LOCK_MINUTES} 分钟`);
      throw new BizError(CODES.LOGIN_FAILED, '账号或密码错误');
    }

    const store = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [user.store_id]);
    if (!store || Number(store.status) !== 1) {
      throw new BizError(CODES.MERCHANT_DISABLED, '门店已停用，请联系管理员');
    }

    await exec(
      'UPDATE store_user SET login_fail_count = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ? WHERE id = ?',
      [nowSql(), ip, user.id]
    );
    await loginLog({ userType: 'MERCHANT', userId: user.id, account: phone, storeId: user.store_id, result: true, ip, userAgent: req.headers['user-agent'] });

    const token = sign({ sub: String(user.id), storeId: String(user.store_id) }, 'MERCHANT');
    return ok(res, {
      token,
      expiresIn: expiresInSeconds('MERCHANT'),
      isInitPassword: Number(user.is_init_password),
      user: {
        id: String(user.id),
        realName: user.real_name || '',
        role: user.role,
        avatar: user.avatar || '',
        phone: maskPhone(user.phone),
      },
      store: {
        id: String(store.id),
        name: store.name,
        logo: store.logo || '',
        businessStatus: Number(store.business_status),
      },
    });
  })
);

router.post('/auth/logout', merchantAuth, wrap(async (req, res) => ok(res, { ok: true })));

/** 当前店主 + 门店信息 */
router.get(
  '/auth/profile',
  merchantAuth,
  wrap(async (req, res) => {
    const u = req.storeUser;
    const s = req.store;
    return ok(res, {
      user: {
        id: String(u.id),
        realName: u.real_name || '',
        role: u.role,
        phone: maskPhone(u.phone),
        avatar: u.avatar || '',
        lastLoginAt: u.last_login_at,
      },
      store: {
        id: String(s.id),
        name: s.name,
        logo: s.logo || '',
        businessStatus: Number(s.business_status),
      },
      permissions: u.permissions ? JSON.parse(u.permissions) : [],
    });
  })
);

/** 修改密码（首次登录强制） */
router.put(
  '/auth/password',
  merchantAuth,
  wrap(async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      throw new BizError(CODES.BAD_PARAM, '新密码至少 6 位');
    }
    if (!compare(oldPassword, req.storeUser.password)) {
      throw new BizError(CODES.LOGIN_FAILED, '原密码错误');
    }
    await exec('UPDATE store_user SET password = ?, is_init_password = 0, updated_at = ? WHERE id = ?', [
      hash(newPassword),
      nowSql(),
      req.storeUser.id,
    ]);
    await operationLog({ req, operatorType: 'MERCHANT', operatorId: req.storeUser.id, operatorName: req.storeUser.real_name, storeId: req.storeId, module: 'AUTH', action: 'UPDATE', description: '修改密码' });
    return ok(res, { ok: true }, '密码修改成功');
  })
);

module.exports = router;
