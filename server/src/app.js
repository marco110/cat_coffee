require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const routes = require('./routes');
const { requestLog, errorHandler, notFound } = require('./middleware/common');
const logger = require('./common/logger');
require('./jobs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
// 上传文件静态访问
app.use(config.upload.prefix, express.static(config.upload.dir));
app.use(requestLog);

app.get('/health', (_req, res) => res.json({ code: 0, msg: 'success', data: { ok: true }, timestamp: Date.now() }));

app.use('/api', routes);

/**
 * 同域托管超管后台前端（admin-web/dist）
 * - 静态资源由 express.static 提供
 * - 前端使用 history 路由，未命中静态文件的 GET 一律回退 index.html
 * - /api、/uploads 不参与回退，仍返回 JSON 404
 */
const adminIndex = path.join(config.adminWeb.dir, 'index.html');
const serveAdminWeb = config.adminWeb.enabled && fs.existsSync(adminIndex);

if (serveAdminWeb) {
  app.use(express.static(config.adminWeb.dir, { index: false, maxAge: '7d' }));
  app.get(/^\/(?!api\b|uploads\b).*/, (_req, res) => res.sendFile(adminIndex));
}

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`CatCoffee server is running at http://localhost:${config.port}`);
    logger.info(`微信登录模式：${config.wx.mock ? 'MOCK（本地联调）' : '微信真实接口'}`);
    if (serveAdminWeb) {
      logger.info(`超管后台已同域托管：http://localhost:${config.port} （静态目录 ${config.adminWeb.dir}）`);
    } else if (config.adminWeb.enabled) {
      logger.warn(`未找到超管后台构建产物：${adminIndex}，请先执行 admin-web 的 npm run build`);
    }
  });
}

module.exports = app;
