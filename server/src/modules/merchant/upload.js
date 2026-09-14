const express = require('express');
const db = require('../../db');
const { wrap, merchantAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { single, saveUploadRecord } = require('../../services/upload');

const router = express.Router();

/** 店主端上传（菜品图、封面等） */
router.post(
  '/upload',
  merchantAuth,
  single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw new BizError(CODES.BAD_PARAM, '请选择要上传的图片');
    const url = await saveUploadRecord(db, {
      file: req.file,
      storeId: req.storeId,
      bizType: req.body.bizType || 'DISH',
      uploaderType: 'MERCHANT',
      uploaderId: req.storeUser.id,
    });
    return ok(res, { url });
  })
);

module.exports = router;
