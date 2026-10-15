const { one, query } = require('../db');
const config = require('../config');
const logger = require('../common/logger');
const { pushplus, escapeHtml } = require('./push');
const { sendSubscribeMessage } = require('./wechat');

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
 * 取该门店下「已开启通知且填了 PushPlus token」的店员 token 列表
 * 消息通知与门店关联：下单选中的门店，就通知该门店的对应店员
 *
 * @param {string|number} storeId
 * @returns {Promise<string[]>}
 */
async function getStoreNotifyTokens(storeId) {
  const rows = await query(
    `SELECT pushplus_token FROM store_user
     WHERE store_id = ? AND deleted_at IS NULL AND status = 1 AND notify_enabled = 1
       AND pushplus_token IS NOT NULL AND pushplus_token <> ''`,
    [storeId]
  );
  return rows.map((r) => r.pushplus_token).filter(Boolean);
}

/**
 * 新订单通知店主（PushPlus）
 * 在事务提交后异步调用，失败不影响下单结果
 * 通知对象：该门店下开启了通知并配置了 token 的店员（与门店关联）
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
    // 6.5 备注（有备注才展示）
    if (order.remark) {
      rows.push(`<b>备注</b>：${escapeHtml(order.remark)}`);
    }
    rows.push('<hr/>');
    // 7 门店（分隔线下方居中显示）
    const shopRow = renderShop(store);

    const tokens = await getStoreNotifyTokens(storeId);
    if (!tokens.length) {
      logger.info('该门店无可接收通知的店员（未配置 token 或未开启通知），跳过推送');
      return false;
    }
    await pushplus({ title, content: rows.join('<br/>') + shopRow, tokens });
    return true;
  } catch (e) {
    logger.warn('新订单推送失败:', e.message);
    return false;
  }
}

/**
 * 顾客取消订单通知店主（PushPlus）
 * 事务提交后异步调用，失败不影响取消结果
 * 通知对象：该门店下开启了通知并配置了 token 的店员（与门店关联）
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
    // 6.5 备注（有备注才展示）
    if (o.remark) {
      rows.push(`<b>备注</b>：${escapeHtml(o.remark)}`);
    }
    rows.push('<hr/>');
    // 7 门店（分隔线下方居中显示）
    const shopRow = renderShop(store);

    const tokens = await getStoreNotifyTokens(storeId || o.store_id);
    if (!tokens.length) {
      logger.info('该门店无可接收通知的店员（未配置 token 或未开启通知），跳过推送');
      return false;
    }
    await pushplus({ title, content: rows.join('<br/>') + shopRow, tokens });
    return true;
  } catch (e) {
    logger.warn('取消订单推送失败:', e.message);
    return false;
  }
}

/**
 * 订阅消息字段裁剪：thing 类型微信限制 20 个字符，超长会被拒（errcode 47001）
 * @param {*} v 原值
 * @param {number} max 最大字符数
 */
function clip(v, max = 20) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * 取餐提醒（订阅消息，发给顾客）
 * 店主点「出品完成」后调用，模板：取餐提醒（编号 1820）
 * 字段：character_string4 取餐号码 / thing8 餐品数量 / thing5 餐品详情
 *
 * @param {{orderId:string|number}} param
 */
async function notifyPickup({ orderId }) {
  try {
    const tpl = (config.wx.subscribe || {}).pickup;
    if (!tpl) return false;

    const o = await one('SELECT * FROM order_main WHERE id = ?', [orderId]);
    if (!o) return false;

    const user = await one('SELECT openid FROM user WHERE id = ?', [o.user_id]);
    // MOCK 环境的 openid 是本地派生的，发不出去，直接跳过
    if (!user || !user.openid || String(user.openid).startsWith('mock_')) {
      logger.info('取餐提醒跳过：用户无有效 openid');
      return false;
    }

    const items = await query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [o.id]);
    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const detail = items
      .map((it) => {
        const spec = it.spec_text ? `(${it.spec_text})` : '';
        return `${it.dish_name}${spec}x${it.quantity}`;
      })
      .join(' ');

    const res = await sendSubscribeMessage({
      openid: user.openid,
      templateId: tpl,
      page: `${config.wx.subscribe.page}?id=${orderId}`,
      miniprogramState: config.wx.subscribe.state,
      data: {
        // 取餐号码：优先取餐码，堂食无取餐码时退化为订单号后 8 位
        character_string4: { value: clip(o.pickup_code || String(o.order_no || '').slice(-8), 32) },
        thing8: { value: clip(`共${totalQty}件`, 20) },
        thing5: { value: clip(detail || '餐品', 20) },
      },
    });
    return !!(res && res.errcode === 0);
  } catch (e) {
    logger.warn('取餐提醒订阅消息发送失败:', e.message);
    return false;
  }
}

module.exports = { notifyNewOrder, notifyCancelOrder, notifyPickup };
