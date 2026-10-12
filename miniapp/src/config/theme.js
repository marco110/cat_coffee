/**
 * 品牌形象资源统一配置
 * 想替换成其他形象（如取得授权的官方素材）：
 * 直接覆盖 static/kitty/ 下的同名图片文件即可全站生效，无需改代码；
 * 图片缺失或加载失败时，组件会自动回退到内置的绘制版形象。
 */
export const KITTY = {
  /** 猫脸（透明背景 PNG），用于各页面装饰与空状态 */
  face: '/static/kitty/face.png',
  /** 猫爪（透明背景 PNG），用于水印 */
  paw: '/static/kitty/paw.png',
  /** 默认头像（圆形底），用于「我的」页 / 个人资料页 */
  avatar: '/static/kitty/face.png',
};
