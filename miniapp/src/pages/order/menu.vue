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
            @open="openDish"
          >
            <template #action>
              <view
                v-if="d.hasSpec"
                class="select-btn"
                :class="{ disabled: Number(d.soldOut) === 1 }"
                @click.stop="openDish(d)"
              >选规格</view>
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
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getMenu, getTables, searchDish, getStore } from '@/api/customer';
import { price } from '@/utils/format';
import { fixUrl } from '@/config';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID, ensureLogin } from '@/utils/auth';
import CtDishItem from '@/components/ct-dish-item.vue';
import CtQty from '@/components/ct-qty.vue';
import CtCartBar from '@/components/ct-cart-bar.vue';

const cart = useCartStore();
const userStore = useUserStore();

const storeId = ref('');
const store = ref({});
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

const panelVisible = ref(false);

onLoad(async (opt) => {
  await ensureLogin();
  // 从分享链接进来时以链接里的门店为准，好友可能先于自己到过别家门店
  storeId.value = (opt && opt.storeId) || userStore.storeId || String(DEFAULT_STORE_ID);
  userStore.setStore({ storeId: storeId.value });
  cart.bindStore(storeId.value);
  if (opt && opt.orderType) orderType.value = opt.orderType;
  else orderType.value = userStore.orderType || 'TAKEAWAY';
  if (opt && opt.tableId) {
    // 分享带桌号：直接定位到该桌，同桌扫码后无需再选
    tableId.value = opt.tableId;
    tableNo.value = decodeURIComponent(opt.tableNo || '');
    userStore.setStore({ tableId: tableId.value, tableNo: tableNo.value, orderType: 'DINE_IN' });
    orderType.value = 'DINE_IN';
  } else if (userStore.tableId) {
    tableId.value = userStore.tableId;
    tableNo.value = userStore.tableNo || '';
    if (tableId.value !== '0') orderType.value = 'DINE_IN';
  }
  // 让右上角「转发给朋友 / 分享到朋友圈」可用
  uni.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  await loadMenu();
  await loadTables();
  await loadStore();
});

/** tabBar 页面只在首次进入时触发 onLoad，切换回来时同步首页/扫码设置的最新状态 */
onShow(() => {
  if (!storeId.value) return; // onLoad 尚未执行完
  const sid = userStore.storeId;
  if (sid && sid !== storeId.value) {
    storeId.value = sid;
    cart.bindStore(sid);
    loadMenu();
    loadTables();
    loadStore();
  }
  if (userStore.orderType) orderType.value = userStore.orderType;
  tableId.value = userStore.tableId || '';
  tableNo.value = userStore.tableNo || '';
});

/** 分享内容：门店名 + 点餐方式（堂食带桌号），封面优先门店图 */
const shareTitle = computed(() => {
  const name = store.value.name || '爱猫咖啡';
  if (orderType.value === 'DINE_IN' && tableNo.value) return `${name} · ${tableNo.value}号桌，一起点单吧🐾`;
  return `${name} · 在线点单，到店即取🐾`;
});
const shareQuery = computed(() => {
  const q = [`storeId=${storeId.value}`, `orderType=${orderType.value}`];
  if (orderType.value === 'DINE_IN' && tableId.value && tableId.value !== '0') {
    q.push(`tableId=${tableId.value}`, `tableNo=${encodeURIComponent(tableNo.value || '')}`);
  }
  return q.join('&');
});
/** 分享封面：门店封面，兜底用第一道菜的封面 */
const shareImage = computed(() => {
  if (store.value.cover) return fixUrl(store.value.cover);
  const first = (categories.value[0] || {}).dishes || [];
  return first.length && first[0].cover ? fixUrl(first[0].cover) : '';
});

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: `/pages/order/menu?${shareQuery.value}`,
  imageUrl: shareImage.value,
}));
onShareTimeline(() => ({
  title: shareTitle.value,
  query: shareQuery.value,
  imageUrl: shareImage.value,
}));

async function loadStore() {
  try {
    store.value = await getStore(storeId.value);
  } catch (e) {
    /* 门店信息拿不到也不影响点餐 */
  }
}
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
/** 点击菜品：跳转商品详情页（图片介绍 / 规格选择 / 加购都在该页完成） */
function openDish(dish) {
  if (Number(dish.soldOut) === 1) return uni.showToast({ title: '今日已售罄', icon: 'none' });
  uni.navigateTo({ url: `/pages/order/dish?id=${dish.id}&storeId=${storeId.value}` });
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
        if (!r.confirm) return;
        // 「我的」是 tabBar 页，用 switchTab + 内存标记传递引导意图
        userStore.setPendingBind(true);
        uni.switchTab({ url: '/pages/mine/index' });
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
  flex-shrink: 0;
  height: 48rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: $coffee-brown;
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  &.disabled {
    background: $border-color;
    color: $text-placeholder;
  }
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
