<template>
  <div class="cc-page">
    <div class="cc-toolbar">
      <el-input v-model="query.keyword" placeholder="手机号 / 姓名 / 门店" clearable style="width: 240px" @keyup.enter="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 120px">
        <el-option label="启用" :value="1" />
        <el-option label="停用" :value="0" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-button :icon="Plus" @click="openCreate">新增账号</el-button>
    </div>

    <div class="cc-table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="storeName" label="所属门店" min-width="160" />
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.isOwner ? 'warning' : 'info'">{{ ROLE[row.role] || row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
            <el-tag v-if="row.lockedUntil" size="small" type="danger" style="margin-left: 4px">锁定</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="初始密码" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isInitPassword" size="small" type="warning">未修改</el-tag>
            <span v-else class="muted">已修改</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最后登录" width="170" />
        <el-table-column label="操作" width="290" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="resetPwd(row)">重置密码</el-button>
            <el-button link type="success" @click="unlock(row)">解锁</el-button>
            <el-button link type="danger" :disabled="!!row.isOwner" @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑账号' : '新增店员账号'" width="520px">
      <el-form :model="form" label-width="100px">
        <template v-if="!form.id">
          <el-form-item label="所属门店" required>
            <el-select v-model="form.storeId" filterable placeholder="请选择门店" style="width: 100%">
              <el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="手机号" required><el-input v-model="form.phone" placeholder="用于登录店主端" /></el-form-item>
        </template>
        <el-form-item label="姓名"><el-input v-model="form.realName" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="店长" value="MANAGER" />
            <el-option label="店员" value="CLERK" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus } from '@element-plus/icons-vue';
import { getStoreUserList, createStoreUser, updateStoreUser, resetStoreUserPassword, unlockStoreUser, deleteStoreUser, getStoreList } from '@/api';

const ROLE = { OWNER: '店主', MANAGER: '店长', CLERK: '店员' };

const list = ref([]);
const stores = ref([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ page: 1, pageSize: 10, keyword: '', status: '' });
const dialogVisible = ref(false);
const form = ref({});

async function load() {
  loading.value = true;
  try {
    const data = await getStoreUserList(query);
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = { storeId: '', phone: '', realName: '', role: 'CLERK', status: 1 };
  dialogVisible.value = true;
}
function openEdit(row) {
  form.value = { id: row.id, realName: row.realName, role: row.role, status: row.status };
  dialogVisible.value = true;
}

async function submit() {
  if (form.value.id) {
    await updateStoreUser(form.value.id, form.value);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } else {
    if (!form.value.storeId) return ElMessage.warning('请选择门店');
    if (!/^1[3-9]\d{9}$/.test(form.value.phone)) return ElMessage.warning('请填写正确的手机号');
    const res = await createStoreUser(form.value);
    ElMessageBox.alert(`初始密码：${res.initPassword}`, '新增成功');
    dialogVisible.value = false;
    load();
  }
}

async function resetPwd(row) {
  await ElMessageBox.confirm(`确认重置「${row.realName}」的密码？`, '重置密码', { type: 'warning' });
  const res = await resetStoreUserPassword(row.id);
  ElMessageBox.alert(`账号：${res.phone}<br/>新密码：${res.initPassword}`, '重置成功', { dangerouslyUseHTMLString: true });
  load();
}

async function unlock(row) {
  await unlockStoreUser(row.id);
  ElMessage.success('已解锁');
  load();
}

async function remove(row) {
  await ElMessageBox.confirm(`确认删除账号「${row.realName}」？`, '删除账号', { type: 'warning' });
  await deleteStoreUser(row.id);
  ElMessage.success('删除成功');
  load();
}

onMounted(async () => {
  const d = await getStoreList({ pageSize: 50 });
  stores.value = d.list;
  load();
});
</script>

<style scoped>
.muted {
  color: #9c8b7a;
  font-size: 12px;
}
</style>
