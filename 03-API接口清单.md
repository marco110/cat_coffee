# 爱猫咖啡 · 扫码点餐系统 —— API 接口清单

版本：v1.0
Base URL：`https://api.example.com/api`

---

## 目录

- [一、通用约定](#一通用约定)
- [二、顾客端接口 `/api/customer`](#二顾客端接口apicustomer)
- [三、店主端接口 `/api/merchant`](#三店主端接口apimerchant)
- [四、超级管理员接口 `/api/admin`](#四超级管理员接口apiadmin)
- [五、关键接口详细定义](#五关键接口详细定义)
- [六、接口鉴权与中间件](#六接口鉴权与中间件)

---

## 一、通用约定

### 1.1 请求头

```http
Content-Type: application/json
Authorization: Bearer <token>
X-Request-Id: <客户端生成的唯一请求 ID，用于幂等与日志追踪>
```

### 1.2 统一响应体

```json
{ "code": 0, "msg": "success", "data": {}, "timestamp": 1739520000000 }
```

分页响应 `data` 固定结构：

```json
{ "list": [], "total": 128, "page": 1, "pageSize": 10 }
```

### 1.3 通用查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `page` | int | 1 | 页码 |
| `pageSize` | int | 10 | 每页条数，最大 50 |
| `startDate` | string | - | 开始日期 `YYYY-MM-DD` |
| `endDate` | string | - | 结束日期 `YYYY-MM-DD` |

### 1.4 错误码

| code | 含义 |
| --- | --- |
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录 / Token 失效 |
| 403 | 无权限（越权访问） |
| 404 | 资源不存在 |
| 409 | 业务冲突（重复提交、状态已变更） |
| 500 | 服务器内部错误 |
| 1001 | 手机号未绑定 |
| 1002 | 门店休息中 |
| 1003 | 菜品已下架 / 已售罄 |
| 1004 | 订单状态不允许当前操作 |
| 1005 | 优惠券不可用 |
| 1006 | 积分不足 |
| 1007 | 桌号无效 |
| 1008 | 用户名或密码错误 |
| 1009 | 账号已被锁定 |
| 1010 | 触发频率限制 |
| 2001 | 店主账号被禁用 / 门店已停用 |

---

## 二、顾客端接口 `/api/customer`

### 2.1 认证授权

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| POST | `/customer/auth/login` | 微信 code 静默登录，换 token | 否 |
| POST | `/customer/auth/phone` | 手机号一键授权绑定 | 是 |
| GET | `/customer/auth/profile` | 获取当前用户信息 | 是 |
| PUT | `/customer/auth/profile` | 更新昵称 / 头像 | 是 |
| POST | `/customer/auth/refresh` | 刷新 token | 是 |

### 2.2 门店与菜单

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| GET | `/customer/store/:storeId` | 门店信息（名称、简介、公告、营业状态、配置） | 否 |
| GET | `/customer/store/scan` | 扫码解析，入参 `scene`，返回门店 + 桌位信息 | 否 |
| GET | `/customer/store/:storeId/tables` | 可用桌位列表（按区域分组，手动选桌用） | 否 |
| GET | `/customer/store/:storeId/menu` | 完整菜单（分类 + 菜品 + 规格），支持 `?categoryId=` 筛选 | 否 |
| GET | `/customer/dish/:dishId` | 菜品详情（含规格组与规格项、加料） | 否 |
| GET | `/customer/dish/search` | 菜品搜索，入参 `storeId`、`keyword` | 否 |
| GET | `/customer/store/:storeId/banners` | 门店轮播图 | 否 |

### 2.3 订单

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| POST | `/customer/order/preview` | 结算预览：计算价格、可用券、可用积分 | 是 |
| POST | `/customer/order` | 提交订单 | 是 |
| GET | `/customer/order/list` | 我的订单列表（`status`、分页） | 是 |
| GET | `/customer/order/:orderId` | 订单详情（含时间轴、改单记录） | 是 |
| POST | `/customer/order/:orderId/cancel` | 取消订单 | 是 |
| POST | `/customer/order/:orderId/urge` | 催单（P1） | 是 |
| GET | `/customer/order/:orderId/reorder` | 再来一单：返回可直接加购的购物车数据 | 是 |
| GET | `/customer/order/ongoing` | 是否存在进行中订单（首页提示用） | 是 |
| POST | `/customer/order/:orderId/review` | 提交评价（P2） | 是 |

### 2.4 会员与营销

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| GET | `/customer/member/info` | 会员卡信息（等级、成长值、折扣、积分余额） | 是 |
| GET | `/customer/member/levels` | 本店等级体系（用于展示升级路径） | 是 |
| GET | `/customer/member/points-log` | 积分明细（分页） | 是 |
| GET | `/customer/coupon/list` | 我的优惠券（`status=UNUSED/USED/EXPIRED`） | 是 |
| GET | `/customer/coupon/available` | 结算可用券，入参 `storeId`、`amount`、`orderType` | 是 |
| GET | `/customer/coupon/center` | 领券中心列表 | 是 |
| POST | `/customer/coupon/:couponId/claim` | 领取优惠券 | 是 |
| GET | `/customer/coupon/:userCouponId` | 券详情 | 是 |

### 2.5 其他

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| POST | `/customer/upload` | 上传图片（头像、评价图） | 是 |
| POST | `/customer/feedback` | 意见反馈（P2） | 是 |

---

## 三、店主端接口 `/api/merchant`

> **所有接口的 `storeId` 由服务端从 token 解析并注入，前端不得传参决定数据范围。**

### 3.1 认证

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| POST | `/merchant/auth/login` | 手机号 + 密码登录 | 否 |
| POST | `/merchant/auth/logout` | 退出登录 | 是 |
| GET | `/merchant/auth/profile` | 当前登录店主信息 + 门店信息 | 是 |
| PUT | `/merchant/auth/password` | 修改密码（首次登录强制） | 是 |

### 3.2 工作台

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| GET | `/merchant/dashboard/overview` | 今日概览（订单数、营业额、客单价、待接单数） | 是 |
| GET | `/merchant/dashboard/pending-count` | 轮询接口：待接单数量 + 最新订单摘要 | 是 |
| GET | `/merchant/dashboard/todo` | 待处理事项汇总（待接单/制作中/待取餐数量） | 是 |

### 3.3 订单管理

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| GET | `/merchant/order/list` | 订单列表（`status`、`orderType`、`tableNo`、`keyword`、`startDate`、`endDate`、分页） | 是 |
| GET | `/merchant/order/:orderId` | 订单详情 | 是 |
| GET | `/merchant/order/:orderId/logs` | 订单状态流转日志 | 是 |
| GET | `/merchant/order/:orderId/modify-logs` | 改单记录 | 是 |
| POST | `/merchant/order/:orderId/accept` | 接单 | 是 |
| POST | `/merchant/order/:orderId/reject` | 拒单（必填原因） | 是 |
| POST | `/merchant/order/:orderId/making` | 开始制作 | 是 |
| POST | `/merchant/order/:orderId/ready` | 出品完成（→ 待取餐） | 是 |
| POST | `/merchant/order/:orderId/complete` | 确认完成 | 是 |
| POST | `/merchant/order/:orderId/cancel` | 取消订单 | 是 |
| POST | `/merchant/order/:orderId/pay` | 标记已收款 | 是 |
| POST | `/merchant/order/:orderId/modify` | **改单**（增删菜品、改数量、改价） | 是 |
| POST | `/merchant/order/:orderId/print` | 打印小票（P2，占位） | 是 |
| GET | `/merchant/order/export` | 导出订单 Excel（P1） | 是 |

### 3.4 分类管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/category/list` | 分类列表（含菜品数量） |
| POST | `/merchant/category` | 新增分类 |
| PUT | `/merchant/category/:categoryId` | 编辑分类 |
| PUT | `/merchant/category/:categoryId/status` | 启用 / 停用 |
| PUT | `/merchant/category/sort` | 批量排序（传 `[{id, sort}]`） |
| DELETE | `/merchant/category/:categoryId` | 删除分类（有菜品时拒绝） |

### 3.5 菜品管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/dish/list` | 菜品列表（`categoryId`、`keyword`、`status`、`soldOut`、分页） |
| GET | `/merchant/dish/:dishId` | 菜品详情（含规格组与规格项） |
| POST | `/merchant/dish` | 新增菜品（含规格，一次性提交） |
| PUT | `/merchant/dish/:dishId` | 编辑菜品（含规格） |
| PUT | `/merchant/dish/:dishId/status` | 上架 / 下架 |
| PUT | `/merchant/dish/:dishId/sold-out` | 沽清 / 取消沽清 |
| PUT | `/merchant/dish/sort` | 批量排序 |
| PUT | `/merchant/dish/batch-status` | 批量上下架（P1） |
| DELETE | `/merchant/dish/:dishId` | 删除菜品（软删） |
| GET | `/merchant/dish/:dishId/spec` | 获取规格配置 |
| PUT | `/merchant/dish/:dishId/spec` | 保存规格配置（整体覆盖式提交，事务内先删后插） |
| GET | `/merchant/addon/list` | 加料库列表（P2） |
| POST | `/merchant/addon` | 新增加料（P2） |
| PUT | `/merchant/addon/:addonId` | 编辑加料（P2） |
| DELETE | `/merchant/addon/:addonId` | 删除加料（P2） |

### 3.6 桌位管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/table/list` | 桌位列表 |
| POST | `/merchant/table` | 新增桌位 |
| PUT | `/merchant/table/:tableId` | 编辑桌位 |
| PUT | `/merchant/table/:tableId/status` | 启用 / 停用 |
| DELETE | `/merchant/table/:tableId` | 删除桌位（有进行中订单时拒绝） |
| POST | `/merchant/table/:tableId/qrcode` | 生成该桌小程序码（返回图片 URL） |
| POST | `/merchant/table/qrcode/batch` | 批量生成（P1） |
| GET | `/merchant/table/:tableId/qrcode/download` | 下载二维码图片（P1） |

### 3.7 营销 - 优惠券

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/coupon/list` | 券列表（`status`、`type`、分页） |
| GET | `/merchant/coupon/:couponId` | 券详情 |
| POST | `/merchant/coupon` | 创建券 |
| PUT | `/merchant/coupon/:couponId` | 编辑券（进行中的券限制可改字段） |
| PUT | `/merchant/coupon/:couponId/status` | 停用 / 启用 / 结束 |
| DELETE | `/merchant/coupon/:couponId` | 删除券（软删） |
| GET | `/merchant/coupon/:couponId/records` | 领取与核销记录（分页） |
| POST | `/merchant/coupon/:couponId/grant` | 定向发券（传手机号数组） |

### 3.8 营销 - 会员

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/member/list` | 会员列表（`keyword` 手机号、`levelId`、`sortBy`、分页） |
| GET | `/merchant/member/:userId` | 会员详情 |
| GET | `/merchant/member/:userId/orders` | 该会员的消费记录 |
| GET | `/merchant/member/:userId/points-log` | 该会员积分明细 |
| GET | `/merchant/member/:userId/coupons` | 该会员持有券 |
| PUT | `/merchant/member/:userId/points` | 手动调整积分 / 成长值（必填原因） |
| GET | `/merchant/member/export` | 导出会员 Excel（P1） |
| GET | `/merchant/member/level/list` | 等级配置列表 |
| POST | `/merchant/member/level` | 新增等级 |
| PUT | `/merchant/member/level/:levelId` | 编辑等级 |
| DELETE | `/merchant/member/level/:levelId` | 删除等级（默认等级与已被使用等级不可删） |
| POST | `/merchant/member/level/apply-template` | 套用平台模板初始化等级 |

### 3.9 店铺设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/store/info` | 店铺全部配置 |
| PUT | `/merchant/store/info` | 保存基础信息（名称、Logo、简介、地址等） |
| PUT | `/merchant/store/business-status` | 切换营业状态（营业中 / 休息中） |
| PUT | `/merchant/store/order-setting` | 下单相关配置（堂食/打包开关、自动接单、取餐码等） |
| PUT | `/merchant/store/member-setting` | 会员与积分配置 |
| PUT | `/merchant/store/notify-setting` | 提醒配置 |
| GET | `/merchant/banner/list` | 轮播图列表 |
| POST | `/merchant/banner` | 新增轮播图 |
| PUT | `/merchant/banner/:bannerId` | 编辑轮播图 |
| DELETE | `/merchant/banner/:bannerId` | 删除轮播图 |

### 3.10 数据统计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/merchant/stat/overview` | 概览数据（`range=today/yesterday/7d/30d/custom`） |
| GET | `/merchant/stat/trend` | 订单与营业额趋势（按天） |
| GET | `/merchant/stat/dish-rank` | 菜品销量排行 TOP N |
| GET | `/merchant/stat/order-type` | 堂食 / 打包占比 |
| GET | `/merchant/stat/hourly` | 时段分布（P1） |
| GET | `/merchant/stat/member` | 会员增长与消费占比（P1） |
| GET | `/merchant/stat/export` | 导出统计报表（P1） |

### 3.11 通用

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/merchant/upload` | 上传图片（菜品图、Logo、二维码等） |

---

## 四、超级管理员接口 `/api/admin`

### 4.1 认证

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | :-: |
| GET | `/admin/auth/captcha` | 获取图形验证码（返回 base64 + captchaId） | 否 |
| POST | `/admin/auth/login` | 账号 + 密码 + 验证码登录 | 否 |
| POST | `/admin/auth/logout` | 退出登录 | 是 |
| GET | `/admin/auth/profile` | 当前管理员信息 | 是 |
| PUT | `/admin/auth/password` | 修改密码 | 是 |

### 4.2 门店管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/store/list` | 门店列表（`keyword`、`status`、分页） |
| GET | `/admin/store/:storeId` | 门店详情（含统计概览与店主列表） |
| POST | `/admin/store` | 新增门店 |
| PUT | `/admin/store/:storeId` | 编辑门店 |
| PUT | `/admin/store/:storeId/status` | 启用 / 停用门店 |
| DELETE | `/admin/store/:storeId` | 删除门店（软删，需强确认） |

### 4.3 店主账号管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/store-user/list` | 账号列表（`keyword`、`storeId`、`role`、`status`、分页） |
| GET | `/admin/store-user/:id` | 账号详情 |
| POST | `/admin/store-user` | 新增账号（手机号 + 门店 + 角色 + 初始密码） |
| PUT | `/admin/store-user/:id` | 编辑账号（姓名、门店换绑、角色） |
| PUT | `/admin/store-user/:id/status` | 启用 / 禁用 |
| PUT | `/admin/store-user/:id/reset-password` | 重置密码（返回新密码，仅展示一次） |
| DELETE | `/admin/store-user/:id` | 删除账号（软删） |

### 4.4 平台数据看板

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/dashboard/overview` | 全局概览卡片数据 |
| GET | `/admin/dashboard/trend` | 订单与营业额趋势（可筛选门店） |
| GET | `/admin/dashboard/store-rank` | 门店排行（`sortBy=revenue/orders`） |
| GET | `/admin/dashboard/order-type` | 订单类型构成 |
| GET | `/admin/dashboard/dish-rank` | 跨门店菜品销量 TOP 10 |
| GET | `/admin/dashboard/member-trend` | 会员增长趋势 |
| GET | `/admin/dashboard/export` | 导出看板数据 Excel |

### 4.5 全局订单查询

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/order/list` | 跨门店订单列表（`storeId`、`keyword`、`status`、日期范围、分页） |
| GET | `/admin/order/:orderId` | 订单详情（只读） |
| GET | `/admin/order/export` | 导出订单 Excel |

### 4.6 全局配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/config/list` | 配置列表（`group` 分组） |
| PUT | `/admin/config` | 批量保存配置 |
| GET | `/admin/member-level/template/list` | 平台等级模板列表 |
| POST | `/admin/member-level/template` | 新增模板等级 |
| PUT | `/admin/member-level/template/:levelId` | 编辑模板等级 |
| DELETE | `/admin/member-level/template/:levelId` | 删除模板等级 |

### 4.7 系统管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/log/operation` | 操作日志（`module`、`operatorType`、日期范围、分页） |
| GET | `/admin/log/login` | 登录日志 |
| GET | `/admin/file/list` | 上传文件列表 |
| DELETE | `/admin/file/:fileId` | 删除文件 |
| POST | `/admin/upload` | 上传图片 |

---

## 五、关键接口详细定义

### 5.1 微信静默登录

**`POST /api/customer/auth/login`**

请求：
```json
{ "code": "081Abc000xyzABCdef" }
```

响应：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800,
    "needBindPhone": true,
    "user": {
      "id": "1024",
      "nickname": null,
      "avatar": null,
      "phone": null
    }
  }
}
```

> `needBindPhone = true` 时，前端在触发下单/进入我的页面时引导手机号授权。

### 5.2 手机号一键授权

**`POST /api/customer/auth/phone`**

请求：
```json
{ "code": "手机号快速验证返回的 code" }
```

响应：
```json
{
  "code": 0,
  "data": {
    "phone": "138****8888",
    "user": { "id": "1024", "phone": "13800008888", "nickname": "微信用户" }
  }
}
```

失败：`code = 400`（code 无效或已使用），需重新触发授权。

### 5.3 扫码解析

**`GET /api/customer/store/scan?scene=s1t12`**

响应：
```json
{
  "code": 0,
  "data": {
    "store": {
      "id": "1",
      "name": "爱猫咖啡（旗舰店）",
      "logo": "https://...",
      "businessStatus": 1,
      "businessHours": "09:00 - 22:00",
      "announcement": "新店开业，满 50 减 10",
      "allowDineIn": 1,
      "allowTakeaway": 1
    },
    "table": { "id": "12", "tableNo": "A03", "area": "A区", "seats": 4 },
    "defaultOrderType": "DINE_IN"
  }
}
```

桌位无效时：`code = 1007`，`data.store` 仍返回（降级为手动选桌）。

### 5.4 获取菜单

**`GET /api/customer/store/1/menu`**

响应（结构固定，前端直接渲染双栏）：
```json
{
  "code": 0,
  "data": {
    "categories": [
      {
        "id": "1",
        "name": "招牌特调",
        "icon": "https://...",
        "dishCount": 2,
        "dishes": [
          {
            "id": "1",
            "name": "猫爪拿铁",
            "cover": "https://...",
            "description": "招牌猫爪拉花，香醇丝滑",
            "price": 32.00,
            "originalPrice": 38.00,
            "unit": "杯",
            "sales": 268,
            "tags": ["招牌"],
            "isRecommend": 1,
            "hasSpec": 1,
            "soldOut": 0,
            "status": 1
          }
        ]
      }
    ],
    "storeStatus": 1
  }
}
```

### 5.5 菜品详情（含规格）

**`GET /api/customer/dish/1`**

响应：
```json
{
  "code": 0,
  "data": {
    "id": "1",
    "name": "猫爪拿铁",
    "cover": "https://...",
    "images": ["https://...", "https://..."],
    "description": "招牌猫爪拉花，香醇丝滑",
    "price": 32.00,
    "originalPrice": 38.00,
    "unit": "杯",
    "sales": 268,
    "soldOut": 0,
    "specGroups": [
      {
        "id": "1",
        "name": "杯型",
        "isRequired": 1,
        "multiSelect": 0,
        "items": [
          { "id": "1", "name": "中杯", "extraPrice": 0.00, "isDefault": 1 },
          { "id": "2", "name": "大杯", "extraPrice": 3.00, "isDefault": 0 }
        ]
      },
      {
        "id": "2",
        "name": "温度",
        "isRequired": 1,
        "multiSelect": 0,
        "items": [
          { "id": "3", "name": "热", "extraPrice": 0.00, "isDefault": 1 },
          { "id": "4", "name": "冰", "extraPrice": 0.00, "isDefault": 0 }
        ]
      }
    ],
    "addons": []
  }
}
```

### 5.6 结算预览

**`POST /api/customer/order/preview`**

请求：
```json
{
  "storeId": "1",
  "orderType": "DINE_IN",
  "tableId": "12",
  "items": [
    {
      "dishId": "1",
      "quantity": 2,
      "specItemIds": ["2", "4"],
      "addonIds": [],
      "remark": "少冰"
    }
  ],
  "userCouponId": null,
  "usePoints": false
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "priceDetail": {
      "goodsAmount": 70.00,
      "memberLevelId": "3",
      "memberLevelName": "金卡会员",
      "memberDiscountRate": 0.90,
      "memberDiscount": 7.00,
      "couponDiscount": 0.00,
      "couponName": null,
      "pointsUsed": 0,
      "pointsDiscount": 0.00,
      "payAmount": 63.00,
      "details": [
        { "label": "商品金额", "value": 70.00, "type": "ADD" },
        { "label": "会员折扣（9折）", "value": -7.00, "type": "SUB" }
      ]
    },
    "availableCoupons": [
      {
        "userCouponId": "88",
        "name": "开业满减券",
        "type": "FULL_REDUCE",
        "thresholdAmount": 50.00,
        "discountAmount": 10.00,
        "discountRate": null,
        "expireAt": "2026-12-31 23:59:59",
        "usable": true,
        "unusableReason": null
      }
    ],
    "pointsInfo": {
      "balance": 1200,
      "deductRatio": 100,
      "maxUsablePoints": 600,
      "maxDeductAmount": 6.00,
      "step": 100
    }
  }
}
```

### 5.7 提交订单

**`POST /api/customer/order`**

请求：
```json
{
  "storeId": "1",
  "orderType": "DINE_IN",
  "tableId": "12",
  "peopleCount": 2,
  "items": [
    { "dishId": "1", "quantity": 2, "specItemIds": ["2","4"], "addonIds": [], "remark": "少冰" }
  ],
  "userCouponId": "88",
  "usePoints": true,
  "pointsUsed": 500,
  "remark": "靠窗的位置",
  "requestId": "客户端幂等 ID"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "orderId": "10086",
    "orderNo": "20260914153205014823",
    "orderType": "DINE_IN",
    "tableNo": "A03",
    "pickupCode": null,
    "payAmount": 53.00,
    "status": "PENDING",
    "payStatus": "UNPAID",
    "tip": "下单成功！桌号 A03，请稍候"
  }
}
```

打包订单响应中 `tableNo = null`、`pickupCode = "A012"`、`tip = "下单成功！取餐码 A012，请留意叫号"`。

**校验失败返回示例**：
```json
{ "code": 1003, "msg": "「猫爪拿铁」已售罄，请重新选择", "data": { "dishId": "1" } }
```

### 5.8 订单详情（顾客端）

**`GET /api/customer/order/10086`**

响应：
```json
{
  "code": 0,
  "data": {
    "id": "10086",
    "orderNo": "20260914153205014823",
    "storeId": "1",
    "storeName": "爱猫咖啡（旗舰店）",
    "orderType": "DINE_IN",
    "tableNo": "A03",
    "pickupCode": null,
    "peopleCount": 2,
    "status": "MAKING",
    "statusText": "制作中",
    "payStatus": "UNPAID",
    "payStatusText": "待收款",
    "payMethod": "到店付款",
    "items": [
      {
        "id": "1",
        "dishId": "1",
        "dishName": "猫爪拿铁",
        "dishCover": "https://...",
        "unitPrice": 35.00,
        "quantity": 2,
        "specText": "大杯 / 冰",
        "addons": [],
        "remark": "少冰",
        "subtotal": 70.00
      }
    ],
    "itemCount": 2,
    "priceDetail": {
      "goodsAmount": 70.00,
      "memberDiscount": 7.00,
      "couponDiscount": 10.00,
      "pointsDiscount": 5.00,
      "pointsUsed": 500,
      "payAmount": 48.00,
      "details": [
        { "label": "商品金额", "value": 70.00, "type": "ADD" },
        { "label": "会员折扣（9折）", "value": -7.00, "type": "SUB" },
        { "label": "优惠券（开业满减券）", "value": -10.00, "type": "SUB" },
        { "label": "积分抵扣（500积分）", "value": -5.00, "type": "SUB" }
      ]
    },
    "remark": "靠窗的位置",
    "modifyCount": 1,
    "modifyNotice": "店主已调整菜品：新增 1 项，最新金额 ¥48.00",
    "timeline": [
      { "action": "CREATE", "title": "已下单", "time": "2026-09-14 15:32:05" },
      { "action": "ACCEPT", "title": "店主已接单", "time": "2026-09-14 15:32:20" },
      { "action": "MAKE",   "title": "开始制作",   "time": "2026-09-14 15:32:45" }
    ],
    "buttons": ["URGE", "CANCEL"],
    "createdAt": "2026-09-14 15:32:05",
    "acceptedAt": "2026-09-14 15:32:20",
    "makingAt": "2026-09-14 15:32:45"
  }
}
```

> `buttons` 由服务端根据**当前状态 + 操作者身份**计算返回，前端按数组渲染，避免前端硬编码状态逻辑导致不一致。

### 5.9 店主登录

**`POST /api/merchant/auth/login`**

请求：
```json
{ "phone": "13900000000", "password": "admin123" }
```

响应：
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800,
    "isInitPassword": 1,
    "user": { "id": "1", "realName": "店长小爱", "role": "OWNER", "avatar": null },
    "store": { "id": "1", "name": "爱猫咖啡（旗舰店）", "logo": "https://...", "businessStatus": 1 }
  }
}
```

`isInitPassword = 1` 时前端强制跳转修改密码页。

错误：`1008` 账号或密码错误；`1009` 账号已锁定（附带 `lockedUntil`）；`2001` 账号被禁用或门店已停用。

### 5.10 工作台轮询（新订单提醒）

**`GET /api/merchant/dashboard/pending-count`**

响应：
```json
{
  "code": 0,
  "data": {
    "pendingCount": 2,
    "lastOrderId": "10086",
    "lastOrderNo": "20260914153205014823",
    "lastOrderTable": "A03",
    "lastOrderAt": "2026-09-14 15:32:05"
  }
}
```

前端逻辑：每 5 秒轮询；当 `pendingCount` 增加或 `lastOrderId` 变化时，播放提示音 + 弹横幅 + 震动。

### 5.11 接单 / 拒单

**`POST /api/merchant/order/10086/accept`** → 无请求体

```json
{ "code": 0, "msg": "接单成功", "data": { "status": "ACCEPTED", "acceptedAt": "2026-09-14 15:32:20" } }
```

**`POST /api/merchant/order/10086/reject`**

```json
{ "reason": "菜品售罄", "remark": "抱歉，猫爪拿铁今日已售完" }
```

→ 订单置为 `REJECTED`，自动退回优惠券与积分。

状态非法时返回：
```json
{ "code": 1004, "msg": "当前订单状态不支持该操作，请刷新后重试", "data": { "currentStatus": "COMPLETED" } }
```

### 5.12 标记已收款

**`POST /api/merchant/order/10086/pay`**

```json
{ "paidAmount": 48.00, "remark": "现金收款" }
```

响应：
```json
{ "code": 0, "data": { "payStatus": "PAID", "paidAt": "2026-09-14 15:50:00", "paidAmount": 48.00 } }
```

### 5.13 改单（核心接口）

**`POST /api/merchant/order/10086/modify`**

请求：
```json
{
  "items": [
    { "orderItemId": "1", "quantity": 2, "remark": "少冰" },
    { "orderItemId": "2", "quantity": 0 },
    { "dishId": "3", "quantity": 1, "specItemIds": [], "addonIds": [], "remark": "" }
  ],
  "remark": "靠窗的位置",
  "orderType": "DINE_IN",
  "tableId": "12",
  "manualDiscount": 0.00,
  "modifyReason": "顾客加了一杯蛋糕"
}
```

字段说明：
| 字段 | 说明 |
| --- | --- |
| `items[].orderItemId` | 已存在明细的 ID；`quantity = 0` 表示删除该项 |
| `items[].dishId` | 无 `orderItemId` 时表示**新增**菜品 |
| `manualDiscount` | 店主手动立减金额（P1），服务端记录但需在改单日志中留痕 |
| `modifyReason` | 改单原因，写入 `order_modify_log.remark` |

响应：
```json
{
  "code": 0,
  "msg": "改单成功",
  "data": {
    "orderId": "10086",
    "amountBefore": 48.00,
    "amountAfter": 76.00,
    "amountChange": 28.00,
    "needRefund": 0.00,
    "priceDetail": {
      "goodsAmount": 98.00,
      "memberDiscount": 9.80,
      "couponDiscount": 10.00,
      "pointsDiscount": 5.00,
      "payAmount": 73.20,
      "details": [
        { "label": "商品金额", "value": 98.00, "type": "ADD" },
        { "label": "会员折扣（9折）", "value": -9.80, "type": "SUB" },
        { "label": "优惠券（开业满减券）", "value": -10.00, "type": "SUB" },
        { "label": "积分抵扣（500积分）", "value": -5.00, "type": "SUB" }
      ]
    },
    "changeSummary": "新增「巴斯克芝士蛋糕」×1，共 3 件，最新金额 ¥73.20",
    "couponRevalidated": true
  }
}
```

**业务校验（服务端必须全部校验）**：
1. 订单属于当前 `storeId`（越权防护）
2. 订单状态不是 `COMPLETED` / `CANCELLED` / `REJECTED`，否则返回 1004
3. 新增菜品属于本店且已上架、未沽清，否则 1003
4. 改单后优惠券门槛重新校验：不满足则自动移除该券并在响应中标注 `couponRevalidated = false`（附提示文案）
5. 改单后积分抵扣上限重新校验：超出部分自动回退，并在响应中体现 `pointsUsed` 变化
6. 若金额下降且订单 `pay_status = PAID`，计算 `needRefund` 并提示店主线下退款
7. **整个改单过程（明细增删改 + 金额重算 + 日志写入）必须在同一数据库事务内完成**

### 5.14 单价计算规则（前端与后端共用，以服务端为准）

```
单价 = dish.price + Σ(所选 specItem.extraPrice) + Σ(所选 addon.price)
小计 = 单价 × quantity
商品金额 = Σ 小计
会员折扣额 = round(商品金额 × (1 - memberLevel.discount))
券后金额 = 商品金额 - 会员折扣额
优惠券抵扣额 =
    FULL_REDUCE / CASH : min(discountAmount, 券后金额)   // 需 券后金额 >= thresholdAmount
    DISCOUNT           : min(券后金额 × (1 - discountRate), maxDiscountAmount)
积分抵扣额 = floor(min(pointsBalance, 券后金额 × maxRate / deductRatio ... ) / step) × step / deductRatio
应付金额 = max(券后金额 - 优惠券抵扣额 - 积分抵扣额, 0.01)
```

> 所有金额运算以「分」为单位取整，最后除以 100 返回，避免浮点误差。

### 5.15 超管创建店主账号

**`POST /api/admin/store-user`**

请求：
```json
{
  "phone": "13900000000",
  "realName": "店长小爱",
  "storeId": "1",
  "role": "OWNER",
  "password": "auto"
}
```

`password = "auto"` 时服务端生成 8 位随机密码。

响应：
```json
{
  "code": 0,
  "data": {
    "id": "2",
    "phone": "13900000000",
    "realName": "店长小爱",
    "storeId": "1",
    "storeName": "爱猫咖啡（旗舰店）",
    "role": "OWNER",
    "initPassword": "Kf7m2Qa9",
    "tip": "初始密码仅显示一次，请复制并告知店主"
  }
}
```

### 5.16 平台看板概览

**`GET /api/admin/dashboard/overview?range=today`**

响应：
```json
{
  "code": 0,
  "data": {
    "storeTotal": 3,
    "storeActive": 2,
    "ownerTotal": 4,
    "orderToday": 128,
    "revenueToday": 5860.00,
    "memberTotal": 862,
    "memberNewToday": 12,
    "compareYesterday": {
      "orderGrowth": 0.15,
      "revenueGrowth": 0.22
    }
  }
}
```

---

## 六、接口鉴权与中间件

### 6.1 中间件链路

```
请求 → 请求日志 → 限流 → JWT 解析 → 用户类型校验 → 门店隔离注入 → 业务校验 → Controller → Service → 统一响应
```

### 6.2 门店隔离（关键安全设计）

```ts
// 伪代码：storeScope 中间件
async function storeScope(ctx, next) {
  const payload = ctx.state.jwt;          // 由 jwtAuth 中间件解析
  if (payload.type === 'MERCHANT') {
    const storeUser = await storeUserRepo.findById(payload.sub);
    if (!storeUser || storeUser.status !== 1) throw new BizError(2001, '账号已被禁用');
    const store = await storeRepo.findById(storeUser.store_id);
    if (!store || store.status !== 1) throw new BizError(2001, '门店已停用');
    ctx.state.storeId = storeUser.store_id;   // ← 唯一可信来源
    ctx.state.storeUser = storeUser;
  }
  await next();
}
```

**Service 层强制约定**：所有查询与写入必须以 `ctx.state.storeId` 作为第一个条件，禁止从 `req.body` / `req.query` 读取 `storeId`。

### 6.3 接口清单自查表

开发完成后逐条核对：

| # | 检查项 |
| --- | --- |
| 1 | 顾客端所有涉及订单的接口均校验 `order.user_id === 当前用户` |
| 2 | 店主端所有接口均通过 `ctx.state.storeId` 过滤 |
| 3 | 订单状态变更接口均调用统一的状态机校验函数 |
| 4 | 下单、改单、状态流转均在数据库事务内完成 |
| 5 | 金额计算全部在服务端完成，前端传入的金额字段一律忽略 |
| 6 | 手机号在响应中统一脱敏 |
| 7 | 上传接口校验文件类型与体积 |
| 8 | 敏感操作写入 `operation_log` |
| 9 | 密码使用 bcrypt，绝不返回给前端 |
| 10 | 分页接口对 `pageSize` 做上限限制（≤ 50） |
