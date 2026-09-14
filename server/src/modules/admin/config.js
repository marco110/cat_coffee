const express = require('express');
const db = require('../../db');
const { query, one, exec } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { nowSql } = require('../../utils/time');
const { sid, json } = require('../../utils/misc');
const { operationLog } = require('../../services/log');

const router = express.Router();

/** 平台配置（Map 形式） */
router.get(
  '/config',
  adminAuth,
  wrap(async (req, res) => {
    const rows = await query('SELECT * FROM platform_config');
    const out = {};
    rows.forEach((r) => {
      out[r.config_key] = r.config_value;
    });
    return ok(res, out);
  })
);

/** 批量保存（有则更新无则新增） */
router.put(
  '/config',
  adminAuth,
  wrap(async (req, res) => {
    const body = req.body || {};
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      const exist = await one('SELECT id FROM platform_config WHERE config_key = ?', [k]);
      const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (exist) {
        await exec('UPDATE platform_config SET config_value = ?, updated_at = ? WHERE id = ?', [value, nowSql(), exist.id]);
      } else {
        await exec(
          'INSERT INTO platform_config (config_key, config_value, remark, created_at, updated_at) VALUES (?,?,?,?,?)',
          [k, value, '', nowSql(), nowSql()]
        );
      }
    }
    await operationLog({ req, operatorType: 'ADMIN', operatorId: req.admin.id, operatorName: req.admin.username, module: 'CONFIG', action: 'UPDATE', description: `保存平台配置：${Object.keys(body).join(',')}` });
    return ok(res, { ok: true }, '保存成功');
  })
);

/** 配置列表（表格形式） */
router.get(
  '/config/list',
  adminAuth,
  wrap(async (req, res) => {
    const rows = await query('SELECT * FROM platform_config ORDER BY id');
    return ok(
      res,
      rows.map((r) => ({
        id: sid(r.id),
        configKey: r.config_key,
        configValue: r.config_value,
        remark: r.remark || '',
        updatedAt: r.updated_at,
      }))
    );
  })
);

module.exports = router;
module.exports.json = json;
