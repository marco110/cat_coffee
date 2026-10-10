<template>
  <view class="page">
    <view class="card block">
      <view class="bt">门店加料库</view>
      <text class="tip">加料为门店共用，配置后顾客在所有菜品详情页都能多选，加价会累加到售价</text>
    </view>

    <view v-for="(a, i) in list" :key="a.id" class="card row-card">
      <view class="line">
        <text class="name">{{ a.name }}</text>
        <text class="price">+¥{{ price(a.price) }}</text>
      </view>
      <view class="line ops">
        <view class="sw">
          <text class="sw-label">启用</text>
          <switch :checked="Number(a.status) === 1" color="#FF6FA5" @change="(e) => toggleStatus(a, e)" />
        </view>
        <view class="sort">
          <text class="mv" :class="{ off: i === 0 }" @click="move(i, -1)">↑</text>
          <text class="mv" :class="{ off: i === list.length - 1 }" @click="move(i, 1)">↓</text>
        </view>
        <text class="edit" @click="openEdit(a)">编辑</text>
        <text class="del" @click="remove(a)">删除</text>
      </view>
    </view>

    <ct-empty v-if="!list.length" text="还没有加料，点下方添加" />

    <!-- 新增 / 编辑 -->
    <view v-if="showForm" class="mask" @click="showForm = false">
      <view class="panel" @click.stop>
        <view class="p-title">{{ editing.id ? '编辑加料' : '新增加料' }}</view>
        <view class="p-row">
          <text class="p-label">名称</text>
          <input v-model="editing.name" class="p-input" placeholder="如：燕麦奶" placeholder-class="ph" maxlength="20" />
        </view>
        <view class="p-row">
          <text class="p-label">加价（元）</text>
          <input v-model="editing.price" class="p-input" type="digit" placeholder="0" placeholder-class="ph" />
        </view>
        <view class="p-btns">
          <text class="p-btn cancel" @click="showForm = false">取消</text>
          <text class="p-btn ok" @click="submit">确定</text>
        </view>
      </view>
    </view>

    <view class="add" @click="openAdd">+ 新增加料</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { addonList, createAddon, updateAddon, deleteAddon } from '@/api/merchant';
import { price } from '@/utils/format';
import CtEmpty from '@/components/ct-empty.vue';

const list = ref([]);
const showForm = ref(false);
const editing = ref({ id: '', name: '', price: '0', sort: 0, status: 1 });
const saving = ref(false);

onShow(() => load());

async function load() {
  try {
    list.value = await addonList();
  } catch (e) {
    list.value = [];
  }
}

function openAdd() {
  editing.value = { id: '', name: '', price: '0', sort: list.value.length, status: 1 };
  showForm.value = true;
}
function openEdit(a) {
  editing.value = { id: a.id, name: a.name, price: String(a.price || 0), sort: a.sort || 0, status: Number(a.status) };
  showForm.value = true;
}

async function submit() {
  const name = String(editing.value.name || '').trim();
  if (!name) return uni.showToast({ title: '请填写加料名称', icon: 'none' });
  const payload = {
    name,
    price: Math.round(Number(editing.value.price || 0) * 100) / 100,
    sort: Number(editing.value.sort || 0),
    status: Number(editing.value.status) ? 1 : 0,
  };
  if (saving.value) return;
  saving.value = true;
  try {
    if (editing.value.id) await updateAddon(editing.value.id, payload);
    else await createAddon(payload);
    uni.showToast({ title: '保存成功', icon: 'none' });
    showForm.value = false;
    load();
  } catch (e) {
    uni.showToast({ title: e.msg || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(a, e) {
  const status = e.detail.value ? 1 : 0;
  try {
    await updateAddon(a.id, { name: a.name, price: a.price, sort: a.sort || 0, status });
    a.status = status;
    uni.showToast({ title: status ? '已启用' : '已停用', icon: 'none' });
  } catch (err) {
    uni.showToast({ title: err.msg || '操作失败', icon: 'none' });
    load();
  }
}

/** 排序：交换后立即持久化（后端按 sort, id 排序） */
async function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= list.value.length) return;
  const arr = list.value;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  const tasks = arr.map((a, idx) => updateAddon(a.id, { name: a.name, price: a.price, sort: idx, status: Number(a.status) || 1 }));
  try {
    await Promise.all(tasks);
  } catch (e) {
    uni.showToast({ title: '排序失败', icon: 'none' });
  }
  load();
}

function remove(a) {
  uni.showModal({
    title: '删除加料',
    content: `确认删除「${a.name}」？已下单的记录不受影响`,
    success: async (r) => {
      if (!r.confirm) return;
      try {
        await deleteAddon(a.id);
        uni.showToast({ title: '已删除', icon: 'none' });
        load();
      } catch (e) {
        uni.showToast({ title: e.msg || '删除失败', icon: 'none' });
      }
    },
  });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 200rpx;
}
.block {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.bt {
  font-size: 28rpx;
  font-weight: 600;
}
.tip {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.row-card {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.line {
  display: flex;
  align-items: center;
}
.name {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-primary;
}
.price {
  color: $pink-dark;
  font-size: 28rpx;
  font-weight: 700;
}
.ops {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed $border-color;
}
.sw {
  display: flex;
  align-items: center;
}
.sw-label {
  margin-right: 10rpx;
  font-size: 24rpx;
  color: $text-secondary;
}
.sort {
  margin-left: auto;
  display: flex;
  gap: 10rpx;
}
.mv {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $cream-white;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  &.off {
    color: $text-placeholder;
    opacity: 0.5;
  }
}
.edit,
.del {
  margin-left: 20rpx;
  font-size: 26rpx;
}
.edit {
  color: $coffee-brown;
}
.del {
  color: $danger;
}
.add {
  padding: 20rpx;
  text-align: center;
  border: 2rpx dashed $coffee-brown;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: $coffee-brown;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 60rpx;
}
.panel {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
}
.p-title {
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
}
.p-row {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
}
.p-label {
  width: 180rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.p-input {
  flex: 1;
  background: $cream-white;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
}
.ph {
  color: $text-placeholder;
}
.p-btns {
  margin-top: 32rpx;
  display: flex;
  gap: 20rpx;
}
.p-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 42rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cancel {
  background: $cream-white;
  color: $text-secondary;
}
.ok {
  background: $coffee-brown;
  color: #fff;
}
</style>
