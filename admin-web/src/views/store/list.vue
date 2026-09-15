<template>
  <div class="cc-page">
    <div class="cc-toolbar">
      <el-input v-model="query.keyword" placeholder="门店名称 / 店主手机号 / 姓名" clearable style="width: 240px" @keyup.enter="load" />
      <el-input v-model="query.city" placeholder="城市" clearable style="width: 140px" @keyup.enter="load" />
      <el-select v-model="query.status" placeholder="门店状态" clearable style="width: 130px">
        <el-option label="启用" :value="1" />
        <el-option label="停用" :value="0" />
      </el-select>
      <el-select v-model="query.businessStatus" placeholder="营业状态" clearable style="width: 130px">
        <el-option label="营业中" :value="1" />
        <el-option label="休息中" :value="0" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-button :icon="Plus" @click="openCreate">开通新门店</el-button>
    </div>

    <div class="cc-table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="门店" min-width="200">
          <template #default="{ row }">
            <div class="store-cell">
              <el-image v-if="row.logo" :src="row.logo" class="logo" fit="cover" />
              <div class="store-avatar" v-else>{{ row.name.slice(0, 1) }}</div>
              <div class="store-info">
                <span class="name">{{ row.name }}</span>
                <span class="addr">{{ [row.city, row.district, row.address].filter(Boolean).join('') || '未填写地址' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="店主" width="160">
          <template #default="{ row }">
            <div>{{ row.ownerName }}</div>
            <div class="muted">{{ row.ownerPhone }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="todayOrderCount" label="今日订单" width="100" />
        <el-table-column label="菜品/桌位" width="110">
          <template #default="{ row }">{{ row.dishCount }} / {{ row.tableCount }}</template>
        </el-table-column>
        <el-table-column label="营业状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.businessStatus === 1 ? 'success' : 'info'" size="small">
              {{ row.businessStatus === 1 ? '营业中' : '休息中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="门店状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="开通时间" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="toggleStatus(row)">{{ row.status === 1 ? '停用' : '启用' }}</el-button>
            <el-button link type="warning" @click="resetPwd(row)">重置密码</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
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

    <!-- 开通 / 编辑门店 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑门店' : '开通新门店'" width="640px">
      <el-form :model="form" label-width="110px">
        <template v-if="!form.id">
          <el-alert type="info" :closable="false" title="开通后系统将自动生成店主账号、4 个默认会员等级与 5 个默认菜品分类" style="margin-bottom: 16px" />
          <el-form-item label="店主手机号" required><el-input v-model="form.ownerPhone" placeholder="用于登录店主端" /></el-form-item>
          <el-form-item label="店主姓名"><el-input v-model="form.ownerName" /></el-form-item>
        </template>
        <el-form-item label="门店名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="所在地区">
          <el-input v-model="form.province" placeholder="省" style="width: 30%; margin-right: 2%" />
          <el-input v-model="form.city" placeholder="市" style="width: 30%; margin-right: 2%" />
          <el-input v-model="form.district" placeholder="区" style="width: 30%" />
        </el-form-item>
        <el-form-item label="详细地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="营业时间">
          <el-input v-model="form.businessHoursStart" placeholder="09:00" style="width: 45%; margin-right: 4%" />
          <el-input v-model="form.businessHoursEnd" placeholder="22:00" style="width: 45%" />
        </el-form-item>
        <el-form-item label="门店公告"><el-input v-model="form.announcement" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="门店简介"><el-input v-model="form.intro" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 开通结果 -->
    <el-dialog v-model="resultVisible" title="开通成功" width="460px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="店主账号">{{ created.ownerAccount }}</el-descriptions-item>
        <el-descriptions-item label="初始密码">{{ created.initPassword }}</el-descriptions-item>
      </el-descriptions>
      <div class="warn">请及时将账号密码告知店主，首次登录后可自行修改密码</div>
      <template #footer><el-button type="primary" @click="resultVisible = false">知道了</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus } from '@element-plus/icons-vue';
import { getStoreList, getStoreDetail, createStore, updateStore, updateStoreStatus, deleteStore, resetStorePassword } from '@/api';

const route = useRoute();
const list = ref([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ page: 1, pageSize: 10, keyword: '', city: '', status: '', businessStatus: '' });

const dialogVisible = ref(false);
const resultVisible = ref(false);
const created = ref({});
const form = ref({});

async function load() {
  loading.value = true;
  try {
    const data = await getStoreList(query);
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = { name: '', ownerPhone: '', ownerName: '', phone: '', province: '', city: '', district: '', address: '', businessHoursStart: '09:00', businessHoursEnd: '22:00', announcement: '', intro: '' };
  dialogVisible.value = true;
}

async function openEdit(row) {
  const d = await getStoreDetail(row.id);
  form.value = { ...d, id: d.id };
  dialogVisible.value = true;
}

async function submit() {
  if (!form.value.name) return ElMessage.warning('请填写门店名称');
  if (form.value.id) {
    await updateStore(form.value.id, form.value);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } else {
    if (!/^1[3-9]\d{9}$/.test(form.value.ownerPhone)) return ElMessage.warning('请填写正确的店主手机号');
    const res = await createStore(form.value);
    created.value = res;
    dialogVisible.value = false;
    resultVisible.value = true;
    load();
  }
}

async function toggleStatus(row) {
  await updateStoreStatus(row.id, row.status === 1 ? 0 : 1);
  ElMessage.success('操作成功');
  load();
}

async function resetPwd(row) {
  await ElMessageBox.confirm(`确认将「${row.name}」店主的登录密码重置为 aimao2026？`, '重置密码', { type: 'warning' });
  const res = await resetStorePassword(row.id);
  ElMessageBox.alert(`账号：${res.phone}<br/>新密码：${res.initPassword}`, '重置成功', { dangerouslyUseHTMLString: true });
}

async function remove(row) {
  await ElMessageBox.confirm(`确认删除门店「${row.name}」？存在进行中订单的门店无法删除`, '删除门店', { type: 'warning' });
  await deleteStore(row.id);
  ElMessage.success('删除成功');
  load();
}

onMounted(() => {
  if (route.query.storeId) query.keyword = '';
  load();
});
</script>

<style scoped>
.store-cell {
  display: flex;
  align-items: center;
}
.logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
.store-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #ffa9c8, #ff6fa5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.store-info {
  margin-left: 10px;
  display: flex;
  flex-direction: column;
}
.name {
  font-weight: 600;
}
.addr {
  font-size: 12px;
  color: var(--cc-text-secondary);
}
.muted {
  font-size: 12px;
  color: var(--cc-text-secondary);
}
.warn {
  margin-top: 12px;
  font-size: 12px;
  color: #d48806;
}
</style>
