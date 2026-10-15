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
const wechat = require('../../services/wechat');

const router = express.Router();

const LOCK_MINUTES = 15;
const MAX_FAIL = 5;

/** 组装店主登录成功后的返回体（登录与 openid 识别共用） */
async function buildSession(userId) {
  const u = await one('SELECT * FROM store_user WHERE id = ? AND deleted_at IS NULL', [userId]);
  const s = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [u.store_id]);
  return {
    token: sign({ sub: String(u.id), storeId: String(u.store_id) }, 'MERCHANT'),
    expiresIn: expiresInSeconds('MERCHANT'),
    isInitPassword: Number(u.is_init_password),
    user: {
      id: String(u.id),
      realName: u.real_name || '',
      role: u.role,
      avatar: u.avatar || '',
      phone: maskPhone(u.phone),
    },
    store: {
      id: String(s.id),
      name: s.name,
      logo: s.logo || '',
      businessStatus: Number(s.business_status),
    },
  };
}

/** 店主登录（账号密码，首次会绑定微信 openid） */
router.post(
  '/auth/login',
  wrap(async (req, res) => {
    const { phone, password, code } = req.body || {};
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

    // 首次登录（或换设备）：绑定/更新微信 openid，后续凭 openid 自动识别身份
    if (code) {
      try {
        const session = await wechat.code2session(code);
        if (session && session.openid) {
          await exec('UPDATE store_user SET openid = ? WHERE id = ?', [session.openid, user.id]);
        }
      } catch (e) {
        // openid 绑定失败不阻断登录（下次登录再绑）
      }
    }

    await exec(
      'UPDATE store_user SET login_fail_count = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ? WHERE id = ?',
      [nowSql(), ip, user.id]
    );
    await loginLog({ userType: 'MERCHANT', userId: user.id, account: phone, storeId: user.store_id, result: true, ip, userAgent: req.headers['user-agent'] });

    const data = await buildSession(user.id);
    return ok(res, data);
  })
);

/**
 * 凭 openid 识别店主身份（无需密码、无需处理 token 过期）
 * 小程序每次启动调用：wx.login -> code -> 此接口。
 * - 未绑定过 openid（从未密码登录过）：{ merchant:false }
 * - 账号已被删除或禁用：抛出 MERCHANT_REMOVED / MERCHANT_DISABLED（前端提示「您已不是店主/店员…」）
 * - 正常：返回 token + 信息
 */
router.post(
  '/auth/identify',
  wrap(async (req, res) => {
    const { code } = req.body || {};
    if (!code) throw new BizError(CODES.BAD_PARAM, '缺少 code');
    const session = await wechat.code2session(code);
    if (!session || !session.openid) throw new BizError(CODES.BAD_PARAM, '微信登录失败');

    // 注意：这里不过滤 deleted_at，要先捞出再判断「是否已被删除」
    const user = await one('SELECT * FROM store_user WHERE openid = ?', [session.openid]);
    // 从未用密码登录绑定过 openid：不是店主
    if (!user) return ok(res, { merchant: false });

    // 已被后台删除或禁用：明确提示，不再允许进入
    if (user.deleted_at) throw new BizError(CODES.MERCHANT_REMOVED, '您已不是店主/店员，请联系管理员处理');
    if (Number(user.status) !== 1) throw new BizError(CODES.MERCHANT_DISABLED, '您已不是店主/店员，请联系管理员处理');

    const store = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [user.store_id]);
    if (!store || Number(store.status) !== 1) {
      throw new BizError(CODES.MERCHANT_DISABLED, '门店已停用，请联系管理员');
    }

    await exec('UPDATE store_user SET last_login_at = ? WHERE id = ?', [nowSql(), user.id]);
    const data = await buildSession(user.id);
    return ok(res, { merchant: true, ...data });
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
