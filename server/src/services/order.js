const { tx, one, query } = require('../db');
const { BizError, CODES } = require('../common/errors');
const { n, toCent, toYuan } = require('../utils/money');
const { nowSql, waitedMinutes } = require('../utils/time');
const { json, sid, buildOrderNo } = require('../utils/misc');
const { resolveItems, computePrice } = require('./price');
const { nextPickupCode } = require('./sequence');
const memberService = require('./member');

const STATUS_TEXT = {
  PENDING: '待接单',
  ACCEPTED: '已接单',
  MAKING: '制作中',
  READY: '待取餐',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REJECTED: '已拒单',
};

const PAY_STATUS_TEXT = { UNPAID: '待收款', PAID: '已收款' };

/** 数据库存北京时间字符串，转时间戳比较 */
function expireTs(sqlTime) {
  return new Date(`${String(sqlTime).replace(' ', 'T')}Z`).getTime() - 8 * 3600 * 1000;
}

const TIMELINE_TITLE = {
  CREATE: '已下单',
  ACCEPT: '店主已接单',
  REJECT: '店主已拒单',
  MAKE: '开始制作',
  READY: '出品完成',
  COMPLETE: '交易完成',
  CANCEL: '订单已取消',
  PAY: '已收款',
  MODIFY: '店主已改单',
};

/** 订单状态机：当前状态 -> 允许的动作 -> 目标状态 */
const TRANSITIONS = {
  PENDING: { ACCEPT: 'ACCEPTED', REJECT: 'REJECTED', CANCEL: 'CANCELLED' },
  ACCEPTED: { MAKE: 'MAKING', CANCEL: 'CANCELLED' },
  MAKING: { READY: 'READY' },
  READY: { COMPLETE: 'COMPLETED', CANCEL: 'CANCELLED' },
};

const STATUS_FIELDS = {
  ACCEPTED: 'accepted_at',
  MAKING: 'making_at',
  READY: 'ready_at',
  COMPLETED: 'completed_at',
  CANCELLED: 'cancelled_at',
  REJECTED: 'cancelled_at',
};

function orderTimeline(logs) {
  return logs
    .filter((l) => TIMELINE_TITLE[l.action])
    .map((l) => ({
      action: l.action,
      title: TIMELINE_TITLE[l.action],
      time: l.created_at,
      remark: l.remark || '',
    }));
}

function orderButtons(order, viewer) {
  const s = order.status;
  if (viewer === 'CUSTOMER') {
    if (s === 'PENDING') return ['CANCEL'];
    if (s === 'ACCEPTED' || s === 'MAKING') return ['URGE'];
    if (s === 'READY') return [];
    if (s === 'COMPLETED') return ['REORDER'];
    return [];
  }
  if (viewer === 'MERCHANT') {
    switch (s) {
      case 'PENDING':
        return ['ACCEPT', 'REJECT', 'MODIFY', 'PAY', 'CANCEL'];
      case 'ACCEPTED':
        return ['MAKE', 'MODIFY', 'CANCEL', 'PAY'];
      case 'MAKING':
        return ['READY', 'MODIFY', 'PAY'];
      case 'READY':
        return ['COMPLETE', 'MODIFY', 'PAY'];
      case 'COMPLETED':
        return order.pay_status === 'UNPAID' ? ['PAY'] : [];
      default:
        return [];
    }
  }
  return [];
}

