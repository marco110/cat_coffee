<template>
  <view class="page">
    <view v-for="c in list" :key="c.id" class="coupon">
      <view class="c-left">
        <text class="c-value">{{ couponValue(c) }}</text>
        <text class="c-threshold">满{{ price(c.thresholdAmount) }}可用</text>
      </view>
      <view class="c-right">
        <text class="c-name">{{ c.name }}</text>
        <text class="c-desc">{{ c.description || '全店通用' }}</text>
        <text class="c-expire">
          {{ c.validDays ? `领取后 ${c.validDays} 天内有效` : `${dateText(c.validStart)} 至 ${dateText(c.validEnd)}` }}
        </text>
      </view>
      <view class="c-btn" :class="{ disabled: !c.canClaim }" @click="claim(c)">
        {{ c.canClaim ? '领取' : '已领取' }}
      </view>
    </view>
    <ct-empty v-if="!list.length" text="暂无可领取的优惠券" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCouponCenter, claimCoupon } from '@/api/customer';
import { price, couponValue, dateText } from '@/utils/format';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID } from '@/utils/auth';
import CtEmpty from '@/components/ct-empty.vue';

const userStore = useUserStore();
const storeId = userStore.storeId || String(DEFAULT_STORE_ID);
const list = ref([]);

onMounted(async () => {
  list.value = await getCouponCenter(storeId);
});

async function claim(c) {
  if (!c.canClaim) return;
  try {
    await claimCoupon(c.id);
    uni.showToast({ title: '领取成功', icon: 'none' });
    list.value = await getCouponCenter(storeId);
  } catch (e) {
    uni.showToast({ title: e.msg || '领取失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.coupon {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: $radius-card;
  padding: 28rpx;
  margin-bottom: 20rpx;
}
.c-left {
  width: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1rpx dashed $border-color;
}
.c-value {
  color: $coffee-brown;
  font-size: 44rpx;
  font-weight: 700;
}
.c-threshold {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.c-right {
  flex: 1;
  margin-left: 28rpx;
  display: flex;
  flex-direction: column;
}
.c-name {
  font-size: 30rpx;
  font-weight: 600;
}
.c-desc,
.c-expire {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.c-btn {
  padding: 12rpx 32rpx;
  border-radius: 30rpx;
  background: $coffee-brown;
  color: #fff;
  font-size: 26rpx;
  &.disabled {
    background: $border-color;
    color: $text-placeholder;
  }
}
</style>
