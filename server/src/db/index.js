const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../common/logger');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.poolLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  // DATETIME 直接按字符串返回，避免时区漂移；BIGINT 转字符串避免 JS 精度丢失
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  decimalNumbers: false,
});

pool.on('error', (err) => logger.error('MySQL pool error:', err.message));

/** 查询多行 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** 查询单行 */
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** 查询单个标量 */
async function scalar(sql, params = [], def = 0) {
  const row = await one(sql, params);
  if (!row) return def;
  const v = Object.values(row)[0];
  return v === null || v === undefined ? def : v;
}

/** 执行写入，返回 { affectedRows, insertId } */
async function exec(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return { affectedRows: result.affectedRows, insertId: result.insertId };
}

/**
 * 数据库事务：所有订单、改单、券核销、积分变动必须在此内完成
 * @param {(conn: {query:Function, one:Function, exec:Function}) => Promise<any>} fn
 */
async function tx(fn) {
  const conn = await pool.getConnection();
  const api = {
    raw: conn,
    query: async (sql, params = []) => {
      const [rows] = await conn.execute(sql, params);
      return rows;
    },
    one: async (sql, params = []) => {
      const [rows] = await conn.execute(sql, params);
      return rows[0] || null;
    },
    exec: async (sql, params = []) => {
      const [result] = await conn.execute(sql, params);
      return { affectedRows: result.affectedRows, insertId: result.insertId };
    },
  };
  try {
    await conn.beginTransaction();
    const result = await fn(api);
    await conn.commit();
    return result;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, one, scalar, exec, tx };