/** 组装订单详情 VO（顾客端 / 店主端 / 后台共用） */
async function buildOrderVO(db, order, viewer = 'CUSTOMER') {
  const store = await db.one('SELECT id, name, logo, phone FROM store WHERE id = ?', [order.store_id]);
  const items = await db.query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [order.id]);
  const logs = await db.query('SELECT * FROM order_log WHERE order_id = ? ORDER BY id ASC', [order.id]);
  let modifyNotice = null;
  if (Number(order.modify_count) > 0) {
    const last = await db.one(
      'SELECT * FROM order_modify_log WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [order.id]
    );
    if (last) modifyNotice = last.change_summary || '店主已调整菜品，请查看最新金额';
  }

  const details = [{ label: '商品金额', value: n(order.goods_amount), type: 'ADD' }];
  if (n(order.member_discount_amount) > 0) {
    details.push({
      label: `会员折扣（${(n(order.member_discount_rate, 1) * 10).toFixed(1).replace(/\.0$/, '')}折）`,
      value: -n(order.member_discount_amount),
      type: 'SUB',
    });
  }
  if (n(order.coupon_discount_amount) > 0) {
    details.push({ label: `优惠券（${order.coupon_name || ''}）`, value: -n(order.coupon_discount_amount), type: 'SUB' });
  }
  if (n(order.points_discount_amount) > 0) {
    details.push({ label: `积分抵扣（${order.points_used}积分）`, value: -n(order.points_discount_amount), type: 'SUB' });
  }

  return {
    id: sid(order.id),
    orderNo: order.order_no,
    storeId: sid(order.store_id),
    storeName: store ? store.name : '',
    storePhone: store ? store.phone : '',
    orderType: order.order_type,
    tableId: sid(order.table_id),
    tableNo: order.table_no,
    pickupCode: order.pickup_code,
    peopleCount: Number(order.people_count),
    status: order.status,
    statusText: STATUS_TEXT[order.status] || order.status,
    payStatus: order.pay_status,
    payStatusText: PAY_STATUS_TEXT[order.pay_status] || order.pay_status,
    payMethod: '到店付款',
    items: items.map((it) => ({
      id: sid(it.id),
      dishId: sid(it.dish_id),
      dishName: it.dish_name,
      dishCover: it.dish_cover,
      unitPrice: n(it.unit_price),
      quantity: Number(it.quantity),
      specText: it.spec_text || '',
      specSnapshot: json(it.spec_snapshot, []),
      addons: json(it.addons, []),
      remark: it.remark || '',
      subtotal: n(it.subtotal),
    })),
    itemCount: Number(order.item_count),
    priceDetail: {
      goodsAmount: n(order.goods_amount),
      memberLevelName: order.member_level_name,
      memberDiscountRate: n(order.member_discount_rate, 1),
      memberDiscount: n(order.member_discount_amount),
      couponName: order.coupon_name,
      couponDiscount: n(order.coupon_discount_amount),
      pointsUsed: Number(order.points_used),
      pointsDiscount: n(order.points_discount_amount),
      payAmount: n(order.pay_amount),
      details,
    },
    remark: order.remark || '',
    modifyCount: Number(order.modify_count),
    modifyNotice,
    timeline: orderTimeline(logs),
    buttons: orderButtons(order, viewer),
    payInfo: {
      paidAmount: n(order.pay_amount),
      paidAt: order.paid_at,
      refundAmount: n(order.refund_amount),
    },
    cancelReason: order.cancel_reason || '',
    waitedMinutes: waitedMinutes(order.created_at),
    createdAt: order.created_at,
    acceptedAt: order.accepted_at,
    makingAt: order.making_at,
    readyAt: order.ready_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
  };
}

