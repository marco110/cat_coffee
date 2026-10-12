const { one, query } = require('../db');
const logger = require('../common/logger');
const { pushplus, escapeHtml } = require('./push');

const ORDER_TYPE_TEXT = { DINE_IN: '堂食', TAKEAWAY: '自取' };

/** 商品明细行 */
function renderItems(items) {
  return items
    .map((it) => {
      const spec = it.spec_text ? `（${it.spec_text}）` : '';
      const remark = it.remark ? `　备注：${it.remark}` : '';
      return `　· ${escapeHtml(it.dish_name)}${escapeHtml(spec)} x${it.quantity}　¥${Number(it.subtotal).toFixed(2)}${escapeHtml(remark)}`;
    })
    .join('<br/>');
}

/** 顾客行 */
function renderCustomer(user) {
  const nickname = user && user.nickname ? user.nickname : '';
  const phone = user && user.phone ? user.phone : '';
  if (!nickname && !phone) return '';
  return `<b>顾客</b>：${escapeHtml(nickname)}${phone ? `　${escapeHtml(phone)}` : ''}`;
}

/** 门店行（分隔线下方居中） */
function renderShop(store) {
  return `<div style="text-align:center"><b>${escapeHtml(store ? store.name : '')}</b></div>`;
}

/** 方式行 */
function renderType(orderType, tableNo) {
  const typeText = ORDER_TYPE_TEXT[orderType] || '自取';
  return orderType === 'DINE_IN' && tableNo ? `${typeText}　桌号 ${escapeHtml(tableNo)}` : typeText;
}

/** 标题：单品「商品名*数量-后缀」，多品「n个商品-后缀」 */
function renderTitle(items, suffix) {
  return items.length === 1
    ? `${items[0].dish_name}*${items[0].quantity}-${suffix}`
    : `${items.length}个商品-${suffix}`;
}

/**
 * 新订单通知店主（PushPlus）
 * 在事务提交后异步调用，失败不影响下单结果
 *
 * @param {{userId:string|number, storeId:string|number, order:object}} param
 */
async function notifyNewOrder({ userId, storeId, order }) {
  try {
    const store = await one('SELECT name FROM store WHERE id = ?', [storeId]);
    const user = await one('SELECT nickname, phone FROM user WHERE id = ?', [userId]);
    const items = await query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [order.orderId]);

    const title = renderTitle(items, '待接单');

    const rows = [];
    // 1 订单号
    rows.push(`<b>订单号</b>：${escapeHtml(order.orderNo)}`);
    // 2 商品明细
    if (items.length) {
      rows.push('<b>商品明细</b>：');
      rows.push(renderItems(items));
    }
    // 3 金额
    rows.push(`<b>金额</b>：<b style="color:#f0487e">¥${Number(order.payAmount || 0).toFixed(2)}</b>`);
    // 4 顾客
    const customerRow = renderCustomer(user);
    if (customerRow) rows.push(customerRow);
    // 5 取餐码
    if (order.pickupCode) {
      rows.push(`<b>取餐码</b>：<span style="font-size:20px"><b>${escapeHtml(order.pickupCode)}</b></span>`);
    }
    // 6 方式
    rows.push(`<b>方式</b>：${renderType(order.orderType, order.tableNo)}`);
    rows.push('<hr/>');
    // 7 门店（分隔线下方居中显示）
    const shopRow = renderShop(store);

    await pushplus({ title, content: rows.join('<br/>') + shopRow });
    return true;
  } catch (e) {
    logger.warn('新订单推送失败:', e.message);
    return false;
  }
}

/**
 * 顾客取消订单通知店主（PushPlus）
 * 事务提交后异步调用，失败不影响取消结果
 *
 * @param {{orderId:string|number, storeId:string|number, reason?:string}} param
 */
async function notifyCancelOrder({ orderId, storeId, reason }) {
  try {
    const o = await one('SELECT * FROM order_main WHERE id = ?', [orderId]);
    if (!o) return false;
    const store = await one('SELECT name FROM store WHERE id = ?', [storeId || o.store_id]);
    const user = await one('SELECT nickname, phone FROM user WHERE id = ?', [o.user_id]);
    const items = await query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [o.id]);

    const title = renderTitle(items, '订单已取消');

    const rows = [];
    // 1 订单号
    rows.push(`<b>订单号</b>：${escapeHtml(o.order_no)}`);
    // 2 商品明细
    if (items.length) {
      rows.push('<b>商品明细</b>：');
      rows.push(renderItems(items));
    }
    // 3 金额
    rows.push(`<b>金额</b>：<b style="color:#f0487e">¥${Number(o.pay_amount || 0).toFixed(2)}</b>`);
    // 4 顾客
    const customerRow = renderCustomer(user);
    if (customerRow) rows.push(customerRow);
    // 5 取消原因
    rows.push(`<b>取消原因</b>：${escapeHtml(reason || o.cancel_reason || '顾客取消')}`);
    // 6 方式
    rows.push(`<b>方式</b>：${renderType(o.order_type, o.table_no)}`);
    rows.push('<hr/>');
    // 7 门店（分隔线下方居中显示）
    const shopRow = renderShop(store);

    await pushplus({ title, content: rows.join('<br/>') + shopRow });
    return true;
  } catch (e) {
    logger.warn('取消订单推送失败:', e.message);
    return false;
  }
}

module.exports = { notifyNewOrder, notifyCancelOrder };
