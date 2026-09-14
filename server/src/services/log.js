const { exec } = require('../db');
const { nowSql } = require('../utils/time');

/**
 * 写入操作日志（三端关键操作留痕）
 * @param {object} opt { operatorType, operatorId, operatorName, storeId, module, action, description, targetId, content, req }
 */
async function operationLog(opt) {
  try {
    const req = opt.req || {};
    await exec(
      `INSERT INTO operation_log
        (store_id, operator_type, operator_id, operator_name, module, action, description, target_id, content, ip, user_agent, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        opt.storeId || 0,
        opt.operatorType || 'SYSTEM',
        opt.operatorId || null,
        opt.operatorName || null,
        opt.module || 'SYSTEM',
        opt.action || 'UPDATE',
        opt.description || '',
        opt.targetId || null,
        opt.content ? JSON.stringify(opt.content) : null,
        req.ip || null,
        String(req.headers?.['user-agent'] || '').slice(0, 300) || null,
        nowSql(),
      ]
    );
  } catch (e) {
    // 日志失败不影响主流程
  }
}

async function loginLog(opt) {
  try {
    await exec(
      `INSERT INTO login_log (user_type, user_id, account, store_id, result, fail_reason, ip, user_agent, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        opt.userType,
        opt.userId || null,
        opt.account || null,
        opt.storeId || 0,
        opt.result ? 1 : 0,
        opt.failReason || null,
        opt.ip || null,
        String(opt.userAgent || '').slice(0, 300) || null,
        nowSql(),
      ]
    );
  } catch (e) {
    /* ignore */
  }
}

module.exports = { operationLog, loginLog };