/** 提交订单 */
async function createOrder({ userId, storeId, body }) {
  return tx(async (conn) => {
    const store = await conn.one(
      'SELECT * FROM store WHERE id = ? AND deleted_at IS NULL',
      [storeId]
    );
    if (!store || Number(store.status) !== 1) throw new BizError(CODES.NOT_FOUND, '门店不存在');
    if (Number(store.business_status) !== 1) throw new BizError(CODES.STORE_CLOSED, '门店休息中，暂不可下单');

    const orderType = body.orderType === 'TAKEAWAY' ? 'TAKEAWAY' : 'DINE_IN';
    if (orderType === 'DINE_IN' && Number(store.allow_dine_in) !== 1) {
      throw new BizError(CODES.BAD_PARAM, '本店暂未开放堂食');
    }
    if (orderType === 'TAKEAWAY' && Number(store.allow_takeaway) !== 1) {
      throw new BizError(CODES.BAD_PARAM, '本店暂未开放打包');
    }

    // 桌号校验
    let table = null;
    if (orderType === 'DINE_IN') {
      if (!body.tableId) throw new BizError(CODES.TABLE_INVALID, '请选择桌号');
      table = await conn.one(
        'SELECT * FROM table_info WHERE id = ? AND store_id = ? AND deleted_at IS NULL',
        [body.tableId, storeId]
      );
      if (!table || Number(table.status) !== 1) {
        throw new BizError(CODES.TABLE_INVALID, '桌号无效或已停用，请重新选择');
      }
    }

    // 菜品
    const { items, goodsAmountCents } = await resolveItems(conn, storeId, body.items || []);
    if (!items.length) throw new BizError(CODES.BAD_PARAM, '请先选择商品');

    // 会员
    const mInfo = await memberService.getMemberInfo(conn, userId, storeId);
    const member = {
      levelId: mInfo.levelId,
      levelName: mInfo.levelName,
      discountRate: mInfo.discountRate,
      points: mInfo.points,
    };

    // 优惠券
    let coupon = null;
    if (body.userCouponId) {
      const uc = await conn.one(
        `SELECT uc.*, c.name, c.type, c.threshold_amount, c.discount_amount, c.discount_rate,
                c.max_discount_amount, c.status AS coupon_status, c.deleted_at AS coupon_deleted
         FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id
         WHERE uc.id = ? AND uc.user_id = ? AND uc.store_id = ?`,
        [body.userCouponId, userId, storeId]
      );
      if (!uc) throw new BizError(CODES.COUPON_UNAVAILABLE, '优惠券不存在');
      if (uc.status !== 'UNUSED') throw new BizError(CODES.COUPON_UNAVAILABLE, '优惠券已使用');
      if (uc.coupon_deleted || uc.coupon_status !== 'RUNNING') {
        throw new BizError(CODES.COUPON_UNAVAILABLE, '优惠券不可用');
      }
      if (uc.expire_at && expireTs(uc.expire_at) < Date.now()) {
        throw new BizError(CODES.COUPON_UNAVAILABLE, '优惠券已过期');
      }
      coupon = { ...uc, userCouponId: uc.id, id: uc.coupon_id };
    }

    // 价格（预计算一次，确认券可用）
    const preview = computePrice({
      store,
      member,
      coupon,
      usePoints: !!body.usePoints,
      pointsUsed: Number(body.pointsUsed || 0),
      goodsAmountCents,
    });
    if (coupon && !preview.detail.couponUsable) {
      throw new BizError(CODES.COUPON_UNAVAILABLE, preview.detail.couponReason || '优惠券不可用');
    }
    if (body.usePoints && body.pointsUsed && Number(body.pointsUsed) > preview.pointsInfo.maxUsablePoints) {
      throw new BizError(CODES.POINTS_NOT_ENOUGH, '积分不足或超出抵扣上限');
    }

    const c = preview.cents;
    const orderNo = buildOrderNo(storeId);
    const pickupCode =
      orderType === 'TAKEAWAY' ? await nextPickupCode(conn, storeId, store.pickup_code_prefix) : null;
    const now = nowSql();
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    const autoAccept = Number(store.auto_accept_order) === 1;
    const status = autoAccept ? 'ACCEPTED' : 'PENDING';

    const ins = await conn.exec(
      `INSERT INTO order_main
       (order_no, store_id, user_id, user_phone, order_type, table_id, table_no, pickup_code, people_count,
        status, pay_status, goods_amount, member_level_id, member_level_name, member_discount_rate,
        member_discount_amount, user_coupon_id, coupon_name, coupon_discount_amount,
        points_used, points_discount_amount, pay_amount, remark, item_count, modify_count,
        accepted_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        orderNo,
        storeId,
        userId,
        body.phone || null,
        orderType,
        table ? table.id : null,
        table ? table.table_no : null,
        pickupCode,
        Number(body.peopleCount || 1),
        status,
        'UNPAID',
        toYuan(c.goods),
        member.levelId,
        member.levelName,
        member.discountRate,
        toYuan(c.member),
        coupon ? coupon.userCouponId : null,
        coupon ? coupon.name : null,
        toYuan(c.coupon),
        preview.detail.pointsUsed,
        toYuan(c.points),
        toYuan(c.pay),
        body.remark || '',
        itemCount,
        0,
        autoAccept ? now : null,
        now,
        now,
      ]
    );
    const orderId = ins.insertId;

    for (const it of items) {
      await conn.exec(
        `INSERT INTO order_item
         (order_id, store_id, dish_id, dish_name, dish_cover, category_name, unit_price, quantity,
          spec_snapshot, spec_text, addons, addon_amount, remark, subtotal, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          orderId,
          storeId,
          it.dishId,
          it.dishName,
          it.dishCover,
          it.categoryName,
          it.unitPrice,
          it.quantity,
          JSON.stringify(it.specSnapshot),
          it.specText,
          JSON.stringify(it.addons),
          it.addonAmount,
          it.remark,
          it.subtotal,
          now,
          now,
        ]
      );
    }

    await addOrderLog(conn, {
      orderId,
      storeId,
      action: 'CREATE',
      fromStatus: null,
      toStatus: status,
      operatorType: 'CUSTOMER',
      operatorId: userId,
      remark: '',
      createdAt: now,
    });
    if (autoAccept) {
      await addOrderLog(conn, {
        orderId,
        storeId,
        action: 'ACCEPT',
        fromStatus: 'PENDING',
        toStatus: 'ACCEPTED',
        operatorType: 'SYSTEM',
        operatorId: null,
        remark: '系统自动接单',
        createdAt: now,
      });
    }

    // 占用优惠券
    if (coupon) {
      await conn.exec("UPDATE user_coupon SET status='USED', order_id=?, updated_at=? WHERE id=?", [
        orderId,
        now,
        coupon.userCouponId,
      ]);
    }
    // 扣减积分
    if (preview.detail.pointsUsed > 0) {
      const m = await conn.one('SELECT * FROM user_member WHERE user_id = ? AND store_id = ?', [userId, storeId]);
      const balance = Math.max(0, Number(m.points) - preview.detail.pointsUsed);
      await conn.exec('UPDATE user_member SET points = ?, updated_at = ? WHERE id = ?', [balance, now, m.id]);
      await conn.exec(
        `INSERT INTO points_log (user_id, store_id, type, points, balance, source_type, source_id, remark, created_at)
         VALUES (?,?, 'DEDUCT', ?, ?, 'ORDER', ?, ?, ?)`,
        [userId, storeId, -preview.detail.pointsUsed, balance, orderId, `订单 ${orderNo} 积分抵扣`, now]
      );
    }

    const tip =
      orderType === 'DINE_IN'
        ? `下单成功！桌号 ${table ? table.table_no : ''}，请稍候`
        : `下单成功！取餐码 ${pickupCode}，请留意叫号`;

    return {
      orderId: sid(orderId),
      orderNo,
      orderType,
      tableNo: table ? table.table_no : null,
      pickupCode,
      payAmount: toYuan(c.pay),
      status,
      payStatus: 'UNPAID',
      tip,
    };
  });
}

