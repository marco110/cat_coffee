<template>
  <view class="page">
    <view class="top">
      <ct-kitty class="top-paw" mode="paw" :size="200" color="#ffffff" opacity="0.18" />
      <view class="store-line">
        <view class="store-name-wrap">
          <ct-kitty mode="face" :size="60" color="#ffffff" bow-color="#ffd84d" />
          <text class="store">{{ storeName }}</text>
        </view>
        <view class="switch" :class="{ on: businessStatus === 1 }" @click="toggleBusiness">
          <text>{{ businessStatus === 1 ? '营业中' : '休息中' }}</text>
        </view>
      </view>
      <view class="kpi">
        <view class="kpi-item">
          <text class="k-value">¥{{ price(overview.revenue) }}</text>
          <text class="k-label">今日营业额</text>
        </view>
        <view class="kpi-item">
          <text class="k-value">{{ overview.orderCount }}</text>
          <text class="k-label">今日订单</text>
        </view>
        <view class="kpi-item">
          <text class="k-value">¥{{ price(overview.avgOrderAmount) }}</text>
          <text class="k-label">客单价</text>
        </view>
        <view class="kpi-item">
          <text class="k-value">{{ overview.memberCount }}</text>
          <text class="k-label">会员数</text>
        </view>
      </view>
    </view>

    <view class="pending card" @click="goOrder('PENDING')">
      <view class="p-left">
        <text class="p-num">{{ todo.pending || 0 }}</text>
        <text class="p-label">待接单</text>
      </view>
      <view class="p-mid">
        <text v-if="pendingInfo.lastOrderNo" class="last">最新：{{ pendingInfo.lastOrderTable }} · {{ pendingInfo.lastOrderAt }}</text>
        <text v-else class="last">暂无待接单</text>
      </view>
      <text class="p-go">去处理 ›</text>
    </view>

    <view class="menu">
      <view class="cell" @click="go('/subpackages/merchant/order/list')">
        <text class="c-icon">🧾</text><text class="c-text">订单管理</text>
        <text v-if="todo.pending" class="c-badge">{{ todo.pending }}</text>
      </view>
      <view class="cell" @click="go('/subpackages/merchant/dish/list')">
        <text class="c-icon">☕</text><text class="c-text">菜单管理</text>
      </view>
      <view class="cell" @click="go('/subpackages/merchant/table/index')">
        <text class="c-icon">🪑</text><text class="c-text">桌位管理</text>
      </view>
      <view class="cell" @click="go('/subpackages/merchant/coupon/list')">
        <text class="c-icon">🎟️</text><text class="c-text">优惠券</text>
      </view>
      <view class="cell" @click="go('/subpackages/merchant/member/list')">
        <text class="c-icon">👑</text><text class="c-text">会员管理</text>
      </view>
      <view class="cell" @click="go('/subpackages/merchant/stat/index')">
        <text class="c-icon">📊</text><text class="c-text">经营统计</text>
      </view>
      <view class="cell" @click="go('/subpackages/merchant/setting/index')">
        <text class="c-icon">⚙️</text><text class="c-text">门店设置</text>
      </view>
    </view>

    <view class="quick">
      <view class="q" @click="goOrder('MAKING')">制作中 {{ todo.making || 0 }}</view>
      <view class="q" @click="goOrder('READY')">待取餐 {{ todo.ready || 0 }}</view>
      <view class="q warn" @click="goOrder('UNPAID')">待收款 {{ todo.unpaid || 0 }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow, onUnload } from '@dcloudio/uni-app';
import { overview as apiOverview, pendingCount, todo as apiTodo, updateBusinessStatus } from '@/api/merchant';
import { price } from '@/utils/format';
import { useUserStore } from '@/store/user';
import CtKitty from '@/components/ct-kitty.vue';

const userStore = useUserStore();
const overview = ref({});
const todo = ref({});
const pendingInfo = ref({});
let timer = null;

const storeName = computed(() => userStore.merchantStore?.name || '我的门店');
const businessStatus = computed(() => userStore.merchantStore?.businessStatus ?? 1);

async function load() {
  if (!userStore.isMerchantLogin) {
    uni.redirectTo({ url: '/subpackages/merchant/login/index' });
    return;
  }
  try {
    const [o, t, p] = await Promise.all([apiOverview(), apiTodo(), pendingCount()]);
    overview.value = o;
    todo.value = t;
    pendingInfo.value = p;
  } catch (e) {
    /* ignore */
  }
}

async function toggleBusiness() {
  const next = businessStatus.value === 1 ? 0 : 1;
  try {
    await updateBusinessStatus(next);
    userStore.setMerchant({
      token: userStore.merchantToken,
      user: userStore.merchantInfo,
      store: { ...userStore.merchantStore, businessStatus: next },
    });
    uni.showToast({ title: next ? '已开始营业' : '已打烊', icon: 'none' });
  } catch (e) {
    uni.showToast({ title: e.msg, icon: 'none' });
  }
}

function go(url) {
  uni.navigateTo({ url });
}
function goOrder(status) {
  uni.navigateTo({ url: `/subpackages/merchant/order/list?status=${status}` });
}

onMounted(() => load());
onShow(() => {
  load();
  timer = setInterval(load, 15000);
});
onUnload(() => timer && clearInterval(timer));
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.top {
  position: relative;
  overflow: hidden;
  padding: 32rpx;
  border-radius: $radius-card;
  background: $grad-brand;
  color: #fff;
}
.top-paw {
  position: absolute;
  right: -20rpx;
  bottom: -30rpx;
  z-index: 0;
}
.store-line {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.store-name-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.kpi {
  position: relative;
  z-index: 1;
}
.store {
  font-size: 36rpx;
  font-weight: 700;
}
.switch {
  padding: 10rpx 28rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.2);
  font-size: 24rpx;
  &.on {
    background: $success;
  }
}
.kpi {
  margin-top: 32rpx;
  display: flex;
}
.kpi-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.k-value {
  font-size: 34rpx;
  font-weight: 700;
}
.k-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  opacity: 0.8;
}
.pending {
  margin-top: 24rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
}
.p-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 140rpx;
}
.p-num {
  font-size: 48rpx;
  font-weight: 700;
  color: $danger;
}
.p-label {
  font-size: 22rpx;
  color: $text-secondary;
}
.p-mid {
  flex: 1;
}
.last {
  font-size: 24rpx;
  color: $text-secondary;
}
.p-go {
  color: $coffee-brown;
  font-size: 26rpx;
}
.menu {
  margin-top: 24rpx;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}
.cell {
  position: relative;
  width: 32%;
  background: #fff;
  border-radius: $radius-card;
  padding: 32rpx 0;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: $shadow-card;
}
.c-icon {
  font-size: 44rpx;
}
.c-text {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $text-secondary;
}
.c-badge {
  position: absolute;
  right: 20rpx;
  top: 16rpx;
  min-width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  background: #f56c6c;
  color: #fff;
  font-size: 22rpx;
  text-align: center;
  line-height: 36rpx;
  padding: 0 8rpx;
}
.quick {
  margin-top: 12rpx;
  display: flex;
  justify-content: space-between;
}
.q {
  width: 31%;
  text-align: center;
  padding: 24rpx 0;
  background: #fff;
  border-radius: $radius-card;
  font-size: 24rpx;
  color: $text-primary;
  box-shadow: $shadow-card;
  &.warn {
    color: $warning;
  }
}
</style>
