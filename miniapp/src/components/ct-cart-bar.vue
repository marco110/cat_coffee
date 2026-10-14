<template>
  <view v-if="count > 0 || showEmpty" class="bar" :style="{ bottom }">
    <view class="icon-wrap" @click="togglePanel">
      <text class="icon">🛒</text>
      <text v-if="count > 0" class="badge">{{ count }}</text>
    </view>
    <view class="amount">
      <text class="total">¥{{ price(amount) }}</text>
      <text class="tip">{{ tip }}</text>
    </view>
    <view v-if="actionText" class="btn act" :class="{ disabled: actionDisabled }" @click="emit('action')">
      {{ actionText }}
    </view>
    <view v-if="count > 0" class="btn" @click="submit">去结算</view>
  </view>
</template>

<script setup>
import { price } from '@/utils/format';

defineProps({
  count: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  showEmpty: { type: Boolean, default: false },
  /**
   * 距屏幕底边的距离；tabBar 页面默认 8rpx 即可（系统已处理安全区），
   * 非 tabBar 页面（如商品详情）需传入 calc(8rpx + env(safe-area-inset-bottom))
   */
  bottom: { type: String, default: '8rpx' },
  /** 金额下方的小字说明 */
  tip: { type: String, default: '另需到店付款' },
  /**
   * 页面主操作按钮文案（如商品详情页的「加入购物车」）；
   * 不传则只显示「去结算」，与点餐页保持一致
   */
  actionText: { type: String, default: '' },
  actionDisabled: { type: Boolean, default: false },
});
const emit = defineEmits(['submit', 'toggle', 'action']);

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
  /* 紧贴底部；具体数值由 bottom prop 注入（见脚本注释） */
  height: 100rpx;
  background: $grad-brand;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  padding: 0 16rpx;
  z-index: 900;
  box-shadow: 0 10rpx 28rpx rgba(240, 72, 128, 0.32);
}
/* 图标圆在购物车栏内垂直居中（去掉外挑的负 margin） */
.icon-wrap {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: $coffee-brown;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* line-height 与字号一致，避免 emoji 基线导致图标视觉上偏下 */
.icon {
  font-size: 40rpx;
  line-height: 40rpx;
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
  flex-shrink: 0;
  height: 76rpx;
  padding: 0 40rpx;
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
  /* 主操作（如加入购物车）与「去结算」并排时留间隔，字号略小以免挤占金额区 */
  &.act {
    margin-right: 12rpx;
    padding: 0 28rpx;
    font-size: 28rpx;
  }
}
</style>
