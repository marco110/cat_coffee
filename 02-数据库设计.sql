-- =============================================================================
--  爱猫咖啡 · 扫码点餐系统  数据库设计
--  DB: MySQL 8.0+    Charset: utf8mb4 / utf8mb4_unicode_ci    Engine: InnoDB
--  说明：
--    1. money 字段统一使用 DECIMAL(10,2)（金额单位：元）
--    2. 时间字段统一 DATETIME（北京时间），由服务端写入
--    3. 软删除统一使用 deleted_at（NULL = 未删除）
--    4. order 为 MySQL 保留字，订单主表命名为 order_main
--    5. 全量业务表带 store_id，为多门店预留
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `cat_coffee`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `cat_coffee`;

-- =============================================================================
-- 一、平台与账号体系
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 平台管理员（超级管理员 / 运营）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sys_admin`;
CREATE TABLE `sys_admin` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`      VARCHAR(50)     NOT NULL                COMMENT '登录账号',
  `password`      VARCHAR(100)    NOT NULL                COMMENT '密码（bcrypt 加密）',
  `real_name`     VARCHAR(50)              DEFAULT NULL   COMMENT '姓名',
  `phone`         VARCHAR(20)              DEFAULT NULL   COMMENT '手机号',
  `role`          VARCHAR(20)     NOT NULL DEFAULT 'SUPER_ADMIN' COMMENT '角色：SUPER_ADMIN 超级管理员 / OPERATOR 运营',
  `status`        TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 禁用',
  `login_fail_count` INT          NOT NULL DEFAULT 0      COMMENT '连续登录失败次数',
  `locked_until`  DATETIME                 DEFAULT NULL   COMMENT '锁定截止时间',
  `last_login_at` DATETIME                 DEFAULT NULL   COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(50)              DEFAULT NULL   COMMENT '最后登录 IP',
  `remark`        VARCHAR(255)             DEFAULT NULL   COMMENT '备注',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台管理员表';

