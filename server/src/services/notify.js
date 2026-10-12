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
    const title = `🔔 新${typeText}订单 ¥${amount}｜${store ? store.name : ''}`;

    const rows = [];
    rows.push(`<b>门店</b>：${escapeHtml(store ? store.name : '')}`);
    rows.push(`<b>订单号</b>：${escapeHtml(order.orderNo)}`);
    rows.push(`<b>方式</b>：${typeText}`);
    if (order.orderType === 'DINE_IN' && order.tableNo) rows.push(`<b>桌号</b>：${escapeHtml(order.tableNo)}`);
    if (order.pickupCode) rows.push(`<b>取餐码</b>：<span style="font-size:20px"><b>${escapeHtml(order.pickupCode)}</b></span>`);
    rows.push(`<b>应收金额</b>：<b style="color:#f0487e">¥${amount}</b>`);

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

    const nickname = user && user.nickname ? user.nickname : '';
    const phone = user && user.phone ? user.phone : '';
    if (nickname || phone) {
      rows.push(`<b>顾客</b>：${escapeHtml(nickname)}${phone ? `　${escapeHtml(phone)}` : ''}`);
    }
    rows.push(`<b>状态</b>：${order.status === 'ACCEPTED' ? '已自动接单，请尽快制作' : '待接单，请到店主端处理'}`);

    await pushplus({ title, content: rows.join('<br/>') });
    return true;
  } catch (e) {
    logger.warn('新订单推送失败:', e.message);
    return false;
  }
}

module.exports = { notifyNewOrder };
