<template>
  <view class="page">
    <view class="hero">
      <text class="h-title">爱猫咖啡 · 店主端</text>
      <text class="h-sub">接单、改单、管菜单、看经营数据</text>
    </view>

    <view v-if="userStore.isMerchantLogin" class="card info">
      <text class="store">{{ userStore.merchantStore?.name }}</text>
      <text class="who">{{ userStore.merchantInfo?.realName }}（{{ roleText }}）</text>
      <view class="btn" @click="go('/subpackages/merchant/dashboard/index')">进入工作台</view>
      <view class="btn ghost" @click="logout">退出登录</view>
    </view>
    <view v-else class="card info">
      <text class="tip">请使用超管为您开通的手机号登录</text>
      <view class="btn" @click="go('/subpackages/merchant/login/index')">店主登录</view>
    </view>

    <view class="card features">
      <view class="f"><text>⚡</text><text>新订单实时提醒</text></view>
      <view class="f"><text>✏️</text><text>随时改单、退款提示</text></view>
      <view class="f"><text>📊</text><text>营业额与热销分析</text></view>
      <view class="f"><text>🎟️</text><text>优惠券与会员运营</text></view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const roleText = computed(() => ({ OWNER: '店主', MANAGER: '店长', CLERK: '店员' }[userStore.merchantInfo?.role] || ''));

onShow(() => {
  userStore.restore();
});
function go(url) {
  uni.navigateTo({ url });
}
function logout() {
  userStore.clearMerchant();
  uni.showToast({ title: '已退出', icon: 'none' });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.hero {
  padding: 60rpx 40rpx;
  border-radius: $radius-card;
  background: linear-gradient(135deg, #7d5940, #6f4e37);
  color: #fff;
}
.h-title {
  font-size: 42rpx;
  font-weight: 700;
}
.h-sub {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  opacity: 0.85;
}
.info {
  margin-top: 32rpx;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.store {
  font-size: 34rpx;
  font-weight: 700;
}
.who {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.tip {
  font-size: 26rpx;
  color: $text-secondary;
  margin-bottom: 32rpx;
}
.btn {
  margin-top: 28rpx;
  width: 100%;
  height: 88rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  &.ghost {
    background: #fff;
    color: $text-secondary;
    border: 1rpx solid $border-color;
  }
}
.features {
  margin-top: 32rpx;
  padding: 24rpx 32rpx;
}
.f {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: $text-secondary;
  text:nth-child(1) {
    margin-right: 16rpx;
    font-size: 32rpx;
  }
}
</style>
