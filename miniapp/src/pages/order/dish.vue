<template>
  <view class="page">
    <swiper
      class="gallery"
      :indicator-dots="gallery.length > 1"
      indicator-color="rgba(255,255,255,0.5)"
      indicator-active-color="#FF6FA5"
      circular
    >
      <swiper-item v-for="(img, i) in gallery" :key="i">
        <image class="g-img" :src="fixUrl(img)" mode="aspectFill" @click="preview(img)" />
      </swiper-item>
    </swiper>

    <view class="card main">
      <view class="title-row">
        <text class="name">{{ dish.name }}</text>
        <text v-if="dish.isRecommend === 1" class="badge rec">推荐</text>
      </view>
      <view class="price-row">
        <text class="price">¥{{ price(dish.price) }}</text>
        <text v-if="dish.originalPrice" class="origin">¥{{ price(dish.originalPrice) }}</text>
        <text class="unit">/{{ dish.unit || '份' }}</text>
      </view>
      <view class="meta">
        <text v-for="t in dish.tags || []" :key="t" class="tag">{{ t }}</text>
        <text class="sales">已售 {{ dish.sales }}</text>
      </view>
      <text v-if="dish.description" class="desc">{{ dish.description }}</text>
      <view v-if="soldOut" class="sold">🐾 今日已售罄，看看别的口味吧</view>
    </view>

    <!-- 规格 -->
    <view v-for="g in specGroups" :key="g.id" class="card group">
      <view class="g-title">
        <text>{{ g.name }}</text>
        <text class="tag">{{ g.isRequired ? '必选' : '可选' }}{{ g.multiSelect ? '（可多选）' : '' }}</text>
      </view>
      <view class="opts">
        <text
          v-for="it in g.items"
          :key="it.id"
          class="opt"
          :class="{ active: isSelected(g, it.id) }"
          @click="toggle(g, it)"
        >{{ it.name }}<text v-if="it.extraPrice" class="extra">+{{ price(it.extraPrice) }}</text></text>
      </view>
    </view>

    <!-- 加料 -->
    <view v-if="addons.length" class="card group">
      <view class="g-title"><text>加料</text><text class="tag">可选（可多选）</text></view>
      <view class="opts">
        <text
          v-for="a in addons"
          :key="a.id"
          class="opt"
          :class="{ active: selectedAddons.includes(a.id) }"
          @click="toggleAddon(a)"
        >{{ a.name }}<text class="extra">+{{ price(a.price) }}</text></text>
      </view>
    </view>

    <!-- 数量：放在页面内，底部只保留一条购物车栏，避免两条操作栏叠着 -->
    <view class="card group">
      <view class="num-row">
        <text class="num-label">购买数量</text>
        <ct-qty :value="quantity" @change="onQtyChange" />
      </view>
    </view>


    <!-- 商品介绍图片（店主在菜品编辑里上传） -->
    <view v-if="introImages.length" class="card">
      <view class="sec-title">🐾 商品介绍</view>
      <image
        v-for="(img, i) in introImages"
        :key="i"
        class="intro-img"
        :src="fixUrl(img)"
        mode="widthFix"
        @click="preview(img)"
      />
    </view>
    <view v-else class="card">
      <view class="sec-title">🐾 商品介绍</view>
      <text class="no-intro">店主还没有上传介绍图片~</text>
    </view>

    <!-- 底部只保留一条栏：左侧购物车（展开明细）+ 金额 + 加入购物车 / 去结算
         商品详情为普通页面（非 tabBar），需自行补安全区 -->
    <ct-cart-bar
      :count="cart.count"
      :amount="cart.goodsAmount"
      bottom="calc(8rpx + env(safe-area-inset-bottom))"
      @submit="goConfirm"
      @toggle="panelVisible = !panelVisible"
    />

    <!-- 点单明细：与点餐页共用同一个组件，样式完全一致 -->
    <ct-cart-panel
      :visible="panelVisible"
      bottom="calc(108rpx + env(safe-area-inset-bottom))"
      @close="panelVisible = false"
    />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getDish, getStore } from '@/api/customer';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import { useCartStore } from '@/store/cart';
import { useUserStore } from '@/store/user';
import { DEFAULT_STORE_ID } from '@/utils/auth';
import CtQty from '@/components/ct-qty.vue';
import CtCartBar from '@/components/ct-cart-bar.vue';
import CtCartPanel from '@/components/ct-cart-panel.vue';

const cart = useCartStore();
const userStore = useUserStore();

const storeId = ref('');
const dishId = ref('');
const dish = ref({});
const specGroups = ref([]);
const addons = ref([]);
const selected = ref({}); // groupId -> [itemId]
const selectedAddons = ref([]);
const remark = ref('');
const panelVisible = ref(false);

/** 门店休息中：businessStatus 明确为 0 才算休息（未加载到门店信息时不拦截） */
const store = ref({});
const storeClosed = computed(() => Number(store.value.businessStatus) === 0);

