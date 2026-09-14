<template>
  <view class="page">
    <view v-for="l in list" :key="l.id" class="card item">
      <view class="left">
        <text class="name">{{ l.typeText }}</text>
        <text class="time">{{ l.createdAt }}</text>
        <text v-if="l.remark" class="remark">{{ l.remark }}</text>
      </view>
      <text class="points" :class="{ plus: l.points > 0 }">{{ l.points > 0 ? '+' : '' }}{{ l.points }}</text>
    </view>
    <ct-empty v-if="!list.length" text="暂无积分记录" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onReachBottom } from '@dcloudio/uni-app';
import { getPointsLog } from '@/api/customer';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID } from '@/utils/auth';

const userStore = useUserStore();
const storeId = userStore.storeId || String(DEFAULT_STORE_ID);
const list = ref([]);
const page = ref(1);

async function load(reset = true) {
  const data = await getPointsLog(storeId, page.value);
  list.value = reset ? data.list : [...list.value, ...data.list];
}
onMounted(() => load(true));
onReachBottom(() => {
  page.value += 1;
  load(false);
});
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 40rpx;
}
.item {
  padding: 24rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.left {
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 28rpx;
}
.time {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.remark {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-placeholder;
}
.points {
  font-size: 34rpx;
  font-weight: 700;
  color: $text-secondary;
  &.plus {
    color: $success;
  }
}
</style>
