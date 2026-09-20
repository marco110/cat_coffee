# 爱猫咖啡 · 扫码点餐系统（Cat Coffee）

一家以猫为主题的咖啡店扫码点餐解决方案。顾客到店扫描桌贴二维码进入小程序点单（**堂食**需绑定桌号 / **打包**生成取餐码），订单实时推送至店主端，店主接单制作，顾客**到店付款**。

仓库内含 **3 个子项目**，共用一套 MySQL 8 数据库与一套 REST API：

| 子项目 | 目录 | 使用者 | 技术栈 | 默认端口 |
| --- | --- | --- | --- | --- |
| 服务端 API | `server/` | — | Node.js 18+ / Express 4 / mysql2 / JWT / multer / node-cron | 3000 |
| 小程序（顾客端 + 店主端） | `miniapp/` | 顾客、店主/店员 | uni-app + Vue 3 + Pinia + Sass（编译目标 mp-weixin） | 微信开发者工具 |
| 超管后台 Web | `admin-web/` | 平台超级管理员 | Vue 3 + Vite + Element Plus + Pinia + ECharts | 5173 |

> 顾客端与店主端在**同一个小程序包**内：顾客端为主包，店主端为独立分包 `subpackages/merchant`，通过「店主入口」页切换角色。

---

## 一、功能清单

### 顾客端（小程序主包）
- 微信授权登录（code2session → 自定义 JWT，7 天）；未登录可浏览菜单，下单时引导授权手机号
- 扫码进店自动带出桌号；门店信息、公告、营业时间、营业状态校验
- 菜单浏览：分类 / 菜品 / 规格（杯型、温度等）/ 招牌标签 / 售罄沽清 / 加料
- 购物车与价格计算（商品合计 − 会员折扣 − 优惠券 − 积分抵扣，以服务端为准）
- 下单：堂食 / 打包、就餐人数、备注；打包单生成当日唯一取餐码
- 订单：列表、详情（含状态时间轴与改单记录）、取消
- 会员：会员卡、等级与成长值、积分明细、我的优惠券、领券中心

### 店主端（小程序分包 `subpackages/merchant`）
- 手机号 + 密码登录，忘记密码由超管重置
- 首页看板：今日订单 / 营业额 / 待处理、新订单提醒（轮询）
- 订单管理：接单 → 开始制作 → 出餐 → 完成/拒单，改单（加菜/减菜，记录 `order_modify_log`）、到店收款、订单筛选
- 菜单管理：分类维护、菜品增删改查、上下架、沽清、库存模式（无限/每日限量）、图片上传
- 桌位管理：按区域分组、批量建桌、桌位二维码生成与保存
- 优惠券管理：创建/暂停/结束、统计数据、定向发放（按手机号）
- 会员管理：会员列表、积分与成长值调整、等级体系配置（折扣/门槛/权益）
- 经营统计：营业额趋势、热销菜品、高峰时段、会员概况
- 门店设置：基本信息、公告、营业时间、营业状态

### 超管后台（Web）
- 账号 + 密码 + 图形验证码登录（2 小时有效期，5 次失败锁定 15 分钟）
- 首页看板（平台维度数据）
- 门店管理、店主账号管理（OWNER / STAFF，初始密码标记）
- 订单查询（跨门店）、会员等级模板、平台配置、素材管理
- 操作日志 / 登录日志审计、修改密码

### 服务端公共能力
- 三端 JWT 鉴权（`type` = `CUSTOMER` / `MERCHANT` / `ADMIN`）
- 门店数据强制隔离（店主端中间件注入 `storeId`，不信任前端传参）
- 统一响应格式与错误码、请求日志、统一异常处理
- 文件上传（multer 落盘 `server/uploads`，通过 `/uploads/**` 静态访问）
- 定时任务（每日 00:00）：重置沽清标记、过期优惠券置为 `EXPIRED`、汇总昨日门店经营数据

---

## 二、架构设计

