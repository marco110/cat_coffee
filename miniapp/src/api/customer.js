import { get, post, put } from './request';

/** 微信登录：code -> token */
export function login(code) {
  return post('/customer/auth/login', { code }, { auth: null });
}
export function bindPhone(code) {
  return post('/customer/auth/phone', { code });
}
export function getProfile() {
  return get('/customer/auth/profile');
}
export function updateProfile(data) {
  return put('/customer/auth/profile', data);
}

export function scanStore(scene) {
  return get('/customer/store/scan', { scene });
}
export function getStore(storeId) {
  return get(`/customer/store/${storeId}`);
}
export function getMenu(storeId) {
  return get(`/customer/store/${storeId}/menu`);
}
export function getTables(storeId) {
  return get(`/customer/store/${storeId}/tables`);
}
export function getBanners(storeId) {
  return get(`/customer/store/${storeId}/banners`);
}
export function getDish(dishId) {
  return get(`/customer/dish/${dishId}`);
}
export function searchDish(storeId, keyword) {
  return get('/customer/dish/search', { storeId, keyword });
}

export function previewOrder(data) {
  return post('/customer/order/preview', data);
}
export function createOrder(data) {
  return post('/customer/order', data);
}
export function getOrderList(params) {
  return get('/customer/order/list', params);
}
export function getOrderDetail(orderId) {
  return get(`/customer/order/${orderId}`);
}
export function cancelOrder(orderId, reason) {
  return post(`/customer/order/${orderId}/cancel`, { reason });
}
export function urgeOrder(orderId) {
  return post(`/customer/order/${orderId}/urge`);
}
export function reorder(orderId) {
  return get(`/customer/order/${orderId}/reorder`);
}
export function getOngoing() {
  return get('/customer/order/ongoing');
}

export function getMemberInfo(storeId) {
  return get('/customer/member/info', { storeId });
}
export function getMemberLevels(storeId) {
  return get('/customer/member/levels', { storeId });
}
export function getPointsLog(storeId, page = 1) {
  return get('/customer/member/points-log', { storeId, page, pageSize: 20 });
}

export function getMyCoupons(params) {
  return get('/customer/coupon/list', params);
}
export function getAvailableCoupons(storeId, amount) {
  return get('/customer/coupon/available', { storeId, amount });
}
export function getCouponCenter(storeId) {
  return get('/customer/coupon/center', { storeId });
}
export function claimCoupon(couponId) {
  return post(`/customer/coupon/${couponId}/claim`);
}
