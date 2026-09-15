<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

onLaunch((options) => {
  // 扫码进入：scene = s{storeId}t{tableId}
  const scene = options?.query?.scene ? decodeURIComponent(options.query.scene) : '';
  if (scene) userStore.setScene(scene);
  userStore.restore();
});

onShow(() => {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  if (cur && cur.$vm && cur.$vm.onTabPolling) cur.$vm.onTabPolling();
});
</script>

<style lang="scss">
/* uni.scss 已由 uni-app 自动注入到每个 scss 样式块，无需再 @import */
page {
  color: $text-primary;
  font-size: 28rpx;
  /* 粉色波点底纹，与 admin-web 的 Hello Kitty 风格一致 */
  background-color: $bg-page;
  background-image: radial-gradient(rgba(255, 111, 165, 0.13) 4rpx, transparent 4rpx),
    radial-gradient(rgba(255, 216, 77, 0.14) 4rpx, transparent 4rpx);
  background-size: 44rpx 44rpx, 44rpx 44rpx;
  background-position: 0 0, 22rpx 22rpx;
  background-attachment: fixed;
}
</style>
