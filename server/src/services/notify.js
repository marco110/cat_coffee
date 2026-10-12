const { one, query } = require('../db');
const logger = require('../common/logger');
const { pushplus, escapeHtml } = require('./push');

const ORDER_TYPE_TEXT = { DINE_IN: '堂食', TAKEAWAY: '自取' };

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

    const amount = Number(order.payAmount || 0).toFixed(2);
    const typeText = ORDER_TYPE_TEXT[order.orderType] || '自取';
    // 标题：单品「商品名*数量-待接单」，多品「n个商品-待接单」
    const title =
      items.length === 1
        ? `${items[0].dish_name}*${items[0].quantity}-待接单`
        : `${items.length}个商品-待接单`;

    const rows = [];
    // 1 订单号
    rows.push(`<b>订单号</b>：${escapeHtml(order.orderNo)}`);
    // 2 商品明细
    if (items.length) {
      rows.push('<b>商品明细</b>：');
      rows.push(
        items
          .map((it) => {
            const spec = it.spec_text ? `（${it.spec_text}）` : '';
            const remark = it.remark ? `　备注：${it.remark}` : '';
            return `　· ${escapeHtml(it.dish_name)}${escapeHtml(spec)} x${it.quantity}　¥${Number(it.subtotal).toFixed(2)}${escapeHtml(remark)}`;
          })
          .join('<br/>')
      );
    }

    // 3 金额
    rows.push(`<b>金额</b>：<b style="color:#f0487e">¥${amount}</b>`);

    // 4 顾客
    const nickname = user && user.nickname ? user.nickname : '';
    const phone = user && user.phone ? user.phone : '';
    if (nickname || phone) {
      rows.push(`<b>顾客</b>：${escapeHtml(nickname)}${phone ? `　${escapeHtml(phone)}` : ''}`);
    }
    // 5 取餐码
    if (order.pickupCode) {
      rows.push(`<b>取餐码</b>：<span style="font-size:20px"><b>${escapeHtml(order.pickupCode)}</b></span>`);
    }
    // 6 方式
    const typeLine =
      order.orderType === 'DINE_IN' && order.tableNo ? `${typeText}　桌号 ${escapeHtml(order.tableNo)}` : typeText;
    rows.push(`<b>方式</b>：${typeLine}`);
    rows.push('<hr/>');
    // 7 门店（分隔线下方居中显示）
    const shopRow = `<div style="text-align:center"><b>${escapeHtml(store ? store.name : '')}</b></div>`;

    await pushplus({ title, content: rows.join('<br/>') + shopRow });
    return true;
  } catch (e) {
    logger.warn('新订单推送失败:', e.message);
    return false;
  }
}

module.exports = { notifyNewOrder };
