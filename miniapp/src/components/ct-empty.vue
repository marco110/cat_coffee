<template>
  <view class="ct-empty">
    <ct-kitty mode="face" :size="140" opacity="0.55" />
    <text class="text">{{ text }}</text>
  </view>
</template>

<script setup>
import CtKitty from '@/components/ct-kitty.vue';

defineProps({ text: { type: String, default: '这里什么都没有~' } });
</script>

<style lang="scss" scoped>
.ct-empty {
  padding: 120rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  .text {
    margin-top: 16rpx;
    color: $text-secondary;
    font-size: 28rpx;
  }
}
</style>
