/**
 * 修复 upload_file 表中已乱码的上传文件名（历史数据）。
 * multer 曾按 latin1 解析中文文件名，导致库里存的是 mojibake，此处还原为 UTF-8。
 *
 * 用法：npm run fix-upload-names
 *       npm run fix-upload-names -- --dry   # 只打印将要修改的记录，不写库
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const DRY = process.argv.includes('--dry');

function decodeOriginalName(name) {
  if (!name) return null;
  if (!/[^\x00-\x7F]/.test(name)) return null; // 纯 ASCII 无需处理
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (decoded && !decoded.includes('\uFFFD') && decoded !== name) return decoded;
  return null;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cat_coffee',
    charset: 'utf8mb4',
  });

  const [rows] = await conn.query('SELECT id, original_name FROM upload_file');
  let fixed = 0;
  for (const r of rows) {
    const name = decodeOriginalName(r.original_name);
    if (!name) continue;
    fixed += 1;
    console.log(`#${r.id}  ${r.original_name}  ->  ${name}`);
    if (!DRY) await conn.query('UPDATE upload_file SET original_name = ? WHERE id = ?', [name.slice(0, 200), r.id]);
  }

  console.log(DRY ? `共 ${fixed} 条待修复（--dry 未写库）` : `已修复 ${fixed} 条文件名 ✅`);
  await conn.end();
}

main().catch((e) => {
  console.error('修复失败：', e.message);
  process.exit(1);
});
