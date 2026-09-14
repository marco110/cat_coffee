const express = require('express');
const svgCaptcha = require('svg-captcha');
const db = require('../../db');
const { one, exec } = db;
const { wrap, adminAuth, sign, expiresInSeconds } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const { compare, hash } = require('../../utils/password');
const { loginLog, operationLog } = require('../../services/log');

const router = express.Router();

/** 验证码缓存：captchaId -> { text, expireAt } */
const captchas = new Map();

const LOCK_MINUTES = 15;
const MAX_FAIL = 5;

/** 图形验证码 */
router.get(
  '/captcha',
  wrap(async (req, res) => {
    const c = svgCaptcha.create({ size: 4, noise: 2, color: true, background: '#f3ede7', ignoreChars: '0o1il' });
    const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    captchas.set(id, { text: c.text.toLowerCase(), expireAt: Date.now() + 2 * 60 * 1000 });
    // 定期清理
    if (captchas.size > 500) {
      const now = Date.now();
      captchas.forEach((v, k) => {
        if (v.expireAt < now) captchas.delete(k);
      });
    }
    return ok(res, { captchaId: id, image: `data:image/svg+xml;base64,${Buffer.from(c.data).toString('base64')}` });
  })
);

/** 超管登录（强制验证码 + 5 次失败锁 15 分钟） */
router.post(
  '/auth/login',
  wrap(async (req, res) => {
    const { username, password, captchaId, captchaCode } = req.body || {};
    if (!username || !password) throw new BizError(CODES.BAD_PARAM, '请输入账号与密码');
    const cap = captchas.get(captchaId);
    if (!cap) throw new BizError(CODES.BAD_PARAM, '验证码已失效，请刷新重试');
    captchas.delete(captchaId);
    if (cap.expireAt < Date.now()) throw new BizError(CODES.BAD_PARAM, '验证码已过期');
    if (String(captchaCode || '').trim().toLowerCase() !== cap.text) {
      throw new BizError(CODES.BAD_PARAM, '验证码错误');
    }

    const admin = await one('SELECT * FROM sys_admin WHERE username = ? AND deleted_at IS NULL', [username]);
    if (!admin) {
      await loginLog({ userType: 'ADMIN', account: username, result: false, failReason: '账号不存在', ip: req.ip });
      throw new BizError(CODES.LOGIN_FAILED, '账号或密码错误');
    }
    if (Number(admin.status) !== 1) throw new BizError(CODES.ACCOUNT_LOCKED, '账号已被禁用');
    if (admin.locked_until && new Date(`${String(admin.locked_until).replace(' ', 'T')}Z`).getTime() - 8 * 3600e3 > Date.now()) {
      throw new BizError(CODES.ACCOUNT_LOCKED, `账号已锁定，请 ${LOCK_MINUTES} 分钟后重试`);
    }
    if (!compare(password, admin.password)) {
      const fail = Number(admin.login_fail_count) + 1;
      const lock = fail >= MAX_FAIL;
      await exec('UPDATE sys_admin SET login_fail_count = ?, locked_until = ? WHERE id = ?', [
        fail,
        lock ? nowSql(new Date(Date.now() + LOCK_MINUTES * 60000)) : null,
        admin.id,
      ]);
      await loginLog({ userType: 'ADMIN', userId: admin.id, account: username, result: false, failReason: '密码错误', ip: req.ip });
      if (lock) throw new BizError(CODES.ACCOUNT_LOCKED, `密码错误 ${MAX_FAIL} 次，账号已锁定 ${LOCK_MINUTES} 分钟`);
      throw new BizError(CODES.LOGIN_FAILED, '账号或密码错误');
    }

    await exec('UPDATE sys_admin SET login_fail_count = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ? WHERE id = ?', [
      nowSql(),
      req.ip,
      admin.id,
    ]);
    await loginLog({ userType: 'ADMIN', userId: admin.id, account: username, result: true, ip: req.ip, userAgent: req.headers['user-agent'] });

    const token = sign({ sub: String(admin.id) }, 'ADMIN');
    return ok(res, {
      token,
      expiresIn: expiresInSeconds('ADMIN'),
      user: {
        id: String(admin.id),
        username: admin.username,
        realName: admin.real_name || '',
        role: admin.role,
        isSuperAdmin: Number(admin.is_super_admin),
        avatar: admin.avatar || '',
      },
      permissions: admin.is_super_admin == 1 ? ['*'] : [],
    });
  })
);

router.post('/auth/logout', adminAuth, wrap(async (req, res) => ok(res, { ok: true })));

router.get(
  '/auth/profile',
  adminAuth,
  wrap(async (req, res) => {
    const a = req.admin;
    return ok(res, {
      id: String(a.id),
      username: a.username,
      realName: a.real_name || '',
      role: a.role,
      avatar: a.avatar || '',
      lastLoginAt: a.last_login_at,
    });
  })
);

router.put(
  '/auth/password',
  adminAuth,
  wrap(async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) throw new BizError(CODES.BAD_PARAM, '新密码至少 6 位');
    if (!compare(oldPassword, req.admin.password)) throw new BizError(CODES.LOGIN_FAILED, '原密码错误');
    await exec('UPDATE sys_admin SET password = ?, updated_at = ? WHERE id = ?', [hash(newPassword), nowSql(), req.admin.id]);
    return ok(res, { ok: true }, '密码修改成功');
  })
);

module.exports = router;
