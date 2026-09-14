<template>
  <view class="page">
    <view class="tabs">
      <text v-for="t in RANGES" :key="t.value" class="tab" :class="{ on: range === t.value }" @click="pickRange(t.value)">{{ t.label }}</text>
    </view>

    <view class="kpis">
      <view class="kpi"><text class="v">¥{{ price(overview.revenue) }}</text><text class="l">营业额</text></view>
      <view class="kpi"><text class="v">{{ overview.orderCount }}</text><text class="l">订单数</text></view>
      <view class="kpi"><text class="v">¥{{ price(overview.avgOrderAmount) }}</text><text class="l">客单价</text></view>
      <view class="kpi"><text class="v">{{ overview.newMember }}</text><text class="l">新增会员</text></view>
    </view>

    <view class="card block">
      <view class="bt">营业额趋势</view>
      <view class="chart">
        <view v-for="t in trend" :key="t.date" class="bar-wrap">
          <text class="bar-label">¥{{ Math.round(t.revenue) }}</text>
          <view class="bar" :style="{ height: barHeight(t.revenue) }" />
          <text class="bar-date">{{ t.date.slice(5) }}</text>
        </view>
      </view>
    </view>

    <view class="card block">
      <view class="bt">热销 TOP 10</view>
      <view v-for="(d, i) in topDishes" :key="d.dishId" class="rank">
        <text class="r-no">{{ i + 1 }}</text>
        <text class="r-name">{{ d.name }}</text>
        <text class="r-qty">{{ d.quantity }} 份</text>
        <text class="r-amount">¥{{ price(d.amount) }}</text>
      </view>
      <ct-empty v-if="!topDishes.length" text="暂无销量数据" />
    </view>

    <view class="card block">
      <view class="bt">高峰时段（订单量）· 峰值 {{ peakLabel }}</view>
      <view class="hours">
        <view v-for="h in peakHours" :key="h.hour" class="h-wrap">
          <view class="h-bar" :style="{ height: hourHeight(h.count) }" />
          <text class="h-label">{{ h.hour }}</text>
        </view>
      </view>
    </view>

    <view class="card block">
      <view class="bt">会员概况</view>
      <view class="m-row"><text>会员总数</text><text>{{ memberStat.total }}</text></view>
      <view class="m-row"><text>30 天活跃会员</text><text>{{ memberStat.active30d }}</text></view>
      <view class="m-row"><text>已核销优惠券</text><text>{{ memberStat.couponUsed }}</text></view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { statOverview, statTrend, statTopDishes, statPeakHours, statMember } from '@/api/merchant';
import { price } from '@/utils/format';

const RANGES = [
  { label: '今日', value: 'TODAY' },
  { label: '近 7 天', value: '7D' },
  { label: '近 30 天', value: '30D' },
];
const range = ref('7D');
const overview = ref({});
const trend = ref([]);
const topDishes = ref([]);
const peakHours = ref([]);
const peakLabel = ref('-');
const memberStat = ref({});

const maxRevenue = computed(() => Math.max(1, ...trend.value.map((t) => t.revenue || 0)));
const maxHour = computed(() => Math.max(1, ...peakHours.value.map((h) => h.count || 0)));

function barHeight(v) {
  return `${Math.max(8, Math.round(((v || 0) / maxRevenue.value) * 200))}rpx`;
}
function hourHeight(v) {
  return `${Math.max(8, Math.round(((v || 0) / maxHour.value) * 160))}rpx`;
}

async function load() {
  const [o, t, d, h, m] = await Promise.all([
    statOverview({ range: range.value }),
    statTrend({ range: range.value }),
    statTopDishes({ range: range.value }),
    statPeakHours({ range: range.value }),
    statMember(),
  ]);
  overview.value = o;
  trend.value = t.list || [];
  topDishes.value = Array.isArray(d) ? d : d.list || [];
  peakHours.value = h.distribution || [];
  peakLabel.value = h.peakHour || '-';
  memberStat.value = m;
}
function pickRange(v) {
  range.value = v;
  load();
}

onMounted(() => load());
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.tabs {
  display: flex;
  margin-bottom: 20rpx;
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
.kpis {
  display: flex;
  background: #fff;
  border-radius: $radius-card;
  padding: 28rpx 0;
  margin-bottom: 20rpx;
}
.kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.v {
  font-size: 32rpx;
  font-weight: 700;
  color: $coffee-brown;
}
.l {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.block {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.bt {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}
.chart {
  display: flex;
  align-items: flex-end;
  height: 260rpx;
}
.bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.bar {
  width: 24rpx;
  background: linear-gradient(180deg, #e8a87c, #6f4e37);
  border-radius: 6rpx 6rpx 0 0;
  margin: 8rpx 0;
}
.bar-label {
  font-size: 18rpx;
  color: $text-secondary;
}
.bar-date {
  font-size: 18rpx;
  color: $text-secondary;
}
.rank {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx dashed $border-color;
  font-size: 26rpx;
}
.r-no {
  width: 48rpx;
  color: $cat-orange;
  font-weight: 700;
}
.r-name {
  flex: 1;
}
.r-qty {
  width: 120rpx;
  text-align: right;
  color: $text-secondary;
}
.r-amount {
  width: 140rpx;
  text-align: right;
  color: $coffee-brown;
}
.hours {
  display: flex;
  align-items: flex-end;
  height: 220rpx;
}
.h-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.h-bar {
  width: 16rpx;
  background: $coffee-brown;
  border-radius: 4rpx 4rpx 0 0;
}
.h-label {
  margin-top: 8rpx;
  font-size: 16rpx;
  color: $text-secondary;
}
.m-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: $text-secondary;
  border-bottom: 1rpx dashed $border-color;
}
</style>
