<template>
  <view class="qty">
    <view v-if="value > 0" class="btn minus" @click.stop="onMinus">-</view>
    <text v-if="value > 0" class="num">{{ value }}</text>
    <view class="btn plus" @click.stop="onPlus">+</view>
  </view>
</template>

<script setup>
const props = defineProps({ value: { type: Number, default: 0 }, max: { type: Number, default: 99 } });
const emit = defineEmits(['change']);

function onPlus() {
  if (props.value >= props.max) {
    uni.showToast({ title: '已达最大数量', icon: 'none' });
    return;
  }
  emit('change', props.value + 1);
}
function onMinus() {
  emit('change', Math.max(0, props.value - 1));
}
</script>

<style lang="scss" scoped>
.qty {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  .btn {
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    line-height: 1;
  }
  .plus {
    background: $coffee-brown;
    color: #fff;
  }
  .minus {
    border: 2rpx solid $coffee-brown;
    color: $coffee-brown;
    box-sizing: border-box;
  }
  .num {
    min-width: 48rpx;
    text-align: center;
    font-size: 28rpx;
    color: $text-primary;
  }
}
</style>
