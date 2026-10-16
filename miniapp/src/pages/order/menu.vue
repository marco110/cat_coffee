<template>
  <view class="page">
    <view class="topbar">
      <view class="pick">
        <text class="mode-tag">门店自取</text>
        <text class="takeaway-tip">下单后凭取餐码取餐</text>
      </view>
      <view class="search" @click="searching = true">
        <input v-model="keyword" class="search-input" placeholder="搜索菜品" placeholder-class="ph" confirm-type="search" @confirm="onSearch" />
      </view>
    </view>

    <!-- 门店休息中：顶部提示 + 结算拦截 -->
    <view v-if="storeClosed" class="closed-tip">
      <text class="ct-icon">😴</text>
      <view class="ct-info">
        <text class="ct-title">门店休息中，暂不可下单</text>
        <text class="ct-sub">营业时间 {{ store.businessHours || '请咨询门店' }}</text>
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

    <!-- 点单明细（与商品详情页共用同一组件） -->
    <ct-cart-panel :visible="panelVisible" @close="panelVisible = false" />


  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getMenu, searchDish, getStore } from '@/api/customer';
import { price } from '@/utils/format';
import { fixUrl } from '@/config';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID, ensureLogin } from '@/utils/auth';
import CtDishItem from '@/components/ct-dish-item.vue';
import CtQty from '@/components/ct-qty.vue';
import CtCartBar from '@/components/ct-cart-bar.vue';
import CtCartPanel from '@/components/ct-cart-panel.vue';
import CtKitty from '@/components/ct-kitty.vue';

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

const panelVisible = ref(false);

/** 休息中：businessStatus 明确为 0 才算休息（未加载到门店信息时不拦截） */
const storeClosed = computed(() => Number(store.value.businessStatus) === 0);

onLoad(async (opt) => {
  await ensureLogin();
  // 从分享链接进来时以链接里的门店为准，好友可能先于自己到过别家门店
  storeId.value = (opt && opt.storeId) || userStore.storeId || String(DEFAULT_STORE_ID);
  userStore.setStore({ storeId: storeId.value, orderType: 'TAKEAWAY' });
  cart.bindStore(storeId.value);
  // 让右上角「转发给朋友 / 分享到朋友圈」可用
  uni.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  await loadMenu();
  await loadStore();
});

/** tabBar 页面只在首次进入时触发 onLoad，切回来时同步最新状态 */
onShow(async () => {
  if (!storeId.value) return; // onLoad 尚未执行完
  loadStore(); // 回到点餐页时刷新营业状态，避免用旧状态放行下单
  const sid = userStore.storeId;
  if (sid && sid !== storeId.value) {
    storeId.value = sid;
    cart.bindStore(sid);
    await loadMenu();
    loadStore();
    return;
  }
  // 店主改了规格/售罄/价格后回到点餐页要能看到最新数据（hasSpec 决定是否展示「选规格」）
  try {
    await loadMenu();
  } catch (e) {
    /* 静默，保留上次列表 */
  }
});

/** 分享内容：门店名 + 到店自取，封面优先门店图 */
const shareTitle = computed(() => `${store.value.name || '12卡coffee'} · 在线点单，到店即取🐾`);
const shareQuery = computed(() => `storeId=${storeId.value}`);
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
async function goConfirm() {
  if (!cart.count) return;
  // 以服务端最新营业状态为准，避免店主刚打烊、本地还是「营业中」
  await loadStore();
  if (storeClosed.value) {
    return uni.showModal({
      title: '门店休息中',
      content: `「${store.value.name || '本店'}」正在休息，暂不可下单，请稍后再来～`,
      showCancel: false,
      confirmText: '我知道了',
    });
  }
  // 结算前校验手机号：未填写则弹窗提醒，用户确认后再去资料页补全（保存后回跳确认订单页）
  if (!userStore.hasPhone) {
    uni.showModal({
      title: '需先完善手机号',
      content: '下单前需先完善手机号信息，否则无法下单。是否前往完善？',
      confirmText: '完善信息',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          userStore.setCheckout(`/pages/order/confirm?storeId=${storeId.value}&orderType=TAKEAWAY`);
          uni.navigateTo({ url: '/pages/mine/profile?back=confirm' });
        }
      },
    });
    return;
  }
  uni.navigateTo({ url: `/pages/order/confirm?storeId=${storeId.value}&orderType=TAKEAWAY` });
}
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-page;
}
/* 门店休息中提示条 */
.closed-tip {
  margin: 0 24rpx 16rpx;
  padding: 18rpx 24rpx;
  display: flex;
  align-items: center;
  border-radius: 20rpx;
  background: #fff4d6;
  border: 2rpx solid #ffe4a3;
  .ct-icon {
    margin-right: 16rpx;
    font-size: 40rpx;
  }
  .ct-info {
    display: flex;
    flex-direction: column;
  }
  .ct-title {
    font-size: 26rpx;
    font-weight: 600;
    color: #8a5a2b;
  }
  .ct-sub {
    margin-top: 4rpx;
    font-size: 22rpx;
    color: #b08a5c;
  }
}
.topbar {
  padding: 16rpx 24rpx;
  background: $coffee-brown;
}
.pick {
  display: flex;
  align-items: center;
}
.mode-tag {
  padding: 8rpx 24rpx;
  border-radius: 26rpx;
  background: #fff;
  color: $coffee-brown;
  font-size: 26rpx;
  font-weight: 600;
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
</style>
