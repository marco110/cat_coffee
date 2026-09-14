const { BizError, CODES } = require('../common/errors');
const { n, toCent, toYuan } = require('../utils/money');
const { json } = require('../utils/misc');

/**
 * 解析并校验购物车/订单明细，返回带快照的明细与商品金额
 * @param {object} db 数据库连接（pool 或 tx conn）
 * @param {Array} rawItems [{ dishId, quantity, specItemIds, addonIds, remark }]
 * @param {{validate?:boolean}} opt validate=false 时不校验上下架（改单新增仍需校验上架）
 */
async function resolveItems(db, storeId, rawItems, opt = { validate: true }) {
  const validate = opt.validate !== false;
  const items = [];
  for (const raw of rawItems) {
    const quantity = Math.min(99, Math.max(1, parseInt(raw.quantity, 10) || 1));
    const dish = await db.one(
      'SELECT * FROM dish WHERE id = ? AND store_id = ? AND deleted_at IS NULL',
      [raw.dishId, storeId]
    );
    if (!dish) throw new BizError(CODES.DISH_UNAVAILABLE, '菜品不存在或已删除', { dishId: raw.dishId });
    if (validate) {
      if (Number(dish.status) !== 1) {
        throw new BizError(CODES.DISH_UNAVAILABLE, `「${dish.name}」已下架，请重新选择`, { dishId: dish.id });
      }
      if (Number(dish.sold_out) === 1) {
        throw new BizError(CODES.DISH_UNAVAILABLE, `「${dish.name}」已售罄，请重新选择`, { dishId: dish.id });
      }
    }

    // 规格
    const specItemIds = (raw.specItemIds || []).map(String);
    const specSnapshot = [];
    let specExtra = 0;
    if (specItemIds.length) {
      const ph = specItemIds.map(() => '?').join(',');
      const specRows = await db.query(
        `SELECT * FROM dish_spec_item WHERE id IN (${ph}) AND dish_id = ? AND status = 1 ORDER BY sort, id`,
        [...specItemIds, dish.id]
      );
      const groupRows = await db.query(
        'SELECT * FROM dish_spec_group WHERE dish_id = ? AND status = 1 ORDER BY sort, id',
        [dish.id]
      );
      const groupMap = new Map(groupRows.map((g) => [String(g.id), g]));
      for (const it of specRows) {
        const g = groupMap.get(String(it.group_id));
        if (!g) continue;
        specExtra += n(it.extra_price);
        specSnapshot.push({
          groupId: String(g.id),
          groupName: g.name,
          itemId: String(it.id),
          itemName: it.name,
          extraPrice: n(it.extra_price),
        });
      }
      // 必选规格组校验
      for (const g of groupRows) {
        if (Number(g.is_required) !== 1) continue;
        const picked = specSnapshot.filter((s) => s.groupId === String(g.id));
        if (!picked.length) throw new BizError(CODES.BAD_PARAM, `请选择「${g.name}」`);
        if (Number(g.multi_select) !== 1 && picked.length > 1) {
          throw new BizError(CODES.BAD_PARAM, `「${g.name}」仅可选一项`);
        }
      }
    }
    const specText = specSnapshot.map((s) => s.itemName).join(' / ');

    // 加料（P2 预留）
    const addonIds = (raw.addonIds || []).map(String);
    let addonAmount = 0;
    const addons = [];
    if (addonIds.length) {
      const ph = addonIds.map(() => '?').join(',');
      const addonRows = await db.query(
        `SELECT * FROM addon WHERE id IN (${ph}) AND store_id = ? AND status = 1 AND deleted_at IS NULL`,
        [...addonIds, storeId]
      );
      for (const a of addonRows) {
        addonAmount += n(a.price);
        addons.push({ addonId: String(a.id), name: a.name, price: n(a.price) });
      }
    }

    const category = await db.one('SELECT name FROM category WHERE id = ?', [dish.category_id]);
    const unitPrice = n(dish.price) + specExtra;
    const subtotal = (unitPrice + addonAmount) * quantity;

    items.push({
      dishId: String(dish.id),
      dishName: dish.name,
      dishCover: dish.cover || '',
      categoryName: category ? category.name : '',
      unitPrice: Math.round(unitPrice * 100) / 100,
      quantity,
      specSnapshot,
      specText,
      addons,
      addonAmount: Math.round(addonAmount * 100) / 100,
      remark: raw.remark || '',
      subtotal: Math.round(subtotal * 100) / 100,
    });
  }
  const goodsAmountCents = items.reduce((sum, i) => sum + toCent(i.subtotal), 0);
  return { items, goodsAmountCents };
}

/**
 * 价格计算引擎（服务端唯一权威，前端仅回显）
 * 顺序：商品金额 → 会员折扣 → 优惠券 → 积分抵扣
 * @param {object} opt { store, member, coupon, usePoints, pointsUsed, goodsAmountCents }
 */
