<template>
  <div class="cc-page">
    <div class="cc-toolbar">
      <el-input v-model="query.keyword" placeholder="文件名" clearable style="width: 220px" @keyup.enter="load" />
      <el-select v-model="query.bizType" placeholder="业务类型" clearable style="width: 150px">
        <el-option v-for="(v, k) in BIZ" :key="k" :label="v" :value="k" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-upload
        :show-file-list="false"
        :http-request="doUpload"
        accept="image/*"
        style="margin-left: 8px"
      >
        <el-button type="primary" :icon="Upload">上传素材</el-button>
      </el-upload>
    </div>

    <div class="cc-table-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="预览" width="90">
          <template #default="{ row }">
            <el-image :src="row.url" :preview-src-list="[row.url]" class="thumb" fit="cover" preview-teleported />
          </template>
        </el-table-column>
        <el-table-column prop="originalName" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column label="业务类型" width="120">
          <template #default="{ row }">{{ BIZ[row.bizType] || row.bizType }}</template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ (row.size / 1024).toFixed(1) }} KB</template>
        </el-table-column>
        <el-table-column prop="url" label="地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="上传时间" width="170" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="copyUrl(row)">复制链接</el-button>
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
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Upload } from '@element-plus/icons-vue';
import { getFileList, uploadFile, deleteFile } from '@/api';

const BIZ = {
  BANNER: '首页轮播',
  DISH: '菜品图',
  STORE: '门店图',
  AVATAR: '头像',
  QRCODE: '二维码',
  OTHER: '其他',
};

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ page: 1, pageSize: 20, keyword: '', bizType: '' });

async function load() {
  loading.value = true;
  try {
    const data = await getFileList(query);
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function doUpload({ file }) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bizType', query.bizType || 'BANNER');
  await uploadFile(fd);
  ElMessage.success('上传成功');
  load();
}

function copyUrl(row) {
  const url = row.url.startsWith('http') ? row.url : `${window.location.origin}${row.url}`;
  navigator.clipboard?.writeText(url);
  ElMessage.success('已复制链接');
}

async function remove(row) {
  await ElMessageBox.confirm('确认删除该素材？', '删除', { type: 'warning' });
  await deleteFile(row.id);
  ElMessage.success('删除成功');
  load();
}

onMounted(() => load());
</script>

<style scoped>
.thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
}
</style>
