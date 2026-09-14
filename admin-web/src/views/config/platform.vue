<template>
  <div class="cc-page">
    <div class="cc-card">
      <h3>平台参数配置</h3>
      <p class="desc">控制全平台门店的默认经营规则，门店可在店主端覆盖部分配置</p>

      <el-form :model="form" label-width="200px" style="max-width: 720px; margin-top: 20px">
        <el-form-item label="默认积分抵现比例">
          <el-input-number v-model="form.POINTS_DEDUCT_RATE" :min="0" :step="0.01" :precision="2" />
          <span class="unit">例如 0.01 表示 100 积分抵扣 1 元</span>
        </el-form-item>
        <el-form-item label="每消费 1 元获得积分">
          <el-input-number v-model="form.POINTS_PER_YUAN" :min="0" :step="1" :precision="0" />
          <span class="unit">0 表示不赠送积分</span>
        </el-form-item>
        <el-form-item label="订单自动完成（分钟）">
          <el-input-number v-model="form.ORDER_AUTO_COMPLETE_MINUTES" :min="0" :step="10" />
          <span class="unit">出品后超过该时间自动完成</span>
        </el-form-item>
        <el-form-item label="待接单超时提醒（分钟）">
          <el-input-number v-model="form.ORDER_TIMEOUT_MINUTES" :min="1" :step="1" />
          <span class="unit">超时后店主端高亮提醒</span>
        </el-form-item>
        <el-form-item label="单笔最多可用优惠券">
          <el-input-number v-model="form.MAX_COUPON_PER_ORDER" :min="0" :max="5" />
          <span class="unit">0 表示不限制</span>
        </el-form-item>
        <el-form-item label="顾客取消订单时限（分钟）">
          <el-input-number v-model="form.CUSTOMER_CANCEL_MINUTES" :min="0" :step="5" />
          <span class="unit">店主接单前允许顾客取消的时长</span>
        </el-form-item>
        <el-form-item label="平台客服电话">
          <el-input v-model="form.SERVICE_PHONE" placeholder="如 400-000-0000" />
        </el-form-item>
        <el-form-item label="顾客端公告">
          <el-input v-model="form.CUSTOMER_NOTICE" type="textarea" :rows="3" placeholder="展示在小程序首页" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存配置</el-button>
          <el-button @click="load">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="cc-card" style="margin-top: 16px">
      <h3>配置项明细</h3>
      <el-table :data="configList" stripe style="margin-top: 12px">
        <el-table-column prop="configKey" label="配置键" width="240" />
        <el-table-column prop="configValue" label="配置值" min-width="200" show-overflow-tooltip />
        <el-table-column prop="remark" label="说明" width="200" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getConfig, saveConfig, getConfigList } from '@/api';

const DEFAULTS = {
  POINTS_DEDUCT_RATE: 0.01,
  POINTS_PER_YUAN: 1,
  ORDER_AUTO_COMPLETE_MINUTES: 60,
  ORDER_TIMEOUT_MINUTES: 5,
  MAX_COUPON_PER_ORDER: 1,
  CUSTOMER_CANCEL_MINUTES: 5,
  SERVICE_PHONE: '',
  CUSTOMER_NOTICE: '',
};

const form = reactive({ ...DEFAULTS });
const configList = ref([]);

async function load() {
  const data = await getConfig();
  const merged = { ...DEFAULTS };
  Object.keys(DEFAULTS).forEach((k) => {
    if (data[k] !== undefined && data[k] !== null) {
      merged[k] = Number.isNaN(Number(data[k])) || ['SERVICE_PHONE', 'CUSTOMER_NOTICE'].includes(k) ? data[k] : Number(data[k]);
    }
  });
  Object.assign(form, merged);
  configList.value = await getConfigList();
}

async function save() {
  await saveConfig({ ...form });
  ElMessage.success('保存成功');
  load();
}

onMounted(() => load());
</script>

<style scoped>
h3 {
  margin: 0;
  font-size: 16px;
}
.desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--cc-text-secondary);
}
.unit {
  margin-left: 12px;
  font-size: 12px;
  color: var(--cc-text-secondary);
}
</style>
