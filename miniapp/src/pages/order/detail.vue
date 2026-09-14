<template>
  <view class="page">
    <view class="status-card">
      <view class="s-main">
        <text class="s-text">{{ order.statusText }}</text>
        <ct-status-tag :status="order.status" />
        <ct-status-tag :status="order.payStatus" />
      </view>
      <text class="s-tip">{{ statusTip }}</text>
      <view v-if="order.pickupCode" class="code-box">
        <text class="code-label">取餐码</text>
        <text class="code">{{ order.pickupCode }}</text>
      </view>
      <view v-if="order.tableNo" class="code-box">
        <text class="code-label">桌号</text>
        <text class="code">{{ order.tableNo }}</text>
      </view>
    </view>

    <view v-if="order.modifyNotice" class="modify-notice">
      <text class="icon">✏️</text>
      <text>{{ order.modifyNotice }}</text>
    </view>

    <view class="card block">
      <view class="store-line">
        <text class="store-name">{{ order.storeName }}</text>
        <text class="order-type">{{ order.orderType === 'DINE_IN' ? '堂食' : '打包' }}</text>
      </view>
      <view v-for="it in order.items || []" :key="it.id" class="goods">
        <image class="cover" :src="fixUrl(it.dishCover)" mode="aspectFill" />
        <view class="g-info">
          <text class="g-name">{{ it.dishName }}</text>
          <text v-if="it.specText" class="g-spec">{{ it.specText }}</text>
          <text v-if="it.remark" class="g-remark">备注：{{ it.remark }}</text>
        </view>
        <text class="g-price">¥{{ price(it.subtotal) }}</text>
        <text class="g-qty">x{{ it.quantity }}</text>
      </view>
      <view class="total-line">
        <text>共 {{ order.itemCount }} 件</text>
        <text>应付 <text class="pay">¥{{ price(order.priceDetail?.payAmount || 0) }}</text></text>
      </view>
    </view>

    <view class="card block">
      <view class="block-title">费用明细</view>
      <view v-for="d in order.priceDetail?.details || []" :key="d.label" class="prow">
        <text>{{ d.label }}</text>
        <text :class="{ red: d.value < 0 }">{{ d.value < 0 ? '-' : '' }}¥{{ price(Math.abs(d.value)) }}</text>
      </view>
    </view>

    <view class="card block">
      <view class="block-title">订单进度</view>
      <view v-for="(t, i) in order.timeline || []" :key="i" class="tl">
        <view class="tl-dot" :class="{ first: i === 0 }" />
        <view class="tl-body">
          <text class="tl-title">{{ t.title }}</text>
          <text class="tl-time">{{ t.time }}</text>
        </view>
      </view>
    </view>

    <view class="card block info">
      <view class="irow"><text class="label">订单号</text><text>{{ order.orderNo }}</text></view>
      <view class="irow"><text class="label">下单时间</text><text>{{ order.createdAt }}</text></view>
      <view class="irow"><text class="label">支付方式</text><text>到店付款</text></view>
      <view v-if="order.remark" class="irow"><text class="label">备注</text><text>{{ order.remark }}</text></view>
    </view>

    <view class="actions">
      <view
        v-for="b in order.buttons || []"
        :key="b"
        class="btn"
        :class="{ primary: b === 'REORDER' || b === 'CANCEL' }"
        @click="onAction(b)"
      >
        {{ BUTTON_TEXT[b] }}
      </view>
      <view v-if="storePhone" class="btn" @click="callStore">联系门店</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { getOrderDetail, cancelOrder, urgeOrder, reorder } from '@/api/customer';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';

const cart = useCartStore();
const userStore = useUserStore();

const BUTTON_TEXT = { CANCEL: '取消订单', URGE: '催一下', REORDER: '再来一单' };
const order = ref({});
const orderId = ref('');
let timer = null;

const statusTip = computed(() => {
  const map = {
    PENDING: '订单已提交，等待店主确认',
    ACCEPTED: '店主已接单，即将开始制作',
    MAKING: '咖啡师正在制作中，请稍候',
    READY: '出品完成，请到吧台取餐',
    COMPLETED: '订单已完成，欢迎再次光临',
    CANCELLED: '订单已取消',
    REJECTED: '订单已被店主拒绝',
  };
  return map[order.value.status] || '';
});
const storePhone = computed(() => order.value.storePhone || '');

