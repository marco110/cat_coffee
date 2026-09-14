import { get, post, put, del } from './request';

const M = '/merchant';

export function merchantLogin(data) {
  return post(`${M}/auth/login`, data, { auth: null });
}
export function merchantProfile() {
  return get(`${M}/auth/profile`, null, { auth: 'merchant' });
}
export function updatePassword(data) {
  return put(`${M}/auth/password`, data, { auth: 'merchant' });
}

export function overview() {
  return get(`${M}/dashboard/overview`, null, { auth: 'merchant' });
}
export function pendingCount() {
  return get(`${M}/dashboard/pending-count`, null, { auth: 'merchant' });
}
export function todo() {
  return get(`${M}/dashboard/todo`, null, { auth: 'merchant' });
}

export function orderList(params) {
  return get(`${M}/order/list`, params, { auth: 'merchant' });
}
export function orderDetail(orderId) {
  return get(`${M}/order/${orderId}`, null, { auth: 'merchant' });
}
export function orderLogs(orderId) {
  return get(`${M}/order/${orderId}/logs`, null, { auth: 'merchant' });
}
export function orderModifyLogs(orderId) {
  return get(`${M}/order/${orderId}/modify-logs`, null, { auth: 'merchant' });
}
export function orderAction(orderId, action, data = {}) {
  return post(`${M}/order/${orderId}/${action}`, data, { auth: 'merchant', loading: true });
}
export function orderPay(orderId, data = {}) {
  return post(`${M}/order/${orderId}/pay`, data, { auth: 'merchant', loading: true });
}
export function orderModify(orderId, data) {
  return post(`${M}/order/${orderId}/modify`, data, { auth: 'merchant', loading: true });
}

export function categoryList() {
  return get(`${M}/category/list`, null, { auth: 'merchant' });
}
export function createCategory(data) {
  return post(`${M}/category`, data, { auth: 'merchant' });
}
export function updateCategory(id, data) {
  return put(`${M}/category/${id}`, data, { auth: 'merchant' });
}
export function deleteCategory(id) {
  return del(`${M}/category/${id}`, null, { auth: 'merchant' });
}

export function dishList(params) {
  return get(`${M}/dish/list`, params, { auth: 'merchant' });
}
export function dishDetail(id) {
  return get(`${M}/dish/${id}`, null, { auth: 'merchant' });
}
export function createDish(data) {
  return post(`${M}/dish`, data, { auth: 'merchant', loading: true });
}
export function updateDish(id, data) {
  return put(`${M}/dish/${id}`, data, { auth: 'merchant', loading: true });
}
export function updateDishStatus(id, status) {
  return put(`${M}/dish/${id}/status`, { status }, { auth: 'merchant' });
}
export function updateSoldOut(id, soldOut) {
  return put(`${M}/dish/${id}/sold-out`, { soldOut }, { auth: 'merchant' });
}
export function deleteDish(id) {
  return del(`${M}/dish/${id}`, null, { auth: 'merchant' });
}
export function getDishSpec(id) {
  return get(`${M}/dish/${id}/spec`, null, { auth: 'merchant' });
}
export function saveDishSpec(id, specGroups) {
  return put(`${M}/dish/${id}/spec`, { specGroups }, { auth: 'merchant', loading: true });
}

export function tableList() {
  return get(`${M}/table/list`, null, { auth: 'merchant' });
}
export function createTable(data) {
  return post(`${M}/table`, data, { auth: 'merchant' });
}
export function batchCreateTable(data) {
  return post(`${M}/table/batch`, data, { auth: 'merchant', loading: true });
}
export function updateTable(id, data) {
  return put(`${M}/table/${id}`, data, { auth: 'merchant' });
}
export function deleteTable(id) {
  return del(`${M}/table/${id}`, null, { auth: 'merchant' });
}
export function tableQrcode(id) {
  return get(`${M}/table/${id}/qrcode`, null, { auth: 'merchant' });
}

export function couponList(params) {
  return get(`${M}/coupon/list`, params, { auth: 'merchant' });
}
export function couponDetail(id) {
  return get(`${M}/coupon/${id}`, null, { auth: 'merchant' });
}
export function createCoupon(data) {
  return post(`${M}/coupon`, data, { auth: 'merchant', loading: true });
}
export function updateCoupon(id, data) {
  return put(`${M}/coupon/${id}`, data, { auth: 'merchant', loading: true });
}
export function updateCouponStatus(id, status) {
  return put(`${M}/coupon/${id}/status`, { status }, { auth: 'merchant' });
}
export function deleteCoupon(id) {
  return del(`${M}/coupon/${id}`, null, { auth: 'merchant' });
}
export function grantCoupon(data) {
  return post(`${M}/coupon/grant`, data, { auth: 'merchant', loading: true });
}
export function couponStats() {
  return get(`${M}/coupon/stats`, null, { auth: 'merchant' });
}

export function memberList(params) {
  return get(`${M}/member/list`, params, { auth: 'merchant' });
}
export function memberDetail(id) {
  return get(`${M}/member/${id}`, null, { auth: 'merchant' });
}
export function adjustMember(data) {
  return post(`${M}/member/adjust`, data, { auth: 'merchant', loading: true });
}
export function levelList() {
  return get(`${M}/member/level/list`, null, { auth: 'merchant' });
}
export function createLevel(data) {
  return post(`${M}/member/level`, data, { auth: 'merchant' });
}
export function updateLevel(id, data) {
  return put(`${M}/member/level/${id}`, data, { auth: 'merchant' });
}
export function deleteLevel(id) {
  return del(`${M}/member/level/${id}`, null, { auth: 'merchant' });
}

export function storeInfo() {
  return get(`${M}/store/info`, null, { auth: 'merchant' });
}
export function updateStoreInfo(data) {
  return put(`${M}/store/info`, data, { auth: 'merchant', loading: true });
}
export function updateStoreConfig(data) {
  return put(`${M}/store/config`, data, { auth: 'merchant', loading: true });
}
export function updateBusinessStatus(status) {
  return put(`${M}/store/business-status`, { status }, { auth: 'merchant' });
}
export function storeUserList() {
  return get(`${M}/store-user/list`, null, { auth: 'merchant' });
}
export function createStoreUser(data) {
  return post(`${M}/store-user`, data, { auth: 'merchant' });
}
export function resetStoreUserPassword(id) {
  return post(`${M}/store-user/${id}/reset-password`, null, { auth: 'merchant' });
}
export function deleteStoreUser(id) {
  return del(`${M}/store-user/${id}`, null, { auth: 'merchant' });
}

export function statOverview(params) {
  return get(`${M}/stat/overview`, params, { auth: 'merchant' });
}
export function statTrend(params) {
  return get(`${M}/stat/trend`, params, { auth: 'merchant' });
}
export function statTopDishes(params) {
  return get(`${M}/stat/top-dishes`, params, { auth: 'merchant' });
}
export function statPeakHours(params) {
  return get(`${M}/stat/peak-hours`, params, { auth: 'merchant' });
}
export function statMember() {
  return get(`${M}/stat/member`, null, { auth: 'merchant' });
}
