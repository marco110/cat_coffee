<template>
  <view v-if="!isReview" class="page">
    <view class="tip card">
      <ct-kitty mode="paw" :size="90" color="#ff6fa5" opacity="0.9" />
      <view class="tip-text">
        <text class="t1">取餐专区</text>
        <text class="t2">凭取餐码到前台取餐，出品完成会第一时间叫号</text>
      </view>
    </view>

    <view v-for="o in list" :key="o.id" class="card item" @click="goDetail(o)">
      <view class="code-side">
        <template v-if="o.orderType === 'DINE_IN'">
          <text class="code-label">桌号</text>
          <text class="code">{{ o.tableNo || '—' }}</text>
        </template>
        <template v-else>
          <text class="code-label">取餐码</text>
          <text class="code">{{ o.pickupCode || '—' }}</text>
        </template>
      </view>
      <view class="info">
        <view class="line1">
          <text class="store">{{ o.storeName }}</text>
          <ct-status-tag :status="o.status" />
        </view>
        <text class="dishes">{{ dishText(o) }}</text>
        <view class="line3">
          <text class="time">{{ dateText(o.createdAt) }}</text>
          <text class="amount">¥{{ price(o.payAmount) }}</text>
        </view>
        <view class="ops" @click.stop>
          <text
            v-for="b in o.buttons"
            :key="b"
            class="op"
            :class="{ primary: b === 'URGE' }"
            @click="onOp(o, b)"
          >{{ OP_TEXT[b] }}</text>
        </view>
      </view>
    </view>

    <ct-empty v-if="!list.length && !loading" text="暂无进行中的订单" />

    <view class="foot-paw">做好的饮品会在这里叫号，别走远哦🐾</view>
  </view>

  <!-- 审核版本：不进入取餐，仅展示提示 -->
  <view v-else class="review-block">
    <ct-kitty mode="paw" :size="140" color="#ff6fa5" opacity="0.6" />
    <text class="rb-text">当前小程序不支持取餐，敬请期待~</text>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import { getOrderList, cancelOrder, urgeOrder } from '@/api/customer';
import { price, dateText } from '@/utils/format';
import { ensureLogin } from '@/utils/auth';
import CtStatusTag from '@/components/ct-status-tag.vue';
import CtEmpty from '@/components/ct-empty.vue';
import CtKitty from '@/components/ct-kitty.vue';
import { useAppStore } from '@/store/app';

const appStore = useAppStore();
const isReview = computed(() => appStore.isReview);
const OP_TEXT = { CANCEL: '取消订单', URGE: '催单', REORDER: '再来一单' };

const list = ref([]);
const loading = ref(false);
let timer = null;

onShow(async () => {
  // 审核版本：不进入取餐（订单），仅展示提示
  if (appStore.isReview) return;
  await ensureLogin();
  load(true);
  // 取餐场景需要及时看到状态变化，10s 轻量轮询
  timer = setInterval(() => load(true), 10000);
});
onHide(() => timer && clearInterval(timer));
onPullDownRefresh(() => load(true));

async function load(reset = true) {
  if (loading.value) return;
  loading.value = true;
  try {
    const data = await getOrderList({ status: 'ONGOING', page: 1, pageSize: 20 });
    list.value = reset ? data.list : [...list.value, ...data.list];
  } catch (e) {
    /* 静默，保留上次内容 */
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

function dishText(o) {
  return (o.dishes || []).map((d) => `${d.name}x${d.quantity}`).join('，') || '—';
}

function goDetail(o) {
  uni.navigateTo({ url: `/pages/order/detail?id=${o.id}` });
}

function onOp(o, b) {
  if (b === 'URGE') {
    uni.showModal({
      title: '催单',
      content: '通知门店加快制作这杯？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await urgeOrder(o.id);
          uni.showToast({ title: '已通知店家', icon: 'none' });
        } catch (e) {
          uni.showToast({ title: e.msg || '催单失败', icon: 'none' });
        }
      },
    });
    return;
  }
  if (b === 'CANCEL') {
    uni.showModal({
      title: '取消订单',
      content: '确认取消该订单？取消后优惠券与积分将原路退回',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await cancelOrder(o.id, '顾客取消');
          uni.showToast({ title: '已取消', icon: 'none' });
          load(true);
        } catch (e) {
          uni.showToast({ title: e.msg || '取消失败', icon: 'none' });
        }
      },
    });
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx 60rpx;
  background: $bg-page;
}
.tip {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  .tip-text {
    margin-left: 20rpx;
    display: flex;
    flex-direction: column;
  }
  .t1 {
    font-size: 30rpx;
    font-weight: 700;
    color: $text-primary;
  }
  .t2 {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $text-secondary;
  }
}
.item {
  display: flex;
  padding: 28rpx;
  margin-bottom: 20rpx;
}
/* 左侧取餐码区：浅粉底 + 大号号码 */
.code-side {
  flex-shrink: 0;
  width: 170rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: $pink-soft;
  border-radius: 16rpx;
  padding: 16rpx 0;
}
.code-label {
  font-size: 22rpx;
  color: $text-secondary;
}
.code {
  margin-top: 8rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: $pink-dark;
  letter-spacing: 2rpx;
}
.info {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}
.line1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.store {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
}
.dishes {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $text-secondary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.line3 {
  margin-top: 10rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.time {
  font-size: 22rpx;
  color: $text-placeholder;
}
.amount {
  font-size: 28rpx;
  font-weight: 700;
  color: $pink-dark;
}
.ops {
  margin-top: 14rpx;
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}
.op {
  padding: 10rpx 26rpx;
  border: 1rpx solid $border-color;
  border-radius: $radius-tag;
  font-size: 24rpx;
  color: $text-secondary;
  &.primary {
    background: $pink-dark;
    border-color: $pink-dark;
    color: #fff;
  }
}
.review-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 28rpx;
  .rb-text {
    font-size: 30rpx;
    color: $text-secondary;
  }
}
</style>