```
┌────────────────┐   ┌─────────────────────┐   ┌──────────────────┐
│ miniapp 顾客端 │   │ miniapp 店主端分包  │   │ admin-web 超管台 │
│ (mp-weixin)    │   │ (mp-weixin)         │   │ (Vue3 + Element) │
└───────┬────────┘   └──────────┬──────────┘   └────────┬─────────┘
        │  /api/customer/*       │ /api/merchant/*        │ /api/admin/*
        └────────────────────────┴────────────────────────┘
                                 │  HTTP / JSON（Bearer JWT）
                    ┌────────────▼────────────┐
                    │  server (Express 4)     │
                    │  routes → modules       │
                    │  middleware → services  │
                    │  db (mysql2 pool)       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ MySQL 8.0（28 张表）    │
                    └─────────────────────────┘
```

服务端分层：

```
server/src/
├── app.js            # 应用入口：中间件、静态目录、路由挂载、监听
├── config/           # 配置（.env → 端口 / 数据库 / JWT / 微信 / 上传）
├── routes/           # 顶层路由：/api/customer、/api/merchant、/api/admin
├── modules/
│   ├── customer/     # auth store order member coupon upload
│   ├── merchant/     # auth dashboard order category dish table coupon member store stat upload
│   └── admin/        # auth dashboard store store-user order member-level config log file
├── middleware/       # 鉴权(customerAuth/merchantAuth/adminAuth)、门店隔离、日志、异常处理
├── services/         # 日志、取餐码/订单号、价格计算等共用服务
├── db/               # mysql2 连接池 + query/one/exec/事务封装
├── common/           # 统一响应、错误码、日志
├── utils/            # 时间、密码(bcrypt)、字符串等
└── jobs/             # node-cron 每日任务
```

关键约定：
- **统一响应**：`{ code, msg, data, timestamp }`，`code = 0` 为成功；分页统一 `{ list, total, page, pageSize }`
- **错误码**：`0/400/401/403/404/409/500`，业务码 `1001~1007`（手机号未绑定、门店休息中、菜品下架/售罄、订单状态非法、优惠券不可用、积分不足、桌号无效）、`2001`（店主账号被禁用）
- **金额**：`DECIMAL(10,2)`，服务端计算，前端只展示
- **软删除**：统一 `deleted_at`，查询默认过滤
- **订单状态机**：`PENDING → ACCEPTED → MAKING → READY → COMPLETED`，旁路 `CANCELLED` / `REJECTED`；支付状态 `UNPAID → PAID`（到店收款）
- **数据表分组**：平台与门店（`sys_admin`/`store`/`store_user`）、用户与会员（`user`/`member_level`/`user_member`/`points_log`）、菜单（`category`/`dish`/`dish_spec_group`/`dish_spec_item`/`addon`）、订单（`order_main`/`order_item`/`order_log`/`order_modify_log`/`daily_sequence`）、营销（`coupon`/`user_coupon`/`coupon_grant_log`）、运营（`store_stats_daily`/`banner`/`review`/`upload_file`/`operation_log`/`login_log`/`sys_config`/`table_info`）

完整接口清单见 `03-API接口清单.md`，建表语句见 `server/sql/schema.sql`（同目录 `02-数据库设计.sql` 为设计稿）。

---

## 三、快速开始

### 3.1 环境要求
- Node.js **18+**（含 npm）
- MySQL **8.0**（utf8mb4）
- 微信开发者工具（小程序预览/真机调试）

### 3.2 安装依赖
```bash
cd server     && npm install
cd ../miniapp && npm install
cd ../admin-web && npm install
```