async function loadStore() {
  try {
    store.value = await getStore(storeId.value);
  } catch (e) {
    /* 门店信息拿不到也不影响下单 */
  }
}

const soldOut = computed(() => Number(dish.value.soldOut) === 1 || Number(dish.value.status) === 0);

/** 轮播图集：封面 + 介绍图，去重且过滤空值 */
const gallery = computed(() => {
  const list = [];
  if (dish.value.cover) list.push(dish.value.cover);
  (dish.value.images || []).forEach((u) => {
    if (u && !list.includes(u)) list.push(u);
  });
  return list.length ? list : [''];
});
/** 介绍图（详情长图） */
const introImages = computed(() => (dish.value.images || []).filter(Boolean));

/** 单价 = 基础价 + 规格加价 + 加料 */
const unitTotal = computed(() => {
  let total = Number(dish.value.price || 0);
  specGroups.value.forEach((g) => {
    (selected.value[g.id] || []).forEach((id) => {
      const it = g.items.find((x) => x.id === id);
      if (it) total += Number(it.extraPrice || 0);
    });
  });
  addons.value.forEach((a) => {
    if (selectedAddons.value.includes(a.id)) total += Number(a.price || 0);
  });
  return Math.round(total * 100) / 100;
});

/** 当前勾选的规格项（顺序按分组展开，key 里再排序，与购物车一致） */
const specItemIds = computed(() => {
  const ids = [];
  specGroups.value.forEach((g) => ids.push(...(selected.value[g.id] || [])));
  return ids;
});

/**
 * 当前「菜品 + 规格 + 加料 + 备注」在购物车里的行 key，
 * 规则必须与 store/cart 的 makeKey 保持一致
 */
const currentKey = computed(() =>
  [
    String(dish.value.id || ''),
    specItemIds.value.slice().sort().join('-'),
    selectedAddons.value.slice().sort().join('-'),
    remark.value || '',
  ].join('|')
);

/**
 * 数量完全由购物车反推：没加过就是 0（只显示「+」），
 * 点「+」即加入购物车并变成「- 1」，点「-」减少，减到 0 自动移除该行
 */
const quantity = computed(() => {
  const row = cart.items.find((i) => i.key === currentKey.value);
  return row ? row.quantity : 0;
});

/** 分享内容：菜品名 + 价格，封面用菜品图 */
const shareTitle = computed(() => {
  const name = dish.value.name || '爱猫咖啡';
  return dish.value.price ? `${name} · 点我一起喝一杯🐾` : `${name} · 点我一起喝一杯🐾`;
});
const shareQuery = computed(() => `id=${dishId.value}&storeId=${storeId.value}`);
const shareImage = computed(() => fixUrl(dish.value.cover));

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: `/pages/order/dish?${shareQuery.value}`,
  imageUrl: shareImage.value,
}));
onShareTimeline(() => ({
  title: shareTitle.value,
  query: shareQuery.value,
  imageUrl: shareImage.value,
}));

const specText = computed(() => {
  const names = [];
  specGroups.value.forEach((g) => {
    (selected.value[g.id] || []).forEach((id) => {
      const it = g.items.find((x) => x.id === id);
      if (it) names.push(it.name);
    });
  });
  return names.join(' / ');
});

onLoad(async (opt) => {
  storeId.value = opt.storeId || userStore.storeId || String(DEFAULT_STORE_ID);
  dishId.value = opt.id || '';
  userStore.setStore({ storeId: storeId.value });
  cart.bindStore(storeId.value);
  // 让右上角「转发给朋友 / 分享到朋友圈」可用
  uni.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  const detail = await getDish(opt.id);
  dish.value = detail;
  specGroups.value = detail.specGroups || [];
  addons.value = detail.addons || [];
  selected.value = {};
  selectedAddons.value = [];
  remark.value = '';
  specGroups.value.forEach((g) => {
    const def = g.items.filter((i) => i.isDefault).map((i) => i.id);
    if (def.length) selected.value[g.id] = g.multiSelect ? def : [def[0]];
  });
  if (detail.name) uni.setNavigationBarTitle({ title: detail.name });
  loadStore();
});

function isSelected(g, id) {
  return (selected.value[g.id] || []).includes(id);
}
function toggle(g, it) {
  const cur = selected.value[g.id] || [];
  if (g.multiSelect) {
    selected.value[g.id] = cur.includes(it.id) ? cur.filter((x) => x !== it.id) : [...cur, it.id];
  } else {
    selected.value[g.id] = cur.includes(it.id) ? [] : [it.id];
  }
}
function toggleAddon(a) {
  selectedAddons.value = selectedAddons.value.includes(a.id)
    ? selectedAddons.value.filter((x) => x !== a.id)
    : [...selectedAddons.value, a.id];
}
function preview(url) {
  const urls = gallery.value.map((u) => fixUrl(u)).filter(Boolean);
  if (!urls.length) return;
  uni.previewImage({ current: fixUrl(url), urls });
}
/** 数量步进：加号直接入购物车，减号减少（为 0 时移除该行） */
function onQtyChange(v) {
  if (v > quantity.value) addOne();
  else cart.setQuantity(currentKey.value, v);
}

