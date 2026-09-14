<template>
  <div class="cc-page">
    <div class="cc-toolbar">
      <el-input v-model="query.keyword" placeholder="订单号 / 取餐码 / 门店" clearable style="width: 240px" @keyup.enter="load" />
      <el-select v-model="query.status" placeholder="订单状态" clearable style="width: 140px">
        <el-option v-for="(v, k) in STATUS" :key="k" :label="v" :value="k" />
      </el-select>
      <el-select v-model="query.range" placeholder="时间范围" clearable style="width: 130px">
        <el-option label="今日" value="today" />
        <el-option label="近 7 天" value="7d" />
        <el-option label="近 30 天" value="30d" />
      </el-select>
      <el-select v-model="query.storeId" placeholder="门店" filterable clearable style="width: 180px">
        <el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-button :icon="Download" @click="exportCsv">导出 CSV</el-button>
    </div>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6"><div class="cc-stat-card"><span class="label">订单数</span><span class="value">{{ stat.orderCount ?? '-' }}</span></div></el-col>
      <el-col :span="6"><div class="cc-stat-card"><span class="label">营业额</span><span class="value">¥{{ Number(stat.revenue || 0).toFixed(2) }}</span></div></el-col>
    </el-row>

    <div class="cc-table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="190" />
        <el-table-column prop="storeName" label="门店" min-width="150" />
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            {{ row.orderType === 'DINE_IN' ? `堂食 ${row.tableNo || ''}` : `打包 ${row.pickupCode || ''}` }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="TAG[row.status] || 'info'">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="收款状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.payStatus === 'PAID' ? 'success' : 'warning'">{{ row.payStatus === 'PAID' ? '已收款' : '待收款' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="itemCount" label="件数" width="80" />
        <el-table-column label="实付金额" width="120">
          <template #default="{ row }">¥{{ Number(row.payAmount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="170" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="cc-pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </div>

    <el-drawer v-model="detailVisible" title="订单详情" size="520px">
      <el-descriptions v-if="detail.id" :column="1" border>
        <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="门店">{{ detail.storeName }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ detail.orderTypeText }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.statusText }}</el-descriptions-item>
        <el-descriptions-item label="收款">{{ detail.payStatusText }}</el-descriptions-item>
        <el-descriptions-item label="下单时间">{{ detail.createdAt }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">商品明细</el-divider>
      <div v-for="it in detail.items || []" :key="it.id" class="goods">
        <div class="g-info">
          <span class="g-name">{{ it.dishName }}</span>
          <span v-if="it.specText" class="g-spec">{{ it.specText }}</span>
          <span v-if="it.remark" class="g-remark">备注：{{ it.remark }}</span>
        </div>
        <span class="g-qty">x{{ it.quantity }}</span>
        <span class="g-price">¥{{ Number(it.subtotal).toFixed(2) }}</span>
      </div>

      <el-divider content-position="left">费用明细</el-divider>
      <div v-for="d in detail.priceDetail?.details || []" :key="d.label" class="price-row">
        <span>{{ d.label }}</span>
        <span :class="{ red: d.value < 0 }">¥{{ Number(d.value).toFixed(2) }}</span>
      </div>
      <div class="price-row total">
        <span>应付金额</span>
        <span>¥{{ Number(detail.priceDetail?.payAmount || 0).toFixed(2) }}</span>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { Search, Download } from '@element-plus/icons-vue';
import { getOrderList, getOrderDetail, getOrderStat, getStoreList, exportOrderUrl } from '@/api';

const STATUS = {
  PENDING: '待接单',
  ACCEPTED: '已接单',
  MAKING: '制作中',
  READY: '待取餐',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REJECTED: '已拒单',
};
const TAG = {
  PENDING: 'warning',
  ACCEPTED: 'primary',
  MAKING: 'primary',
  READY: 'success',
  COMPLETED: 'info',
  CANCELLED: 'info',
  REJECTED: 'danger',
};

const list = ref([]);
const stores = ref([]);
const total = ref(0);
const loading = ref(false);
const stat = ref({});
const detail = ref({});
const detailVisible = ref(false);
const query = reactive({ page: 1, pageSize: 10, keyword: '', status: '', range: '7d', storeId: '' });

async function load() {
  loading.value = true;
  try {
    const data = await getOrderList(query);
    list.value = data.list;
    total.value = data.total;
    stat.value = await getOrderStat({ range: query.range || 'today' });
  } finally {
    loading.value = false;
  }
}

async function openDetail(row) {
  detail.value = await getOrderDetail(row.id);
  detailVisible.value = true;
}

function exportCsv() {
  const url = exportOrderUrl({ range: query.range || '30d', storeId: query.storeId || '' });
  window.open(url, '_blank');
}

onMounted(async () => {
  const d = await getStoreList({ pageSize: 50 });
  stores.value = d.list;
  load();
});
</script>

<style scoped>
.goods {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px dashed var(--cc-border);
}
.g-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.g-name {
  font-size: 14px;
}
.g-spec,
.g-remark {
  font-size: 12px;
  color: var(--cc-text-secondary);
}
.g-qty {
  width: 60px;
  text-align: right;
  color: var(--cc-text-secondary);
}
.g-price {
  width: 100px;
  text-align: right;
  color: var(--cc-pink-dark);
  font-weight: 600;
}
.price-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  color: var(--cc-text-secondary);
}
.price-row.red {
  color: var(--cc-red);
}
.price-row.total {
  border-top: 1px solid var(--cc-border);
  margin-top: 8px;
  padding-top: 12px;
  color: var(--cc-text);
  font-size: 15px;
  font-weight: 600;
}
.price-row.total span:last-child {
  color: var(--cc-pink-dark);
  font-size: 20px;
}
</style>
