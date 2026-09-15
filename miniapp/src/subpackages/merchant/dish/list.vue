<template>
  <view class="page">
    <view class="topbar">
      <scroll-view scroll-x class="cats">
        <view class="cats-inner">
          <text class="cat" :class="{ on: !categoryId }" @click="pickCat('')">全部</text>
          <text v-for="c in categories" :key="c.id" class="cat" :class="{ on: categoryId === c.id }" @click="pickCat(c.id)">{{ c.name }}</text>
        </view>
      </scroll-view>
      <view class="tools">
        <input v-model="keyword" class="search" placeholder="搜索菜品" placeholder-class="ph" @confirm="load(true)" />
        <view class="cat-manage" @click="goCategory">分类管理</view>
      </view>
    </view>

    <view class="tabs">
      <text class="tab" :class="{ on: status === 'ON' }" @click="status = 'ON'">在售</text>
      <text class="tab" :class="{ on: status === 'OFF' }" @click="status = 'OFF'">已下架</text>
    </view>

    <view v-for="(d, i) in list" :key="d.id" class="swipe">
      <!-- 左滑露出的删除按钮 -->
      <view class="swipe-del" @click.stop="removeDish(d)">
        <text>删除</text>
      </view>
      <view
        class="swipe-body"
        :class="{ dragging: dragging === i }"
        :style="{ transform: `translateX(${swipeX[i] || 0}px)` }"
        @touchstart="onTouchStart(i, $event)"
        @touchmove="onTouchMove(i, $event)"
        @touchend="onTouchEnd(i)"
        @touchcancel="onTouchEnd(i)"
      >
        <view class="card item" @click="preview(d)">
          <image class="cover" :src="fixUrl(d.cover)" mode="aspectFill" />
          <view class="info">
            <view class="name-line">
              <text class="name">{{ d.name }}</text>
              <text v-if="d.soldOut" class="badge sold">售罄</text>
              <text v-if="d.isRecommend" class="badge rec">推荐</text>
            </view>
            <text class="meta">{{ d.categoryName }} · 已售 {{ d.sales }} · 每日限量 {{ d.stockMode === 'DAILY_LIMIT' ? d.dailyLimit : '不限' }}</text>
            <text class="price">¥{{ price(d.price) }}<text v-if="d.originalPrice" class="origin"> ¥{{ price(d.originalPrice) }}</text></text>
          </view>
          <view class="ops">
            <template v-if="categoryId">
              <text class="op" @click.stop="move(i, -1)" :class="{ disabled: i === 0 }">↑</text>
              <text class="op" @click.stop="move(i, 1)" :class="{ disabled: i === list.length - 1 }">↓</text>
            </template>
            <text class="op" @click.stop="changeCat(d)">改分类</text>
            <text class="op" @click.stop="edit(d)">编辑</text>
            <text class="op" @click.stop="toggleSoldOut(d)">{{ d.soldOut ? '取消售罄' : '标记售罄' }}</text>
            <text class="op" @click.stop="toggleStatus(d)">{{ d.status === 1 ? '下架' : '上架' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!categories.length" class="tip-bar" @click="goCategory">还没有分类，点这里去创建分类 ›</view>
    <view v-else-if="categoryId" class="tip-bar plain">当前按分类排序：用 ↑ ↓ 调整菜品在该分类下的展示顺序</view>
    <view v-else class="tip-bar plain">点击菜品卡片查看详情，左滑可删除</view>
    <ct-empty v-if="!list.length && categories.length" text="暂无菜品" />

    <view class="add-btn" @click="edit(null)">+ 新建菜品</view>
  </view>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { dishList, categoryList, updateDishStatus, updateSoldOut, updateDish, deleteDish, updateDishSort } from '@/api/merchant';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import CtEmpty from '@/components/ct-empty.vue';

const list = ref([]);
const categories = ref([]);
const categoryId = ref('');
const keyword = ref('');
const status = ref('ON');
const page = ref(1);

async function load(reset = true) {
  if (reset) page.value = 1;
  const data = await dishList({ categoryId: categoryId.value, keyword: keyword.value, status: status.value, page: page.value, pageSize: 20 });
  list.value = reset ? data.list : [...list.value, ...data.list];
  swipeX.value = list.value.map(() => 0); // 刷新后收起所有左滑
  uni.stopPullDownRefresh();
}
async function loadCats() {
  categories.value = await categoryList();
}

/* ---------------- 左滑删除 ---------------- */
const SWIPE_W = 80; // 删除按钮宽度（px，约 160rpx）
const swipeX = ref([]);
const dragging = ref(-1);
let startX = 0;
let startY = 0;
let startOffset = 0;
let swipeIndex = -1; // 当前正在手势处理的项，-1 表示未接管（纵向滚动）

function onTouchStart(i, e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {};
  startX = t.clientX || 0;
  startY = t.clientY || 0;
  startOffset = swipeX.value[i] || 0;
  swipeIndex = -1;
  dragging.value = i;
}
function onTouchMove(i, e) {
  if (dragging.value !== i) return;
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {};
  const dx = (t.clientX || 0) - startX;
  const dy = (t.clientY || 0) - startY;
  if (swipeIndex === -1) {
    // 首次判断手势方向：纵向为主则交还给页面滚动
    if (Math.abs(dx) <= Math.abs(dy)) {
      dragging.value = -1;
      return;
    }
    swipeIndex = i;
  }
  let x = startOffset + dx;
  if (x > 0) x = 0;
  if (x < -SWIPE_W) x = -SWIPE_W + (x + SWIPE_W) * 0.2; // 超出后加阻尼
  swipeX.value[i] = x;
}
function onTouchEnd(i) {
  if (dragging.value !== i) return;
  dragging.value = -1;
  if (swipeIndex !== i) return; // 只是点击，不改变位置
  swipeIndex = -1;
  const open = (swipeX.value[i] || 0) < -SWIPE_W / 3;
  // 同一时间只允许一项处于展开状态
  swipeX.value = swipeX.value.map((_, idx) => (open && idx === i ? -SWIPE_W : 0));
}
/** 关闭所有已展开的项 */
function closeSwipe() {
  swipeX.value = swipeX.value.map(() => 0);
}

/** 点击卡片：跳转菜品预览页，按顾客端看到的效果展示 */
function preview(d) {
  closeSwipe();
  uni.navigateTo({ url: `/subpackages/merchant/dish/preview?id=${d.id}` });
}

/** 左滑删除菜品 */
async function removeDish(d) {
  uni.showModal({
    title: '删除菜品',
    content: `确认删除「${d.name}」？删除后不可恢复`,
    success: async (r) => {
      if (!r.confirm) {
        closeSwipe();
        return;
      }
      try {
        await deleteDish(d.id);
        uni.showToast({ title: '已删除', icon: 'none' });
        await load(true);
      } catch (e) {
        uni.showToast({ title: e.msg || '删除失败', icon: 'none' });
        closeSwipe();
      }
    },
  });
}
function pickCat(id) {
  categoryId.value = id;
  load(true);
}
function edit(d) {
  uni.navigateTo({ url: `/subpackages/merchant/dish/edit?id=${d ? d.id : ''}` });
}
function goCategory() {
  uni.navigateTo({ url: '/subpackages/merchant/category/index' });
}

/** 修改单个菜品的所属分类 */
async function changeCat(d) {
  if (!categories.value.length) return uni.showToast({ title: '请先创建分类', icon: 'none' });
  uni.showActionSheet({
    itemList: categories.value.map((c) => (Number(c.status) === 1 ? c.name : `${c.name}（隐藏）`)),
    success: async (r) => {
      const c = categories.value[r.tapIndex];
      if (!c || c.id === d.categoryId) return;
      try {
        await updateDish(d.id, { categoryId: c.id });
        uni.showToast({ title: `已移到「${c.name}」`, icon: 'none' });
        if (categoryId.value) await load(true);
        else d.categoryName = c.name;
      } catch (e) {
        uni.showToast({ title: e.msg || '操作失败', icon: 'none' });
      }
    },
  });
}

/** 菜品排序：整体重排当前列表顺序后批量提交 */
async function move(i, dir) {
  const target = i + dir;
  if (target < 0 || target >= list.value.length) return;
  const arr = [...list.value];
  [arr[i], arr[target]] = [arr[target], arr[i]];
  const sorted = arr.map((d, idx) => ({ ...d, sort: (idx + 1) * 10 }));
  list.value = sorted;
  try {
    await updateDishSort(sorted.map((d) => ({ id: d.id, sort: d.sort })));
  } catch (e) {
    uni.showToast({ title: e.msg || '排序失败', icon: 'none' });
    load(true);
  }
}
async function toggleSoldOut(d) {
  await updateSoldOut(d.id, d.soldOut ? 0 : 1);
  load(true);
}
async function toggleStatus(d) {
  await updateDishStatus(d.id, d.status === 1 ? 0 : 1);
  load(true);
}

onLoad((opt) => {
  // 从分类管理页点分类进来时，直接筛选该分类
  if (opt && opt.categoryId) categoryId.value = opt.categoryId;
});
onMounted(async () => {
  await loadCats();
  await load(true);
});
onShow(() => load(true));
watch(status, () => load(true));
onPullDownRefresh(() => load(true));
onReachBottom(() => {
  page.value += 1;
  load(false);
});
</script>

<style lang="scss" scoped>
.page {
  padding: 0 24rpx 180rpx;
}
.topbar {
  padding: 20rpx 0 12rpx;
}
.cats {
  white-space: nowrap;
}
.cats-inner {
  display: inline-flex;
}
.cat {
  padding: 12rpx 28rpx;
  border-radius: 30rpx;
  background: #fff;
  font-size: 26rpx;
  color: $text-secondary;
  margin-right: 16rpx;
  &.on {
    background: $coffee-brown;
    color: #fff;
  }
}
.tools {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
}
.search {
  flex: 1;
  height: 72rpx;
  background: #fff;
  border-radius: 36rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
}
.cat-manage {
  margin-left: 16rpx;
  flex-shrink: 0;
  height: 72rpx;
  padding: 0 28rpx;
  border-radius: 36rpx;
  background: #fff;
  border: 1rpx solid $coffee-brown;
  color: $coffee-brown;
  font-size: 26rpx;
  display: flex;
  align-items: center;
}
.tip-bar {
  margin: 4rpx 0 20rpx;
  padding: 18rpx 24rpx;
  border-radius: 12rpx;
  background: rgba(255, 169, 200, 0.16);
  color: $coffee-brown;
  font-size: 24rpx;
  &.plain {
    background: #fff;
    color: $text-secondary;
  }
}
.ph {
  color: $text-placeholder;
}
.tabs {
  display: flex;
  padding: 12rpx 0;
}
.tab {
  padding: 10rpx 32rpx;
  border-radius: 30rpx;
  background: #fff;
  font-size: 26rpx;
  color: $text-secondary;
  margin-right: 16rpx;
  &.on {
    background: $coffee-brown;
    color: #fff;
  }
}
/* 左滑容器：删除按钮垫在下层，内容层滑动露出 */
.swipe {
  position: relative;
  margin-bottom: 20rpx;
}
.swipe-del {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 160rpx;
  border-radius: $radius-card;
  background: $danger;
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.swipe-body {
  position: relative;
  z-index: 1;
  transition: transform 0.22s ease;
  &.dragging {
    transition: none;
  }
}
.item {
  display: flex;
  flex-wrap: wrap;
  padding: 24rpx;
  position: relative;
}
.cover {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  background: $cream-white;
}
.info {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
}
.name-line {
  display: flex;
  align-items: center;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
}
.badge {
  margin-left: 12rpx;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  &.sold {
    color: $danger;
    background: rgba(245, 108, 108, 0.12);
  }
  &.rec {
    color: $cat-orange;
    background: rgba(255, 169, 200, 0.22);
  }
}
.meta {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.price {
  margin-top: auto;
  color: $coffee-brown;
  font-size: 32rpx;
  font-weight: 600;
}
.origin {
  margin-left: 10rpx;
  font-size: 22rpx;
  color: $text-placeholder;
  text-decoration: line-through;
  font-weight: 400;
}
/* 操作栏独占卡片底部一行，按钮多时自动换行，避免被压缩成竖排文字 */
.ops {
  width: 100%;
  margin-top: 20rpx;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.op {
  margin-left: 12rpx;
  margin-bottom: 8rpx;
  padding: 10rpx 22rpx;
  border-radius: 24rpx;
  border: 1rpx solid $border-color;
  font-size: 24rpx;
  white-space: nowrap;
  &.disabled {
    opacity: 0.35;
  }
}
.op:first-child {
  margin-left: 0;
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
</style>
