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
@import './uni.scss';
page {
  background: $bg-page;
  color: $text-primary;
  font-size: 28rpx;
}
</style>
