<template>
  <view v-if="count > 0 || showEmpty" class="bar">
    <view class="icon-wrap" @click="togglePanel">
      <text class="icon">🛒</text>
      <text v-if="count > 0" class="badge">{{ count }}</text>
    </view>
    <view class="amount">
      <text class="total">¥{{ price(amount) }}</text>
      <text class="tip">另需到店付款</text>
    </view>
    <view class="btn" :class="{ disabled: count === 0 }" @click="submit">
      {{ count === 0 ? '购物车空' : '去结算' }}
    </view>
  </view>
</template>

<script setup>
import { price } from '@/utils/format';

defineProps({
  count: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  showEmpty: { type: Boolean, default: false },
});
const emit = defineEmits(['submit', 'toggle']);

function submit() {
  emit('submit');
}
function togglePanel() {
  emit('toggle');
}
</script>

<style lang="scss" scoped>
.bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  height: 100rpx;
  background: $grad-brand;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  padding: 0 16rpx 0 28rpx;
  z-index: 900;
  box-shadow: 0 10rpx 28rpx rgba(240, 72, 128, 0.32);
}
.icon-wrap {
  position: relative;
  margin-top: -32rpx;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: $coffee-brown;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon {
  font-size: 40rpx;
}
.badge {
  position: absolute;
  right: -4rpx;
  top: -4rpx;
  min-width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  background: #f56c6c;
  color: #fff;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
}
.amount {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
}
.total {
  color: #fff;
  font-size: 34rpx;
  font-weight: 600;
}
.tip {
  color: rgba(255, 255, 255, 0.6);
  font-size: 20rpx;
}
.btn {
  height: 76rpx;
  padding: 0 44rpx;
  border-radius: 38rpx;
  background: #fff;
  color: $pink-dark;
  font-weight: 600;
  display: flex;
  align-items: center;
  font-size: 30rpx;
  &.disabled {
    background: #6b5b4b;
    color: rgba(255, 255, 255, 0.5);
  }
}
</style>
