<template>
  <view class="page">
    <view class="tabs">
      <scroll-view scroll-x class="tabs-scroll">
        <view class="tabs-inner">
          <text v-for="t in TABS" :key="t.value" class="tab" :class="{ on: status === t.value }" @click="switchTab(t.value)">{{ t.label }}</text>
        </view>
      </scroll-view>
    </view>

    <view v-for="o in list" :key="o.id" class="card item">
      <view class="head">
        <view class="h-left">
          <ct-status-tag :status="o.status" />
          <ct-status-tag :status="o.payStatus" />
          <text v-if="o.isTimeout" class="timeout">等待超时</text>
          <text v-if="o.modifyCount" class="modified">已改单x{{ o.modifyCount }}</text>
        </view>
        <text class="wait">{{ o.waitedMinutes }} 分钟</text>
      </view>

      <view class="no-line">
        <text class="order-no">{{ o.orderNo }}</text>
        <text class="type">{{ o.orderType === 'DINE_IN' ? `堂食 ${o.tableNo || ''}` : `打包 ${o.pickupCode || ''}` }}</text>
      </view>

      <view v-for="it in o.items" :key="it.id" class="dish">
        <text class="d-name">{{ it.dishName }}</text>
        <text v-if="it.specText" class="d-spec">{{ it.specText }}</text>
        <text v-if="it.remark" class="d-remark">备注：{{ it.remark }}</text>
        <text class="d-qty">x{{ it.quantity }}</text>
      </view>

      <view v-if="o.remark" class="o-remark">整单备注：{{ o.remark }}</view>

      <view class="foot">
        <text class="amount">¥{{ price(o.payAmount) }}</text>
        <view class="ops">
          <text
            v-for="b in o.buttons"
            :key="b"
            class="op"
            :class="{ primary: ['ACCEPT', 'MAKE', 'READY', 'COMPLETE', 'PAY'].includes(b) }"
            @click="onOp(o, b)"
          >{{ BTN[b] }}</text>
        </view>
      </view>
    </view>

    <ct-empty v-if="!list.length && !loading" text="暂无订单" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow, onPullDownRefresh, onReachBottom, onUnload } from '@dcloudio/uni-app';
import { orderList, orderAction, orderPay } from '@/api/merchant';
import { price } from '@/utils/format';
import { useUserStore } from '@/store/user';
import CtStatusTag from '@/components/ct-status-tag.vue';
import CtEmpty from '@/components/ct-empty.vue';

const TABS = [
  { label: '全部', value: '' },
  { label: '待接单', value: 'PENDING' },
  { label: '制作中', value: 'MAKING' },
  { label: '待取餐', value: 'READY' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
];
const BTN = {
  ACCEPT: '接单',
  REJECT: '拒单',
  MAKE: '开始制作',
  READY: '出品完成',
  COMPLETE: '确认完成',
  CANCEL: '取消订单',
  MODIFY: '改单',
  PAY: '已收款',
};

const userStore = useUserStore();
const status = ref('');
const list = ref([]);
const page = ref(1);
const loading = ref(false);
let timer = null;

async function load(reset = true) {
  if (!userStore.isMerchantLogin) return uni.redirectTo({ url: '/subpackages/merchant/login/index' });
  if (loading.value) return;
  loading.value = true;
  if (reset) page.value = 1;
  try {
    const data = await orderList({ status: status.value, page: page.value, pageSize: 10 });
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
async function onOp(o, b) {
  if (b === 'MODIFY') return uni.navigateTo({ url: `/subpackages/merchant/order/modify?id=${o.id}` });
  if (b === 'PAY') {
    uni.showModal({
      title: '确认收款',
      content: `确认已收到 ¥${price(o.payAmount)}？`,
      success: async (r) => {
        if (!r.confirm) return;
        await orderPay(o.id, { paidAmount: o.payAmount });
        uni.showToast({ title: '已收款', icon: 'none' });
        load(true);
      },
    });
    return;
  }
  if (b === 'REJECT' || b === 'CANCEL') {
    uni.showModal({
      title: b === 'REJECT' ? '拒绝订单' : '取消订单',
      editable: true,
      placeholderText: '请输入原因',
      success: async (r) => {
        if (!r.confirm) return;
        await orderAction(o.id, b === 'REJECT' ? 'reject' : 'cancel', { reason: r.content || '' });
        uni.showToast({ title: '已处理', icon: 'none' });
        load(true);
      },
    });
    return;
  }
  const map = { ACCEPT: 'accept', MAKE: 'making', READY: 'ready', COMPLETE: 'complete' };
  await orderAction(o.id, map[b]);
  uni.showToast({ title: '操作成功', icon: 'none' });
  load(true);
}

onMounted(() => load(true));
onShow(() => {
  load(true);
  timer = setInterval(() => load(true), 15000);
});
onUnload(() => timer && clearInterval(timer));
onPullDownRefresh(() => load(true));
onReachBottom(() => {
  page.value += 1;
  load(false);
});
</script>

<style lang="scss" scoped>
.page {
  padding: 0 24rpx 40rpx;
}
.tabs {
  padding: 20rpx 0;
  background: $bg-page;
}
.tabs-scroll {
  white-space: nowrap;
}
.tabs-inner {
  display: inline-flex;
}
.tab {
  padding: 12rpx 28rpx;
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
.h-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.timeout {
  color: $danger;
  font-size: 22rpx;
}
.modified {
  color: $cat-orange;
  font-size: 22rpx;
}
.wait {
  font-size: 22rpx;
  color: $text-secondary;
}
.no-line {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.order-no {
  font-size: 26rpx;
  color: $text-secondary;
}
.type {
  font-size: 28rpx;
  font-weight: 600;
}
.dish {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
  font-size: 26rpx;
  border-bottom: 1rpx dashed $border-color;
}
.d-name {
  flex: 1;
}
.d-spec,
.d-remark {
  font-size: 22rpx;
  color: $text-secondary;
  margin-right: 12rpx;
}
.d-qty {
  width: 70rpx;
  text-align: right;
  color: $text-secondary;
}
.o-remark {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $cat-orange;
}
.foot {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.amount {
  color: $coffee-brown;
  font-size: 34rpx;
  font-weight: 700;
}
.ops {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.op {
  margin: 0 0 12rpx 16rpx;
  padding: 12rpx 28rpx;
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
