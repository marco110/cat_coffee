<template>
  <view class="page" v-if="order.id">
    <view class="card block">
      <view class="title-row">
        <text class="order-no">{{ order.orderNo }}</text>
        <ct-status-tag :status="order.status" />
        <ct-status-tag :status="order.payStatus" />
      </view>
      <view class="meta">
        <text>{{ order.orderType === 'DINE_IN' ? `堂食 · 桌号 ${order.tableNo}` : `打包 · 取餐码 ${order.pickupCode}` }}</text>
        <text>下单 {{ order.createdAt }} · 已等待 {{ order.waitedMinutes }} 分钟</text>
        <text v-if="order.userPhone">顾客 {{ order.userNickname }} {{ order.userPhone }}</text>
      </view>
    </view>

    <view class="card block">
      <view class="bt">菜品明细（{{ order.itemCount }} 件）</view>
      <view v-for="it in order.items" :key="it.id" class="goods">
        <view class="g-info">
          <text class="g-name">{{ it.dishName }}</text>
          <text v-if="it.specText" class="g-spec">{{ it.specText }}</text>
          <text v-if="it.remark" class="g-remark">备注：{{ it.remark }}</text>
        </view>
        <text class="g-qty">x{{ it.quantity }}</text>
        <text class="g-price">¥{{ price(it.subtotal) }}</text>
      </view>
      <view class="sum">
        <text>合计</text>
        <text class="pay">¥{{ price(order.priceDetail?.payAmount) }}</text>
      </view>
    </view>

    <view class="card block" v-if="order.modifyNotice">
      <text class="warn-text">✏️ {{ order.modifyNotice }}</text>
    </view>

    <view class="card block">
      <view class="bt">操作</view>
      <view class="ops">
        <text v-for="b in order.buttons" :key="b" class="op" :class="{ primary: primaryButtons.includes(b) }" @click="onOp(b)">{{ BTN[b] }}</text>
      </view>
    </view>

    <view class="card block">
      <view class="bt">订单日志</view>
      <view v-for="(l, i) in logs" :key="i" class="log">
        <text class="l-title">{{ l.title }}</text>
        <text class="l-time">{{ l.createdAt }}</text>
        <text v-if="l.remark" class="l-remark">{{ l.remark }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { orderDetail, orderLogs, orderAction, orderPay } from '@/api/merchant';
import { price } from '@/utils/format';

const BTN = {
  ACCEPT: '接单',
  REJECT: '拒单',
  MAKE: '开始制作',
  READY: '出品完成',
  COMPLETE: '确认完成',
  CANCEL: '取消订单',
  MODIFY: '改单',
  PAY: '标记已收款',
};
const primaryButtons = ['ACCEPT', 'MAKE', 'READY', 'COMPLETE', 'PAY'];

const order = ref({});
const logs = ref([]);
const orderId = ref('');

onLoad(async (opt) => {
  orderId.value = opt.id;
  await load();
});

async function load() {
  order.value = await orderDetail(orderId.value);
  logs.value = await orderLogs(orderId.value);
}

async function onOp(b) {
  if (b === 'MODIFY') return uni.navigateTo({ url: `/subpackages/merchant/order/modify?id=${orderId.value}` });
  if (b === 'PAY') {
    await orderPay(orderId.value, { paidAmount: order.value.priceDetail?.payAmount });
    uni.showToast({ title: '已收款', icon: 'none' });
    return load();
  }
  if (b === 'REJECT' || b === 'CANCEL') {
    uni.showModal({
      title: b === 'REJECT' ? '拒绝订单' : '取消订单',
      editable: true,
      placeholderText: '请输入原因',
      success: async (r) => {
        if (!r.confirm) return;
        await orderAction(orderId.value, b === 'REJECT' ? 'reject' : 'cancel', { reason: r.content || '' });
        uni.showToast({ title: '已处理', icon: 'none' });
        load();
      },
    });
    return;
  }
  const map = { ACCEPT: 'accept', MAKE: 'making', READY: 'ready', COMPLETE: 'complete' };
  await orderAction(orderId.value, map[b]);
  uni.showToast({ title: '操作成功', icon: 'none' });
  load();
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.block {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.order-no {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
}
.meta {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  font-size: 24rpx;
  color: $text-secondary;
  line-height: 1.8;
}
.bt {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.goods {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.g-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.g-name {
  font-size: 28rpx;
}
.g-spec,
.g-remark {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.g-qty {
  width: 80rpx;
  text-align: right;
  color: $text-secondary;
}
.g-price {
  width: 140rpx;
  text-align: right;
  color: $coffee-brown;
  font-weight: 600;
}
.sum {
  margin-top: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.pay {
  color: $coffee-brown;
  font-size: 36rpx;
  font-weight: 700;
}
.warn-text {
  color: $cat-orange;
  font-size: 26rpx;
}
.ops {
  display: flex;
  flex-wrap: wrap;
}
.op {
  margin: 0 16rpx 16rpx 0;
  padding: 14rpx 32rpx;
  border-radius: 30rpx;
  border: 1rpx solid $border-color;
  font-size: 26rpx;
  &.primary {
    background: $coffee-brown;
    color: #fff;
    border-color: $coffee-brown;
  }
}
.log {
  padding: 12rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.l-title {
  font-size: 26rpx;
}
.l-time {
  margin-left: 16rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.l-remark {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
</style>
