const express = require('express');
const db = require('../../db');
const { wrap, customerAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { single, saveUploadRecord } = require('../../services/upload');

const router = express.Router();

/** 顾客端上传（头像、评价图） */
router.post(
  '/upload',
  customerAuth,
  single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw new BizError(CODES.BAD_PARAM, '请选择要上传的图片');
    const url = await saveUploadRecord(db, {
      file: req.file,
      storeId: req.body.storeId || 0,
      bizType: req.body.bizType || 'AVATAR',
      uploaderType: 'CUSTOMER',
      uploaderId: req.auth.sub,
    });
    return ok(res, { url });
  })
);

module.exports = router;
