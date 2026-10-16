<template>
  <view class="kitty" :class="[`kitty--${mode}`]" :style="rootStyle">
    <!-- 猫爪：直接用 emoji 🐾（随字体大小/透明度自适应） -->
    <text v-if="mode === 'paw'" class="k-emoji">🐾</text>

    <!-- 小猫脸：优先主题图片（可在 static/kitty/ 下替换为官方授权素材），失败回退绘制版 -->
    <template v-else>
      <image v-if="imgSrc && !imgFailed" class="k-img" :src="imgSrc" mode="aspectFit" @error="imgFailed = true" />

      <template v-if="!imgSrc || imgFailed">
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
        <view class="whisker w5" />
        <view class="whisker w6" />
        <view class="bow">
          <view class="loop loop-l" />
          <view class="loop loop-r" />
          <view class="knot" />
        </view>
      </template>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { KITTY } from '@/config/theme';

const props = defineProps({
  /** face 小猫脸 / paw 猫爪 */
  mode: { type: String, default: 'face' },
  /** 尺寸（rpx） */
  size: { type: [Number, String], default: 120 },
  /** 主体色（描边与耳朵） */
  color: { type: String, default: '#ff6fa5' },
  /** 蝴蝶结色 */
  bowColor: { type: String, default: '#ef3d6b' },
  /** 鼻子色（柠檬黄） */
  noseColor: { type: String, default: '#ffd84d' },
  /** 整体透明度（做水印时调低） */
  opacity: { type: [Number, String], default: 1 },
  /** 直接指定图片；不传则按 mode 取主题资源 */
  src: { type: String, default: '' },
});

const imgFailed = ref(false);
const imgSrc = computed(() => props.src || (props.mode === 'face' ? KITTY.face : KITTY.paw));

const rootStyle = computed(() => ({
  width: `${props.size}rpx`,
  height: `${props.size}rpx`,
  '--k-color': props.color,
  '--k-bow': props.bowColor,
  '--k-nose': props.noseColor,
  fontSize: `${props.size}rpx`,
  opacity: Number(props.opacity),
}));
</script>

<style lang="scss" scoped>
.kitty {
  position: relative;
  display: inline-block;
  flex: none;
}
.k-img {
  width: 100%;
  height: 100%;
  display: block;
}
.k-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: inherit;
  line-height: 1;
  color: var(--k-color);
}

.kitty--face {
  .head {
    position: absolute;
    left: 15%;
    top: 27%;
    width: 70%;
    height: 58%;
    box-sizing: border-box;
    border-radius: 50%;
    background: #fff;
    border: 3rpx solid var(--k-color);
    z-index: 2;
  }
  /* 圆润三角耳：方形 + 单尖圆角后旋转 */
  .ear {
    position: absolute;
    top: 8%;
    width: 26%;
    height: 26%;
    background: var(--k-color);
    z-index: 1;
  }
  .ear-l {
    left: 12%;
    border-radius: 50% 0 50% 50%;
    transform: rotate(-45deg);
  }
  .ear-r {
    right: 12%;
    border-radius: 0 50% 50% 50%;
    transform: rotate(45deg);
  }
  .eye {
    position: absolute;
    top: 48%;
    width: 8%;
    height: 11%;
    border-radius: 50%;
    background: #4a3340;
    z-index: 3;
  }
  .eye-l {
    left: 32%;
  }
  .eye-r {
    right: 32%;
  }
  .nose {
    position: absolute;
    top: 61%;
    left: 46.4%;
    width: 7.2%;
    height: 5%;
    border-radius: 50%;
    background: var(--k-nose);
    z-index: 3;
  }
  .whisker {
    position: absolute;
    width: 16%;
    height: 2rpx;
    background: #4a3340;
    opacity: 0.75;
    z-index: 1;
  }
  .w1 {
    left: 8%;
    top: 49%;
    transform: rotate(10deg);
  }
  .w2 {
    left: 7%;
    top: 59%;
  }
  .w3 {
    left: 8%;
    top: 69%;
    transform: rotate(-10deg);
  }
  .w4 {
    right: 8%;
    top: 49%;
    transform: rotate(-10deg);
  }
  .w5 {
    right: 7%;
    top: 59%;
  }
  .w6 {
    right: 8%;
    top: 69%;
    transform: rotate(10deg);
  }
  .bow {
    position: absolute;
    right: 1%;
    top: 13%;
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
      transform: rotate(-20deg);
    }
    .loop-r {
      right: 0;
      transform: rotate(20deg);
    }
    .knot {
      position: absolute;
      left: 34%;
      top: 22%;
      width: 32%;
      height: 56%;
      border-radius: 50%;
      background: var(--k-bow);
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