-- -----------------------------------------------------------------------------
-- 2. 门店
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `store`;
CREATE TABLE `store` (
  `id`                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`                    VARCHAR(50)     NOT NULL                COMMENT '门店名称（同一平台内名称由业务层校验唯一；因软删除不使用数据库唯一索引）',
  `logo`                    VARCHAR(255)             DEFAULT NULL   COMMENT '门店 Logo 图片地址',
  `cover`                   VARCHAR(255)             DEFAULT NULL   COMMENT '门店封面图地址',
  `intro`                   TEXT                                    COMMENT '门店简介',
  `announcement`            VARCHAR(200)             DEFAULT NULL   COMMENT '首页公告（跑马灯）',
  `phone`                   VARCHAR(20)              DEFAULT NULL   COMMENT '联系电话',
  `province`                VARCHAR(50)              DEFAULT NULL   COMMENT '省',
  `city`                    VARCHAR(50)              DEFAULT NULL   COMMENT '市',
  `district`                VARCHAR(50)              DEFAULT NULL   COMMENT '区/县',
  `address`                 VARCHAR(200)             DEFAULT NULL   COMMENT '详细地址',
  `longitude`               DECIMAL(10,7)            DEFAULT NULL   COMMENT '经度',
  `latitude`                DECIMAL(10,7)            DEFAULT NULL   COMMENT '纬度',
  `business_hours_start`    VARCHAR(5)               DEFAULT '09:00' COMMENT '营业开始时间 HH:mm',
  `business_hours_end`      VARCHAR(5)               DEFAULT '22:00' COMMENT '营业结束时间 HH:mm',
  `business_status`         TINYINT         NOT NULL DEFAULT 1      COMMENT '营业状态：1 营业中 / 0 休息中',

  -- 下单与展示配置
  `allow_dine_in`           TINYINT         NOT NULL DEFAULT 1      COMMENT '是否开放堂食：1 是 / 0 否',
  `allow_takeaway`          TINYINT         NOT NULL DEFAULT 1      COMMENT '是否开放打包：1 是 / 0 否',
  `need_scan_table`         TINYINT         NOT NULL DEFAULT 0      COMMENT '堂食是否必须扫码带桌号：1 是 / 0 否（0 允许手动选桌）',
  `auto_accept_order`       TINYINT         NOT NULL DEFAULT 0      COMMENT '是否自动接单：1 是 / 0 否',
  `show_sales`              TINYINT         NOT NULL DEFAULT 1      COMMENT '是否展示销量：1 是 / 0 否',
  `show_sold_out_dish`      TINYINT         NOT NULL DEFAULT 1      COMMENT '是否展示已售罄菜品：1 展示 / 0 隐藏',
  `hot_sales_threshold`     INT             NOT NULL DEFAULT 100    COMMENT '热销标签阈值（销量大于该值打热销标签）',

  -- 取餐码配置
  `pickup_code_prefix`      VARCHAR(5)      NOT NULL DEFAULT 'A'    COMMENT '取餐码前缀',
  `pickup_code_daily_reset` TINYINT         NOT NULL DEFAULT 1      COMMENT '取餐码是否每日重置：1 是 / 0 否',

  -- 会员与积分配置
  `member_enabled`          TINYINT         NOT NULL DEFAULT 1      COMMENT '会员功能总开关：1 开 / 0 关',
  `growth_rate`             DECIMAL(10,2)   NOT NULL DEFAULT 1.00   COMMENT '成长值比例：1 元 = N 成长值',
  `points_enabled`          TINYINT         NOT NULL DEFAULT 1      COMMENT '积分功能开关：1 开 / 0 关',
  `points_rate`             DECIMAL(10,2)   NOT NULL DEFAULT 1.00   COMMENT '积分比例：1 元 = N 积分',
  `points_deduct_ratio`     INT             NOT NULL DEFAULT 100    COMMENT '抵扣比例：多少积分 = 1 元',
  `points_deduct_max_rate`  DECIMAL(5,2)    NOT NULL DEFAULT 30.00  COMMENT '单笔积分抵扣上限（占订单金额百分比，0 表示不限）',
  `points_deduct_step`      INT             NOT NULL DEFAULT 100    COMMENT '积分抵扣最小单位（积分数）',
  `member_discount_stackable` TINYINT       NOT NULL DEFAULT 1      COMMENT '会员折扣与优惠券是否可叠加：1 可叠加 / 0 互斥',

  -- 提醒配置
  `order_sound_enabled`     TINYINT         NOT NULL DEFAULT 1      COMMENT '新订单声音提醒开关',
  `order_timeout_minutes`   INT             NOT NULL DEFAULT 3      COMMENT '待接单超时提醒阈值（分钟）',

  `status`                  TINYINT         NOT NULL DEFAULT 1      COMMENT '门店状态：1 正常 / 0 停用',
  `sort`                    INT             NOT NULL DEFAULT 0      COMMENT '排序值（越小越前）',
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`              DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店表';

-- -----------------------------------------------------------------------------
-- 3. 店主 / 店员账号（由超级管理员创建并绑定门店）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `store_user`;
CREATE TABLE `store_user` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`          BIGINT UNSIGNED NOT NULL                COMMENT '所属门店 ID',
  `phone`             VARCHAR(20)     NOT NULL                COMMENT '登录手机号（全局唯一，软删除后不可复用）',
  `password`          VARCHAR(100)    NOT NULL                COMMENT '密码（bcrypt 加密）',
  `real_name`         VARCHAR(50)              DEFAULT NULL   COMMENT '姓名',
  `avatar`            VARCHAR(255)             DEFAULT NULL   COMMENT '头像',
  `role`              VARCHAR(20)     NOT NULL DEFAULT 'OWNER' COMMENT '角色：OWNER 店主 / STAFF 店员',
  `permissions`       JSON                                    COMMENT '店员权限配置（P2，JSON 数组）',
  `is_init_password`  TINYINT         NOT NULL DEFAULT 1      COMMENT '是否为初始密码：1 是（登录后强制修改）',
  `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 正常 / 0 禁用',
  `login_fail_count`  INT             NOT NULL DEFAULT 0      COMMENT '连续登录失败次数',
  `locked_until`      DATETIME                 DEFAULT NULL   COMMENT '锁定截止时间',
  `last_login_at`     DATETIME                 DEFAULT NULL   COMMENT '最后登录时间',
  `last_login_ip`     VARCHAR(50)              DEFAULT NULL   COMMENT '最后登录 IP',
  `created_by`        BIGINT UNSIGNED          DEFAULT NULL   COMMENT '创建人（sys_admin.id）',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`        DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_role` (`store_id`, `role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店主/店员账号表';

-- -----------------------------------------------------------------------------
-- 4. 顾客（微信用户）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `openid`        VARCHAR(64)     NOT NULL                COMMENT '微信 openid（小程序唯一标识）',
  `unionid`       VARCHAR(64)              DEFAULT NULL   COMMENT '微信 unionid',
  `phone`         VARCHAR(20)              DEFAULT NULL   COMMENT '手机号（一键授权获取，全局唯一，NULL 表示未绑定）',
  `nickname`      VARCHAR(50)              DEFAULT NULL   COMMENT '昵称（用户自行填写）',
  `avatar`        VARCHAR(255)             DEFAULT NULL   COMMENT '头像地址',
  `gender`        TINYINT         NOT NULL DEFAULT 0      COMMENT '性别：0 未知 / 1 男 / 2 女',
  `status`        TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 正常 / 0 禁用',
  `last_login_at` DATETIME                 DEFAULT NULL   COMMENT '最后登录时间',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（注册时间）',
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_unionid` (`unionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='顾客表';

-- =============================================================================
-- 二、会员与积分
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5. 会员等级配置（store_id = 0 表示平台模板）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `member_level`;
CREATE TABLE `member_level` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0      COMMENT '门店 ID（0 表示平台级模板）',
  `name`             VARCHAR(20)     NOT NULL                COMMENT '等级名称（如 普通会员/银卡/金卡/黑卡）',
  `level_value`      TINYINT         NOT NULL                COMMENT '等级值（1 起，越大等级越高）',
  `growth_threshold` INT             NOT NULL DEFAULT 0      COMMENT '升级所需成长值（最低等级固定为 0）',
  `discount`         DECIMAL(3,2)    NOT NULL DEFAULT 1.00   COMMENT '专属折扣（1.00 = 无折扣，0.90 = 9 折）',
  `icon`             VARCHAR(255)             DEFAULT NULL   COMMENT '等级图标',
  `benefits`         VARCHAR(500)             DEFAULT NULL   COMMENT '权益说明文案',
  `is_default`       TINYINT         NOT NULL DEFAULT 0      COMMENT '是否默认等级（新用户初始等级，1 是）',
  `sort`             INT             NOT NULL DEFAULT 0      COMMENT '排序值（越小越前）',
  `status`           TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`, `status`),
  KEY `idx_store_level` (`store_id`, `level_value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员等级配置表';

-- -----------------------------------------------------------------------------
-- 6. 用户会员信息（按门店独立）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_member`;
CREATE TABLE `user_member` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`        BIGINT UNSIGNED NOT NULL                COMMENT '用户 ID',
  `store_id`       BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `level_id`       BIGINT UNSIGNED NOT NULL                COMMENT '当前等级 ID',
  `growth`         INT             NOT NULL DEFAULT 0      COMMENT '成长值',
  `points`         INT             NOT NULL DEFAULT 0      COMMENT '积分余额',
  `total_consume`  DECIMAL(12,2)   NOT NULL DEFAULT 0.00   COMMENT '累计消费金额',
  `order_count`    INT             NOT NULL DEFAULT 0      COMMENT '累计有效订单数',
  `last_order_at`  DATETIME                 DEFAULT NULL   COMMENT '最近下单时间',
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（成为会员时间）',
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_store` (`user_id`, `store_id`),
  KEY `idx_store_level` (`store_id`, `level_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会员信息表';

-- -----------------------------------------------------------------------------
-- 7. 积分明细
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `points_log`;
CREATE TABLE `points_log` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      BIGINT UNSIGNED NOT NULL                COMMENT '用户 ID',
  `store_id`     BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `type`         VARCHAR(20)     NOT NULL                COMMENT '类型：EARN 获得 / DEDUCT 抵扣 / REFUND 退回 / ADMIN 手动调整',
  `points`       INT             NOT NULL                COMMENT '变动积分（正数增加，负数减少）',
  `balance`      INT             NOT NULL                COMMENT '变动后积分余额',
  `source_type`  VARCHAR(20)     NOT NULL DEFAULT 'ORDER' COMMENT '来源：ORDER 订单 / ADMIN 人工 / REGISTER 注册奖励',
  `source_id`    BIGINT UNSIGNED          DEFAULT NULL   COMMENT '来源单据 ID（如订单 ID）',
  `remark`       VARCHAR(200)             DEFAULT NULL   COMMENT '备注（人工调整时必填原因）',
  `operator_id`  BIGINT UNSIGNED          DEFAULT NULL   COMMENT '操作人 ID（人工调整时为 store_user.id）',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_store` (`user_id`, `store_id`, `created_at`),
  KEY `idx_source` (`source_type`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分明细表';

-- =============================================================================
-- 三、桌位
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 8. 桌位
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `table_info`;
CREATE TABLE `table_info` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`     BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `table_no`     VARCHAR(10)     NOT NULL                COMMENT '桌号（门店内唯一，如 A01）',
  `area`         VARCHAR(20)              DEFAULT NULL   COMMENT '区域（如 A区 / 露台）',
  `seats`        INT             NOT NULL DEFAULT 2      COMMENT '座位数',
  `qrcode_url`   VARCHAR(255)             DEFAULT NULL   COMMENT '桌贴小程序码图片地址',
  `qrcode_scene` VARCHAR(64)              DEFAULT NULL   COMMENT '二维码 scene 参数（s{storeId}t{tableId}）',
  `qrcode_at`    DATETIME                 DEFAULT NULL   COMMENT '二维码生成时间（避免重复调用微信接口）',
  `status`       TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `sort`         INT             NOT NULL DEFAULT 0      COMMENT '排序值',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  -- 生成列：MySQL 唯一索引不约束 NULL 值，故用生成列把「未删除」统一为 0，保证启用中的桌号唯一
  `deleted_flag` TINYINT AS (IF(`deleted_at` IS NULL, 0, 1)) STORED COMMENT '软删除标记（生成列，仅用于唯一索引）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_table_no` (`store_id`, `table_no`, `deleted_flag`),
  KEY `idx_store_status` (`store_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='桌位表';

-- =============================================================================
-- 四、菜单（分类 / 菜品 / 规格）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9. 菜品分类
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `category`;
CREATE TABLE `category` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`   BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `name`       VARCHAR(20)     NOT NULL                COMMENT '分类名称',
  `icon`       VARCHAR(255)             DEFAULT NULL   COMMENT '分类图标',
  `sort`       INT             NOT NULL DEFAULT 0      COMMENT '排序值（越小越前）',
  `status`     TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  KEY `idx_store_sort` (`store_id`, `status`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品分类表';

-- -----------------------------------------------------------------------------
-- 10. 菜品
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `dish`;
CREATE TABLE `dish` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`       BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `category_id`    BIGINT UNSIGNED NOT NULL                COMMENT '所属分类 ID',
  `name`           VARCHAR(30)     NOT NULL                COMMENT '菜品名称',
  `cover`          VARCHAR(255)             DEFAULT NULL   COMMENT '主图地址',
  `images`         JSON                                    COMMENT '详情图集（URL 数组）',
  `description`    VARCHAR(200)             DEFAULT NULL   COMMENT '菜品描述',
  `price`          DECIMAL(10,2)   NOT NULL                COMMENT '售价（元）',
  `original_price` DECIMAL(10,2)            DEFAULT NULL   COMMENT '划线原价（需大于售价）',
  `unit`           VARCHAR(10)     NOT NULL DEFAULT '份'   COMMENT '单位（杯/份/块）',
  `sales`          INT             NOT NULL DEFAULT 0      COMMENT '真实销量（订单完成后累加）',
  `base_sales`     INT             NOT NULL DEFAULT 0      COMMENT '销量基数（展示销量 = base_sales + sales）',
  `tags`           JSON                                    COMMENT '标签数组（如 ["招牌","新品"]）',
  `is_recommend`   TINYINT         NOT NULL DEFAULT 0      COMMENT '是否推荐：1 是 / 0 否',
  `has_spec`       TINYINT         NOT NULL DEFAULT 0      COMMENT '是否有规格：1 有 / 0 无',
  `stock_mode`     VARCHAR(20)     NOT NULL DEFAULT 'UNLIMITED' COMMENT '库存模式：UNLIMITED 不限量 / DAILY_LIMIT 每日限量',
  `daily_limit`    INT             NOT NULL DEFAULT 0      COMMENT '每日限量数量（stock_mode=DAILY_LIMIT 时有效）',
  `sold_out`       TINYINT         NOT NULL DEFAULT 0      COMMENT '今日沽清：1 已售罄 / 0 正常（每日重置）',
  `status`         TINYINT         NOT NULL DEFAULT 1      COMMENT '上架状态：1 上架 / 0 下架',
  `sort`           INT             NOT NULL DEFAULT 0      COMMENT '排序值（越小越前）',
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  KEY `idx_store_category` (`store_id`, `category_id`, `status`, `sort`),
  KEY `idx_store_status` (`store_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品表';

-- -----------------------------------------------------------------------------
-- 11. 菜品规格组（如：杯型 / 温度 / 糖度）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `dish_spec_group`;
CREATE TABLE `dish_spec_group` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`    BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `dish_id`     BIGINT UNSIGNED NOT NULL                COMMENT '菜品 ID',
  `name`        VARCHAR(20)     NOT NULL                COMMENT '规格组名称（如 杯型）',
  `is_required` TINYINT         NOT NULL DEFAULT 1      COMMENT '是否必选：1 必选 / 0 可选',
  `multi_select` TINYINT        NOT NULL DEFAULT 0      COMMENT '是否多选：1 多选 / 0 单选',
  `sort`        INT             NOT NULL DEFAULT 0      COMMENT '排序值',
  `status`      TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_dish` (`dish_id`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品规格组表';

-- -----------------------------------------------------------------------------
-- 12. 菜品规格项（如：中杯 +0 / 大杯 +3）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `dish_spec_item`;
CREATE TABLE `dish_spec_item` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`     BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `dish_id`      BIGINT UNSIGNED NOT NULL                COMMENT '菜品 ID',
  `group_id`     BIGINT UNSIGNED NOT NULL                COMMENT '规格组 ID',
  `name`         VARCHAR(20)     NOT NULL                COMMENT '规格项名称（如 大杯）',
  `extra_price`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '加价（可为负数）',
  `is_default`   TINYINT         NOT NULL DEFAULT 0      COMMENT '是否默认选中：1 是 / 0 否',
  `sort`         INT             NOT NULL DEFAULT 0      COMMENT '排序值',
  `status`       TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_group` (`group_id`, `sort`),
  KEY `idx_dish` (`dish_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品规格项表';

-- -----------------------------------------------------------------------------
-- 13. 加料/小料库（P2，门店级）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `addon`;
CREATE TABLE `addon` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`   BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `name`       VARCHAR(20)     NOT NULL                COMMENT '加料名称（如 燕麦奶）',
  `price`      DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '加价',
  `sort`       INT             NOT NULL DEFAULT 0      COMMENT '排序值',
  `status`     TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  KEY `idx_store` (`store_id`, `status`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='加料库表';

-- =============================================================================
-- 五、订单
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 14. 订单主表
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_main`;
CREATE TABLE `order_main` (
  `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no`               VARCHAR(32)     NOT NULL                COMMENT '订单号（全局唯一）',
  `store_id`               BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `user_id`                BIGINT UNSIGNED NOT NULL                COMMENT '顾客 ID',
  `user_phone`             VARCHAR(20)              DEFAULT NULL   COMMENT '下单手机号快照',
  `order_type`             VARCHAR(20)     NOT NULL                COMMENT '订单类型：DINE_IN 堂食 / TAKEAWAY 打包',
  `table_id`               BIGINT UNSIGNED          DEFAULT NULL   COMMENT '桌位 ID（堂食必填）',
  `table_no`               VARCHAR(10)              DEFAULT NULL   COMMENT '桌号快照',
  `pickup_code`            VARCHAR(10)              DEFAULT NULL   COMMENT '取餐码（打包单生成，如 A012）',
  `people_count`           INT             NOT NULL DEFAULT 1      COMMENT '就餐人数',
  `status`                 VARCHAR(20)     NOT NULL DEFAULT 'PENDING' COMMENT '订单状态：PENDING/ACCEPTED/MAKING/READY/COMPLETED/CANCELLED/REJECTED',
  `pay_status`             VARCHAR(20)     NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态：UNPAID 待收款 / PAID 已收款',
  `paid_at`                DATETIME                 DEFAULT NULL   COMMENT '收款时间',
  `paid_by`                BIGINT UNSIGNED          DEFAULT NULL   COMMENT '收款操作人（store_user.id）',
  `refund_amount`          DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '退款金额（线下退款登记）',
  `refund_remark`          VARCHAR(200)             DEFAULT NULL   COMMENT '退款备注',

  -- 金额（服务端计算并冗余存储，不受菜单改价影响）
  `goods_amount`           DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '商品金额（原价合计）',
  `member_level_id`        BIGINT UNSIGNED          DEFAULT NULL   COMMENT '下单时会员等级 ID',
  `member_level_name`      VARCHAR(20)              DEFAULT NULL   COMMENT '下单时会员等级名称快照',
  `member_discount_rate`   DECIMAL(3,2)    NOT NULL DEFAULT 1.00   COMMENT '下单时会员折扣率快照',
  `member_discount_amount` DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '会员折扣金额',
  `user_coupon_id`         BIGINT UNSIGNED          DEFAULT NULL   COMMENT '使用的用户券 ID',
  `coupon_name`            VARCHAR(50)              DEFAULT NULL   COMMENT '优惠券名称快照',
  `coupon_discount_amount` DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '优惠券抵扣金额',
  `points_used`            INT             NOT NULL DEFAULT 0      COMMENT '使用的积分数',
  `points_discount_amount` DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '积分抵扣金额',
  `pay_amount`             DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '应付金额（实付）',
  `growth_earned`          INT             NOT NULL DEFAULT 0      COMMENT '本单获得成长值',
  `points_earned`          INT             NOT NULL DEFAULT 0      COMMENT '本单获得积分',
  `settled`                TINYINT         NOT NULL DEFAULT 0      COMMENT '会员是否已结算：1 已结算 / 0 未结算',

  `remark`                 VARCHAR(200)             DEFAULT NULL   COMMENT '整单备注',
  `item_count`             INT             NOT NULL DEFAULT 0      COMMENT '菜品总件数',
  `modify_count`           INT             NOT NULL DEFAULT 0      COMMENT '改单次数',

  -- 状态时间戳（用于时间轴展示）
  `accepted_at`            DATETIME                 DEFAULT NULL   COMMENT '接单时间',
  `making_at`              DATETIME                 DEFAULT NULL   COMMENT '开始制作时间',
  `ready_at`               DATETIME                 DEFAULT NULL   COMMENT '出品完成时间',
  `completed_at`           DATETIME                 DEFAULT NULL   COMMENT '完成时间',
  `cancelled_at`           DATETIME                 DEFAULT NULL   COMMENT '取消时间',
  `cancel_reason`          VARCHAR(200)             DEFAULT NULL   COMMENT '取消/拒单原因',
  `cancelled_by`           VARCHAR(20)              DEFAULT NULL   COMMENT '取消发起方：CUSTOMER 顾客 / MERCHANT 店主 / SYSTEM 系统',

  `created_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
  `updated_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`             DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_store_status_created` (`store_id`, `status`, `created_at`),
  KEY `idx_store_created` (`store_id`, `created_at`),
  KEY `idx_user` (`user_id`, `created_at`),
  KEY `idx_store_pickup` (`store_id`, `pickup_code`),
  KEY `idx_pay_status` (`store_id`, `pay_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单主表';

-- -----------------------------------------------------------------------------
-- 15. 订单明细（保存菜品快照）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_item`;
CREATE TABLE `order_item` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`      BIGINT UNSIGNED NOT NULL                COMMENT '订单 ID',
  `store_id`      BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `dish_id`       BIGINT UNSIGNED NOT NULL                COMMENT '菜品 ID',
  `dish_name`     VARCHAR(30)     NOT NULL                COMMENT '菜品名称快照',
  `dish_cover`    VARCHAR(255)             DEFAULT NULL   COMMENT '菜品主图快照',
  `category_name` VARCHAR(20)              DEFAULT NULL   COMMENT '分类名称快照',
  `unit_price`    DECIMAL(10,2)   NOT NULL                COMMENT '单价（含规格加价，快照）',
  `quantity`      INT             NOT NULL DEFAULT 1      COMMENT '数量',
  `spec_snapshot` JSON                                    COMMENT '规格快照（规格组/规格项/加价）',
  `spec_text`     VARCHAR(200)             DEFAULT NULL   COMMENT '规格文案（如 大杯/热/半糖）',
  `addons`        JSON                                    COMMENT '加料快照（P2）',
  `addon_amount`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '加料加价合计',
  `remark`        VARCHAR(100)             DEFAULT NULL   COMMENT '单品备注',
  `subtotal`      DECIMAL(10,2)   NOT NULL                COMMENT '小计（unit_price + addon_amount）× quantity',
  `is_gift`       TINYINT         NOT NULL DEFAULT 0      COMMENT '是否赠品（店主手动标记）',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_dish` (`store_id`, `dish_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单明细表';

-- -----------------------------------------------------------------------------
-- 16. 订单状态流转日志（时间轴数据源）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_log`;
CREATE TABLE `order_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`      BIGINT UNSIGNED NOT NULL                COMMENT '订单 ID',
  `store_id`      BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `action`        VARCHAR(30)     NOT NULL                COMMENT '动作：CREATE/ACCEPT/REJECT/MAKE/READY/COMPLETE/CANCEL/PAY/MODIFY',
  `from_status`   VARCHAR(20)              DEFAULT NULL   COMMENT '变更前状态',
  `to_status`     VARCHAR(20)              DEFAULT NULL   COMMENT '变更后状态',
  `operator_type` VARCHAR(20)     NOT NULL                COMMENT '操作者类型：CUSTOMER/MERCHANT/SYSTEM',
  `operator_id`   BIGINT UNSIGNED          DEFAULT NULL   COMMENT '操作者 ID',
  `operator_name` VARCHAR(50)              DEFAULT NULL   COMMENT '操作者名称快照',
  `remark`        VARCHAR(200)             DEFAULT NULL   COMMENT '备注（拒单/取消原因等）',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单状态流转日志表';

-- -----------------------------------------------------------------------------
-- 17. 订单改单记录
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_modify_log`;
CREATE TABLE `order_modify_log` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`        BIGINT UNSIGNED NOT NULL                COMMENT '订单 ID',
  `store_id`        BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `operator_type`   VARCHAR(20)     NOT NULL                COMMENT '操作者类型：MERCHANT/SYSTEM',
  `operator_id`     BIGINT UNSIGNED          DEFAULT NULL   COMMENT '操作者 ID（store_user.id）',
  `operator_name`   VARCHAR(50)              DEFAULT NULL   COMMENT '操作者名称',
  `modify_type`     VARCHAR(30)     NOT NULL                COMMENT '改单类型：ADD_DISH/REDUCE_DISH/DELETE_DISH/CHANGE_QTY/CHANGE_SPEC/CHANGE_TYPE/DISCOUNT/CHANGE_REMARK',
  `before_snapshot` JSON                                    COMMENT '变更前订单快照（菜品+金额）',
  `after_snapshot`  JSON                                    COMMENT '变更后订单快照（菜品+金额）',
  `change_summary`  VARCHAR(300)             DEFAULT NULL   COMMENT '变更摘要文案（顾客端展示）',
  `amount_before`   DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '变更前应付金额',
  `amount_after`    DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '变更后应付金额',
  `amount_change`   DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '金额变化（正数增加，负数减少）',
  `need_refund`     DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '需线下退款金额',
  `remark`          VARCHAR(200)             DEFAULT NULL   COMMENT '改单原因备注',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单改单记录表';

-- -----------------------------------------------------------------------------
-- 18. 每日流水号（取餐码 / 订单序号）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `daily_sequence`;
CREATE TABLE `daily_sequence` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`      BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `biz_type`      VARCHAR(20)     NOT NULL                COMMENT '业务类型：PICKUP_CODE 取餐码 / ORDER_SEQ 订单序号',
  `seq_date`      DATE            NOT NULL                COMMENT '日期',
  `current_value` INT             NOT NULL DEFAULT 0      COMMENT '当前值',
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_biz_date` (`store_id`, `biz_type`, `seq_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日流水号表';

-- -----------------------------------------------------------------------------
-- 19. 每日营业统计（定时任务落表，用于看板加速）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `store_stats_daily`;
CREATE TABLE `store_stats_daily` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`          BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `stat_date`         DATE            NOT NULL                COMMENT '统计日期',
  `order_count`       INT             NOT NULL DEFAULT 0      COMMENT '订单总数',
  `completed_count`   INT             NOT NULL DEFAULT 0      COMMENT '已完成订单数',
  `cancelled_count`   INT             NOT NULL DEFAULT 0      COMMENT '已取消订单数',
  `dine_in_count`     INT             NOT NULL DEFAULT 0      COMMENT '堂食订单数',
  `takeaway_count`    INT             NOT NULL DEFAULT 0      COMMENT '打包订单数',
  `revenue`           DECIMAL(12,2)   NOT NULL DEFAULT 0.00   COMMENT '营业额（已收款订单实付合计）',
  `discount_amount`   DECIMAL(12,2)   NOT NULL DEFAULT 0.00   COMMENT '优惠总额（会员折扣+券+积分）',
  `avg_order_amount`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '客单价',
  `customer_count`    INT             NOT NULL DEFAULT 0      COMMENT '下单顾客数',
  `new_member_count`  INT             NOT NULL DEFAULT 0      COMMENT '新增会员数',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_date` (`store_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店每日统计表';

-- =============================================================================
-- 六、营销（优惠券）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 20. 优惠券模板
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `coupon`;
CREATE TABLE `coupon` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`             BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `name`                 VARCHAR(50)     NOT NULL                COMMENT '券名称',
  `type`                 VARCHAR(20)     NOT NULL                COMMENT '券类型：FULL_REDUCE 满减券 / DISCOUNT 折扣券 / CASH 代金券',
  `threshold_amount`     DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '使用门槛（满 X 元可用，0 表示无门槛）',
  `discount_amount`      DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '减免金额（满减券/代金券使用）',
  `discount_rate`        DECIMAL(3,2)    NOT NULL DEFAULT 1.00   COMMENT '折扣率（折扣券使用，如 0.85 表示 8.5 折）',
  `max_discount_amount`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '最高减免金额（折扣券使用，0 表示不限）',
  `total_count`          INT             NOT NULL DEFAULT 0      COMMENT '发放总量（0 表示不限量）',
  `issued_count`         INT             NOT NULL DEFAULT 0      COMMENT '已领取数量',
  `used_count`           INT             NOT NULL DEFAULT 0      COMMENT '已核销数量',
  `per_user_limit`       INT             NOT NULL DEFAULT 1      COMMENT '每人限领数量',
  `valid_type`           VARCHAR(20)     NOT NULL DEFAULT 'FIXED' COMMENT '有效期类型：FIXED 固定日期 / DAYS 领取后 N 天',
  `valid_start`          DATETIME                 DEFAULT NULL   COMMENT '有效期开始（valid_type=FIXED）',
  `valid_end`            DATETIME                 DEFAULT NULL   COMMENT '有效期结束（valid_type=FIXED，精确到 23:59:59）',
  `valid_days`           INT             NOT NULL DEFAULT 0      COMMENT '领取后有效天数（valid_type=DAYS）',
  `scope_type`           VARCHAR(20)     NOT NULL DEFAULT 'ALL'  COMMENT '适用范围：ALL 全场 / CATEGORY 指定分类 / DISH 指定菜品',
  `scope_ids`            JSON                                    COMMENT '适用范围 ID 数组（scope_type 非 ALL 时使用）',
  `grant_type`           VARCHAR(20)     NOT NULL DEFAULT 'CLAIM' COMMENT '发放方式：CLAIM 主动领取 / NEW_USER 新人自动发 / MANUAL 定向发放 / ORDER_REWARD 满额自动发',
  `is_public`            TINYINT         NOT NULL DEFAULT 1      COMMENT '是否在领券中心公开展示：1 是 / 0 否',
  `stackable`            TINYINT         NOT NULL DEFAULT 0      COMMENT '是否可叠加使用：1 可叠加 / 0 不可',
  `description`          VARCHAR(200)             DEFAULT NULL   COMMENT '使用说明文案',
  `status`               VARCHAR(20)     NOT NULL DEFAULT 'NOT_START' COMMENT '状态：NOT_START 未开始 / RUNNING 进行中 / ENDED 已结束 / DISABLED 已停用',
  `created_by`           BIGINT UNSIGNED          DEFAULT NULL   COMMENT '创建人（store_user.id）',
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`           DATETIME                 DEFAULT NULL   COMMENT '删除时间（软删除）',
  PRIMARY KEY (`id`),
  KEY `idx_store_status` (`store_id`, `status`, `deleted_at`),
  KEY `idx_store_public` (`store_id`, `is_public`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券模板表';

-- -----------------------------------------------------------------------------
-- 21. 用户持有优惠券
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_coupon`;
CREATE TABLE `user_coupon` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `coupon_id`    BIGINT UNSIGNED NOT NULL                COMMENT '券模板 ID',
  `user_id`      BIGINT UNSIGNED NOT NULL                COMMENT '用户 ID',
  `store_id`     BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `code`         VARCHAR(32)     NOT NULL                COMMENT '券码（唯一）',
  `status`       VARCHAR(20)     NOT NULL DEFAULT 'UNUSED' COMMENT '状态：UNUSED 未使用 / USED 已使用 / EXPIRED 已过期',
  `source`       VARCHAR(20)     NOT NULL DEFAULT 'CLAIM' COMMENT '来源：CLAIM 主动领取 / ADMIN_GRANT 定向发放 / NEW_USER 新人券 / ORDER_REWARD 满额奖励',
  `order_id`     BIGINT UNSIGNED          DEFAULT NULL   COMMENT '核销订单 ID',
  `received_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  `expire_at`    DATETIME                 DEFAULT NULL   COMMENT '过期时间（FIXED 取券模板 valid_end，DAYS 按领取时间计算）',
  `used_at`      DATETIME                 DEFAULT NULL   COMMENT '使用时间',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_user_status` (`user_id`, `store_id`, `status`, `expire_at`),
  KEY `idx_coupon` (`coupon_id`),
  KEY `idx_expire` (`status`, `expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户优惠券表';

-- -----------------------------------------------------------------------------
-- 22. 优惠券定向发放记录
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `coupon_grant_log`;
CREATE TABLE `coupon_grant_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `coupon_id`     BIGINT UNSIGNED NOT NULL                COMMENT '券模板 ID',
  `store_id`      BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `phone`         VARCHAR(20)     NOT NULL                COMMENT '目标手机号',
  `user_id`       BIGINT UNSIGNED          DEFAULT NULL   COMMENT '命中的用户 ID（未注册时为空）',
  `user_coupon_id` BIGINT UNSIGNED         DEFAULT NULL   COMMENT '生成的用户券 ID',
  `status`        VARCHAR(20)     NOT NULL DEFAULT 'SUCCESS' COMMENT '发放结果：SUCCESS 成功 / FAILED 失败 / PENDING 待用户注册后补发',
  `fail_reason`   VARCHAR(200)             DEFAULT NULL   COMMENT '失败原因',
  `operator_id`   BIGINT UNSIGNED          DEFAULT NULL   COMMENT '操作人（store_user.id）',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_coupon` (`coupon_id`, `created_at`),
  KEY `idx_store_phone` (`store_id`, `phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券发放记录表';

-- =============================================================================
-- 七、门店内容与系统
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 23. 门店轮播图
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `banner`;
CREATE TABLE `banner` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`   BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `image`      VARCHAR(255)    NOT NULL                COMMENT '图片地址',
  `link_type`  VARCHAR(20)     NOT NULL DEFAULT 'NONE' COMMENT '跳转类型：NONE/MENU/DISH/WEBVIEW',
  `link_value` VARCHAR(255)             DEFAULT NULL   COMMENT '跳转目标（菜品 ID / URL）',
  `sort`       INT             NOT NULL DEFAULT 0      COMMENT '排序值',
  `status`     TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 启用 / 0 停用',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_store` (`store_id`, `status`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店轮播图表';

-- -----------------------------------------------------------------------------
-- 24. 顾客评价（P2，表结构预留）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `review`;
CREATE TABLE `review` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`      BIGINT UNSIGNED NOT NULL                COMMENT '订单 ID',
  `store_id`      BIGINT UNSIGNED NOT NULL                COMMENT '门店 ID',
  `user_id`       BIGINT UNSIGNED NOT NULL                COMMENT '用户 ID',
  `score`         TINYINT         NOT NULL DEFAULT 5      COMMENT '总体评分 1-5',
  `taste_score`   TINYINT                  DEFAULT NULL   COMMENT '口味评分',
  `service_score` TINYINT                  DEFAULT NULL   COMMENT '服务评分',
  `content`       VARCHAR(500)             DEFAULT NULL   COMMENT '评价内容',
  `images`        JSON                                    COMMENT '评价图片数组',
  `reply`         VARCHAR(500)             DEFAULT NULL   COMMENT '店主回复',
  `replied_at`    DATETIME                 DEFAULT NULL   COMMENT '回复时间',
  `status`        TINYINT         NOT NULL DEFAULT 1      COMMENT '状态：1 正常 / 0 隐藏',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order` (`order_id`),
  KEY `idx_store` (`store_id`, `status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='顾客评价表';

-- -----------------------------------------------------------------------------
-- 25. 上传文件记录
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `upload_file`;
CREATE TABLE `upload_file` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0      COMMENT '门店 ID（0 表示平台）',
  `url`              VARCHAR(500)    NOT NULL                COMMENT '访问地址',
  `path`             VARCHAR(500)    NOT NULL                COMMENT '存储路径/对象 Key',
  `original_name`    VARCHAR(200)             DEFAULT NULL   COMMENT '原始文件名',
  `mime_type`        VARCHAR(50)              DEFAULT NULL   COMMENT 'MIME 类型',
  `size`             INT             NOT NULL DEFAULT 0      COMMENT '文件大小（字节）',
  `biz_type`         VARCHAR(30)              DEFAULT NULL   COMMENT '业务类型：DISH_COVER/STORE_LOGO/QRCODE/COUPON/AVATAR',
  `uploader_type`    VARCHAR(20)              DEFAULT NULL   COMMENT '上传者类型：CUSTOMER/MERCHANT/ADMIN',
  `uploader_id`      BIGINT UNSIGNED          DEFAULT NULL   COMMENT '上传者 ID',
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_store_biz` (`store_id`, `biz_type`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传文件表';

-- -----------------------------------------------------------------------------
-- 26. 操作日志
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `operation_log`;
CREATE TABLE `operation_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `store_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0      COMMENT '门店 ID（0 表示平台级操作）',
  `operator_type` VARCHAR(20)     NOT NULL                COMMENT '操作者类型：ADMIN/MERCHANT/CUSTOMER/SYSTEM',
  `operator_id`   BIGINT UNSIGNED          DEFAULT NULL   COMMENT '操作者 ID',
  `operator_name` VARCHAR(50)              DEFAULT NULL   COMMENT '操作者名称',
  `module`        VARCHAR(30)     NOT NULL                COMMENT '模块：STORE/STORE_USER/ORDER/DISH/CATEGORY/TABLE/COUPON/MEMBER/CONFIG/AUTH',
  `action`        VARCHAR(30)     NOT NULL                COMMENT '动作：CREATE/UPDATE/DELETE/LOGIN/LOGOUT/EXPORT/STATUS_CHANGE',
  `description`   VARCHAR(300)             DEFAULT NULL   COMMENT '操作描述',
  `target_id`     BIGINT UNSIGNED          DEFAULT NULL   COMMENT '目标对象 ID',
  `content`       JSON                                    COMMENT '变更内容（前后值）',
  `ip`            VARCHAR(50)              DEFAULT NULL   COMMENT '操作 IP',
  `user_agent`    VARCHAR(300)             DEFAULT NULL   COMMENT 'User-Agent',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_store_module` (`store_id`, `module`, `created_at`),
  KEY `idx_operator` (`operator_type`, `operator_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- -----------------------------------------------------------------------------
-- 27. 登录日志
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `login_log`;
CREATE TABLE `login_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_type`     VARCHAR(20)     NOT NULL                COMMENT '用户类型：ADMIN/MERCHANT',
  `user_id`       BIGINT UNSIGNED          DEFAULT NULL   COMMENT '用户 ID',
  `account`       VARCHAR(50)              DEFAULT NULL   COMMENT '登录账号（手机号/用户名）',
  `store_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0      COMMENT '门店 ID',
  `result`        TINYINT         NOT NULL DEFAULT 1      COMMENT '结果：1 成功 / 0 失败',
  `fail_reason`   VARCHAR(100)             DEFAULT NULL   COMMENT '失败原因',
  `ip`            VARCHAR(50)              DEFAULT NULL   COMMENT '登录 IP',
  `user_agent`    VARCHAR(300)             DEFAULT NULL   COMMENT 'User-Agent',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_type`, `user_id`, `created_at`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录日志表';

-- -----------------------------------------------------------------------------
-- 28. 平台配置（键值对）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_key`   VARCHAR(50)     NOT NULL                COMMENT '配置键',
  `config_value` TEXT                                    COMMENT '配置值',
  `config_group` VARCHAR(30)     NOT NULL DEFAULT 'PLATFORM' COMMENT '配置分组：PLATFORM 平台信息 / POINTS 积分默认规则 / UPLOAD 存储 / TEXT 文案',
  `description`  VARCHAR(200)             DEFAULT NULL   COMMENT '配置说明',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台配置表';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 八、初始化数据
-- =============================================================================

-- 超级管理员：账号 admin / 密码 admin123（bcrypt cost=10）
-- ⚠️ 生产环境务必首次登录后立即修改密码
INSERT INTO `sys_admin` (`username`, `password`, `real_name`, `role`, `status`)
VALUES ('admin', '$2b$10$Qtyuxef1Vr05Z1dD2tnIQu5Q5tufGKJbsx6n1.hbVdTuKR6UmFY9e', '超级管理员', 'SUPER_ADMIN', 1);

-- 平台默认配置
INSERT INTO `sys_config` (`config_key`, `config_value`, `config_group`, `description`) VALUES
('platform_name',        '爱猫咖啡',  'PLATFORM', '平台名称'),
('platform_logo',        '',         'PLATFORM', '平台 Logo 地址'),
('service_phone',        '',         'PLATFORM', '客服电话'),
('copyright',            '爱猫咖啡',  'PLATFORM', '版权信息'),
('default_growth_rate',  '1',        'POINTS',   '新门店默认成长值比例：1 元 = N 成长值'),
('default_points_rate',  '1',        'POINTS',   '新门店默认积分比例：1 元 = N 积分'),
('default_points_deduct_ratio', '100', 'POINTS', '新门店默认抵扣比例：多少积分 = 1 元'),
('default_points_deduct_max_rate', '30', 'POINTS', '新门店默认积分抵扣上限（%）'),
('upload_driver',        'local',    'UPLOAD',   '文件存储驱动：local / cos / oss'),
('upload_max_size_mb',   '5',        'UPLOAD',   '单个文件最大体积（MB）');

-- 平台默认会员等级模板（store_id = 0）
INSERT INTO `member_level` (`store_id`, `name`, `level_value`, `growth_threshold`, `discount`, `benefits`, `is_default`, `sort`, `status`) VALUES
(0, '普通会员', 1, 0,    1.00, '注册即享，累计消费可升级', 1, 1, 1),
(0, '银卡会员', 2, 500,  0.95, '全场 9.5 折', 0, 2, 1),
(0, '金卡会员', 3, 2000, 0.90, '全场 9 折，生日赠券', 0, 3, 1),
(0, '黑卡会员', 4, 5000, 0.85, '全场 8.5 折，新品优先体验', 0, 4, 1);

-- =============================================================================
-- 九、示例业务数据（可选，便于开发调试；生产环境请删除本段）
-- =============================================================================

-- 示例门店
INSERT INTO `store` (`name`, `intro`, `announcement`, `phone`, `city`, `address`, `business_hours_start`, `business_hours_end`)
VALUES ('爱猫咖啡（旗舰店）', '一家有猫的咖啡店，主营手冲、意式与季节限定特调。', '新店开业，满 50 减 10，欢迎撸猫~', '13800000000', '深圳市', '南山区科技园某某路 1 号', '09:00', '22:00');

-- 示例店主账号：手机号 13900000000 / 密码 admin123（务必修改）
INSERT INTO `store_user` (`store_id`, `phone`, `password`, `real_name`, `role`, `is_init_password`, `status`)
VALUES (1, '13900000000', '$2b$10$Qtyuxef1Vr05Z1dD2tnIQu5Q5tufGKJbsx6n1.hbVdTuKR6UmFY9e', '店长小爱', 'OWNER', 1, 1);

-- 示例门店会员等级（从模板复制）
INSERT INTO `member_level` (`store_id`, `name`, `level_value`, `growth_threshold`, `discount`, `benefits`, `is_default`, `sort`, `status`) VALUES
(1, '普通会员', 1, 0,    1.00, '注册即享，累计消费可升级', 1, 1, 1),
(1, '银卡会员', 2, 500,  0.95, '全场 9.5 折', 0, 2, 1),
(1, '金卡会员', 3, 2000, 0.90, '全场 9 折，生日赠券', 0, 3, 1),
(1, '黑卡会员', 4, 5000, 0.85, '全场 8.5 折，新品优先体验', 0, 4, 1);

-- 示例桌位
INSERT INTO `table_info` (`store_id`, `table_no`, `area`, `seats`, `sort`) VALUES
(1, 'A01', 'A区', 2, 1),
(1, 'A02', 'A区', 4, 2),
(1, 'A03', 'A区', 4, 3),
(1, 'B01', '露台', 2, 4);

-- 示例分类
INSERT INTO `category` (`store_id`, `name`, `sort`) VALUES
(1, '招牌特调', 1),
(1, '经典咖啡', 2),
(1, '茶饮果饮', 3),
(1, '甜点小食', 4);

-- 示例菜品（无规格 + 有规格各一）
INSERT INTO `dish` (`store_id`, `category_id`, `name`, `description`, `price`, `original_price`, `unit`, `base_sales`, `tags`, `is_recommend`, `has_spec`, `sort`) VALUES
(1, 1, '猫爪拿铁', '招牌猫爪拉花，香醇丝滑', 32.00, 38.00, '杯', 268, '["招牌"]', 1, 1, 1),
(1, 2, '美式咖啡', '经典单品，醇厚回甘', 22.00, NULL,  '杯', 156, '[]',       0, 1, 2),
(1, 4, '巴斯克芝士蛋糕', '现烤芝士，微焦外皮', 28.00, NULL, '份', 96, '["新品"]', 1, 0, 1);

-- 示例规格（猫爪拿铁：杯型 / 温度）
INSERT INTO `dish_spec_group` (`store_id`, `dish_id`, `name`, `is_required`, `multi_select`, `sort`) VALUES
(1, 1, '杯型', 1, 0, 1),
(1, 1, '温度', 1, 0, 2);

INSERT INTO `dish_spec_item` (`store_id`, `dish_id`, `group_id`, `name`, `extra_price`, `is_default`, `sort`) VALUES
(1, 1, 1, '中杯', 0.00, 1, 1),
(1, 1, 1, '大杯', 3.00, 0, 2),
(1, 1, 2, '热',   0.00, 1, 1),
(1, 1, 2, '冰',   0.00, 0, 2);

-- 示例优惠券：满 50 减 10
INSERT INTO `coupon` (`store_id`, `name`, `type`, `threshold_amount`, `discount_amount`, `total_count`, `per_user_limit`, `valid_type`, `valid_start`, `valid_end`, `scope_type`, `grant_type`, `is_public`, `description`, `status`)
VALUES (1, '开业满减券', 'FULL_REDUCE', 50.00, 10.00, 500, 1, 'FIXED', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'ALL', 'CLAIM', 1, '满 50 元可用，不与其他优惠同享', 'RUNNING');

-- =============================================================================
-- 十、关键查询与并发说明
-- =============================================================================
--
-- 1) 取餐码并发安全生成（原子自增，避免重复）：
--    INSERT INTO daily_sequence (store_id, biz_type, seq_date, current_value)
--    VALUES (?, 'PICKUP_CODE', CURDATE(), 1)
--    ON DUPLICATE KEY UPDATE current_value = current_value + 1;
--    SELECT current_value FROM daily_sequence
--    WHERE store_id = ? AND biz_type = 'PICKUP_CODE' AND seq_date = CURDATE();
--    （两步需放在同一事务中，或使用 LAST_INSERT_ID 技巧保证原子性）
--
-- 2) 待接单超时筛选：
--    SELECT * FROM order_main
--    WHERE store_id = ? AND status = 'PENDING'
--      AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE);
--
-- 3) 今日营业额（已收款）：
--    SELECT IFNULL(SUM(pay_amount), 0) FROM order_main
--    WHERE store_id = ? AND pay_status = 'PAID' AND deleted_at IS NULL
--      AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY;
--
-- 4) 菜品销量排行：
--    SELECT oi.dish_id, oi.dish_name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_amount
--    FROM order_item oi
--    JOIN order_main o ON o.id = oi.order_id AND o.status = 'COMPLETED'
--    WHERE oi.store_id = ? AND o.created_at BETWEEN ? AND ?
--    GROUP BY oi.dish_id, oi.dish_name
--    ORDER BY total_qty DESC LIMIT 10;
--
-- 5) 用户可用优惠券（结算时校验）：
--    SELECT uc.*, c.* FROM user_coupon uc
--    JOIN coupon c ON c.id = uc.coupon_id
--    WHERE uc.user_id = ? AND uc.store_id = ? AND uc.status = 'UNUSED'
--      AND (uc.expire_at IS NULL OR uc.expire_at > NOW())
--      AND c.status = 'RUNNING' AND c.deleted_at IS NULL
--      AND c.threshold_amount <= ?          -- 传入订单金额
--    ORDER BY c.discount_amount DESC;
--
-- 6) 会员升级判定：
--    SELECT * FROM member_level
--    WHERE store_id = ? AND status = 1 AND growth_threshold <= ?
--    ORDER BY growth_threshold DESC LIMIT 1;
--
-- 7) 必加索引提醒：order_main 的 (store_id, status, created_at) 与 (user_id, created_at)
--    为高频查询路径，务必保留。
-- =============================================================================
