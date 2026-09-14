<template>
  <view class="ct-empty">
    <view class="icon">🐾</view>
    <text class="text">{{ text }}</text>
  </view>
</template>

<script setup>
defineProps({ text: { type: String, default: '这里什么都没有~' } });
</script>

<style lang="scss" scoped>
.ct-empty {
  padding: 120rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  .icon {
    font-size: 80rpx;
    opacity: 0.35;
  }
  .text {
    margin-top: 16rpx;
    color: $text-secondary;
    font-size: 28rpx;
  }
}
</style>
