<template>
  <div class="cc-page">
    <div class="cc-toolbar">
      <el-input v-model="query.keyword" placeholder="操作描述" clearable style="width: 220px" @keyup.enter="load" />
      <el-select v-model="query.operatorType" placeholder="操作人类型" clearable style="width: 150px">
        <el-option label="超管" value="ADMIN" />
        <el-option label="门店" value="MERCHANT" />
        <el-option label="顾客" value="CUSTOMER" />
        <el-option label="系统" value="SYSTEM" />
      </el-select>
      <el-select v-model="query.module" placeholder="模块" clearable style="width: 150px">
        <el-option v-for="(v, k) in MODULES" :key="k" :label="v" :value="k" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        style="width: 240px"
      />
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
    </div>

    <div class="cc-table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="createdAt" label="时间" width="170" />
        <el-table-column label="操作人" width="160">
          <template #default="{ row }">
            {{ row.operatorName }}
            <el-tag size="small" style="margin-left: 4px">{{ row.operatorType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模块" width="120">
          <template #default="{ row }">{{ MODULES[row.module] || row.module }}</template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="100" />
        <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP" width="140" />
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
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { getOperationLog } from '@/api';

const MODULES = {
  STORE: '门店',
  STORE_USER: '门店账号',
  ORDER: '订单',
  DISH: '菜品',
  CATEGORY: '分类',
  TABLE: '桌位',
  COUPON: '优惠券',
  MEMBER: '会员',
  CONFIG: '配置',
  UPLOAD: '素材',
};

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const dateRange = ref([]);
const query = reactive({ page: 1, pageSize: 10, keyword: '', operatorType: '', module: '', startDate: '', endDate: '' });

async function load() {
  loading.value = true;
  try {
    const data = await getOperationLog(query);
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

watch(dateRange, (v) => {
  query.startDate = v && v[0] ? v[0] : '';
  query.endDate = v && v[1] ? v[1] : '';
});

onMounted(() => load());
</script>
