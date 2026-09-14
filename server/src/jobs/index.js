const cron = require('node-cron');
const config = require('../config');
const db = require('../db');
const logger = require('../common/logger');
const { dateSql, addDays, nowSql } = require('../utils/time');

/** 凌晨重置沽清标记 */
async function resetSoldOut() {
  const r = await db.exec('UPDATE dish SET sold_out = 0 WHERE sold_out = 1');
  logger.info(`[cron] 重置沽清菜品：${r.affectedRows} 个`);
}

/** 过期优惠券置为已过期 */
async function expireCoupons() {
  const r = await db.exec(
    "UPDATE user_coupon SET status = 'EXPIRED', updated_at = ? WHERE status = 'UNUSED' AND expire_at IS NOT NULL AND expire_at < ?",
    [nowSql(), nowSql()]
  );
  logger.info(`[cron] 过期优惠券：${r.affectedRows} 张`);
}

/** 汇总昨日门店经营数据 */
async function buildDailyStats() {
  const day = addDays(dateSql(), -1);
  const stores = await db.query('SELECT id FROM store WHERE deleted_at IS NULL AND status = 1');
  for (const s of stores) {
    const row = await db.one(
      `SELECT COUNT(1) AS order_count, IFNULL(SUM(pay_amount),0) AS revenue,
              IFNULL(AVG(pay_amount),0) AS avg_amount
       FROM order_main WHERE store_id = ? AND status = 'COMPLETED' AND deleted_at IS NULL
         AND created_at >= ? AND created_at <= ?`,
      [s.id, `${day} 00:00:00`, `${day} 23:59:59`]
    );
    const newMember = await db.one(
      'SELECT COUNT(1) AS c FROM user_member WHERE store_id = ? AND created_at >= ? AND created_at <= ?',
      [s.id, `${day} 00:00:00`, `${day} 23:59:59`]
    );
    await db.exec(
      `INSERT INTO store_stats_daily (store_id, stat_date, order_count, revenue, avg_order_amount, new_member_count, created_at)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE order_count = VALUES(order_count), revenue = VALUES(revenue),
         avg_order_amount = VALUES(avg_order_amount), new_member_count = VALUES(new_member_count)`,
      [s.id, day, Number(row.order_count), Number(row.revenue), Math.round(Number(row.avg_amount) * 100) / 100, Number(newMember.c), nowSql()]
    );
  }
  logger.info(`[cron] 门店日统计完成：${day}，共 ${stores.length} 家门店`);
}

async function dailyJob() {
  try {
    await resetSoldOut();
    await expireCoupons();
    await buildDailyStats();
  } catch (e) {
    logger.error('[cron] 每日任务执行失败：', e.message);
  }
}

if (config.cron) {
  // 每天 00:00 执行
  cron.schedule('0 0 * * *', dailyJob, { timezone: 'Asia/Shanghai' });
  logger.info('[cron] 已注册每日任务（00:00）');
}

module.exports = { dailyJob };
