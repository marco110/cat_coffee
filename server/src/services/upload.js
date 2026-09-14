const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');

if (!fs.existsSync(config.upload.dir)) fs.mkdirSync(config.upload.dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(config.upload.dir, 'images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okType = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(okType ? null : new Error('仅支持 jpg / png / webp 图片'), okType);
  },
});

/**
 * 修正上传文件名编码。
 * multer/busboy 按 latin1 解析 multipart 头部，浏览器传来的 UTF-8 中文文件名会被
 * 逐字节截断成乱码（如 "猫" → "ç"+"«"），这里尝试还原为 UTF-8。
 * 只有当还原结果不含替换字符 U+FFFD 时才认为原串确实是 mojibake。
 */
function decodeOriginalName(name) {
  if (!name) return '';
  if (!/[^\x00-\x7F]/.test(name)) return name; // 纯 ASCII 无需处理
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('\uFFFD')) return decoded;
  } catch (e) {
    /* ignore */
  }
  return name;
}

function fixFileNames(file) {
  if (file && typeof file.originalname === 'string') {
    file.originalname = decodeOriginalName(file.originalname);
  }
}

/** multer 单文件中间件，异常转为业务异常 + 文件名编码修正 */
function single(field = 'file') {
  return (req, res, next) =>
    upload.single(field)(req, res, (err) => {
      if (err) {
        err.code = 400;
        err.name = 'BizError';
        return next(err);
      }
      fixFileNames(req.file);
      if (Array.isArray(req.files)) {
        (Array.isArray(req.files[0]) ? req.files.flat() : req.files).forEach(fixFileNames);
      }
      return next();
    });
}

/** 落库 upload_file 并返回可访问 URL */
async function saveUploadRecord(db, { file, storeId = 0, bizType = 'OTHER', uploaderType = null, uploaderId = null }) {
  const url = `${config.upload.prefix}/images/${file.filename}`;
  await db.exec(
    `INSERT INTO upload_file (store_id, url, path, original_name, mime_type, size, biz_type, uploader_type, uploader_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
    [
      storeId,
      url,
      file.path,
      decodeOriginalName(file.originalname).slice(0, 200),
      file.mimetype,
      file.size,
      bizType,
      uploaderType,
      uploaderId,
    ]
  );
  return url;
}

module.exports = { upload, single, saveUploadRecord, decodeOriginalName };
