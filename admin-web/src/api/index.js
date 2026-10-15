import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { useUserStore } from '@/store/user';

const service = axios.create({
  baseURL: '/api/admin',
  timeout: 20000,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem('cc_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

service.interceptors.response.use(
  (res) => {
    const body = res.data || {};
    if (body.code === 0) return body.data;
    if (body.code === 401) {
      // 关键：必须同步清空 Pinia 用户态，否则路由守卫会因 isLogin 仍为 true
      // 把 /login 再弹回 /dashboard，导致「只提示过期却不跳转登录页」
      const hadToken = localStorage.getItem('cc_admin_token');
      localStorage.removeItem('cc_admin_token');
      localStorage.removeItem('cc_admin_user');
      useUserStore().logout();
      // 只在首次（仍有 token 时）提示并跳转，避免并发请求重复弹窗
      if (hadToken) {
        ElMessage.error(body.msg || '登录已过期，请重新登录');
        router.push('/login');
      }
      return Promise.reject(new Error(body.msg || '登录已过期'));
    }
    ElMessage.error(body.msg || '请求失败');
    return Promise.reject(new Error(body.msg || '请求失败'));
  },
  (err) => {
    // HTTP 层异常（网络/超时/连接被拒）：若响应里带了 401 业务码也按上述逻辑处理
    const body = err.response && err.response.data;
    if (body && body.code === 401) {
      const hadToken = localStorage.getItem('cc_admin_token');
      localStorage.removeItem('cc_admin_token');
      localStorage.removeItem('cc_admin_user');
      useUserStore().logout();
      if (hadToken) {
        ElMessage.error(body.msg || '登录已过期，请重新登录');
        router.push('/login');
      }
    } else {
      ElMessage.error(err.message || '网络异常');
    }
    return Promise.reject(err);
  }
);

export default service;

/* ---------- 认证 ---------- */
export const getCaptcha = () => service.get('/captcha');
export const login = (data) => service.post('/auth/login', data);
export const logout = () => service.post('/auth/logout');
export const getProfile = () => service.get('/auth/profile');
export const updatePassword = (data) => service.put('/auth/password', data);

/* ---------- 首页看板 ---------- */
export const getOverview = () => service.get('/dashboard/overview');
export const getTrend = (params) => service.get('/dashboard/trend', { params });
export const getStoreRank = () => service.get('/dashboard/store-rank');
export const getActivity = () => service.get('/dashboard/activity');

/* ---------- 门店 ---------- */
export const createStore = (data) => service.post('/store', data);
export const getStoreList = (params) => service.get('/store/list', { params });
export const getStoreDetail = (storeId) => service.get(`/store/${storeId}`);
export const updateStore = (storeId, data) => service.put(`/store/${storeId}`, data);
export const updateStoreStatus = (storeId, status) => service.put(`/store/${storeId}/status`, { status });
export const deleteStore = (storeId) => service.delete(`/store/${storeId}`);
export const resetStorePassword = (storeId) => service.post(`/store/${storeId}/reset-password`);
export const getStoreStat = () => service.get('/store/stat');

/* ---------- 店主账号 ---------- */
export const getStoreUserList = (params) => service.get('/store-user/list', { params });
export const createStoreUser = (data) => service.post('/store-user', data);
export const updateStoreUser = (userId, data) => service.put(`/store-user/${userId}`, data);
export const resetStoreUserPassword = (userId) => service.post(`/store-user/${userId}/reset-password`);
export const unlockStoreUser = (userId) => service.post(`/store-user/${userId}/unlock`);
export const deleteStoreUser = (userId) => service.delete(`/store-user/${userId}`);

/* ---------- 订单 ---------- */
export const getOrderList = (params) => service.get('/order/list', { params });
export const getOrderDetail = (orderId) => service.get(`/order/${orderId}`);
export const getOrderStat = (params) => service.get('/order/stat', { params });
export const exportOrderUrl = (params) => {
  const qs = new URLSearchParams(params).toString();
  return `/api/admin/order/export?${qs}`;
};

/* ---------- 会员等级模板 ---------- */
export const getLevelTemplate = () => service.get('/member-level/template');
export const saveLevelTemplate = (list) => service.put('/member-level/template', { list });

/* ---------- 平台配置 ---------- */
export const getConfig = () => service.get('/config');
export const saveConfig = (data) => service.put('/config', data);
export const getConfigList = () => service.get('/config/list');

/* ---------- 日志 ---------- */
export const getOperationLog = (params) => service.get('/log/operation', { params });
export const getLoginLog = (params) => service.get('/log/login', { params });

/* ---------- 素材 ---------- */
export const getFileList = (params) => service.get('/file/list', { params });
export const uploadFile = (formData) =>
  service.post('/file/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteFile = (fileId) => service.delete(`/file/${fileId}`);
