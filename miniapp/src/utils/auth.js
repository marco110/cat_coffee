import { login, getProfile } from '@/api/customer';
import { useUserStore } from '@/store/user';

/** 静默登录：无 token 时自动 wx.login */
export async function ensureLogin() {
  const store = useUserStore();
  if (store.token) return true;
  try {
    const code = await new Promise((resolve, reject) => {
      uni.login({ success: (r) => resolve(r.code), fail: reject });
    });
    const data = await login(code);
    store.setSession({ token: data.token, userId: data.user.id, userInfo: data.user });
    return true;
  } catch (e) {
    uni.showToast({ title: '登录失败，请检查网络', icon: 'none' });
    return false;
  }
}

/**
 * 下单前校验手机号：以服务端最新资料为准
 * 登录接口返回的 phone 可能是脱敏串（138****1234），不能用它判断是否已绑定，
 * 否则会出现前端放行、后端报「请先授权手机号」的情况
 */
export async function ensurePhone() {
  const store = useUserStore();
  try {
    const profile = await getProfile();
    store.setSession({ token: store.token, userId: profile.id, userInfo: profile });
  } catch (e) {
    /* 拉取失败时用本地资料兜底 */
  }
  const phone = String((store.userInfo && store.userInfo.phone) || '');
  if (/\d{11}/.test(phone)) return true;
  uni.showModal({
    title: '需绑定手机号',
    content: '下单需要绑定手机号以便联系，是否立即绑定？',
    confirmText: '去绑定',
    cancelText: '再看看',
    success: (r) => {
      if (!r.confirm) return;
      // 「我的」是 tabBar 页，用 switchTab + 内存标记传递引导意图
      store.setPendingBind(true);
      uni.switchTab({ url: '/pages/mine/index' });
    },
  });
  return false;
}

/** 统一跳转到登录/首页 */
export const DEFAULT_STORE_ID = 1;

export function currentStoreId() {
  const store = useUserStore();
  return store.storeId || String(DEFAULT_STORE_ID);
}
