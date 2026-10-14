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

function httpsPostJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error('微信接口返回解析失败'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** access_token 进程内缓存（微信有效期 7200s，提前 5 分钟续期） */
let tokenCache = { token: '', expireAt: 0 };

async function getAccessToken(force = false) {
  if (!force && tokenCache.token && Date.now() < tokenCache.expireAt) return tokenCache.token;
  const res = await httpsGetJson(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx.appid}&secret=${config.wx.secret}`
  );
  if (!res.access_token) {
    logger.warn('微信 access_token 获取失败:', res);
    throw new Error(res.errmsg || '获取微信 access_token 失败');
  }
  tokenCache = {
    token: res.access_token,
    expireAt: Date.now() + (Number(res.expires_in || 7200) - 300) * 1000,
  };
  return tokenCache.token;
}

/**
 * 发送小程序订阅消息
 * @param {{openid:string, templateId:string, page:string, data:object, miniprogramState?:string}} param
 * @returns 微信返回结果；errcode 0 为成功（43101=用户未订阅/已拒收，属正常情况）
 */
async function sendSubscribeMessage({ openid, templateId, page, data, miniprogramState }) {
  if (config.wx.mock) {
    logger.info(`[mock] 订阅消息跳过发送：template=${templateId} openid=${openid}`);
    return { errcode: 0, errmsg: 'mock' };
  }
  const payload = {
    touser: openid,
    template_id: templateId,
    page: page || '',
    miniprogram_state: miniprogramState || 'formal',
    lang: 'zh_CN',
    data: data || {},
  };
  let res = await httpsPostJson(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${await getAccessToken()}`,
    payload
  );
  // access_token 失效：强制刷新后重试一次
  if (res && (res.errcode === 40001 || res.errcode === 42001)) {
    res = await httpsPostJson(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${await getAccessToken(true)}`,
      payload
    );
  }
  if (!res || res.errcode !== 0) {
    const code = res && res.errcode;
    let hint = '';
    // 43101：用户未订阅 / 已拒收 / 一次性额度已用尽 / 订阅版本与下发版本不一致
    if (code === 43101) hint = '（检查：用户是否点过「允许」、订阅版本与 miniprogram_state 是否一致、一次性额度是否已用掉）';
    else if (code === 47001) hint = '（模板字段超长或类型不符）';
    else if (code === 40003) hint = '（openid 无效或不属于该小程序）';
    logger.warn('订阅消息发送失败:', code, res && res.errmsg, hint);
  } else {
    logger.info(`订阅消息发送成功：template=${templateId} state=${miniprogramState || 'formal'}`);
  }
  return res;
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

module.exports = { code2session, getPhoneNumber, getAccessToken, sendSubscribeMessage };
