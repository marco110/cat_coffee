/**
 * 初始化数据库：执行 server/sql/schema.sql
 * 用法：npm run init-db
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const SQL_FILE = path.join(__dirname, '..', 'sql', 'schema.sql');

async function main() {
  // 去掉整行注释，避免注释中的特殊符号被当作 SQL 解析
  const sql = fs
    .readFileSync(SQL_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  console.log('正在初始化数据库...');
  await conn.query(sql);
  console.log('数据库初始化完成 ✅');
  await conn.end();
}

main().catch((e) => {
  console.error('初始化失败：', e.message);
  process.exit(1);
});
