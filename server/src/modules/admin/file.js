const express = require('express');
const db = require('../../db');
const { query, one, exec } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok, page, paging } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const { sid } = require('../../utils/misc');
const { single, saveUploadRecord } = require('../../services/upload');

const router = express.Router();

/** 素材列表 */
router.get(
  '/file/list',
  adminAuth,
  wrap(async (req, res) => {
    const { page: p, pageSize, offset, limit } = paging(req.query, 20);
    const where = [];
    const params = [];
    if (req.query.bizType) {
      where.push('biz_type = ?');
      params.push(req.query.bizType);
    }
    if (req.query.keyword) {
      where.push('original_name LIKE ?');
      params.push(`%${req.query.keyword}%`);
    }
    const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await one(`SELECT COUNT(1) AS c FROM upload_file ${wsql}`, params);
    const rows = await query(`SELECT * FROM upload_file ${wsql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    return ok(
      res,
      page(
        rows.map((r) => ({
          id: sid(r.id),
          url: r.url,
          originalName: r.original_name,
          mimeType: r.mime_type,
          size: Number(r.size),
          bizType: r.biz_type,
          storeId: sid(r.store_id),
          createdAt: r.created_at,
        })),
        Number(total.c),
        p,
        pageSize
      )
    );
  })
);

router.post(
  '/file/upload',
  adminAuth,
  single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw new BizError(CODES.BAD_PARAM, '请选择要上传的图片');
    const url = await saveUploadRecord(db, {
      file: req.file,
      storeId: req.body.storeId || 0,
      bizType: req.body.bizType || 'BANNER',
      uploaderType: 'ADMIN',
      uploaderId: req.admin.id,
    });
    return ok(res, { url }, '上传成功');
  })
);

router.delete(
  '/file/:fileId',
  adminAuth,
  wrap(async (req, res) => {
    const f = await one('SELECT * FROM upload_file WHERE id = ?', [req.params.fileId]);
    if (!f) throw new BizError(CODES.NOT_FOUND, '文件不存在');
    await exec('DELETE FROM upload_file WHERE id = ?', [f.id]);
    return ok(res, { ok: true }, '删除成功');
  })
);

module.exports = router;
module.exports.nowSql = nowSql;
