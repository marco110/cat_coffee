const { n } = require('../utils/money');
const { nowSql } = require('../utils/time');
const { json } = require('../utils/misc');

/** 获取或初始化门店会员 */
async function ensureMember(conn, userId, storeId) {
  let member = await conn.one(
    'SELECT * FROM user_member WHERE user_id = ? AND store_id = ?',
    [userId, storeId]
  );
  if (member) return member;
  const level =
    (await conn.one(
      'SELECT * FROM member_level WHERE store_id = ? AND status = 1 AND deleted_at IS NULL AND is_default = 1 ORDER BY level_value ASC LIMIT 1',
      [storeId]
    )) ||
    (await conn.one(
      'SELECT * FROM member_level WHERE store_id = ? AND status = 1 AND deleted_at IS NULL ORDER BY growth_threshold ASC, level_value ASC LIMIT 1',
      [storeId]
    ));
  if (!level) throw new Error('门店未配置会员等级，请先初始化等级');
  const res = await conn.exec(
    `INSERT INTO user_member (user_id, store_id, level_id, growth, points, total_consume, order_count, created_at, updated_at)
     VALUES (?,?,?,0,0,0,0,?,?)`,
    [userId, storeId, level.id, nowSql(), nowSql()]
  );
  member = await conn.one('SELECT * FROM user_member WHERE id = ?', [res.insertId]);
  return member;
}

/** 会员 + 当前等级 */
async function getMemberInfo(conn, userId, storeId) {
  const member = await ensureMember(conn, userId, storeId);
  const level = await conn.one('SELECT * FROM member_level WHERE id = ?', [member.level_id]);
  return {
    member,
    level,
    levelId: String(member.level_id),
    levelName: level ? level.name : '普通会员',
    discountRate: level ? n(level.discount, 1) : 1,
    points: Number(member.points),
    growth: Number(member.growth),
  };
}

/** 会员升级判定 */
async function upgradeLevel(conn, member, storeId) {
  const level = await conn.one(
    `SELECT * FROM member_level WHERE store_id = ? AND status = 1 AND deleted_at IS NULL
     AND growth_threshold <= ? ORDER BY growth_threshold DESC, level_value DESC LIMIT 1`,
    [storeId, member.growth]
  );
  if (level && String(level.id) !== String(member.level_id)) {
    await conn.exec('UPDATE user_member SET level_id = ?, updated_at = ? WHERE id = ?', [
      level.id,
      nowSql(),
      member.id,
    ]);
    return level;
  }
  return null;
}

/** 订单完成结算：成长值 + 积分 + 累计消费 + 升级 + 菜品销量 */
async function settleOrder(conn, order, store) {
  if (Number(order.settled) === 1) return;
  const member = await ensureMember(conn, order.user_id, order.store_id);
  const payAmount = n(order.pay_amount);
  const growth = Number(store.member_enabled) === 1 ? Math.floor(payAmount * n(store.growth_rate, 1)) : 0;
  const pointsEarned =
    Number(store.points_enabled) === 1 ? Math.floor(payAmount * n(store.points_rate, 1)) : 0;

  const newPoints = Number(member.points) + pointsEarned;
  await conn.exec(
    `UPDATE user_member SET growth = growth + ?, points = ?, total_consume = total_consume + ?,
      order_count = order_count + 1, last_order_at = ?, updated_at = ? WHERE id = ?`,
    [growth, newPoints, payAmount, order.created_at, nowSql(), member.id]
  );

  if (pointsEarned > 0) {
    await conn.exec(
      `INSERT INTO points_log (user_id, store_id, type, points, balance, source_type, source_id, remark, created_at)
       VALUES (?,?, 'EARN', ?, ?, 'ORDER', ?, ?, ?)`,
      [order.user_id, order.store_id, pointsEarned, newPoints, order.id, `订单 ${order.order_no} 消费获得`, nowSql()]
    );
  }

  const updatedMember = await conn.one('SELECT * FROM user_member WHERE id = ?', [member.id]);
  await upgradeLevel(conn, updatedMember, order.store_id);

  // 菜品真实销量累加
  const items = await conn.query('SELECT * FROM order_item WHERE order_id = ?', [order.id]);
  for (const it of items) {
    await conn.exec('UPDATE dish SET sales = sales + ? WHERE id = ? AND store_id = ?', [
      it.quantity,
      it.dish_id,
      order.store_id,
    ]);
  }

  await conn.exec('UPDATE order_main SET settled = 1, growth_earned = ?, points_earned = ? WHERE id = ?', [
    growth,
    pointsEarned,
    order.id,
  ]);
}

/** 取消 / 拒单：退回积分与优惠券 */
async function refundOrderAssets(conn, order) {
  if (Number(order.points_used) > 0) {
    const member = await conn.one('SELECT * FROM user_member WHERE user_id = ? AND store_id = ?', [
      order.user_id,
      order.store_id,
    ]);
    if (member) {
      const balance = Number(member.points) + Number(order.points_used);
      await conn.exec('UPDATE user_member SET points = ?, updated_at = ? WHERE id = ?', [
        balance,
        nowSql(),
        member.id,
      ]);
      await conn.exec(
        `INSERT INTO points_log (user_id, store_id, type, points, balance, source_type, source_id, remark, created_at)
         VALUES (?,?, 'REFUND', ?, ?, 'ORDER', ?, ?, ?)`,
        [
          order.user_id,
          order.store_id,
          Number(order.points_used),
          balance,
          order.id,
          `订单 ${order.order_no} 取消退回`,
          nowSql(),
        ]
      );
    }
  }
  if (order.user_coupon_id) {
    await conn.exec(
      "UPDATE user_coupon SET status = 'UNUSED', order_id = NULL, used_at = NULL, updated_at = ? WHERE id = ? AND status = 'USED'",
      [nowSql(), order.user_coupon_id]
    );
    await conn.exec('UPDATE coupon SET used_count = GREATEST(used_count - 1, 0) WHERE id = (SELECT coupon_id FROM (SELECT coupon_id FROM user_coupon WHERE id = ?) t)', [order.user_coupon_id]);
  }
}

/** 手动调整积分 / 成长值 */
async function adjustPoints(conn, { userId, storeId, points, growth, remark, operatorId }) {
  const member = await ensureMember(conn, userId, storeId);
  const balance = Math.max(0, Number(member.points) + Number(points || 0));
  await conn.exec(
    `UPDATE user_member SET points = ?, growth = GREATEST(growth + ?, 0), updated_at = ? WHERE id = ?`,
    [balance, Number(growth || 0), nowSql(), member.id]
  );
  if (Number(points || 0) !== 0) {
    await conn.exec(
      `INSERT INTO points_log (user_id, store_id, type, points, balance, source_type, source_id, remark, operator_id, created_at)
       VALUES (?,?, 'ADMIN', ?, ?, 'ADMIN', NULL, ?, ?, ?)`,
      [userId, storeId, Number(points), balance, remark || '店主手动调整', operatorId || null, nowSql()]
    );
  }
  const updated = await conn.one('SELECT * FROM user_member WHERE id = ?', [member.id]);
  await upgradeLevel(conn, updated, storeId);
  return balance;
}

module.exports = { ensureMember, getMemberInfo, upgradeLevel, settleOrder, refundOrderAssets, adjustPoints, json };
