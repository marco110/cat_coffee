import { merchantIdentify } from '@/api/merchant';
import { useUserStore } from '@/store/user';
import { ApiError } from '@/api/request';

/** 调起微信 wx.login 拿 code */
export function wxLoginCode() {
  return new Promise((resolve, reject) => {
    uni.login({ success: (r) => resolve(r.code), fail: reject });
  });
}

/**
 * 确保店主身份（凭 openid 自动识别，无需密码、无需处理过期）
 * 返回：
 *   'ok'      —— 已取得店主会话（本地已有或刚通过 openid 识别）
 *   'none'    —— 该微信从未绑定过店主账号（引导去密码登录）
 *   'removed' —— 账号已被后台删除/禁用（前端提示「您已不是店主/店员…」）
 */
export async function ensureMerchant() {
  const store = useUserStore();
  if (store.merchantToken) return 'ok';

  let code = '';
  try {
    code = await wxLoginCode();
  } catch (e) {
    return 'none';
  }

  try {
    const data = await merchantIdentify(code);
    if (!data || !data.merchant) return 'none';
    store.setMerchant({ token: data.token, user: data.user, store: data.store });
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError && (e.code === 2001 || e.code === 2002)) {
      store.clearMerchant();
      return 'removed';
    }
    return 'none';
  }
}

/**
 * 点击「店主入口」时的统一跳转：
 * - 已持有店主会话 → 直接进工作台
 * - 未持有会话：先凭 openid 静默识别（换设备/会话失效的店主也能免密直进）
 *   - 识别成功 → 进工作台
 *   - 未绑定过 → 进店主入口页（显示登录表单）
 */
export function goMerchantEntry() {
  const store = useUserStore();
  store.restore(); // 确保从本地存储加载最新会话
  if (store.isMerchantLogin) {
    uni.redirectTo({ url: '/subpackages/merchant/dashboard/index' });
    return;
  }
  uni.showLoading({ title: '识别中...', mask: true });
  ensureMerchant()
    .then((s) => {
      uni.hideLoading();
      if (s === 'ok') {
        uni.redirectTo({ url: '/subpackages/merchant/dashboard/index' });
      } else {
        uni.navigateTo({ url: '/pages/merchant-entry/index' });
      }
    })
    .catch(() => {
      uni.hideLoading();
      uni.navigateTo({ url: '/pages/merchant-entry/index' });
    });
}
