<template>
  <view class="page">
    <view class="hero">
      <image class="bg" :src="fixUrl(store.cover)" mode="aspectFill" />
      <ct-kitty class="hero-paw" mode="paw" :size="180" color="#ffffff" opacity="0.18" />
      <view class="hero-mask">
        <view class="store-name">{{ store.name || '爱猫咖啡' }}</view>
        <view class="status-row">
          <text class="dot" :class="{ on: store.businessStatus === 1 }" />
          <text class="status-text">{{ store.businessStatus === 1 ? '营业中' : '休息中' }}</text>
          <text class="hours">{{ store.businessHours }}</text>
        </view>
      </view>
    </view>

    <view v-if="store.announcement" class="notice card">
      <text class="icon">📢</text>
      <text class="text">{{ store.announcement }}</text>
    </view>

    <view class="actions">
      <view class="action" @click="goOrder('DINE_IN')">
        <text class="emoji">🪑</text>
        <text class="t">堂食点餐</text>
        <text class="s">选择桌号下单</text>
      </view>
      <view class="action" @click="goOrder('TAKEAWAY')">
        <text class="emoji">🥤</text>
        <text class="t">打包带走</text>
        <text class="s">取餐码叫号</text>
      </view>
      <view class="action" @click="scan">
        <text class="emoji">📷</text>
        <text class="t">扫码点餐</text>
        <text class="s">扫描桌面二维码</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        <text>🐾 今日推荐</text>
        <text class="more" @click="goMenu">查看菜单</text>
      </view>
      <scroll-view class="recommend" scroll-x>
        <view v-for="d in recommends" :key="d.id" class="rec-card" @click="openDish(d)">
          <image class="rec-cover" :src="fixUrl(d.cover)" mode="aspectFill" />
          <text class="rec-name">{{ d.name }}</text>
          <text class="rec-price">¥{{ price(d.price) }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="info card">
      <view class="row" @click="callPhone">
        <text class="label">门店电话</text>
        <text class="value">{{ store.phone || '暂无' }}</text>
      </view>
      <view class="row" @click="openMap">
        <text class="label">门店地址</text>
        <text class="value">{{ fullAddress }}</text>
      </view>
      <view class="row">
        <text class="label">营业时间</text>
        <text class="value">{{ store.businessHours }}</text>
      </view>
    </view>

    <view class="entry" @click="goMerchant">店主入口（企业管理）</view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { getStore, getMenu, scanStore, getBanners } from '@/api/customer';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import { useUserStore } from '@/store/user';
import { ensureLogin, DEFAULT_STORE_ID } from '@/utils/auth';
import CtKitty from '@/components/ct-kitty.vue';

const userStore = useUserStore();
const store = ref({ businessHours: '', businessStatus: 0 });
const recommends = ref([]);
const banners = ref([]);

const fullAddress = computed(() =>
  [store.value.province, store.value.city, store.value.district, store.value.address].filter(Boolean).join('')
);

async function loadStore() {
  let storeId = userStore.storeId || String(DEFAULT_STORE_ID);
  try {
    if (userStore.scene) {
      const data = await scanStore(userStore.scene);
      store.value = data.store;
      storeId = data.store.id;
      if (data.table) userStore.setStore({ storeId, tableId: data.table.id, tableNo: data.table.tableNo, orderType: 'DINE_IN' });
    } else {
      store.value = await getStore(storeId);
    }
    userStore.setStore({ storeId });
  } catch (e) {
    uni.showToast({ title: e.msg || '门店信息加载失败', icon: 'none' });
  }
}

async function loadMenu() {
  try {
    const data = await getMenu(userStore.storeId || DEFAULT_STORE_ID);
    const all = [];
    data.categories.forEach((c) => c.dishes.forEach((d) => all.push(d)));
    recommends.value = all.filter((d) => d.isRecommend).slice(0, 8);
  } catch (e) {
    /* ignore */
  }
}

async function loadBanners() {
  try {
    banners.value = await getBanners(userStore.storeId || DEFAULT_STORE_ID);
  } catch (e) {
    /* ignore */
  }
}

function goOrder(type) {
  userStore.setStore({ orderType: type });
  // 点餐页是 tabBar 页，只能用 switchTab 跳转
  uni.switchTab({ url: '/pages/order/menu' });
}
function goMenu() {
  uni.switchTab({ url: '/pages/order/menu' });
}
function openDish(dish) {
  const sid = userStore.storeId || String(DEFAULT_STORE_ID);
  uni.navigateTo({ url: `/pages/order/dish?id=${dish.id}&storeId=${sid}` });
}
function scan() {
  uni.scanCode({
    success: async (res) => {
      const scene = res.result;
      userStore.setScene(scene);
      await loadStore();
      uni.showToast({ title: '扫码成功', icon: 'none' });
    },
  });
}
function callPhone() {
  if (store.value.phone) uni.makePhoneCall({ phoneNumber: store.value.phone });
}
function openMap() {
  if (store.value.latitude && store.value.longitude) {
    uni.openLocation({ latitude: store.value.latitude, longitude: store.value.longitude, name: store.value.name, address: fullAddress.value });
  }
}
function goMerchant() {
  uni.navigateTo({ url: '/pages/merchant-entry/index' });
}

onMounted(async () => {
  await ensureLogin();
  await loadStore();
  await loadMenu();
  await loadBanners();
});
onPullDownRefresh(async () => {
  await loadStore();
  await loadMenu();
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
.page {
  padding: 0 24rpx 40rpx;
}
.hero {
  position: relative;
  margin: 24rpx 0;
  height: 300rpx;
  border-radius: $radius-card;
  overflow: hidden;
  background: $grad-brand;
}
.bg {
  width: 100%;
  height: 100%;
}
.hero-paw {
  position: absolute;
  right: 16rpx;
  bottom: 8rpx;
  z-index: 1;
}
.hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.store-name {
  color: #fff;
  font-size: 40rpx;
  font-weight: 700;
}
.status-row {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  color: #fff;
  font-size: 24rpx;
}
.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #bbb;
  margin-right: 10rpx;
  &.on {
    background: $success;
  }
}
.hours {
  margin-left: 24rpx;
  opacity: 0.85;
}
.notice {
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  .icon {
    margin-right: 12rpx;
  }
  .text {
    flex: 1;
    font-size: 26rpx;
    color: $text-primary;
  }
}
.actions {
  margin-top: 24rpx;
  display: flex;
  justify-content: space-between;
}
.action {
  width: 31%;
  background: #fff;
  border-radius: $radius-card;
  padding: 28rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: $shadow-card;
  .emoji {
    font-size: 48rpx;
  }
  .t {
    margin-top: 12rpx;
    font-size: 28rpx;
    font-weight: 600;
  }
  .s {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $text-secondary;
  }
}
.section {
  margin-top: 40rpx;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 32rpx;
  font-weight: 700;
  .more {
    font-size: 24rpx;
    color: $coffee-brown;
    font-weight: 400;
  }
}
.recommend {
  margin-top: 20rpx;
  white-space: nowrap;
}
.rec-card {
  display: inline-block;
  width: 200rpx;
  margin-right: 20rpx;
  background: #fff;
  border-radius: $radius-card;
  overflow: hidden;
  box-shadow: $shadow-card;
}
.rec-cover {
  width: 200rpx;
  height: 200rpx;
  background: $cream-white;
}
.rec-name {
  display: block;
  padding: 12rpx 16rpx 0;
  font-size: 26rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rec-price {
  display: block;
  padding: 6rpx 16rpx 16rpx;
  color: $coffee-brown;
  font-weight: 600;
}
.info {
  margin-top: 32rpx;
  padding: 8rpx 24rpx;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $border-color;
  &:last-child {
    border-bottom: none;
  }
  .label {
    color: $text-secondary;
    font-size: 26rpx;
  }
  .value {
    font-size: 26rpx;
    max-width: 60%;
    text-align: right;
  }
}
.entry {
  margin-top: 32rpx;
  text-align: center;
  padding: 24rpx;
  color: $text-secondary;
  font-size: 26rpx;
}
</style>
