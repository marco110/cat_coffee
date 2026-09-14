<template>
  <view class="page">
    <view class="topbar">
      <view class="pick">
        <view class="seg">
          <text class="seg-item" :class="{ on: orderType === 'DINE_IN' }" @click="switchType('DINE_IN')">堂食</text>
          <text class="seg-item" :class="{ on: orderType === 'TAKEAWAY' }" @click="switchType('TAKEAWAY')">打包</text>
        </view>
        <view v-if="orderType === 'DINE_IN'" class="table-pick" @click="showTables = true">
          <text>{{ tableNo ? `桌号 ${tableNo}` : '请选择桌号' }}</text>
          <text class="arrow">▾</text>
        </view>
        <text v-else class="takeaway-tip">下单后凭取餐码取餐</text>
      </view>
      <view class="search" @click="searching = true">
        <input v-model="keyword" class="search-input" placeholder="搜索菜品" placeholder-class="ph" confirm-type="search" @confirm="onSearch" />
      </view>
    </view>

    <view class="body">
      <scroll-view class="cats" scroll-y>
        <view
          v-for="(c, i) in categories"
          :key="c.id"
          class="cat"
          :class="{ on: currentCat === i }"
          @click="selectCat(i)"
        >
          {{ c.name }}
          <text v-if="catCount(c.id)" class="cat-badge">{{ catCount(c.id) }}</text>
        </view>
      </scroll-view>

      <scroll-view class="dishes" scroll-y :scroll-into-view="anchor" scroll-with-animation @scroll="onScroll">
        <view v-for="(c, i) in categories" :key="c.id" :id="`cat-${i}`" class="dish-group">
          <view class="group-title">{{ c.name }}</view>
          <ct-dish-item
            v-for="d in filtered(c)"
            :key="d.id"
            :dish="d"
            :show-sales="showSales"
            @open="openSpec"
          >
            <template #action>
              <view v-if="d.hasSpec" class="select-btn" @click.stop="openSpec(d)">选规格</view>
              <ct-qty v-else :value="qtyOf(d.id)" @change="(v) => setSimple(d, v)" />
            </template>
          </ct-dish-item>
        </view>
        <view class="bottom-space" />
      </scroll-view>
    </view>

    <ct-cart-bar :count="cart.count" :amount="cart.goodsAmount" @submit="goConfirm" @toggle="panelVisible = !panelVisible" />

    <!-- 购物车明细 -->
    <view v-if="panelVisible && cart.count > 0" class="cart-mask" @click="panelVisible = false">
      <view class="cart-panel" @click.stop>
        <view class="cart-head">
          <text>购物车</text>
          <text class="clear" @click="cart.clear()">清空</text>
        </view>
        <scroll-view class="cart-list" scroll-y>
          <view v-for="it in cart.items" :key="it.key" class="cart-item">
            <view class="ci-info">
              <text class="ci-name">{{ it.name }}</text>
              <text v-if="it.specText" class="ci-spec">{{ it.specText }}</text>
            </view>
            <text class="ci-price">¥{{ price((it.unitPrice + (it.addonAmount || 0)) * it.quantity) }}</text>
            <ct-qty :value="it.quantity" @change="(v) => cart.setQuantity(it.key, v)" />
          </view>
        </scroll-view>
      </view>
    </view>

    <ct-spec-popup :dish="activeDish" :visible="specVisible" @close="specVisible = false" @confirm="onSpecConfirm" />

    <!-- 桌号选择 -->
    <view v-if="showTables" class="cart-mask" @click="showTables = false">
      <view class="table-panel" @click.stop>
        <view class="cart-head"><text>选择桌号</text></view>
        <scroll-view class="cart-list" scroll-y>
          <view v-for="g in tableGroups" :key="g.area" class="tg">
            <view class="tg-title">{{ g.area }}</view>
            <view class="tg-tables">
              <text
                v-for="t in g.tables"
                :key="t.id"
                class="t-item"
                :class="{ on: String(tableId) === String(t.id) }"
                @click="pickTable(t)"
              >{{ t.tableNo }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getMenu, getTables, getDish, searchDish } from '@/api/customer';
import { price } from '@/utils/format';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID, ensureLogin } from '@/utils/auth';

const cart = useCartStore();
const userStore = useUserStore();

const storeId = ref('');
const categories = ref([]);
const currentCat = ref(0);
const anchor = ref('');
const showSales = ref(true);
const keyword = ref('');
const searching = ref(false);

const orderType = ref('TAKEAWAY');
const tableId = ref('');
const tableNo = ref('');
const tableGroups = ref([]);
const showTables = ref(false);

const specVisible = ref(false);
const activeDish = ref({});
const panelVisible = ref(false);

onLoad(async (opt) => {
  await ensureLogin();
  storeId.value = userStore.storeId || String(DEFAULT_STORE_ID);
  cart.bindStore(storeId.value);
  if (opt.orderType) orderType.value = opt.orderType;
  else orderType.value = userStore.orderType || 'TAKEAWAY';
  if (userStore.tableId) {
    tableId.value = userStore.tableId;
    tableNo.value = userStore.tableNo || '';
    if (tableId.value !== '0') orderType.value = 'DINE_IN';
  }
  await loadMenu();
  await loadTables();
});

