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

/** multer 单文件中间件，异常转为业务异常 */
function single(field = 'file') {
  return (req, res, next) =>
    upload.single(field)(req, res, (err) => {
      if (err) {
        err.code = 400;
        err.name = 'BizError';
      }
      next(err);
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
      (file.originalname || '').slice(0, 200),
      file.mimetype,
      file.size,
      bizType,
      uploaderType,
      uploaderId,
    ]
  );
  return url;
}

module.exports = { upload, single, saveUploadRecord };
