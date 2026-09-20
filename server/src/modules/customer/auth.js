const express = require('express');
const { query, one, exec, tx } = require('../../db');
const { wrap, customerAuth, sign, expiresInSeconds } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const { maskPhone } = require('../../utils/misc');
const jwtUtil = require('../../utils/jwt');
const wechat = require('../../services/wechat');

const router = express.Router();

/** 微信静默登录：code -> openid -> 自动注册 -> token */
router.post(
  '/auth/login',
  wrap(async (req, res) => {
    const { code } = req.body || {};
    if (!code) throw new BizError(CODES.BAD_PARAM, '缺少 code');
    const session = await wechat.code2session(code);
    let user = await one('SELECT * FROM user WHERE openid = ?', [session.openid]);
    if (!user) {
      const ins = await exec(
        'INSERT INTO user (openid, unionid, last_login_at, created_at, updated_at) VALUES (?,?,?,?,?)',
        [session.openid, session.unionid || null, nowSql(), nowSql(), nowSql()]
      );
      user = await one('SELECT * FROM user WHERE id = ?', [ins.insertId]);
    } else {
      await exec('UPDATE user SET last_login_at = ?, updated_at = ? WHERE id = ?', [nowSql(), nowSql(), user.id]);
    }
    const token = sign({ sub: String(user.id) }, 'CUSTOMER');
    return ok(res, {
      token,
      expiresIn: expiresInSeconds('CUSTOMER'),
      needBindPhone: !user.phone,
      user: {
        id: String(user.id),
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        // 注意：这里是真实号码（用于判断是否需要绑定），脱敏串另外给 phoneMask，
        // 前端若拿脱敏串判断会误认为已绑定，导致下单时报「请先授权手机号」
        phone: user.phone || null,
        phoneMask: user.phone ? maskPhone(user.phone) : null,
      },
    });
  })
);

/** 手机号一键授权绑定（含换微信时的账号合并） */
router.post(
  '/auth/phone',
  customerAuth,
  wrap(async (req, res) => {
    const { code, phone: inputPhone } = req.body || {};
    const me = await one('SELECT * FROM user WHERE id = ?', [req.auth.sub]);
    if (!me) throw new BizError(CODES.UNAUTHORIZED, '登录已失效');
    if (me.phone) {
      return ok(res, { phone: maskPhone(me.phone), user: formatUser(me) }, '已绑定');
    }

    // 优先用微信手机号授权 code；拿不到 code 时允许手动输入手机号（/^1[3-9]\d{9}$/）
    let phone = '';
    if (code) {
      phone = await wechat.getPhoneNumber(code);
    } else if (/^1[3-9]\d{9}$/.test(String(inputPhone || '').trim())) {
      phone = String(inputPhone).trim();
    } else {
      throw new BizError(CODES.BAD_PARAM, '缺少手机号授权 code');
    }
    const exist = await one('SELECT * FROM user WHERE phone = ? AND id <> ?', [phone, me.id]);

    if (exist) await mergeUsers(me.id, exist.id);

    await exec('UPDATE user SET phone = ?, updated_at = ? WHERE id = ?', [phone, nowSql(), me.id]);
    const user = await one('SELECT * FROM user WHERE id = ?', [me.id]);
    return ok(res, { phone: maskPhone(phone), user: formatUser(user) });
  })
);

/** 合并账号：把旧账号的会员 / 券 / 订单 / 积分迁移到当前 openid 下 */
async function mergeUsers(targetId, sourceId) {
  await tx(async (conn) => {
    const members = await conn.query('SELECT * FROM user_member WHERE user_id = ?', [sourceId]);
    for (const m of members) {
      const mine = await conn.one(
        'SELECT * FROM user_member WHERE user_id = ? AND store_id = ?',
        [targetId, m.store_id]
      );
      if (mine) {
        await conn.exec(
          'UPDATE user_member SET growth = growth + ?, points = points + ?, total_consume = total_consume + ?, order_count = order_count + ? WHERE id = ?',
          [m.growth, m.points, m.total_consume, m.order_count, mine.id]
        );
        await conn.exec('DELETE FROM user_member WHERE id = ?', [m.id]);
      } else {
        await conn.exec('UPDATE user_member SET user_id = ? WHERE id = ?', [targetId, m.id]);
      }
    }
    await conn.exec('UPDATE user_coupon SET user_id = ? WHERE user_id = ?', [targetId, sourceId]);
    await conn.exec('UPDATE order_main SET user_id = ? WHERE user_id = ?', [targetId, sourceId]);
    await conn.exec('UPDATE points_log SET user_id = ? WHERE user_id = ?', [targetId, sourceId]);
    await conn.exec('UPDATE user SET phone = NULL, status = 0, updated_at = ? WHERE id = ?', [nowSql(), sourceId]);
  });
}

router.get(
  '/auth/profile',
  customerAuth,
  wrap(async (req, res) => {
    const user = await one('SELECT * FROM user WHERE id = ?', [req.auth.sub]);
    return ok(res, formatUser(user));
  })
);

router.put(
  '/auth/profile',
  customerAuth,
  wrap(async (req, res) => {
    const { nickname, avatar } = req.body || {};
    await exec('UPDATE user SET nickname = ?, avatar = ?, updated_at = ? WHERE id = ?', [
      nickname || null,
      avatar || null,
      nowSql(),
      req.auth.sub,
    ]);
    const user = await one('SELECT * FROM user WHERE id = ?', [req.auth.sub]);
    return ok(res, formatUser(user));
  })
);

router.post(
  '/auth/refresh',
  customerAuth,
  wrap(async (req, res) => {
    const token = jwtUtil.sign({ sub: req.auth.sub }, 'CUSTOMER');
    return ok(res, { token, expiresIn: expiresInSeconds('CUSTOMER') });
  })
);

function formatUser(user) {
  return {
    id: String(user.id),
    nickname: user.nickname || '',
    avatar: user.avatar || '',
    phone: user.phone || null,
    phoneMask: maskPhone(user.phone),
  };
}

module.exports = router;
module.exports.formatUser = formatUser;
module.exports.mergeUsers = mergeUsers;
