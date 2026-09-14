import { BASE_URL } from '@/config';
import { useUserStore } from '@/store/user';

/** 业务异常 */
export class ApiError extends Error {
  constructor(code, msg, data) {
    super(msg || '请求失败');
    this.code = code;
    this.data = data;
  }
}

function tokenOf(type) {
  const store = useUserStore();
  if (type === 'merchant') return store.merchantToken;
  if (type === 'admin') return '';
  return store.token;
}

/**
 * 统一请求
 * @param {object} opt { url, method, data, auth: 'customer'|'merchant'|null, loading }
 */
export function request(opt) {
  const { url, method = 'GET', data = {}, auth = 'customer', loading = false, header = {} } = opt;
  if (loading) uni.showLoading({ title: '加载中', mask: true });
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...header };
    const token = tokenOf(auth);
    if (token) headers.Authorization = `Bearer ${token}`;
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      timeout: 20000,
      success: (res) => {
        if (loading) uni.hideLoading();
        const body = res.data || {};
        if (body.code === 0) return resolve(body.data);
        // 登录失效
        if (body.code === 401) {
          if (auth === 'merchant') useUserStore().clearMerchant();
          else useUserStore().clear();
          uni.showToast({ title: '登录已失效', icon: 'none' });
        }
        return reject(new ApiError(body.code, body.msg || '请求失败', body.data));
      },
      fail: (err) => {
        if (loading) uni.hideLoading();
        reject(new ApiError(-1, err.errMsg || '网络异常，请检查网络'));
      },
    });
  });
}

export const get = (url, data, opt = {}) => request({ ...opt, url, method: 'GET', data });
export const post = (url, data, opt = {}) => request({ ...opt, url, method: 'POST', data });
export const put = (url, data, opt = {}) => request({ ...opt, url, method: 'PUT', data });
export const del = (url, data, opt = {}) => request({ ...opt, url, method: 'DELETE', data });

/** 上传文件 */
export function uploadFile(filePath, { auth = 'customer', bizType = 'AVATAR', storeId = 0 } = {}) {
  const store = useUserStore();
  const token = auth === 'merchant' ? store.merchantToken : store.token;
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}/${auth === 'merchant' ? 'merchant' : 'customer'}/upload`,
      filePath,
      name: 'file',
      formData: { bizType, storeId },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data);
          if (body.code === 0) return resolve(body.data.url);
          reject(new ApiError(body.code, body.msg));
        } catch (e) {
          reject(new ApiError(-1, '上传失败'));
        }
      },
      fail: (err) => reject(new ApiError(-1, err.errMsg || '上传失败')),
    });
  });
}
