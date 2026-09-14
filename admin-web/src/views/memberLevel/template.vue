<template>
  <div class="cc-page">
    <div class="cc-card">
      <div class="head">
        <div>
          <h3>新店默认会员等级模板</h3>
          <p class="desc">新开通的门店将自动套用该模板，各门店可在店主端自行调整自身等级体系</p>
        </div>
        <div>
          <el-button :icon="Plus" @click="addLevel">新增等级</el-button>
          <el-button type="primary" :icon="Check" @click="save">保存模板</el-button>
        </div>
      </div>

      <el-table :data="levels" stripe>
        <el-table-column label="等级名称" width="200">
          <template #default="{ row }"><el-input v-model="row.name" /></template>
        </el-table-column>
        <el-table-column label="等级值" width="120">
          <template #default="{ row }"><el-input-number v-model="row.levelValue" :min="1" :max="10" controls-position="right" /></template>
        </el-table-column>
        <el-table-column label="成长值门槛" width="180">
          <template #default="{ row }"><el-input-number v-model="row.growthThreshold" :min="0" :step="10" controls-position="right" /></template>
        </el-table-column>
        <el-table-column label="折扣率" width="180">
          <template #default="{ row }">
            <el-input-number v-model="row.discount" :min="0.01" :max="1" :step="0.05" :precision="2" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="折扣展示">
          <template #default="{ row }">{{ discountText(row.discount) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ $index }">
            <el-button link type="danger" :disabled="levels.length <= 1" @click="removeLevel($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="tip">提示：成长值门槛需递增，折扣率取值 0 ~ 1（0.85 表示 8.5 折）</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Check } from '@element-plus/icons-vue';
import { getLevelTemplate, saveLevelTemplate } from '@/api';

const levels = ref([]);

function discountText(rate) {
  if (!rate || rate >= 1) return '无折扣';
  const d = Math.round(Number(rate) * 100) / 10;
  return `${String(d).replace(/\.0$/, '')}折`;
}

function addLevel() {
  const max = levels.value.length ? Math.max(...levels.value.map((l) => l.growthThreshold)) : 0;
  levels.value.push({ name: '', levelValue: levels.value.length + 1, growthThreshold: max + 100, discount: 0.95 });
}
function removeLevel(i) {
  levels.value.splice(i, 1);
}

async function save() {
  if (levels.value.some((l) => !l.name)) return ElMessage.warning('请填写等级名称');
  const sorted = [...levels.value].sort((a, b) => a.growthThreshold - b.growthThreshold);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].growthThreshold <= sorted[i - 1].growthThreshold) {
      return ElMessage.warning('成长值门槛需递增');
    }
  }
  await saveLevelTemplate(levels.value);
  ElMessage.success('保存成功');
}

onMounted(async () => {
  levels.value = await getLevelTemplate();
});
</script>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
h3 {
  margin: 0;
  font-size: 16px;
}
.desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: #9c8b7a;
}
.tip {
  margin-top: 16px;
  font-size: 12px;
  color: #e6a23c;
}
</style>
