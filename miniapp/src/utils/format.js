/** 金额格式化：始终两位小数 */
export function price(v) {
  const n = Number(v || 0);
  return n.toFixed(2);
}

export function money(v) {
  return `¥${price(v)}`;
}

export function discountText(rate) {
  if (!rate || rate >= 1) return '无折扣';
  const d = Math.round(Number(rate) * 100) / 10;
  return `${String(d).replace(/\.0$/, '')}折`;
}

export const ORDER_STATUS_TEXT = {
  PENDING: '待接单',
  ACCEPTED: '已接单',
  MAKING: '制作中',
  READY: '待取餐',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REJECTED: '已拒单',
};

export const ORDER_TYPE_TEXT = { DINE_IN: '堂食', TAKEAWAY: '打包带走' };

export function timeText(t) {
  if (!t) return '';
  return String(t).slice(5, 16);
}

export function couponDesc(c) {
  if (c.type === 'FULL_REDUCE') return `满${price(c.thresholdAmount)}减${price(c.discountAmount)}`;
  if (c.type === 'CASH') return `代金券 ¥${price(c.discountAmount)}`;
  return `${discountText(c.discountRate)}券`;
}

export function couponValue(c) {
  if (c.type === 'FULL_REDUCE') return price(c.discountAmount);
  if (c.type === 'CASH') return price(c.discountAmount);
  return discountText(c.discountRate);
}

export function dateText(t) {
  if (!t) return '';
  return String(t).slice(0, 10);
}
