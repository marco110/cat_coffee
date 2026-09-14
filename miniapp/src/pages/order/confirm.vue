<template>
  <view class="page">
    <view class="card block">
      <view class="row">
        <text class="label">取餐方式</text>
        <text class="value">{{ orderType === 'DINE_IN' ? `堂食（桌号 ${tableNo}）` : '打包带走（凭取餐码）' }}</text>
      </view>
      <view v-if="orderType === 'DINE_IN'" class="row">
        <text class="label">用餐人数</text>
        <ct-qty :value="peopleCount" :max="20" @change="peopleCount = $event" />
      </view>
    </view>

    <view class="card block">
      <view class="block-title">商品清单（{{ cart.count }} 件）</view>
      <view v-for="it in cart.items" :key="it.key" class="goods">
        <image class="cover" :src="fixUrl(it.cover)" mode="aspectFill" />
        <view class="g-info">
          <text class="g-name">{{ it.name }}</text>
          <text v-if="it.specText" class="g-spec">{{ it.specText }}</text>
        </view>
        <text class="g-price">¥{{ price((it.unitPrice + (it.addonAmount || 0)) * it.quantity) }}</text>
        <text class="g-qty">x{{ it.quantity }}</text>
      </view>
    </view>

    <view v-if="coupons.length" class="card block" @click="couponVisible = true">
      <view class="row">
        <text class="label">优惠券</text>
        <text class="value" :class="{ muted: !selectedCoupon }">
          {{ selectedCoupon ? `${selectedCoupon.name}（-¥${price(detail.couponDiscount || 0)})` : `${coupons.length} 张可用` }}
        </text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view v-if="pointsEnabled" class="card block">
      <view class="row">
        <text class="label">积分抵扣（{{ member.points }} 分，可抵 ¥{{ price(pointsInfo.maxDeductAmount || 0) }}）</text>
        <switch :checked="usePoints" color="#6F4E37" @change="onTogglePoints" />
      </view>
    </view>

    <view class="card block">
      <view class="row">
        <text class="label">备注</text>
        <input v-model="remark" class="remark-input" placeholder="口味、忌口等要求" placeholder-class="ph" />
      </view>
    </view>

    <view class="card block price-block">
      <view v-for="d in detail.details || []" :key="d.label" class="prow">
        <text class="p-label">{{ d.label }}</text>
        <text class="p-value" :class="{ red: d.value < 0 }">{{ d.value < 0 ? '-' : '' }}¥{{ price(Math.abs(d.value)) }}</text>
      </view>
      <view class="prow total">
        <text class="p-label">应付金额</text>
        <text class="p-value">¥{{ price(detail.payAmount || 0) }}</text>
      </view>
      <text class="pay-tip">支付方式：到店付款（离店时前台结算）</text>
    </view>

    <view class="submit-wrap">
      <view class="submit" :class="{ loading: submitting }" @click="submit">
        {{ submitting ? '提交中...' : `提交订单 ¥${price(detail.payAmount || 0)}` }}
      </view>
    </view>

    <!-- 优惠券选择 -->
    <view v-if="couponVisible" class="mask" @click="couponVisible = false">
      <view class="panel" @click.stop>
        <view class="p-head">选择优惠券</view>
        <scroll-view class="p-body" scroll-y>
          <view
            v-for="c in coupons"
            :key="c.userCouponId"
            class="coupon"
            :class="{ on: selectedUserCouponId === c.userCouponId, disabled: !c.usable }"
            @click="pickCoupon(c)"
          >
            <view class="c-left">
              <text class="c-value">¥{{ c.type === 'DISCOUNT' ? discountText(c.discountRate) : price(c.discountAmount) }}</text>
              <text class="c-threshold">满{{ price(c.thresholdAmount) }}可用</text>
            </view>
            <view class="c-right">
              <text class="c-name">{{ c.name }}</text>
              <text class="c-expire">{{ dateText(c.expireAt) }} 前有效</text>
            </view>
            <text v-if="!c.usable" class="c-reason">{{ c.unusableReason }}</text>
          </view>
          <view class="coupon none" :class="{ on: !selectedUserCouponId }" @click="pickCoupon(null)">不使用优惠券</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { previewOrder, createOrder, getMemberInfo, getAvailableCoupons } from '@/api/customer';
import { fixUrl } from '@/config';
import { price, discountText, dateText } from '@/utils/format';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';

const cart = useCartStore();
const userStore = useUserStore();

const storeId = ref('');
const orderType = ref('TAKEAWAY');
const tableId = ref('');
const tableNo = ref('');
const peopleCount = ref(1);
const remark = ref('');

