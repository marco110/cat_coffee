-- 0003: 店主/店员账号绑定微信 openid，支持「首次密码登录后凭 openid 自动识别身份」
-- 用法：mysql -u<user> -p cat_coffee < server/migrations/0003_store_user_openid.sql

ALTER TABLE `store_user`
  ADD COLUMN `openid` VARCHAR(64) DEFAULT NULL COMMENT '微信 openid（首次密码登录时绑定，后续凭此自动识别店主身份）'
  AFTER `phone`,
  ADD UNIQUE KEY `uk_openid` (`openid`);
