const https = require('https');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../common/logger');
const { BizError, CODES } = require('../common/errors');

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('微信接口返回解析失败'));
          }
        });
      })
      .on('error', reject);
  });
}

/** 微信 code2session：MOCK 模式下用 code 派生 openid，便于本地联调 */
async function code2session(code) {
  if (config.wx.mock) {
    const hash = crypto.createHash('md5').update(String(code || 'dev')).digest('hex');
    return { openid: `mock_${hash.slice(0, 24)}`, unionid: null, session_key: 'mock' };
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wx.appid}&secret=${config.wx.secret}&js_code=${code}&grant_type=authorization_code`;
  const res = await httpsGetJson(url);
  if (!res.openid) {
    logger.warn('code2session failed:', res);
    throw new BizError(CODES.BAD_PARAM, res.errmsg || '微信登录失败');
  }
  return res;
}

/**
 * 手机号快速验证：真实环境需先获取 access_token 再调用 getphonenumber
 * MOCK 模式下用 code 派生一个稳定手机号
 */
async function getPhoneNumber(code) {
  if (config.wx.mock) {
    const hash = crypto.createHash('md5').update(String(code || 'phone')).digest('hex');
    const tail = String(parseInt(hash.slice(0, 6), 16) % 100000000).padStart(8, '0');
    return `138${tail}`;
  }
  const tokenRes = await httpsGetJson(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx.appid}&secret=${config.wx.secret}`
  );
  if (!tokenRes.access_token) throw new BizError(CODES.BAD_PARAM, '获取微信 access_token 失败');
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${tokenRes.access_token}`;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ code });
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.errcode !== 0) return reject(new BizError(CODES.BAD_PARAM, json.errmsg || '手机号授权失败'));
            resolve(json.phone_info.purePhoneNumber || json.phone_info.phoneNumber);
          } catch (e) {
            reject(new Error('微信接口返回解析失败'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { code2session, getPhoneNumber };
