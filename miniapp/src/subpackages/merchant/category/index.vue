<template>
  <view class="page">
    <view v-for="(c, i) in list" :key="c.id" class="card item">
      <view class="left" @click="goDishes(c)">
        <text class="name">{{ c.name }} ›</text>
        <text class="meta">排序 {{ c.sort }} · {{ c.dishCount }} 个菜品 · {{ c.status === 1 ? '显示中' : '已隐藏' }}</text>
      </view>
      <view class="ops">
        <text class="op" :class="{ disabled: i === 0 }" @click="move(i, -1)">↑</text>
        <text class="op" :class="{ disabled: i === list.length - 1 }" @click="move(i, 1)">↓</text>
        <text class="op" @click="edit(c)">编辑</text>
        <text class="op danger" @click="remove(c)">删除</text>
      </view>
    </view>

    <view class="tip-bar">用 ↑ ↓ 调整顺序，顾客端菜单的分类和菜品都按这里的顺序展示</view>
    <ct-empty v-if="!list.length" text="暂无分类，先建一个吧" />
    <view class="add-btn" @click="edit(null)">+ 新建分类</view>

    <view v-if="editing" class="mask" @click="editing = false">
      <view class="panel" @click.stop>
        <view class="p-head">{{ form.id ? '编辑分类' : '新建分类' }}</view>
        <view class="f">
          <text class="label">分类名称</text>
          <input v-model="form.name" class="input" placeholder="如：招牌咖啡" placeholder-class="ph" />
        </view>
        <view class="f">
          <text class="label">排序</text>
          <input v-model="form.sort" class="input" type="number" placeholder="数字越小越靠前" placeholder-class="ph" />
        </view>
        <view class="f">
          <text class="label">显示状态</text>
          <switch :checked="form.status === 1" color="#FF6FA5" @change="(e) => (form.status = e.detail.value ? 1 : 0)" />
        </view>
        <view class="p-btns">
          <text class="cancel" @click="editing = false">取消</text>
          <text class="ok" @click="save">保存</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { categoryList, createCategory, updateCategory, deleteCategory, updateCategorySort } from '@/api/merchant';
import CtEmpty from '@/components/ct-empty.vue';

const list = ref([]);
const editing = ref(false);
const form = ref({ id: '', name: '', sort: 0, status: 'ON' });

async function load() {
  list.value = await categoryList();
}
function edit(c) {
  const nextSort = (list.value.reduce((m, x) => Math.max(m, Number(x.sort) || 0), 0) || 0) + 10;
  form.value = c ? { ...c, status: Number(c.status) } : { id: '', name: '', sort: nextSort, status: 1 };
  editing.value = true;
}
async function save() {
  if (!form.value.name) return uni.showToast({ title: '请填写分类名称', icon: 'none' });
  const payload = { ...form.value, status: form.value.status ? 1 : 0 };
  if (form.value.id) await updateCategory(form.value.id, payload);
  else await createCategory(payload);
  editing.value = false;
  await load();
}
function goDishes(c) {
  uni.navigateTo({ url: `/subpackages/merchant/dish/list?categoryId=${c.id}` });
}

async function remove(c) {
  uni.showModal({
    title: '删除分类',
    content: `确认删除「${c.name}」？若分类下有菜品将无法删除`,
    success: async (r) => {
      if (!r.confirm) return;
      try {
        await deleteCategory(c.id);
        await load();
      } catch (e) {
        uni.showModal({
          title: '无法删除',
          content: `${e.msg || '删除失败'}。可到菜单管理里先把这些菜品「改分类」移走，再回来删除。`,
          showCancel: false,
        });
      }
    },
  });
}

/** 分类排序：整体重排后批量提交，避免 sort 值相同时交换无效 */
async function move(i, dir) {
  const target = i + dir;
  if (target < 0 || target >= list.value.length) return;
  const arr = [...list.value];
  [arr[i], arr[target]] = [arr[target], arr[i]];
  const sorted = arr.map((c, idx) => ({ ...c, sort: (idx + 1) * 10 }));
  list.value = sorted;
  try {
    await updateCategorySort(sorted.map((c) => ({ id: c.id, sort: c.sort })));
  } catch (e) {
    uni.showToast({ title: e.msg || '排序失败', icon: 'none' });
    await load();
  }
}

onMounted(() => load());
onShow(() => load());
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 180rpx;
}
.item {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.left {
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
}
.meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.ops {
  margin-top: 20rpx;
  display: flex;
  justify-content: flex-end;
}
.op {
  margin-left: 20rpx;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid $border-color;
  font-size: 24rpx;
  &.danger {
    color: $danger;
    border-color: $danger;
  }
  &.disabled {
    opacity: 0.35;
  }
}
.tip-bar {
  margin-bottom: 20rpx;
  padding: 18rpx 24rpx;
  border-radius: 12rpx;
  background: #fff;
  color: $text-secondary;
  font-size: 24rpx;
}
.add-btn {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  height: 92rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel {
  width: 80%;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
}
.p-head {
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 24rpx;
}
.f {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}
.label {
  width: 160rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.input {
  flex: 1;
  font-size: 28rpx;
  text-align: right;
}
.ph {
  color: $text-placeholder;
}
.p-btns {
  margin-top: 32rpx;
  display: flex;
}
.cancel,
.ok {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.cancel {
  border: 1rpx solid $border-color;
  color: $text-secondary;
  margin-right: 20rpx;
}
.ok {
  background: $coffee-brown;
  color: #fff;
}
</style>