onLoad(async (opt) => {
  orderId.value = opt.id;
  await load();
});
onShow(() => {
  if (!orderId.value) return;
  timer = setInterval(load, 15000);
});
onUnload(() => {
  if (timer) clearInterval(timer);
});

async function load() {
  try {
    order.value = await getOrderDetail(orderId.value);
  } catch (e) {
    uni.showToast({ title: e.msg || '加载失败', icon: 'none' });
  }
}

function onAction(b) {
  if (b === 'CANCEL') {
    uni.showModal({
      title: '取消订单',
      content: '确认取消该订单？取消后优惠券与积分将原路退回',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await cancelOrder(orderId.value, '顾客取消');
          uni.showToast({ title: '已取消', icon: 'none' });
          await load();
        } catch (e) {
          uni.showToast({ title: e.msg || '取消失败', icon: 'none' });
        }
      },
    });
  } else if (b === 'URGE') {
    urgeOrder(orderId.value).then(() => uni.showToast({ title: '已提醒店员', icon: 'none' })).catch((e) => uni.showToast({ title: e.msg, icon: 'none' }));
  } else if (b === 'REORDER') {
    reorder(orderId.value).then((data) => {
      cart.bindStore(data.storeId);
      data.items.forEach((it) => {
        const dish = (order.value.items || []).find((x) => x.dishId === it.dishId);
        if (dish) cart.add({ id: dish.dishId, name: dish.dishName, cover: dish.dishCover, price: dish.unitPrice }, { quantity: it.quantity, specItemIds: it.specItemIds || [], specText: dish.specText || '' });
      });
      userStore.setStore({ storeId: data.storeId });
      uni.switchTab({ url: '/pages/order/menu' });
    });
  }
}
function callStore() {
  uni.makePhoneCall({ phoneNumber: storePhone.value });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.status-card {
  padding: 36rpx;
  border-radius: $radius-card;
  background: linear-gradient(135deg, #7d5940, #6f4e37);
  color: #fff;
}
.s-main {
  display: flex;
  align-items: center;
}
.s-text {
  font-size: 40rpx;
  font-weight: 700;
  margin-right: 20rpx;
}
.s-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.85;
}
.code-box {
  margin-top: 24rpx;
  display: flex;
  align-items: baseline;
}
.code-label {
  font-size: 24rpx;
  opacity: 0.8;
  margin-right: 16rpx;
}
.code {
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}
.modify-notice {
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: rgba(232, 168, 124, 0.16);
  border-radius: 12rpx;
  color: $cat-orange;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  .icon {
    margin-right: 12rpx;
  }
}
.block {
  margin-top: 20rpx;
  padding: 24rpx;
}
.store-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $border-color;
}
.store-name {
  font-size: 30rpx;
  font-weight: 600;
}
.order-type {
  font-size: 22rpx;
  color: $text-secondary;
}
.goods {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.cover {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background: $cream-white;
}
.g-info {
  flex: 1;
  margin-left: 20rpx;
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
.g-price {
  color: $coffee-brown;
  font-weight: 600;
}
.g-qty {
  width: 60rpx;
  text-align: right;
  color: $text-secondary;
  font-size: 24rpx;
}
.total-line {
  display: flex;
  justify-content: space-between;
  padding-top: 20rpx;
  font-size: 26rpx;
  color: $text-secondary;
  .pay {
    color: $coffee-brown;
    font-size: 32rpx;
    font-weight: 700;
  }
}
.block-title {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.prow {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
  font-size: 26rpx;
  color: $text-secondary;
}
.prow .red {
  color: $cat-orange;
}
.tl {
  display: flex;
  padding: 12rpx 0;
}
.tl-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: $border-color;
  margin-top: 8rpx;
  &.first {
    background: $coffee-brown;
  }
}
.tl-body {
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
}
.tl-title {
  font-size: 26rpx;
}
.tl-time {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.irow {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 0;
  font-size: 26rpx;
  color: $text-secondary;
  .label {
    color: $text-secondary;
  }
}
.actions {
  margin-top: 32rpx;
  display: flex;
  justify-content: flex-end;
}
.btn {
  margin-left: 20rpx;
  padding: 16rpx 36rpx;
  border-radius: 40rpx;
  border: 1rpx solid $border-color;
  font-size: 26rpx;
  color: $text-primary;
  &.primary {
    background: $coffee-brown;
    color: #fff;
    border-color: $coffee-brown;
  }
}
</style>
