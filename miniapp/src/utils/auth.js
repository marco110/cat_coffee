import { login } from '@/api/customer';
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

/** 统一跳转到登录/首页 */
export const DEFAULT_STORE_ID = 1;

export function currentStoreId() {
  const store = useUserStore();
  return store.storeId || String(DEFAULT_STORE_ID);
}
