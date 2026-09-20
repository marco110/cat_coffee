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
  const http = require('http');
  const https = require('https');

  // 创建 HTTP 服务器
  const httpServer = http.createServer(app);

  // 创建 HTTPS 服务器（仅在生产模式下加载 SSL 证书）
  let httpsServer = null;

  httpServer.listen(config.port, () => {
    logger.info(`CatCoffee server is running at http://localhost:${config.port} （RUN_MODE=${config.runMode}）`);
    logger.info(`微信登录模式：${config.wx.mock ? 'MOCK（本地联调）' : '微信真实接口'}`);
    if (serveAdminWeb) {
      logger.info(`超管后台已同域托管：http://localhost:${config.port} （静态目录 ${config.adminWeb.dir}）`);
    } else if (config.adminWeb.enabled) {
      logger.warn(`未找到超管后台构建产物：${adminIndex}，请先执行 admin-web 的 npm run build`);
    }
  });

  if (config.isProduction) {
    try {
      // 检查 SSL 证书文件是否存在
      if (fs.existsSync(config.ssl.keyPath) && fs.existsSync(config.ssl.certPath)) {
        const sslConfig = {
          key: fs.readFileSync(config.ssl.keyPath),
          cert: fs.readFileSync(config.ssl.certPath),
        };
        httpsServer = https.createServer(sslConfig, app);
        httpsServer.listen(config.httpsPort, () => {
          logger.info(`✓ SSL 证书加载成功，HTTPS 服务已启动：https://localhost:${config.httpsPort}`);
        });
        httpsServer.on('error', (err) => logger.error(`HTTPS 服务异常：${err.message}`));
      } else {
        logger.warn(`✗ SSL 证书文件不存在（${config.ssl.keyPath} / ${config.ssl.certPath}），仅运行 HTTP 服务`);
      }
    } catch (error) {
      logger.error(`✗ SSL 证书加载失败：${error.message}`);
    }
  } else {
    logger.info('✓ 开发模式：使用 localhost，不加载 SSL 证书');
  }
}

module.exports = app;
