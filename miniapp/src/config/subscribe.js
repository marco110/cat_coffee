/**
 * 订阅消息配置
 * 模板在「小程序后台 - 订阅消息」里申请，改模板时只改这里即可
 */
/** 取餐提醒（模板编号 1820，类目：餐厅排队） */
export const TMPL_PICKUP = 'd-p-AMhDOre-7T-Yo0_LyAXuQBLIUdq19_0-oH9gqmg';

/**
 * 申请「取餐提醒」订阅授权
 * 一次性订阅：用户点一次「允许」，服务端可下发一条消息
 *
 * @param {(accepted:boolean)=>void} [callback] 授权结果回调
 */
export function requestPickupSubscribe(callback) {
  // #ifdef MP-WEIXIN
  if (typeof uni.requestSubscribeMessage !== 'function') return callback && callback(false);
  uni.requestSubscribeMessage({
    tmplIds: [TMPL_PICKUP],
    success: (res) => {
      // accept / reject / ban / filter 等状态
      const accepted = res[TMPL_PICKUP] === 'accept';
      if (callback) callback(accepted);
    },
    fail: () => callback && callback(false),
  });
  // #endif
  // #ifndef MP-WEIXIN
  if (callback) callback(false);
  // #endif
}