async function addOrderLog(conn, { orderId, storeId, action, fromStatus, toStatus, operatorType, operatorId, operatorName, remark, createdAt }) {
  await conn.exec(
    `INSERT INTO order_log (order_id, store_id, action, from_status, to_status, operator_type, operator_id, operator_name, remark, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [orderId, storeId, action, fromStatus, toStatus, operatorType, operatorId || null, operatorName || null, remark || '', createdAt || nowSql()]
  );
}

async function getOrderForMerchant(conn, orderId, storeId) {
  const order = await conn.one(
    'SELECT * FROM order_main WHERE id = ? AND store_id = ? AND deleted_at IS NULL',
    [orderId, storeId]
  );
  if (!order) throw new BizError(CODES.NOT_FOUND, '订单不存在');
  return order;
}

/** 状态流转（服务端唯一入口，非法流转返回 1004） */
async function transition({ orderId, storeId, action, operatorType = 'MERCHANT', operatorId = null, operatorName = '', extra = {} }) {
  return tx(async (conn) => {
    const order = await getOrderForMerchant(conn, orderId, storeId);
    const allow = TRANSITIONS[order.status] || {};
    const toStatus = allow[action];
    if (!toStatus) {
      throw new BizError(CODES.ORDER_STATUS_INVALID, '当前订单状态不支持该操作，请刷新后重试', {
        currentStatus: order.status,
      });
    }
    const now = nowSql();
    const field = STATUS_FIELDS[toStatus];
    await conn.exec(
      `UPDATE order_main SET status = ?, ${field} = ?, updated_at = ? WHERE id = ?`,
      [toStatus, now, now, orderId]
    );

    if (action === 'CANCEL' || action === 'REJECT') {
      await conn.exec('UPDATE order_main SET cancel_reason = ?, cancelled_by = ? WHERE id = ?', [
        extra.reason || '',
        operatorType === 'CUSTOMER' ? 'CUSTOMER' : 'MERCHANT',
        orderId,
      ]);
      await memberService.refundOrderAssets(conn, order);
    }

    if (action === 'COMPLETE') {
      const store = await conn.one('SELECT * FROM store WHERE id = ?', [storeId]);
      const fresh = await conn.one('SELECT * FROM order_main WHERE id = ?', [orderId]);
      await memberService.settleOrder(conn, fresh, store);
      if (fresh.user_coupon_id) {
        await conn.exec("UPDATE user_coupon SET used_at = ?, updated_at = ? WHERE id = ?", [now, now, fresh.user_coupon_id]);
        await conn.exec(
          'UPDATE coupon SET used_count = used_count + 1 WHERE id = (SELECT coupon_id FROM (SELECT coupon_id FROM user_coupon WHERE id = ?) t)',
          [fresh.user_coupon_id]
        );
      }
    }

    await addOrderLog(conn, {
      orderId,
      storeId,
      action,
      fromStatus: order.status,
      toStatus,
      operatorType,
      operatorId,
      operatorName,
      remark: extra.reason || extra.remark || '',
      createdAt: now,
    });

    const updated = await conn.one('SELECT * FROM order_main WHERE id = ?', [orderId]);
    return { status: updated.status, [field]: updated[field], order: updated };
  });
}

/** 标记已收款 */
async function markPaid({ orderId, storeId, operatorId, paidAmount, remark }) {
  return tx(async (conn) => {
    const order = await getOrderForMerchant(conn, orderId, storeId);
    if (order.pay_status === 'PAID') throw new BizError(CODES.CONFLICT, '该订单已收款');
    const now = nowSql();
    const amount = paidAmount === undefined || paidAmount === null ? n(order.pay_amount) : n(paidAmount);
    await conn.exec(
      "UPDATE order_main SET pay_status = 'PAID', paid_at = ?, paid_by = ?, pay_amount = ?, updated_at = ? WHERE id = ?",
      [now, operatorId, amount, now, orderId]
    );
    await addOrderLog(conn, {
      orderId,
      storeId,
      action: 'PAY',
      fromStatus: 'UNPAID',
      toStatus: 'PAID',
      operatorType: 'MERCHANT',
      operatorId,
      remark: remark || '到店付款',
      createdAt: now,
    });
    return { payStatus: 'PAID', paidAt: now, paidAmount: amount };
  });
}

/** 改单：明细增删改 + 金额重算 + 日志，全部在同一事务内 */
async function modifyOrder({ orderId, storeId, operatorId, operatorName, body }) {
  return tx(async (conn) => {
    const order = await getOrderForMerchant(conn, orderId, storeId);
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
      throw new BizError(CODES.ORDER_STATUS_INVALID, '该订单当前状态不支持改单');
    }
    const store = await conn.one('SELECT * FROM store WHERE id = ?', [storeId]);
    const oldItems = await conn.query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [order.id]);
    const before = {
      items: oldItems.map((i) => ({ name: i.dish_name, quantity: i.quantity, subtotal: n(i.subtotal) })),
      payAmount: n(order.pay_amount),
    };
    const now = nowSql();

    // 1. 处理已有明细（改数量 / 改备注 / 删除）
    const inputItems = body.items || [];
    let addedCount = 0;
    let removedCount = 0;
    let changedCount = 0;
    const touchedIds = new Set();
    for (const raw of inputItems) {
      if (!raw.orderItemId) continue;
      touchedIds.add(String(raw.orderItemId));
      const exist = oldItems.find((i) => String(i.id) === String(raw.orderItemId));
      if (!exist) continue;
      const qty = parseInt(raw.quantity, 10);
      if (qty === 0) {
        await conn.exec('DELETE FROM order_item WHERE id = ? AND order_id = ?', [exist.id, order.id]);
        removedCount += 1;
        continue;
      }
      const newQty = Math.min(99, Math.max(1, qty));
      const remark = raw.remark === undefined ? exist.remark : raw.remark;
      if (Number(exist.quantity) !== newQty || (exist.remark || '') !== (remark || '')) changedCount += 1;
      const subtotal = (n(exist.unit_price) + n(exist.addon_amount)) * newQty;
      await conn.exec('UPDATE order_item SET quantity = ?, remark = ?, subtotal = ?, updated_at = ? WHERE id = ?', [
        newQty,
        remark || '',
        Math.round(subtotal * 100) / 100,
        now,
        exist.id,
      ]);
    }

    // 2. 新增菜品
    const newRawItems = inputItems.filter((i) => !i.orderItemId && i.dishId);
    if (newRawItems.length) {
      const { items } = await resolveItems(conn, storeId, newRawItems);
      for (const it of items) {
        await conn.exec(
          `INSERT INTO order_item
           (order_id, store_id, dish_id, dish_name, dish_cover, category_name, unit_price, quantity,
            spec_snapshot, spec_text, addons, addon_amount, remark, subtotal, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            order.id,
            storeId,
            it.dishId,
            it.dishName,
            it.dishCover,
            it.categoryName,
            it.unitPrice,
            it.quantity,
            JSON.stringify(it.specSnapshot),
            it.specText,
            JSON.stringify(it.addons),
            it.addonAmount,
            it.remark,
            it.subtotal,
            now,
            now,
          ]
        );
        addedCount += 1;
      }
    }

    // 3. 订单类型 / 桌号
    let tableNo = order.table_no;
    let tableId = order.table_id;
    let pickupCode = order.pickup_code;
    let orderType = order.order_type;
    if (body.orderType && body.orderType !== order.order_type) {
      orderType = body.orderType;
      if (orderType === 'TAKEAWAY') {
        tableId = null;
        tableNo = null;
        pickupCode = await nextPickupCode(conn, storeId, store.pickup_code_prefix);
      } else {
        pickupCode = null;
        if (body.tableId) {
          const t = await conn.one(
            'SELECT * FROM table_info WHERE id = ? AND store_id = ? AND deleted_at IS NULL AND status = 1',
            [body.tableId, storeId]
          );
          if (!t) throw new BizError(CODES.TABLE_INVALID, '桌号无效，请重新选择');
          tableId = t.id;
          tableNo = t.table_no;
        }
      }
    }

    // 4. 重新计算金额
    const finalItems = await conn.query('SELECT * FROM order_item WHERE order_id = ? ORDER BY id', [order.id]);
    if (!finalItems.length) throw new BizError(CODES.BAD_PARAM, '订单至少需要保留一个菜品');
    const goodsAmountCents = finalItems.reduce((s, i) => s + toCent((n(i.unit_price) + n(i.addon_amount)) * Number(i.quantity)), 0);

    const mInfo = await memberService.getMemberInfo(conn, order.user_id, storeId);
    const member = {
      levelId: mInfo.levelId,
      levelName: mInfo.levelName,
      discountRate: mInfo.discountRate,
      points: mInfo.points + Number(order.points_used), // 下单已扣减，计算上限时还原
    };

    let coupon = null;
    let couponRevalidated = true;
    if (order.user_coupon_id) {
      const uc = await conn.one(
        `SELECT uc.*, c.name, c.type, c.threshold_amount, c.discount_amount, c.discount_rate, c.max_discount_amount
         FROM user_coupon uc JOIN coupon c ON c.id = uc.coupon_id WHERE uc.id = ?`,
        [order.user_coupon_id]
      );
      if (uc) coupon = { ...uc, userCouponId: uc.id, id: uc.coupon_id };
    }

    const needPoints = Number(order.points_used) > 0;
    const result = computePrice({
      store,
      member,
      coupon,
      usePoints: needPoints,
      pointsUsed: Number(order.points_used),
      goodsAmountCents,
    });
    if (coupon && !result.detail.couponUsable) couponRevalidated = false;
    const c = result.cents;
    const after = {
      items: finalItems.map((i) => ({ name: i.dish_name, quantity: Number(i.quantity), subtotal: n(i.subtotal) })),
      payAmount: toYuan(c.pay),
    };

    // 券失效：释放回未使用
    if (!couponRevalidated && order.user_coupon_id) {
      await conn.exec("UPDATE user_coupon SET status='UNUSED', order_id=NULL, updated_at=? WHERE id=?", [
        now,
        order.user_coupon_id,
      ]);
    }

    // 积分超出部分回退
    if (Number(order.points_used) > result.detail.pointsUsed) {
      const back = Number(order.points_used) - result.detail.pointsUsed;
      const m = await conn.one('SELECT * FROM user_member WHERE user_id = ? AND store_id = ?', [order.user_id, storeId]);
      const balance = Number(m.points) + back;
      await conn.exec('UPDATE user_member SET points = ?, updated_at = ? WHERE id = ?', [balance, now, m.id]);
      await conn.exec(
        `INSERT INTO points_log (user_id, store_id, type, points, balance, source_type, source_id, remark, created_at)
         VALUES (?,?, 'REFUND', ?, ?, 'ORDER', ?, ?, ?)`,
        [order.user_id, storeId, back, balance, order.id, '改单后积分抵扣超限自动退回', now]
      );
    }

    const itemCount = finalItems.reduce((s, i) => s + Number(i.quantity), 0);
    const amountBefore = n(order.pay_amount);
    const amountAfter = toYuan(c.pay);
    const amountChange = Math.round((amountAfter - amountBefore) * 100) / 100;
    const needRefund = amountChange < 0 && order.pay_status === 'PAID' ? Math.abs(amountChange) : 0;

    await conn.exec(
      `UPDATE order_main SET
        goods_amount = ?, member_discount_amount = ?, member_level_name = ?, member_discount_rate = ?,
        user_coupon_id = ?, coupon_name = ?, coupon_discount_amount = ?,
        points_used = ?, points_discount_amount = ?, pay_amount = ?, item_count = ?,
        order_type = ?, table_id = ?, table_no = ?, pickup_code = ?, remark = ?,
        modify_count = modify_count + 1, updated_at = ?
       WHERE id = ?`,
      [
        toYuan(c.goods),
        toYuan(c.member),
        result.detail.memberLevelName,
        result.detail.memberDiscountRate,
        couponRevalidated && coupon ? coupon.userCouponId : null,
        couponRevalidated && coupon ? coupon.name : null,
        couponRevalidated ? toYuan(c.coupon) : 0,
        result.detail.pointsUsed,
        toYuan(c.points),
        amountAfter,
        itemCount,
        orderType,
        tableId,
        tableNo,
        pickupCode,
        body.remark === undefined ? order.remark : body.remark,
        now,
        order.id,
      ]
    );

    const summaryParts = [];
    if (addedCount) summaryParts.push(`新增 ${addedCount} 项`);
    if (removedCount) summaryParts.push(`删除 ${removedCount} 项`);
    if (changedCount) summaryParts.push(`调整 ${changedCount} 项`);
    const changeSummary =
      (summaryParts.join('、') || '订单信息已更新') + `，共 ${itemCount} 件，最新金额 ¥${amountAfter.toFixed(2)}`;

    await conn.exec(
      `INSERT INTO order_modify_log
       (order_id, store_id, operator_type, operator_id, operator_name, modify_type, before_snapshot, after_snapshot,
        change_summary, amount_before, amount_after, amount_change, need_refund, remark, created_at)
       VALUES (?,?, 'MERCHANT', ?,?, 'MIXED', ?,?,?,?,?,?,?,?,?)`,
      [
        order.id,
        storeId,
        operatorId,
        operatorName,
        JSON.stringify(before),
        JSON.stringify(after),
        changeSummary,
        amountBefore,
        amountAfter,
        amountChange,
        needRefund,
        body.modifyReason || '',
        now,
      ]
    );
    await addOrderLog(conn, {
      orderId,
      storeId,
      action: 'MODIFY',
      fromStatus: order.status,
      toStatus: order.status,
      operatorType: 'MERCHANT',
      operatorId,
      operatorName,
      remark: body.modifyReason || changeSummary,
      createdAt: now,
    });

    return {
      orderId: sid(order.id),
      amountBefore,
      amountAfter,
      amountChange,
      needRefund,
      priceDetail: {
        goodsAmount: toYuan(c.goods),
        memberDiscount: toYuan(c.member),
        couponDiscount: couponRevalidated ? toYuan(c.coupon) : 0,
        pointsDiscount: toYuan(c.points),
        pointsUsed: result.detail.pointsUsed,
        payAmount: amountAfter,
        details: result.detail.details,
      },
      changeSummary,
      couponRevalidated,
    };
  });
}

module.exports = {
  STATUS_TEXT,
  PAY_STATUS_TEXT,
  TIMELINE_TITLE,
  TRANSITIONS,
  buildOrderVO,
  orderButtons,
  createOrder,
  transition,
  markPaid,
  modifyOrder,
  getOrderForMerchant,
  addOrderLog,
};
