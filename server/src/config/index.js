require('dotenv').config();
const path = require('path');

// server/ 根目录，SSL 等相对路径都基于它解析
const serverRoot = path.resolve(__dirname, '..', '..');
const runMode = String(process.env.RUN_MODE || 'development').toLowerCase();

module.exports = {
  // development | production
  runMode,
  isProduction: runMode === 'production',
  port: Number(process.env.PORT || 3000),
  httpsPort: Number(process.env.HTTPS_PORT || 443),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cat_coffee',
    poolLimit: Number(process.env.DB_POOL_LIMIT || 20),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'cat_coffee_dev_secret_change_me',
    customerExpires: process.env.JWT_CUSTOMER_EXPIRES || '7d',
    merchantExpires: process.env.JWT_MERCHANT_EXPIRES || '7d',
    adminExpires: process.env.JWT_ADMIN_EXPIRES || '2h',
  },
  wx: {
    appid: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
    // 未配置 appid/secret 或显式开启时使用 MOCK：openid 由 code 派生，手机号由 code 派生
    mock: process.env.WX_MOCK === 'true' || !process.env.WX_APPID || !process.env.WX_SECRET,
    // 订阅消息模板（小程序后台「订阅消息」里申请后填入）
    subscribe: {
      // 取餐提醒（模板编号 1820）
      pickup: process.env.WX_TMPL_PICKUP || '',
      // 跳转版本：formal 正式版 / trial 体验版 / developer 开发版
      state: process.env.WX_MINIPROGRAM_STATE || 'developer',
      // 消息内跳转的详情页路径
      page: process.env.WX_SUBSCRIBE_PAGE || 'pages/order/detail',
    },
  },
  upload: {
    dir: path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads'),
    maxSizeMb: Number(process.env.UPLOAD_MAX_SIZE_MB || 5),
    prefix: process.env.STATIC_PREFIX || '/uploads',
  },
  // 超管后台前端（admin-web/dist）同域托管
  adminWeb: {
    enabled: process.env.SERVE_ADMIN_WEB !== 'false',
    dir: path.resolve(__dirname, '..', '..', process.env.ADMIN_WEB_DIR || '../admin-web/dist'),
  },
  // HTTPS：仅 RUN_MODE=production 时加载证书
  ssl: {
    keyPath: path.resolve(serverRoot, process.env.SSL_KEY_PATH || '/home/ssl/marco2026.site.key'),
    certPath: path.resolve(serverRoot, process.env.SSL_CERT_PATH || '/home/ssl/marco2026.site_bundle.crt'),
  },
  cron: process.env.ENABLE_CRON !== 'false',
  // 门店账号（店主/店员）的默认密码，新建与重置密码都用它
  storeUser: {
    defaultPassword: process.env.STORE_USER_DEFAULT_PASSWORD || 'aimao2026',
  },
  // PushPlus 消息推送（新订单通知店主）：改用自己的账号时替换 token 即可
  pushplus: {
    enabled: process.env.PUSHPLUS_ENABLED !== 'false',
    token: process.env.PUSHPLUS_TOKEN || '9a6a1d4b64bd405fa14d8eaf3adc1b77',
    // 一对一推送留空；群组/topic 推送填群组编码
    topic: process.env.PUSHPLUS_TOPIC || '',
    api: process.env.PUSHPLUS_API || 'https://www.pushplus.plus/send',
  },
};