async function loadMenu() {
  const data = await getMenu(storeId.value);
  categories.value = data.categories || [];
  showSales.value = true;
}
async function loadTables() {
  const data = await getTables(storeId.value);
  tableGroups.value = data.groups || [];
}
function filtered(c) {
  if (!keyword.value) return c.dishes;
  return c.dishes.filter((d) => d.name.includes(keyword.value));
}
function onSearch() {
  searching.value = false;
}
function catCount(id) {
  return cart.items.filter((i) => i.categoryId === String(id)).length;
}
function selectCat(i) {
  currentCat.value = i;
  anchor.value = `cat-${i}`;
}
function onScroll(e) {
  // 简易滚动联动：根据滚动距离估算分类
  const tops = [];
  const h = e.detail.scrollTop;
  if (h < 20) currentCat.value = 0;
}
function switchType(type) {
  orderType.value = type;
  userStore.setStore({ orderType: type });
  if (type === 'DINE_IN' && !tableId.value) showTables.value = true;
}
function pickTable(t) {
  tableId.value = t.id;
  tableNo.value = t.tableNo;
  userStore.setStore({ tableId: t.id, tableNo: t.tableNo, orderType: 'DINE_IN' });
  showTables.value = false;
}
function qtyOf(dishId) {
  return cart.items.filter((i) => i.dishId === String(dishId)).reduce((s, i) => s + i.quantity, 0);
}
function setSimple(dish, v) {
  const delta = v - qtyOf(dish.id);
  if (delta > 0) cart.add(dish, { quantity: delta });
  else {
    const row = cart.items.filter((i) => i.dishId === String(dish.id))[0];
    if (row) cart.setQuantity(row.key, v);
  }
}
async function openSpec(dish) {
  const detail = await getDish(dish.id);
  activeDish.value = detail;
  specVisible.value = true;
}
function onSpecConfirm(payload) {
  cart.add(activeDish.value, payload);
  uni.showToast({ title: '已加入购物车', icon: 'none' });
}
function goConfirm() {
  if (!cart.count) return;
  if (orderType.value === 'DINE_IN' && !tableId.value) {
    showTables.value = true;
    uni.showToast({ title: '请先选择桌号', icon: 'none' });
    return;
  }
  if (orderType.value === 'TAKEAWAY' && !userStore.userInfo?.phone) {
    uni.showModal({
      title: '需授权手机号',
      content: '打包订单需要绑定手机号以便联系，是否立即授权？',
      success: (r) => {
        if (r.confirm) uni.navigateTo({ url: '/pages/mine/index?bind=1' });
      },
    });
    return;
  }
  uni.navigateTo({
    url: `/pages/order/confirm?storeId=${storeId.value}&orderType=${orderType.value}&tableId=${tableId.value}&tableNo=${encodeURIComponent(tableNo.value)}`,
  });
}
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-page;
}
.topbar {
  padding: 16rpx 24rpx;
  background: $coffee-brown;
}
.pick {
  display: flex;
  align-items: center;
}
.seg {
  display: flex;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 30rpx;
  padding: 4rpx;
}
.seg-item {
  padding: 10rpx 28rpx;
  border-radius: 26rpx;
  color: #fff;
  font-size: 26rpx;
  &.on {
    background: #fff;
    color: $coffee-brown;
    font-weight: 600;
  }
}
.table-pick {
  margin-left: 20rpx;
  color: #fff;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  .arrow {
    margin-left: 8rpx;
  }
}
.takeaway-tip {
  margin-left: 20rpx;
  color: rgba(255, 255, 255, 0.8);
  font-size: 24rpx;
}
.search {
  margin-top: 16rpx;
}
.search-input {
  height: 64rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 32rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
}
.ph {
  color: $text-placeholder;
}
.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.cats {
  width: 180rpx;
  background: $cream-white;
}
.cat {
  padding: 28rpx 20rpx;
  font-size: 26rpx;
  color: $text-secondary;
  position: relative;
  &.on {
    background: #fff;
    color: $coffee-brown;
    font-weight: 600;
  }
}
.cat-badge {
  position: absolute;
  right: 12rpx;
  top: 16rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  background: $cat-orange;
  color: #fff;
  font-size: 20rpx;
  text-align: center;
  line-height: 32rpx;
  padding: 0 6rpx;
}
.dishes {
  flex: 1;
  padding: 16rpx;
}
.group-title {
  font-size: 26rpx;
  font-weight: 700;
  color: $text-primary;
  padding: 12rpx 8rpx;
}
.select-btn {
  background: $cat-orange;
  color: #fff;
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 26rpx;
}
.bottom-space {
  height: 160rpx;
}
.cart-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 950;
  display: flex;
  align-items: flex-end;
}
.cart-panel,
.table-panel {
  width: 100%;
  max-height: 60vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}
.cart-head {
  padding: 24rpx 28rpx;
  display: flex;
  justify-content: space-between;
  border-bottom: 1rpx solid $border-color;
  font-size: 30rpx;
  font-weight: 600;
  .clear {
    color: $text-secondary;
    font-size: 26rpx;
    font-weight: 400;
  }
}
.cart-list {
  max-height: 50vh;
  padding: 0 28rpx;
}
.cart-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.ci-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.ci-name {
  font-size: 28rpx;
}
.ci-spec {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.ci-price {
  margin: 0 24rpx;
  color: $coffee-brown;
  font-weight: 600;
}
.tg-title {
  padding: 20rpx 0 8rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.tg-tables {
  display: flex;
  flex-wrap: wrap;
}
.t-item {
  width: 140rpx;
  text-align: center;
  padding: 18rpx 0;
  margin: 0 16rpx 16rpx 0;
  background: $cream-white;
  border-radius: 12rpx;
  font-size: 26rpx;
  &.on {
    background: $coffee-brown;
    color: #fff;
  }
}
</style>
