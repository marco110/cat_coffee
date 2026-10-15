-- 0004: 店主/店员账号支持个人 PushPlus 接收账号与消息通知开关
-- 消息通知改为与门店关联：下单选中的是哪家门店，就通知该门店下「已开启通知且填了 token」的店员
-- 用法：mysql -u<user> -p cat_coffee < server/migrations/0004_store_user_pushplus.sql

ALTER TABLE `store_user`
  ADD COLUMN `pushplus_token`  VARCHAR(64)     DEFAULT NULL COMMENT 'PushPlus 推送 token（店员个人接收账号，留空则不接收）' AFTER `openid`,
  ADD COLUMN `notify_enabled`  TINYINT         NOT NULL DEFAULT 1 COMMENT '新订单/取消消息通知开关：1 开 / 0 关';