function computePrice(opt) {
  const { store, member, coupon, usePoints, pointsUsed, goodsAmountCents } = opt;
  const goodsCents = goodsAmountCents;

  // ① 会员折扣
  let memberCent = 0;
  let memberLevelId = null;
  let memberLevelName = null;
  let memberDiscountRate = 1;
  if (Number(store.member_enabled) === 1 && member) {
    memberLevelId = String(member.levelId);
    memberLevelName = member.levelName;
    memberDiscountRate = n(member.discountRate, 1);
    if (memberDiscountRate < 1) memberCent = Math.round(goodsCents * (1 - memberDiscountRate));
  }
  const afterMemberCents = goodsCents - memberCent;

  // ② 优惠券
  let couponCent = 0;
  let couponName = null;
  let couponUsable = true;
  let couponReason = null;
  if (coupon) {
    if (Number(store.member_discount_stackable) !== 1 && memberCent > 0) {
      couponUsable = false;
      couponReason = '会员折扣与优惠券不可叠加使用';
    } else {
      const threshold = toCent(coupon.threshold_amount);
      if (afterMemberCents < threshold) {
        couponUsable = false;
        couponReason = `订单未满 ${toYuan(threshold)} 元`;
      } else if (coupon.type === 'DISCOUNT') {
        let d = Math.round(afterMemberCents * (1 - n(coupon.discount_rate, 1)));
        const maxD = toCent(coupon.max_discount_amount);
        if (maxD > 0) d = Math.min(d, maxD);
        couponCent = Math.min(d, afterMemberCents);
      } else {
        couponCent = Math.min(toCent(coupon.discount_amount), afterMemberCents);
      }
      if (couponUsable) couponName = coupon.name;
    }
  }
  const afterCouponCents = afterMemberCents - couponCent;

  // ③ 积分抵扣
  let pointsUsedFinal = 0;
  let pointsCent = 0;
  let maxUsablePoints = 0;
  let maxDeductCents = 0;
  const ratio = Math.max(1, Number(store.points_deduct_ratio) || 100);
  const step = Math.max(1, Number(store.points_deduct_step) || 100);
  if (Number(store.points_enabled) === 1) {
    const maxRate = n(store.points_deduct_max_rate, 0);
    const limitCents = maxRate > 0 ? Math.floor((afterCouponCents * maxRate) / 100) : afterCouponCents;
    const balance = n(member && member.points, 0);
    maxUsablePoints = Math.floor(Math.min(balance, Math.floor((limitCents * ratio) / 100)) / step) * step;
    maxDeductCents = Math.floor((maxUsablePoints * 100) / ratio);
    if (usePoints) {
      const want = pointsUsed > 0 ? Number(pointsUsed) : maxUsablePoints;
      pointsUsedFinal = Math.max(0, Math.min(want, maxUsablePoints));
      pointsCent = Math.floor((pointsUsedFinal * 100) / ratio);
    }
  }

  // ④ 应付金额（最低 0.01 元）
  const payCents = Math.max(afterCouponCents - pointsCent, 1);

  const details = [{ label: '商品金额', value: toYuan(goodsCents), type: 'ADD' }];
  if (memberCent > 0) {
    details.push({
      label: `会员折扣（${(memberDiscountRate * 10).toFixed(1).replace(/\.0$/, '')}折）`,
      value: -toYuan(memberCent),
      type: 'SUB',
    });
  }
  if (couponCent > 0) {
    details.push({ label: `优惠券（${couponName || ''}）`, value: -toYuan(couponCent), type: 'SUB' });
  }
  if (pointsCent > 0) {
    details.push({ label: `积分抵扣（${pointsUsedFinal}积分）`, value: -toYuan(pointsCent), type: 'SUB' });
  }

  const detail = {
    goodsAmount: toYuan(goodsCents),
    memberLevelId,
    memberLevelName,
    memberDiscountRate,
    memberDiscount: toYuan(memberCent),
    couponId: coupon ? String(coupon.id) : null,
    userCouponId: coupon ? String(coupon.userCouponId) : null,
    couponName,
    couponDiscount: toYuan(couponCent),
    couponUsable,
    couponReason,
    pointsUsed: pointsUsedFinal,
    pointsDiscount: toYuan(pointsCent),
    payAmount: toYuan(payCents),
    details,
  };

  return {
    detail,
    cents: {
      goods: goodsCents,
      member: memberCent,
      coupon: couponCent,
      points: pointsCent,
      pay: payCents,
      afterCoupon: afterCouponCents,
    },
    pointsInfo: {
      balance: n(member && member.points, 0),
      deductRatio: ratio,
      step,
      maxUsablePoints,
      maxDeductAmount: toYuan(maxDeductCents),
    },
  };
}

/** 菜品展示销量 = 基数 + 真实销量 */
function displaySales(dish) {
  return Number(dish.base_sales || 0) + Number(dish.sales || 0);
}

/** 格式化菜品给前端（含标签、热销判断） */
function formatDish(dish, store) {
  const tags = json(dish.tags, []) || [];
  const threshold = Number(store ? store.hot_sales_threshold : 100) || 100;
  if (displaySales(dish) > threshold && !tags.includes('热销')) tags.push('热销');
  return {
    id: String(dish.id),
    categoryId: String(dish.category_id),
    name: dish.name,
    cover: dish.cover || '',
    description: dish.description || '',
    price: n(dish.price),
    originalPrice: dish.original_price === null ? null : n(dish.original_price),
    unit: dish.unit,
    sales: displaySales(dish),
    tags,
    isRecommend: Number(dish.is_recommend) === 1 ? 1 : 0,
    hasSpec: Number(dish.has_spec) === 1 ? 1 : 0,
    soldOut: Number(dish.sold_out) === 1 ? 1 : 0,
    status: Number(dish.status),
    sort: Number(dish.sort),
  };
}

module.exports = { resolveItems, computePrice, displaySales, formatDish };
