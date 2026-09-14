<template>
  <view class="dish" :class="{ 'is-sold-out': soldOut }" @click="onOpen">
    <view class="cover-wrap">
      <image class="cover" :src="fixUrl(dish.cover)" mode="aspectFill" />
      <view v-if="soldOut" class="mask">已售罄</view>
    </view>
    <view class="info">
      <view class="name-line">
        <text class="name">{{ dish.name }}</text>
        <text v-if="isRecommend" class="badge rec">推荐</text>
      </view>
      <text v-if="dish.tags && dish.tags.length" class="tags">{{ dish.tags.join(' · ') }}</text>
      <text v-if="showSales" class="sales">已售 {{ dish.sales }}</text>
      <text class="desc">{{ dish.description }}</text>
      <view class="bottom">
        <view class="price-line">
          <text class="price">¥{{ price(dish.price) }}</text>
          <text v-if="dish.originalPrice" class="origin">¥{{ price(dish.originalPrice) }}</text>
          <text v-if="hasSpec" class="spec-tip">选规格</text>
        </view>
        <slot name="action" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { fixUrl } from '@/config';
import { price } from '@/utils/format';

const props = defineProps({
  dish: { type: Object, required: true },
  showSales: { type: Boolean, default: true },
});
const emit = defineEmits(['open']);
const soldOut = props.dish.soldOut === 1;
const isRecommend = props.dish.isRecommend === 1;
const hasSpec = props.dish.hasSpec === 1;

function onOpen() {
  if (soldOut) return;
  emit('open', props.dish);
}
</script>

<style lang="scss" scoped>
.dish {
  display: flex;
  padding: 24rpx;
  background: #fff;
  border-radius: $radius-card;
  margin-bottom: 16rpx;
  &.is-sold-out {
    opacity: 0.55;
  }
  .cover-wrap {
    position: relative;
    width: 160rpx;
    height: 160rpx;
    border-radius: 12rpx;
    overflow: hidden;
    background: $cream-white;
    flex-shrink: 0;
  }
  .cover {
    width: 100%;
    height: 100%;
  }
  .mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .info {
    flex: 1;
    margin-left: 20rpx;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name-line {
    display: flex;
    align-items: center;
  }
  .name {
    font-size: 30rpx;
    font-weight: 600;
    color: $text-primary;
  }
  .badge {
    margin-left: 12rpx;
    font-size: 20rpx;
    padding: 2rpx 10rpx;
    border-radius: 6rpx;
    &.rec {
      color: $cat-orange;
      background: rgba(232, 168, 124, 0.18);
    }
  }
  .tags,
  .sales,
  .desc {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: $text-secondary;
  }
  .desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bottom {
    margin-top: auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .price-line {
    display: flex;
    align-items: baseline;
  }
  .price {
    color: $coffee-brown;
    font-size: 32rpx;
    font-weight: 600;
  }
  .origin {
    margin-left: 10rpx;
    font-size: 22rpx;
    color: $text-placeholder;
    text-decoration: line-through;
  }
  .spec-tip {
    margin-left: 12rpx;
    font-size: 20rpx;
    color: $cat-orange;
    border: 1rpx solid $cat-orange;
    border-radius: 6rpx;
    padding: 2rpx 8rpx;
  }
}
</style>