### 3.3 初始化数据库
1. 创建数据库（默认库名 `cat_coffee`）：
   ```sql
   CREATE DATABASE cat_coffee DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. 复制环境配置并按需修改：
   ```bash
   cp server/.env.example server/.env
   ```
   | 变量 | 说明 | 默认 |
   | --- | --- | --- |
   | `PORT` | 服务端口 | 3000 |
   | `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | MySQL 连接 | 127.0.0.1 / 3306 / root / root / cat_coffee |
   | `JWT_SECRET` | JWT 密钥（**生产必须修改**） | cat_coffee_dev_secret_change_me |
   | `JWT_*_EXPIRES` | 三端 token 有效期 | 7d / 7d / 2h |
   | `WX_APPID` / `WX_SECRET` | 小程序配置；留空或 `WX_MOCK=true` 进入 MOCK 登录 | 空 / true |
   | `UPLOAD_DIR` / `STATIC_PREFIX` / `UPLOAD_MAX_SIZE_MB` | 上传目录与访问前缀 | uploads / /uploads / 5 |
   | `ENABLE_CRON` | 是否开启每日定时任务 | true |
3. 导入表结构与示例数据：
   ```bash
   cd server && npm run init-db
   ```
   > 该脚本会执行 `server/sql/schema.sql`（重建 28 张表并写入示例数据），**请勿在生产库执行**。

### 3.4 启动
```bash
# 0) 同时启动服务端和admin-web
cd server && npm run deploy即可先打包admin-web后运行server端

# 1) 服务端

cd server && npm start          # 或 npm run dev（node --watch 热重载）
# 验证： curl http://localhost:3000/health  → {"code":0,"data":{"ok":true}}

# 2) 超管后台
cd admin-web && npm run dev     # http://localhost:5173（已配置 /api → localhost:3000 代理）

# 3) 小程序
cd miniapp && npm run build:mp-weixin   # 产出 dist/build/mp-weixin
# 开发模式：npm run dev:mp-weixin（--watch）
# 微信开发者工具 → 导入 miniapp/dist/build/mp-weixin
```

### 3.5 默认账号
| 端 | 账号 | 密码 | 来源 |
| --- | --- | --- | --- |
| 超管后台 | `admin` | `admin123` | `schema.sql` 内置（首次登录后请立即修改） |
| 店主端小程序 | `13900000000` | `admin123` | 示例门店「爱猫咖啡（旗舰店）」店长账号（初始密码，登录后建议修改） |
| 顾客端 | 微信授权登录 | — | 未配置小程序 AppID 时为 MOCK 登录（openid 由 code 派生） |

示例数据另含：门店 1 家、桌位 A01/A02、分类「招牌特调/经典咖啡」、菜品「猫爪拿铁（含规格）」「美式咖啡」、优惠券「满 50 减 10」、会员等级模板。

---

## 四、各子项目说明

### server（服务端）
```
server/
├── src/        # 见上文分层说明
├── sql/schema.sql
├── scripts/init-db.js
├── uploads/    # 上传文件落盘目录
└── .env.example
```
常用脚本：`npm start`（启动）、`npm run dev`（热重载）、`npm run init-db`（初始化数据库）。

接口前缀：
- `GET /health` 健康检查
- `/api/customer/**` 顾客端（需顾客 token）
- `/api/merchant/**` 店主端（需店主 token，自动注入 `storeId`）
- `/api/admin/**` 超管后台（需超管 token）

### miniapp（小程序）
```
miniapp/src/
├── pages/            # 顾客端主包：首页、点餐、确认订单、订单详情/列表、我的、会员卡、积分、优惠券、领券中心、店主入口
├── subpackages/merchant/  # 店主端分包：登录、看板、订单管理/详情/改单、菜单、分类、桌位、优惠券、会员、等级、统计、设置
├── components/       # ct-* 自定义组件（easycom 自动引入）
├── store/            # Pinia：用户态、购物车、门店态
├── api/  utils/  config.js   # 接口定义、工具、后端地址配置
├── pages.json  manifest.json  uni.scss
└── App.vue  main.js
```
真机调试/联调需修改 `miniapp/src/config.js`：
```js
export const BASE_URL = 'http://<本机局域网IP>:3000/api';
export const STATIC_HOST = 'http://<本机局域网IP>:3000';
```
并在 `manifest.json` 填写小程序 AppID；开发者工具勾选「不校验合法域名」或使用 HTTPS 域名。

