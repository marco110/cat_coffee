const express = require('express');
const db = require('../../db');
const { one, exec } = db;
const { wrap, adminAuth } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { nowSql } = require('../../utils/time');
const DEFAULT_LEVELS = require('./store').DEFAULT_LEVELS;

const router = express.Router();

const KEY = 'MEMBER_LEVEL_TEMPLATE';

/** 新店默认等级模板 */
router.get(
  '/member-level/template',
  adminAuth,
  wrap(async (req, res) => {
    const row = await one('SELECT * FROM sys_config WHERE config_key = ?', [KEY]);
    const list = row ? JSON.parse(row.config_value) : DEFAULT_LEVELS;
    return ok(
      res,
      list.map((l) => ({
        name: l.name,
        levelValue: Number(l.levelValue || l.level_value || 1),
        growthThreshold: Number(l.growthThreshold !== undefined ? l.growthThreshold : l.growth_threshold || 0),
        discount: Number(l.discount !== undefined ? l.discount : 1),
      }))
    );
  })
);

router.put(
  '/member-level/template',
  adminAuth,
  wrap(async (req, res) => {
    const list = (req.body || {}).list || [];
    if (!Array.isArray(list) || !list.length) throw new BizError(CODES.BAD_PARAM, '请配置至少一个等级');
    list.forEach((l) => {
      if (!l.name) throw new BizError(CODES.BAD_PARAM, '请填写等级名称');
      const d = Number(l.discount);
      if (!(d > 0 && d <= 1)) throw new BizError(CODES.BAD_PARAM, '折扣需在 0 ~ 1 之间');
    });
    // 成长值门槛必须递增
    const sorted = [...list].sort((a, b) => Number(a.growthThreshold) - Number(b.growthThreshold));
    for (let i = 1; i < sorted.length; i += 1) {
      if (Number(sorted[i].growthThreshold) <= Number(sorted[i - 1].growthThreshold)) {
        throw new BizError(CODES.BAD_PARAM, '成长值门槛需递增');
      }
    }
    const value = JSON.stringify(
      list.map((l) => ({
        name: l.name,
        levelValue: Number(l.levelValue || 1),
        growthThreshold: Number(l.growthThreshold || 0),
        discount: Number(l.discount),
      }))
    );
    const exist = await one('SELECT id FROM sys_config WHERE config_key = ?', [KEY]);
    if (exist) {
      await exec('UPDATE sys_config SET config_value = ?, updated_at = ? WHERE id = ?', [value, nowSql(), exist.id]);
    } else {
      await exec('INSERT INTO sys_config (config_key, config_value, config_group, description, created_at, updated_at) VALUES (?,?,?,?,?,?)', [
        KEY,
        value,
        'POINTS',
        '新店默认会员等级模板',
        nowSql(),
        nowSql(),
      ]);
    }
    return ok(res, { ok: true }, '保存成功');
  })
);

module.exports = router;
