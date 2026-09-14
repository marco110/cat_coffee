<template>
  <view class="page">
    <view class="tabs">
      <text
        v-for="t in TABS"
        :key="t.value"
        class="tab"
        :class="{ on: status === t.value }"
        @click="switchTab(t.value)"
      >{{ t.label }}</text>
    </view>

    <view v-for="o in list" :key="o.id" class="card item" @click="goDetail(o)">
      <view class="head">
        <text class="store">{{ o.storeName }}</text>
        <ct-status-tag :status="o.status" />
      </view>
      <view v-for="(d, i) in o.dishes" :key="i" class="dish">
        <text class="d-name">{{ d.name }}</text>
        <text class="d-qty">x{{ d.quantity }}</text>
      </view>
      <view class="foot">
        <text class="time">{{ o.createdAt }}</text>
        <view class="foot-right">
          <ct-status-tag :status="o.payStatus" />
          <text class="amount">¥{{ price(o.payAmount) }}</text>
        </view>
      </view>
      <view class="ops">
        <text v-for="b in o.buttons" :key="b" class="op" :class="{ primary: b !== 'URGE' }" @click.stop="onOp(o, b)">
          {{ OP_TEXT[b] }}
        </text>
      </view>
    </view>

    <ct-empty v-if="!list.length && !loading" text="暂无订单" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app';
import { getOrderList, cancelOrder, reorder } from '@/api/customer';
import { price } from '@/utils/format';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';

const TABS = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'ONGOING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
];
const OP_TEXT = { CANCEL: '取消订单', URGE: '催单', REORDER: '再来一单' };

const cart = useCartStore();
const userStore = useUserStore();
const status = ref('');
const list = ref([]);
const page = ref(1);
const loading = ref(false);

async function load(reset = true) {
  if (loading.value) return;
  loading.value = true;
  if (reset) page.value = 1;
  try {
    const data = await getOrderList({ status: status.value, page: page.value, pageSize: 10 });
    list.value = reset ? data.list : [...list.value, ...data.list];
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}
function switchTab(v) {
  status.value = v;
  load(true);
}
function goDetail(o) {
  uni.navigateTo({ url: `/pages/order/detail?id=${o.id}` });
}
function onOp(o, b) {
  if (b === 'CANCEL') {
    uni.showModal({
      title: '取消订单',
      content: '确认取消？',
      success: async (r) => {
        if (!r.confirm) return;
        await cancelOrder(o.id, '顾客取消');
        load(true);
      },
    });
  } else if (b === 'URGE') {
    uni.showToast({ title: '已催单', icon: 'none' });
  } else if (b === 'REORDER') {
    reorder(o.id).then((data) => {
      cart.bindStore(data.storeId);
      userStore.setStore({ storeId: data.storeId });
      uni.switchTab({ url: '/pages/order/menu' });
    });
  }
}

onMounted(() => load(true));
onShow(() => load(true));
onReachBottom(() => {
  page.value += 1;
  load(false);
});
onPullDownRefresh(() => load(true));
</script>

<style lang="scss" scoped>
.page {
  padding: 0 24rpx 40rpx;
}
.tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  background: $bg-page;
  padding: 20rpx 0;
}
.tab {
  padding: 12rpx 32rpx;
  border-radius: 30rpx;
  background: #fff;
  font-size: 26rpx;
  color: $text-secondary;
  margin-right: 16rpx;
  &.on {
    background: $coffee-brown;
    color: #fff;
  }
}
.item {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.store {
  font-size: 30rpx;
  font-weight: 600;
}
.dish {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
  font-size: 26rpx;
  color: $text-secondary;
}
.foot {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid $border-color;
  padding-top: 16rpx;
}
.time {
  font-size: 22rpx;
  color: $text-secondary;
}
.foot-right {
  display: flex;
  align-items: center;
}
.amount {
  margin-left: 16rpx;
  color: $coffee-brown;
  font-size: 32rpx;
  font-weight: 700;
}
.ops {
  margin-top: 16rpx;
  display: flex;
  justify-content: flex-end;
}
.op {
  margin-left: 16rpx;
  padding: 10rpx 28rpx;
  border-radius: 30rpx;
  border: 1rpx solid $border-color;
  font-size: 24rpx;
  &.primary {
    background: $coffee-brown;
    color: #fff;
    border-color: $coffee-brown;
  }
}
</style>
