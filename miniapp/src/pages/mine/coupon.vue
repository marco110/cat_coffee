<template>
  <view class="page">
    <view class="tabs">
      <text v-for="t in TABS" :key="t.value" class="tab" :class="{ on: status === t.value }" @click="status = t.value">{{ t.label }}</text>
    </view>

    <view v-for="c in list" :key="c.userCouponId" class="coupon" :class="{ used: c.status !== 'UNUSED' }">
      <view class="c-left">
        <text class="c-value">{{ couponValue(c) }}</text>
        <text class="c-threshold">满{{ price(c.thresholdAmount) }}可用</text>
      </view>
      <view class="c-right">
        <text class="c-name">{{ c.name }}</text>
        <text class="c-expire">{{ c.expireAt ? `${dateText(c.expireAt)} 前有效` : '长期有效' }}</text>
        <view v-if="c.status === 'UNUSED'" class="c-use" @click="goUse">去使用</view>
      </view>
      <text v-if="c.status !== 'UNUSED'" class="c-status">{{ c.status === 'USED' ? '已使用' : '已过期' }}</text>
    </view>

    <ct-empty v-if="!list.length" text="暂无优惠券" />
    <view class="center-entry" @click="go('/pages/coupon/center')">去领券中心看看 ›</view>
  </view>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { getMyCoupons } from '@/api/customer';
import { price, couponValue, dateText } from '@/utils/format';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID } from '@/utils/auth';

const TABS = [
  { label: '未使用', value: 'UNUSED' },
  { label: '已使用', value: 'USED' },
  { label: '已过期', value: 'EXPIRED' },
];
const userStore = useUserStore();
const storeId = userStore.storeId || String(DEFAULT_STORE_ID);
const status = ref('UNUSED');
const list = ref([]);

async function load() {
  const data = await getMyCoupons({ storeId, status: status.value, pageSize: 50 });
  list.value = data.list;
}
onMounted(() => load());
watch(status, () => load());
function go(url) {
  uni.navigateTo({ url });
}
function goUse() {
  uni.switchTab({ url: '/pages/order/menu' });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.tabs {
  display: flex;
  margin-bottom: 20rpx;
}
.tab {
  padding: 12rpx 32rpx;
  border-radius: 30rpx;
  background: #fff;
  font-size: 26rpx;
  color: $text-secondary;
  margin-right: 16rpx;
  &.on {
    background: $coffee-brown;
    color: #fff;
  }
}
.coupon {
  position: relative;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: $radius-card;
  padding: 28rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  &.used {
    opacity: 0.55;
  }
}
.c-left {
  width: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1rpx dashed $border-color;
}
.c-value {
  color: $coffee-brown;
  font-size: 44rpx;
  font-weight: 700;
}
.c-threshold {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.c-right {
  flex: 1;
  margin-left: 28rpx;
  display: flex;
  flex-direction: column;
}
.c-name {
  font-size: 30rpx;
  font-weight: 600;
}
.c-expire {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.c-use {
  align-self: flex-start;
  margin-top: 16rpx;
  padding: 8rpx 28rpx;
  border-radius: 30rpx;
  background: $cat-orange;
  color: #fff;
  font-size: 24rpx;
}
.c-status {
  position: absolute;
  right: 24rpx;
  top: 24rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.center-entry {
  margin-top: 32rpx;
  text-align: center;
  color: $coffee-brown;
  font-size: 26rpx;
}
</style>
