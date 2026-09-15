<template>
  <view class="kitty" :class="[`kitty--${mode}`]" :style="rootStyle">
    <!-- 小猫脸 -->
    <template v-if="mode === 'face'">
      <view class="ear ear-l" />
      <view class="ear ear-r" />
      <view class="head">
        <view class="eye eye-l" />
        <view class="eye eye-r" />
        <view class="nose" />
      </view>
      <view class="whisker w1" />
      <view class="whisker w2" />
      <view class="whisker w3" />
      <view class="whisker w4" />
      <view class="bow">
        <view class="loop loop-l" />
        <view class="loop loop-r" />
        <view class="knot" />
      </view>
    </template>

    <!-- 猫爪 -->
    <template v-else>
      <view class="toe t1" />
      <view class="toe t2" />
      <view class="toe t3" />
      <view class="toe t4" />
      <view class="pad" />
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  /** face 小猫脸 / paw 猫爪 */
  mode: { type: String, default: 'face' },
  /** 尺寸（rpx） */
  size: { type: [Number, String], default: 120 },
  /** 主体色 */
  color: { type: String, default: '#ff6fa5' },
  /** 蝴蝶结色 */
  bowColor: { type: String, default: '#ef3d6b' },
  /** 整体透明度（做水印时调低） */
  opacity: { type: [Number, String], default: 1 },
});

const rootStyle = computed(() => ({
  width: `${props.size}rpx`,
  height: `${props.size}rpx`,
  '--k-color': props.color,
  '--k-bow': props.bowColor,
  opacity: Number(props.opacity),
}));
</script>

<style lang="scss" scoped>
.kitty {
  position: relative;
  display: inline-block;
  flex: none;
}

.kitty--face {
  .head {
    position: absolute;
    left: 11%;
    top: 17%;
    width: 78%;
    height: 70%;
    box-sizing: border-box;
    border-radius: 50%;
    background: #fff;
    border: 4rpx solid var(--k-color);
    z-index: 2;
  }
  .ear {
    position: absolute;
    top: 6%;
    width: 26%;
    height: 26%;
    background: var(--k-color);
    border-radius: 6rpx;
    transform: rotate(45deg);
    z-index: 1;
  }
  .ear-l {
    left: 9%;
  }
  .ear-r {
    right: 9%;
  }
  .eye {
    position: absolute;
    top: 44%;
    width: 9%;
    height: 13%;
    border-radius: 50%;
    background: #4a3340;
    z-index: 3;
  }
  .eye-l {
    left: 29%;
  }
  .eye-r {
    right: 29%;
  }
  .nose {
    position: absolute;
    top: 59%;
    left: 46%;
    width: 8%;
    height: 6%;
    border-radius: 50%;
    background: #ffc53d;
    z-index: 3;
  }
  .whisker {
    position: absolute;
    width: 17%;
    height: 2rpx;
    background: #4a3340;
    opacity: 0.75;
    z-index: 1;
  }
  .w1 {
    left: -4%;
    top: 46%;
    transform: rotate(8deg);
  }
  .w2 {
    left: -6%;
    top: 56%;
  }
  .w3 {
    right: -4%;
    top: 46%;
    transform: rotate(-8deg);
  }
  .w4 {
    right: -6%;
    top: 56%;
  }
  .bow {
    position: absolute;
    right: -2%;
    top: 12%;
    width: 42%;
    height: 22%;
    z-index: 4;
    .loop {
      position: absolute;
      top: 0;
      width: 48%;
      height: 100%;
      background: var(--k-bow);
      border-radius: 50%;
    }
    .loop-l {
      left: 0;
      transform: rotate(-18deg);
    }
    .loop-r {
      right: 0;
      transform: rotate(18deg);
    }
    .knot {
      position: absolute;
      left: 34%;
      top: 22%;
      width: 32%;
      height: 56%;
      border-radius: 50%;
      background: #ff86a8;
    }
  }
}

.kitty--paw {
  .pad {
    position: absolute;
    left: 19%;
    bottom: 8%;
    width: 62%;
    height: 46%;
    background: var(--k-color);
    border-radius: 50% 50% 44% 44%;
  }
  .toe {
    position: absolute;
    width: 19%;
    height: 19%;
    background: var(--k-color);
    border-radius: 50%;
  }
  .t1 {
    left: 8%;
    top: 26%;
    transform: rotate(-16deg);
  }
  .t2 {
    left: 30%;
    top: 12%;
    transform: rotate(-6deg);
  }
  .t3 {
    right: 30%;
    top: 12%;
    transform: rotate(6deg);
  }
  .t4 {
    right: 8%;
    top: 26%;
    transform: rotate(16deg);
  }
}
</style>
