<template>
  <view class="page">
    <view class="card block">
      <view class="bt">订单明细（数量改为 0 即删除）</view>
      <view v-for="(it, i) in items" :key="it.id" class="goods">
        <view class="g-info">
          <text class="g-name">{{ it.dishName }}</text>
          <text v-if="it.specText" class="g-spec">{{ it.specText }}</text>
          <input v-model="it.remark" class="remark-input" placeholder="备注" placeholder-class="ph" />
        </view>
        <text class="g-price">¥{{ price(it.subtotal) }}</text>
        <ct-qty :value="it.quantity" :max="99" @change="(v) => (it.quantity = v)" />
      </view>
      <view class="add" @click="showAdd = true">+ 添加菜品</view>
    </view>

    <view class="card block">
      <view class="row"><text class="label">改单原因</text><input v-model="reason" class="input" placeholder="如顾客要求加单" placeholder-class="ph" /></view>
      <view v-if="result.amountChange" class="diff" :class="{ up: result.amountChange > 0 }">
        <text>金额变化</text>
        <text>{{ result.amountChange > 0 ? '+' : '-' }}¥{{ price(Math.abs(result.amountChange)) }}（{{ price(result.amountBefore) }} → {{ price(result.amountAfter) }}）</text>
      </view>
      <view v-if="result.needRefund" class="refund">该订单已收款，需向顾客退款 ¥{{ price(result.needRefund) }}</view>
      <view v-if="result.couponRevalidated === false" class="refund">优惠券已不满足使用条件，已自动移除</view>
    </view>

    <view class="submit" @click="submit">确认改单</view>

    <!-- 添加菜品 -->
    <view v-if="showAdd" class="mask" @click="showAdd = false">
      <view class="panel" @click.stop>
        <view class="p-head">添加菜品</view>
        <input v-model="kw" class="search" placeholder="搜索菜品" placeholder-class="ph" />
        <scroll-view class="p-body" scroll-y>
          <view v-for="d in dishOptions" :key="d.id" class="dish-row" @click="addDish(d)">
            <text>{{ d.name }}</text>
            <text class="dp">¥{{ price(d.price) }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { orderDetail, orderModify, dishList } from '@/api/merchant';
import { getDish } from '@/api/customer';
import { price } from '@/utils/format';

const orderId = ref('');
const items = ref([]);
const reason = ref('');
const result = ref({});
const dishes = ref([]);
const kw = ref('');
const showAdd = ref(false);

const dishOptions = computed(() =>
  dishes.value.filter((d) => !kw.value || d.name.includes(kw.value))
);

onLoad(async (opt) => {
  orderId.value = opt.id;
  const o = await orderDetail(orderId.value);
  items.value = (o.items || []).map((it) => ({ ...it }));
  const data = await dishList({ pageSize: 100, status: 'ON' });
  dishes.value = data.list || [];
});

async function addDish(d) {
  const detail = await getDish(d.id);
  items.value.push({
    id: '',
    dishId: detail.id,
    dishName: detail.name,
    specText: '',
    unitPrice: detail.price,
    quantity: 1,
    subtotal: detail.price,
    remark: '',
  });
  showAdd.value = false;
  uni.showToast({ title: '已添加，可在上方调整数量', icon: 'none' });
}

async function submit() {
  try {
    const res = await orderModify(orderId.value, {
      items: items.value.map((it) => ({
        orderItemId: it.id || undefined,
        dishId: it.id ? undefined : it.dishId,
        quantity: it.quantity,
        remark: it.remark,
      })),
      modifyReason: reason.value,
    });
    result.value = res;
    uni.showModal({
      title: '改单成功',
      content: `${res.changeSummary}${res.needRefund ? `，需退款 ¥${price(res.needRefund)}` : ''}`,
      showCancel: false,
      success: () => uni.navigateBack(),
    });
  } catch (e) {
    uni.showToast({ title: e.msg || '改单失败', icon: 'none' });
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
.bt {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.goods {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
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
.g-spec {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.remark-input {
  margin-top: 8rpx;
  font-size: 24rpx;
  background: $cream-white;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
}
.ph {
  color: $text-placeholder;
}
.g-price {
  width: 140rpx;
  text-align: right;
  color: $coffee-brown;
}
.add {
  margin-top: 24rpx;
  padding: 24rpx;
  text-align: center;
  border: 2rpx dashed $coffee-brown;
  color: $coffee-brown;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
}
.label {
  width: 160rpx;
  color: $text-secondary;
  font-size: 26rpx;
}
.input {
  flex: 1;
  font-size: 26rpx;
}
.diff {
  margin-top: 16rpx;
  display: flex;
  justify-content: space-between;
  font-size: 26rpx;
  color: $cat-orange;
  &.up {
    color: $success;
  }
}
.refund {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 8rpx;
  background: rgba(245, 108, 108, 0.1);
  color: $danger;
  font-size: 24rpx;
}
.submit {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  height: 92rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
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
  padding: 24rpx;
}
.p-head {
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}
.search {
  background: $cream-white;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}
.p-body {
  max-height: 46vh;
  margin-top: 20rpx;
}
.dish-row {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 8rpx;
  border-bottom: 1rpx solid $border-color;
  font-size: 28rpx;
}
.dp {
  color: $coffee-brown;
}
</style>