const detail = ref({});
const pointsInfo = ref({});
const member = ref({ points: 0 });
const pointsEnabled = ref(false);
const usePoints = ref(false);
const coupons = ref([]);
const selectedUserCouponId = ref('');
const selectedCoupon = computed(() => coupons.value.find((c) => c.userCouponId === selectedUserCouponId.value) || null);
const couponVisible = ref(false);
const submitting = ref(false);

onLoad(async (opt) => {
  storeId.value = opt.storeId || userStore.storeId;
  orderType.value = opt.orderType || 'TAKEAWAY';
  tableId.value = opt.tableId || '';
  tableNo.value = opt.tableNo || '';
  await load();
});

onMounted(() => {
  if (!storeId.value) storeId.value = userStore.storeId;
});

async function load() {
  try {
    const [p, m] = await Promise.all([
      previewOrder(buildPayload()),
      getMemberInfo(storeId.value).catch(() => ({ points: 0 })),
    ]);
    detail.value = p.priceDetail || {};
    pointsInfo.value = p.pointsInfo || {};
    member.value = m || { points: 0 };
    pointsEnabled.value = (p.pointsInfo && p.pointsInfo.maxUsablePoints) > 0;
    coupons.value = p.availableCoupons || [];
  } catch (e) {
    uni.showToast({ title: e.msg || '加载失败', icon: 'none' });
  }
}

function buildPayload() {
  return {
    storeId: storeId.value,
    items: cart.toPayload(),
    userCouponId: selectedUserCouponId.value || undefined,
    usePoints: usePoints.value,
    pointsUsed: usePoints.value ? pointsInfo.value.maxUsablePoints : 0,
  };
}

watch([usePoints, selectedUserCouponId], async () => {
  await load();
});

function onTogglePoints(e) {
  usePoints.value = e.detail.value;
}
function pickCoupon(c) {
  selectedUserCouponId.value = c ? c.userCouponId : '';
  couponVisible.value = false;
}

async function submit() {
  if (submitting.value) return;
  if (!cart.count) return uni.showToast({ title: '购物车为空', icon: 'none' });
  submitting.value = true;
  try {
    const res = await createOrder({
      ...buildPayload(),
      orderType: orderType.value,
      tableId: tableId.value || undefined,
      peopleCount: peopleCount.value,
      remark: remark.value,
    });
    cart.clear();
    uni.showToast({ title: res.tip || '下单成功', icon: 'none' });
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/order/detail?id=${res.orderId}` });
    }, 600);
  } catch (e) {
    uni.showToast({ title: e.msg || '下单失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 200rpx;
}
.block {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.block-title {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  .label {
    color: $text-secondary;
    font-size: 26rpx;
    margin-right: 20rpx;
  }
  .value {
    flex: 1;
    font-size: 26rpx;
    text-align: right;
    &.muted {
      color: $text-placeholder;
    }
  }
  .arrow {
    color: $text-placeholder;
    margin-left: 12rpx;
  }
}
.remark-input {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
}
.ph {
  color: $text-placeholder;
}
.goods {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx dashed $border-color;
  &:last-child {
    border-bottom: none;
  }
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
.g-spec {
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
.price-block {
  .prow {
    display: flex;
    justify-content: space-between;
    padding: 10rpx 0;
    font-size: 26rpx;
    color: $text-secondary;
  }
  .p-value.red {
    color: $cat-orange;
  }
  .total {
    border-top: 1rpx solid $border-color;
    margin-top: 12rpx;
    padding-top: 20rpx;
    .p-label {
      color: $text-primary;
      font-weight: 600;
      font-size: 28rpx;
    }
    .p-value {
      color: $coffee-brown;
      font-size: 36rpx;
      font-weight: 700;
    }
  }
  .pay-tip {
    display: block;
    margin-top: 12rpx;
    font-size: 22rpx;
    color: $text-secondary;
  }
}
.submit-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
}
.submit {
  height: 92rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  &.loading {
    opacity: 0.6;
  }
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.panel {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
}
.p-head {
  padding: 28rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  border-bottom: 1rpx solid $border-color;
}
.p-body {
  max-height: 56vh;
  padding: 20rpx 28rpx 40rpx;
}
.coupon {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 12rpx;
  background: $cream-white;
  margin-bottom: 16rpx;
  &.on {
    background: rgba(111, 78, 55, 0.1);
    border: 2rpx solid $coffee-brown;
  }
  &.disabled {
    opacity: 0.5;
  }
  &.none {
    justify-content: center;
    color: $text-secondary;
  }
}
.c-left {
  width: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1rpx dashed $border-color;
}
.c-value {
  color: $coffee-brown;
  font-size: 36rpx;
  font-weight: 700;
}
.c-threshold {
  font-size: 20rpx;
  color: $text-secondary;
}
.c-right {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}
.c-name {
  font-size: 28rpx;
}
.c-expire {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.c-reason {
  font-size: 20rpx;
  color: $danger;
}
</style>