function addOne() {
  if (soldOut.value) return uni.showToast({ title: '今日已售罄', icon: 'none' });
  const missing = specGroups.value.find((g) => g.isRequired && !(selected.value[g.id] || []).length);
  if (missing) {
    // 数量由购物车反推，未加入时步进器会自己回到 0，无需回滚
    uni.showToast({ title: `请选择${missing.name}`, icon: 'none' });
    return;
  }
  cart.add(dish.value, {
    quantity: 1,
    specItemIds: specItemIds.value,
    specText: specText.value,
    specExtra: Math.round((unitTotal.value - Number(dish.value.price || 0)) * 100) / 100,
    addons: addons.value.filter((a) => selectedAddons.value.includes(a.id)),
    remark: remark.value,
  });
}
async function goConfirm() {
  if (!cart.count) return;
  // 与点餐页一致：门店休息中不允许下单
  await loadStore();
  if (storeClosed.value) {
    return uni.showModal({
      title: '门店休息中',
      content: `「${store.value.name || '本店'}」正在休息，暂不可下单，请稍后再来～`,
      showCancel: false,
      confirmText: '我知道了',
    });
  }
  const orderType = userStore.orderType || 'TAKEAWAY';
  const tableId = orderType === 'DINE_IN' ? userStore.tableId || '' : '';
  const tableNo = orderType === 'DINE_IN' ? userStore.tableNo || '' : '';
  const confirmUrl = `/pages/order/confirm?storeId=${storeId.value}&orderType=${orderType}&tableId=${tableId}&tableNo=${encodeURIComponent(tableNo)}`;
  // 结算前校验手机号：未填写则弹窗提醒，用户确认后再去资料页补全（保存后回跳确认订单页）
  if (!userStore.hasPhone) {
    uni.showModal({
      title: '需先完善手机号',
      content: '下单前需先完善手机号信息，否则无法下单。是否前往完善？',
      confirmText: '完善信息',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          userStore.setCheckout(confirmUrl);
          uni.navigateTo({ url: '/pages/mine/profile?back=confirm' });
        }
      },
    });
    return;
  }
  uni.navigateTo({ url: confirmUrl });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  /* 底部仅一条购物车栏（100rpx + 安全区），留足不遮挡即可 */
  padding: 0 24rpx 200rpx;
  background: $bg-page;
}
.gallery {
  height: 520rpx;
  margin: 0 -24rpx;
  width: calc(100% + 48rpx);
}
.g-img {
  width: 100%;
  height: 520rpx;
  background: $cream-white;
}
.card {
  background: #fff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  padding: 24rpx;
  margin-top: 20rpx;
}
.main {
  margin-top: -40rpx;
  position: relative;
  z-index: 2;
  border-radius: $radius-card;
}
.title-row {
  display: flex;
  align-items: center;
}
.name {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
}
.badge {
  margin-left: 12rpx;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  &.rec {
    color: $cat-orange;
    background: rgba(255, 169, 200, 0.22);
  }
}
.price-row {
  margin-top: 12rpx;
  display: flex;
  align-items: baseline;
}
.price {
  color: $coffee-brown;
  font-size: 40rpx;
  font-weight: 700;
}
.origin {
  margin-left: 12rpx;
  font-size: 24rpx;
  color: $text-placeholder;
  text-decoration: line-through;
}
.unit {
  margin-left: 8rpx;
  font-size: 22rpx;
  color: $text-placeholder;
}
.meta {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.tag {
  margin-right: 12rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: $pink-soft;
  color: $pink-dark;
  font-size: 20rpx;
}
.sales {
  margin-left: auto;
  font-size: 22rpx;
  color: $text-placeholder;
}
.desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: $text-secondary;
}
.sold {
  margin-top: 16rpx;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  background: $cream-white;
  color: $pink-dark;
  font-size: 24rpx;
}
.group {
  padding-bottom: 8rpx;
}
.g-title {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  .tag {
    background: transparent;
    color: $text-secondary;
    font-size: 20rpx;
    font-weight: 400;
    padding: 0;
  }
}
.opts {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}
.opt {
  padding: 12rpx 24rpx;
  border-radius: 30rpx;
  background: $cream-white;
  color: $text-primary;
  font-size: 26rpx;
  margin: 0 16rpx 16rpx 0;
  .extra {
    color: $cat-orange;
    margin-left: 6rpx;
  }
  &.active {
    background: $coffee-brown;
    color: #fff;
    .extra {
      color: #ffe0ec;
    }
  }
}
.num-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.num-label {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
}
.remark {
  margin-top: 16rpx;
  background: $cream-white;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}
.ph {
  color: $text-placeholder;
}
.sec-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 16rpx;
}
.intro-img {
  width: 100%;
  display: block;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
  background: $cream-white;
}
.no-intro {
  font-size: 24rpx;
  color: $text-placeholder;
}
</style>
