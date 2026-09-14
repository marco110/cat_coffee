<template>
  <view class="page">
    <view class="topbar">
      <scroll-view scroll-x class="cats">
        <view class="cats-inner">
          <text class="cat" :class="{ on: !categoryId }" @click="pickCat('')">全部</text>
          <text v-for="c in categories" :key="c.id" class="cat" :class="{ on: categoryId === c.id }" @click="pickCat(c.id)">{{ c.name }}</text>
        </view>
      </scroll-view>
      <input v-model="keyword" class="search" placeholder="搜索菜品" placeholder-class="ph" @confirm="load(true)" />
    </view>

    <view class="tabs">
      <text class="tab" :class="{ on: status === 'ON' }" @click="status = 'ON'">在售</text>
      <text class="tab" :class="{ on: status === 'OFF' }" @click="status = 'OFF'">已下架</text>
    </view>

    <view v-for="d in list" :key="d.id" class="card item">
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
        <text class="op" @click="edit(d)">编辑</text>
        <text class="op" @click="toggleSoldOut(d)">{{ d.soldOut ? '取消售罄' : '标记售罄' }}</text>
        <text class="op" @click="toggleStatus(d)">{{ d.status === 1 ? '下架' : '上架' }}</text>
      </view>
    </view>

    <ct-empty v-if="!list.length" text="暂无菜品" />

    <view class="add-btn" @click="edit(null)">+ 新建菜品</view>
  </view>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { dishList, categoryList, updateDishStatus, updateSoldOut } from '@/api/merchant';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';

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
  uni.stopPullDownRefresh();
}
async function loadCats() {
  categories.value = await categoryList();
}
function pickCat(id) {
  categoryId.value = id;
  load(true);
}
function edit(d) {
  uni.navigateTo({ url: `/subpackages/merchant/dish/edit?id=${d ? d.id : ''}` });
}
async function toggleSoldOut(d) {
  await updateSoldOut(d.id, d.soldOut ? 0 : 1);
  load(true);
}
async function toggleStatus(d) {
  await updateDishStatus(d.id, d.status === 1 ? 0 : 1);
  load(true);
}

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
.search {
  margin-top: 16rpx;
  height: 72rpx;
  background: #fff;
  border-radius: 36rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
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
.item {
  display: flex;
  padding: 24rpx;
  margin-bottom: 20rpx;
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
    background: rgba(232, 168, 124, 0.18);
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
