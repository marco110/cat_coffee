const { dateSql } = require('../utils/time');

/**
 * 取餐码 / 订单序号：按 (store_id, biz_type, seq_date) 原子自增
 * 必须在事务内调用，保证并发安全
 */
async function nextSeq(conn, storeId, bizType = 'PICKUP_CODE') {
  const day = dateSql();
  await conn.exec(
    `INSERT INTO daily_sequence (store_id, biz_type, seq_date, current_value)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE current_value = current_value + 1`,
    [storeId, bizType, day]
  );
  const row = await conn.one(
    'SELECT current_value FROM daily_sequence WHERE store_id = ? AND biz_type = ? AND seq_date = ?',
    [storeId, bizType, day]
  );
  return Number(row ? row.current_value : 1);
}

/** 取餐码：前缀 + 3 位当日序号（超过 999 自动扩位） */
async function nextPickupCode(conn, storeId, prefix = 'A') {
  const seq = await nextSeq(conn, storeId, 'PICKUP_CODE');
  const s = String(seq);
  return `${prefix || 'A'}${s.length >= 3 ? s : s.padStart(3, '0')}`;
}

module.exports = { nextSeq, nextPickupCode };