### admin-web（超管后台）
```
admin-web/src/
├── views/     # login、dashboard、store、storeUser、order、memberLevel、config、log、file
├── layout/    # 侧边栏 + 顶栏布局
├── api/       # axios 封装（统一携带 token、错误提示、401 跳登录）
├── router/    # 路由 + 登录守卫
├── store/     # Pinia 用户态
└── styles/    # 主题与 Element Plus 变量覆盖
```
`vite.config.js` 已将 `/api` 代理到 `http://localhost:3000`，开发时无需额外配置跨域。

**生产同域托管（推荐，无需 Nginx）**：`server` 可直接托管 `admin-web/dist`，访问 `http://<host>:3000` 即为后台，接口同为 `/api`，不存在跨域问题。

```bash
cd admin-web && npm run build          # 产出 admin-web/dist
cd ../server && npm start              # 自动托管 ../admin-web/dist
```

- SPA 使用 history 路由，服务端已做回退：未命中静态文件的 GET 一律返回 `index.html`（`/api`、`/uploads` 除外，仍返回 JSON 404）
- 目录与开关通过环境变量控制（`server/.env`）：

  | 变量 | 说明 | 默认 |
  | --- | --- | --- |
  | `SERVE_ADMIN_WEB` | 是否托管后台静态站点，置 `false` 关闭 | true |
  | `ADMIN_WEB_DIR` | dist 目录，相对 `server/` 解析 | `../admin-web/dist` |

- 更新后台只需重新 `npm run build`，无需重启服务端（静态文件每次请求读取；`index.html` 未做缓存）

---

## 五、常见问题

| 问题 | 处理 |
| --- | --- |
| 微信登录失败 / 无法获取手机号 | 未配置 `WX_APPID`/`WX_SECRET` 时自动进入 **MOCK 模式**（日志会打印「微信登录模式：MOCK」）；真实授权需**企业主体**小程序并开通手机号快速验证组件 |
| 小程序请求失败 | 检查 `miniapp/src/config.js` 的 `BASE_URL`；真机需填局域网 IP，不能用 `localhost`；开发者工具勾选「不校验合法域名」 |
| 超管后台 401 | 接口 `/api/admin/auth/login` 需要图形验证码，先调用 `/api/admin/auth/captcha` 获取 `captchaId` |
| 超管账号被锁定 | 连续 5 次密码错误锁定 15 分钟，等待或手动清空 `sys_admin.locked_until` |
| 图片上传后 404 | 确认服务端已启动（图片由 `server` 提供 `/uploads/**` 静态访问），且 `STATIC_HOST` 指向服务端地址 |
| 端口被占用 | 修改 `server/.env` 的 `PORT`，或 `admin-web/vite.config.js` 的 `server.port` |
| 定时任务不执行 | 检查 `.env` 中 `ENABLE_CRON` 是否为 `false`；任务固定在每日 00:00（Asia/Shanghai）执行 |

---

## 六、文档索引

| 文件 | 内容 |
| --- | --- |
| `00-README-项目总览与阅读指引.md` | 需求背景、技术选型、全局技术约定、开发优先级、验收标准 |
| `01-需求规格说明书.md` | 角色权限、三端功能需求、业务流程、订单状态机、页面清单 |
| `02-数据库设计.sql` | 28 张表设计稿与字段说明 |
| `03-API接口清单.md` | 三端 REST 接口清单（路径 / 入参 / 出参 / 权限） |
| `04-视觉设计规范.md` | 粉白可爱风设计令牌、组件规范、三端差异化与 IP 合规红线 |
| `server/sql/schema.sql` | 可直接执行的建表语句 + 示例数据（与 `02` 一致的可运行版本） |

> **IP 合规提醒**：HelloKitty 为三丽鸥注册 IP，本项目仅参考其风格，禁止使用其形象、名称、Logo 或字体；品牌 IP 为自研猫咪形象「爱咪」。
