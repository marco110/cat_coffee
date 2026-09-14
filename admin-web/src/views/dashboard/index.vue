<template>
  <div class="cc-page">
    <el-row :gutter="16">
      <el-col :span="6" v-for="c in cards" :key="c.label">
        <div class="cc-stat-card" style="margin-bottom: 16px">
          <span class="label">{{ c.label }}</span>
          <span class="value">{{ c.value }}</span>
          <span class="sub">{{ c.sub }}</span>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="cc-card">
          <div class="card-head">
            <span class="title">平台营收趋势</span>
            <el-radio-group v-model="range" size="small" @change="loadTrend">
              <el-radio-button label="7d">近 7 天</el-radio-button>
              <el-radio-button label="30d">近 30 天</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="trendRef" class="chart" />
        </div>
      </el-col>
      <el-col :span="8">
        <div class="cc-card">
          <div class="card-head"><span class="title">门店活跃度</span></div>
          <div class="activity">
            <div class="act-main">
              <span class="act-value">{{ activity.activityRate }}%</span>
              <span class="act-label">近 7 天有交易的门店占比</span>
            </div>
            <div class="act-sub">活跃门店 {{ activity.activeStore }} / {{ activity.totalStore }}</div>
            <el-divider content-position="left">低活跃门店（近 7 天 ≤ 3 单）</el-divider>
            <el-empty v-if="!activity.lowActiveStores?.length" description="暂无" :image-size="60" />
            <div v-for="s in activity.lowActiveStores" :key="s.storeId" class="low-store">
              <span>{{ s.storeName }}</span>
              <el-button link type="primary" @click="goStore(s.storeId)">查看</el-button>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="cc-card" style="margin-top: 16px">
      <div class="card-head"><span class="title">门店营业额 TOP 10（近 30 天）</span></div>
      <el-table :data="rank" stripe>
        <el-table-column prop="rank" label="排名" width="80" />
        <el-table-column prop="storeName" label="门店" />
        <el-table-column prop="orderCount" label="完成订单数" width="140" />
        <el-table-column label="营业额" width="160">
          <template #default="{ row }">¥{{ Number(row.revenue).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="goStore(row.storeId)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { getOverview, getTrend, getStoreRank, getActivity } from '@/api';

const router = useRouter();
const overview = ref({});
const trend = ref([]);
const rank = ref([]);
const activity = ref({});
const range = ref('7d');
const trendRef = ref();
let chart = null;

const cards = computed(() => [
  { label: '门店总数', value: overview.value.storeTotal ?? '-', sub: `营业中 ${overview.value.storeOpened ?? 0} · 停用 ${overview.value.storeDisabled ?? 0}` },
  { label: '今日订单', value: overview.value.todayOrderCount ?? '-', sub: `待接单 ${overview.value.pendingOrderCount ?? 0}` },
  { label: '今日营业额', value: `¥${Number(overview.value.todayRevenue || 0).toFixed(2)}`, sub: `已收款 ${overview.value.todayPaidCount ?? 0} 单` },
  { label: '会员 / 用户数', value: `${overview.value.memberTotal ?? 0} / ${overview.value.userTotal ?? 0}`, sub: `近 30 天新开门店 ${overview.value.newStore30 ?? 0}` },
]);

async function loadTrend() {
  const data = await getTrend({ range: range.value });
  trend.value = data.list || [];
  renderChart();
}

function renderChart() {
  if (!trendRef.value) return;
  if (!chart) chart = echarts.init(trendRef.value);
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单数', '营业额'] },
    grid: { left: 40, right: 40, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: trend.value.map((t) => t.date) },
    yAxis: [
      { type: 'value', name: '订单数' },
      { type: 'value', name: '营业额' },
    ],
    series: [
      { name: '订单数', type: 'bar', data: trend.value.map((t) => t.orderCount), itemStyle: { color: '#E8A87C' } },
      { name: '营业额', type: 'line', yAxisIndex: 1, smooth: true, data: trend.value.map((t) => t.revenue), itemStyle: { color: '#6F4E37' } },
    ],
  });
}

function goStore(storeId) {
  router.push({ path: '/store', query: { storeId } });
}

onMounted(async () => {
  overview.value = await getOverview();
  rank.value = await getStoreRank();
  activity.value = await getActivity();
  await loadTrend();
  await nextTick();
  window.addEventListener('resize', () => chart && chart.resize());
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', () => chart && chart.resize());
  if (chart) chart.dispose();
});
</script>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: #3d2c1e;
}
.chart {
  height: 320px;
  width: 100%;
}
.activity {
  min-height: 320px;
}
.act-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 8px;
}
.act-value {
  font-size: 34px;
  font-weight: 700;
  color: #6f4e37;
}
.act-label {
  margin-top: 6px;
  font-size: 12px;
  color: #9c8b7a;
}
.act-sub {
  text-align: center;
  font-size: 13px;
  color: #9c8b7a;
}
.low-store {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
  font-size: 13px;
}
</style>
