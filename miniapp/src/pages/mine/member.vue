<template>
  <view class="page">
    <view class="card vip">
      <view class="vip-top">
        <text class="vip-level">{{ info.levelName }}</text>
        <text class="vip-discount">{{ discountText(info.discountRate) }}</text>
      </view>
      <view class="vip-nums">
        <view class="num"><text class="n">{{ info.points || 0 }}</text><text class="l">积分</text></view>
        <view class="num"><text class="n">{{ info.growth || 0 }}</text><text class="l">成长值</text></view>
        <view class="num"><text class="n">¥{{ price(info.totalConsume) }}</text><text class="l">累计消费</text></view>
        <view class="num"><text class="n">{{ info.orderCount || 0 }}</text><text class="l">订单数</text></view>
      </view>
      <view v-if="info.nextLevel" class="progress">
        <view class="bar"><view class="bar-in" :style="{ width: progress + '%' }" /></view>
        <text class="p-text">距 {{ info.nextLevel.name }} 还需成长值 {{ info.nextLevel.needGrowth }}</text>
      </view>
    </view>

    <view v-if="info.benefits" class="card block">
      <view class="title">会员权益</view>
      <text class="benefits">{{ info.benefits }}</text>
    </view>

    <view class="card block">
      <view class="title">等级体系</view>
      <view v-for="l in levels" :key="l.id" class="level" :class="{ cur: l.id === info.levelId }">
        <text class="l-name">{{ l.name }}</text>
        <text class="l-threshold">成长值 ≥ {{ l.growthThreshold }}</text>
        <text class="l-discount">{{ discountText(l.discount) }}</text>
      </view>
    </view>

    <view class="go-points" @click="go('/pages/mine/points')">查看积分明细 ›</view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getMemberInfo, getMemberLevels } from '@/api/customer';
import { price, discountText } from '@/utils/format';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID } from '@/utils/auth';

const userStore = useUserStore();
const storeId = userStore.storeId || String(DEFAULT_STORE_ID);
const info = ref({});
const levels = ref([]);

const progress = computed(() => {
  const next = info.value.nextLevel;
  if (!next) return 100;
  const target = next.growthThreshold || 1;
  const cur = target - (next.needGrowth || 0);
  return Math.min(100, Math.round((cur / target) * 100));
});

onMounted(async () => {
  info.value = await getMemberInfo(storeId);
  levels.value = await getMemberLevels(storeId);
});
function go(url) {
  uni.navigateTo({ url });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.vip {
  padding: 36rpx 32rpx;
  background: $grad-brand;
  color: #fff;
}
.vip-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.vip-level {
  font-size: 40rpx;
  font-weight: 700;
}
.vip-discount {
  padding: 8rpx 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.18);
  font-size: 26rpx;
}
.vip-nums {
  margin-top: 32rpx;
  display: flex;
}
.num {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.n {
  font-size: 34rpx;
  font-weight: 700;
}
.l {
  margin-top: 6rpx;
  font-size: 22rpx;
  opacity: 0.8;
}
.progress {
  margin-top: 32rpx;
}
.bar {
  height: 12rpx;
  border-radius: 6rpx;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}
.bar-in {
  height: 100%;
  background: $cat-orange;
}
.p-text {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  opacity: 0.85;
}
.block {
  margin-top: 24rpx;
  padding: 28rpx 32rpx;
}
.title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}
.benefits {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.8;
}
.level {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx dashed $border-color;
  font-size: 26rpx;
  &.cur {
    color: $coffee-brown;
    font-weight: 600;
  }
}
.l-threshold {
  flex: 1;
  margin-left: 24rpx;
  color: $text-secondary;
  font-size: 24rpx;
}
.go-points {
  margin-top: 32rpx;
  text-align: center;
  color: $coffee-brown;
  font-size: 26rpx;
}
</style>
