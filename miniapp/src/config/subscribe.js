/**
 * 订阅消息配置
 * 模板在「小程序后台 - 订阅消息」里申请，改模板只改这里即可
 */
/** 取餐提醒（模板编号 1820，类目：餐厅排队） */
export const TMPL_PICKUP = 'd-p-AMhDOre-7T-Yo0_LyAXuQBLIUdq19_0-oH9gqmg';

/**
 * 申请「取餐提醒」订阅授权
 * 一次性订阅：用户点一次「允许」，服务端可下发一条消息
 *
 * 注意：微信要求该 API **必须由用户点击事件（bindtap 的同步调用链）触发**，
 * 放在 setTimeout / 网络回调里调用会直接 fail（表现为「未订阅」）。
 *
 * @param {(accepted:boolean, raw?:object)=>void} [callback] 授权结果回调
 */
export function requestPickupSubscribe(callback) {
  // #ifdef MP-WEIXIN
  if (typeof uni.requestSubscribeMessage !== 'function') {
    return callback && callback(false, { reason: 'api-missing' });
  }
  uni.requestSubscribeMessage({
    tmplIds: [TMPL_PICKUP],
    success: (res) => {
      const state = res[TMPL_PICKUP];
      // accept=同意；reject=拒绝；ban=被后台封禁；filter=模板被过滤（如重复订阅）
      console.log('[subscribe] 取餐提醒授权结果:', state, res);
      if (callback) callback(state === 'accept', res);
    },
    fail: (err) => {
      console.warn('[subscribe] 取餐提醒授权失败:', err);
      if (callback) callback(false, { reason: err && (err.errMsg || err.errCode) });
    },
  });
  // #endif
  // #ifndef MP-WEIXIN
  if (callback) callback(false, { reason: 'not-mp-weixin' });
  // #endif
}
