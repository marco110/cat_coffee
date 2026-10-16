<template>
  <view class="page">
    <view class="hero">
      <image v-if="coffee.cover" class="hero-cover" :src="coffee.cover" mode="aspectFill" />
      <view v-else class="hero-cover hero-cover--ph"><text class="ph-emoji">☕</text></view>
      <view class="hero-mask">
        <text class="name">{{ coffee.name }}</text>
        <view class="tags">
          <text v-for="t in coffee.tags" :key="t" class="tag">{{ t }}</text>
        </view>
      </view>
    </view>

    <view class="block card">
      <text class="label">简介</text>
      <text class="text">{{ coffee.intro }}</text>
    </view>

    <view class="block card">
      <text class="label">风味</text>
      <text class="text">{{ coffee.flavor }}</text>
    </view>

    <view class="block card">
      <text class="label">产地 / 起源</text>
      <text class="text">{{ coffee.origin }}</text>
    </view>

    <view class="block card">
      <text class="label">制作方法</text>
      <text class="text">{{ coffee.brew }}</text>
    </view>

    <view class="block card">
      <text class="label">相关产品 / 器具</text>
      <text class="text">{{ coffee.products }}</text>
    </view>

    <view class="tip">本页内容来自本地知识库，仅供咖啡文化展示</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import coffees from '@/data/coffees.json';

const coffee = ref({
  name: '',
  cover: '',
  intro: '',
  flavor: '',
  origin: '',
  brew: '',
  products: '',
  tags: [],
});

onLoad((opt) => {
  const id = opt && opt.id;
  const found = coffees.find((c) => c.id === id);
  if (found) coffee.value = found;
});
</script>

<style lang="scss" scoped>
.page {
  padding: 0 0 60rpx;
}
.hero {
  position: relative;
  width: 100%;
  height: 420rpx;
}
.hero-cover {
  width: 100%;
  height: 100%;
}
.hero-cover--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff8fb8, #ffd84d);
  .ph-emoji {
    font-size: 160rpx;
  }
}
.hero-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40rpx 32rpx 28rpx;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.45));
  .name {
    display: block;
    font-size: 40rpx;
    font-weight: 800;
    color: #fff;
  }
  .tags {
    margin-top: 14rpx;
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    .tag {
      font-size: 20rpx;
      color: #fff;
      background: rgba(255, 255, 255, 0.25);
      border-radius: 20rpx;
      padding: 4rpx 14rpx;
    }
  }
}
.card {
  margin: 24rpx 24rpx 0;
  padding: 28rpx;
}
.block {
  display: flex;
  flex-direction: column;
  .label {
    font-size: 26rpx;
    font-weight: 700;
    color: $coffee-brown;
    margin-bottom: 12rpx;
  }
  .text {
    font-size: 28rpx;
    line-height: 1.7;
    color: $text-primary;
  }
}
.tip {
  margin: 32rpx 24rpx 0;
  text-align: center;
  font-size: 22rpx;
  color: $text-secondary;
}
</style>
