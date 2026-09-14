<template>
  <div class="cc-page">
    <div class="cc-toolbar">
      <el-input v-model="query.account" placeholder="登录账号" clearable style="width: 200px" @keyup.enter="load" />
      <el-select v-model="query.userType" placeholder="账号类型" clearable style="width: 140px">
        <el-option label="超管" value="ADMIN" />
        <el-option label="门店" value="MERCHANT" />
        <el-option label="顾客" value="CUSTOMER" />
      </el-select>
      <el-select v-model="query.result" placeholder="登录结果" clearable style="width: 130px">
        <el-option label="成功" value="1" />
        <el-option label="失败" value="0" />
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
        <el-table-column prop="account" label="登录账号" width="160" />
        <el-table-column label="账号类型" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ { ADMIN: '超管', MERCHANT: '门店', CUSTOMER: '顾客' }[row.userType] || row.userType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.result ? 'success' : 'danger'">{{ row.result ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="failReason" label="失败原因" min-width="180" />
        <el-table-column prop="ip" label="IP" width="150" />
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
import { getLoginLog } from '@/api';

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const dateRange = ref([]);
const query = reactive({ page: 1, pageSize: 10, account: '', userType: '', result: '', startDate: '', endDate: '' });

async function load() {
  loading.value = true;
  try {
    const data = await getLoginLog(query);
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
