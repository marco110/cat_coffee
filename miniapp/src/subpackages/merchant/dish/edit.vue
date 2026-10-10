<template>
  <view class="page">
    <view class="card block">
      <view class="row">
        <text class="label">菜品图片</text>
        <view class="upload" @click="chooseImage">
          <image v-if="form.cover" class="cover" :src="fixUrl(form.cover)" mode="aspectFill" />
          <text v-else class="plus">+</text>
        </view>
      </view>
      <view class="row">
        <text class="label">菜品名称</text>
        <input v-model="form.name" class="input" placeholder="必填" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">所属分类</text>
        <picker :range="cats" range-key="name" :value="catIndex" @change="onCat">
          <view class="picker">{{ catIndex >= 0 ? cats[catIndex].name : '请选择' }}</view>
        </picker>
        <text class="mini-link" @click="goCategory">管理</text>
      </view>
      <view class="row">
        <text class="label">售价（元）</text>
        <input v-model="form.price" class="input" type="digit" placeholder="0.00" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">划线价</text>
        <input v-model="form.originalPrice" class="input" type="digit" placeholder="不填则不展示" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">库存模式</text>
        <picker :range="STOCK_MODES" range-key="label" :value="stockModeIndex" @change="onStockMode">
          <view class="picker">{{ STOCK_MODES[stockModeIndex].label }}</view>
        </picker>
      </view>
      <view v-if="form.stockMode === 'DAILY_LIMIT'" class="row">
        <text class="label">每日限量</text>
        <input v-model="form.dailyLimit" class="input" type="number" placeholder="如 30" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">是否参与折扣</text>
        <switch :checked="form.isDiscount" color="#FF6FA5" @change="(e) => (form.isDiscount = e.detail.value)" />
      </view>
      <view class="row">
        <text class="label">门店推荐</text>
        <switch :checked="form.isRecommend" color="#FF6FA5" @change="(e) => (form.isRecommend = e.detail.value)" />
      </view>
    </view>

    <view class="card block">
      <view class="bt">商品介绍图片（详情页轮播 / 长图介绍）</view>
      <text class="tip">最多 9 张，建议竖图 3:4。第一张会作为详情页轮播首图</text>
      <view class="imgs">
        <view v-for="(img, i) in form.images" :key="i" class="img-wrap">
          <image class="img" :src="fixUrl(img)" mode="aspectFill" @click="previewIntro(i)" />
          <view class="img-del" @click="removeIntro(i)">×</view>
        </view>
        <view v-if="form.images.length < 9" class="img-wrap add" @click="chooseIntroImages">+</view>
      </view>
    </view>

    <view class="card block">
      <view class="bt">商品描述</view>
      <textarea v-model="form.description" class="textarea" placeholder="一句话介绍这道产品" placeholder-class="ph" />
      <view class="bt">口味标签（逗号分隔）</view>
      <input v-model="form.tags" class="input" placeholder="如：香浓,热饮" placeholder-class="ph" />
    </view>

    <view class="card block" v-if="form.id">
      <view class="bt">规格与加料</view>
      <text class="tip">规格用于计算加价（如大杯 +3 元），加料为门店共用并累加到售价</text>
      <view class="spec-row" @click="goSpec">配置规格{{ specCount ? `（${specCount} 组）` : '' }}</view>
      <view v-for="g in specPreview" :key="g.name" class="spec-item">
        <view class="s-left">
          <text class="s-name">{{ g.name }}</text>
          <text class="s-mode">{{ Number(g.multiSelect) ? '多选' : '单选' }}{{ Number(g.isRequired) === 0 ? ' · 可选' : '' }}</text>
        </view>
        <text class="s-items">{{ (g.items || []).map((i) => `${i.name}${Number(i.extraPrice) ? ' +' + price(i.extraPrice) : ''}`).join(' / ') }}</text>
      </view>
      <view v-if="!specPreview.length" class="spec-empty">未配置规格，顾客将直接按原价下单</view>
      <view class="addon-line">
        <text class="a-title">门店加料</text>
        <text v-if="addonNames" class="a-list">{{ addonNames }}</text>
        <text v-else class="a-none">未配置</text>
      </view>
      <view class="manage" @click="goAddon">管理加料库</view>
    </view>

    <view class="card block">
      <view class="row">
        <text class="label">售卖状态</text>
        <switch :checked="form.status === 'ON'" color="#FF6FA5" @change="(e) => (form.status = e.detail.value ? 'ON' : 'OFF')" />
      </view>
      <view class="row">
        <text class="label">今日售罄</text>
        <switch :checked="form.soldOut" color="#FF6FA5" @change="(e) => (form.soldOut = e.detail.value)" />
      </view>
    </view>

    <view class="footer">
      <view class="save" @click="save">保存</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { dishDetail, createDish, updateDish, categoryList, getDishSpec, addonList } from '@/api/merchant';
import { uploadFile } from '@/api/request';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const cats = ref([]);
const catIndex = ref(-1);
const specPreview = ref([]);
const addons = ref([]);
const specCount = computed(() => specPreview.value.length);
const addonNames = computed(() => addons.value.map((a) => `${a.name}+${price(a.price)}`).join(' / '));
const STOCK_MODES = [
  { label: '不限量', value: 'UNLIMITED' },
  { label: '每日限量', value: 'DAILY_LIMIT' },
];
const stockModeIndex = computed(() => Math.max(0, STOCK_MODES.findIndex((m) => m.value === form.value.stockMode)));
function onStockMode(e) {
  form.value.stockMode = STOCK_MODES[e.detail.value].value;
}

const form = ref({
  id: '',
  name: '',
  categoryId: '',
  price: '',
  originalPrice: '',
  stockMode: 'UNLIMITED',
  dailyLimit: 0,
  cover: '',
  images: [],
  description: '',
  tags: '',
  isDiscount: true,
  isRecommend: false,
  status: 'ON',
  soldOut: false,
});

const loading = ref(false);

let dishId = '';

onLoad(async (opt) => {
  dishId = opt.id || '';
  await loadCats();
  if (!dishId) return;
  const d = await dishDetail(dishId);
  // 规格只在规格页维护：这里不能把详情里的 specGroups 带回表单，
  // 否则保存菜品时会用进页面时的旧快照覆盖刚配好的规格
  delete d.specGroups;
  form.value = {
    ...form.value,
    ...d,
    isDiscount: !!d.isDiscount,
    isRecommend: !!d.isRecommend,
    soldOut: !!d.soldOut,
    status: Number(d.status) === 1 ? 'ON' : 'OFF',
    stockMode: d.stockMode || 'UNLIMITED',
    tags: (d.tags || []).join(','),
    images: d.images || [],
  };
  syncCatIndex();
  loadSpec();
  loadAddons();
});

/** 从分类管理 / 规格配置页返回时刷新（watch 会自动重新定位已选中的分类） */
onShow(() => {
  loadCats();
  loadSpec();
  loadAddons();
});

async function loadSpec() {
  if (!dishId) return;
  try {
    specPreview.value = await getDishSpec(dishId);
  } catch (e) {
    /* ignore */
  }
}
async function loadAddons() {
  try {
    addons.value = await addonList();
  } catch (e) {
    addons.value = [];
  }
}
watch(cats, () => syncCatIndex());

async function loadCats() {
  cats.value = await categoryList();
}
function syncCatIndex() {
  catIndex.value = cats.value.findIndex((c) => c.id === form.value.categoryId);
}

function goCategory() {
  uni.navigateTo({ url: '/subpackages/merchant/category/index' });
}

function onCat(e) {
  catIndex.value = e.detail.value;
  form.value.categoryId = cats.value[catIndex.value].id;
}

function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      try {
        const url = await uploadFile(res.tempFilePaths[0], { auth: 'merchant', bizType: 'DISH', storeId: userStore.merchantStore?.id || 0 });
        form.value.cover = url;
      } catch (e) {
        uni.showToast({ title: '上传失败', icon: 'none' });
      }
    },
  });
}

/** 商品介绍图片：多图上传，最多 9 张 */
function chooseIntroImages() {
  const remain = 9 - form.value.images.length;
  if (remain <= 0) return uni.showToast({ title: '最多 9 张', icon: 'none' });
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    success: async (res) => {
      uni.showLoading({ title: '上传中', mask: true });
      try {
        for (const p of res.tempFilePaths) {
          const url = await uploadFile(p, { auth: 'merchant', bizType: 'DISH', storeId: userStore.merchantStore?.id || 0 });
          form.value.images.push(url);
        }
      } catch (e) {
        uni.showToast({ title: '上传失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
  });
}
function removeIntro(i) {
  form.value.images.splice(i, 1);
}
function previewIntro(i) {
  uni.previewImage({ current: i, urls: form.value.images.map((u) => fixUrl(u)) });
}

function goSpec() {
  uni.navigateTo({
    url: `/subpackages/merchant/dish/spec?id=${dishId}&name=${encodeURIComponent(form.value.name || '')}`,
  });
}
function goAddon() {
  uni.navigateTo({ url: '/subpackages/merchant/addon/index' });
}

async function save() {
  if (!form.value.name) return uni.showToast({ title: '请填写菜品名称', icon: 'none' });
  if (!form.value.categoryId) {
    return uni.showModal({
      title: '请先创建分类',
      content: '菜品需要归属到某个分类，现在去创建分类？',
      success: (r) => r.confirm && goCategory(),
    });
  }
  if (!Number(form.value.price)) return uni.showToast({ title: '请填写售价', icon: 'none' });
  if (loading.value) return;
  loading.value = true;
  const payload = {
    ...form.value,
    tags: form.value.tags ? String(form.value.tags).split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
    images: form.value.images || [],
    isDiscount: form.value.isDiscount ? 1 : 0,
    isRecommend: form.value.isRecommend ? 1 : 0,
    soldOut: form.value.soldOut ? 1 : 0,
    status: form.value.status === 'ON' ? 1 : 0,
    stockMode: form.value.stockMode,
    dailyLimit: Number(form.value.dailyLimit || 0),
  };
  // 双保险：菜品保存不携带规格，规格一律走 PUT /merchant/dish/:id/spec
  delete payload.specGroups;
  try {
    if (form.value.id) await updateDish(form.value.id, payload);
    else await createDish(payload);
    uni.showToast({ title: '保存成功', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 500);
  } catch (e) {
    uni.showToast({ title: e.msg || '保存失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
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
.row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $border-color;
  &:last-child {
    border-bottom: none;
  }
}
.label {
  width: 220rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.input {
  flex: 1;
  font-size: 28rpx;
  text-align: right;
}
.picker {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  color: $coffee-brown;
}
.mini-link {
  margin-left: 16rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  color: $coffee-brown;
}
.ph {
  color: $text-placeholder;
}
.upload {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  background: $cream-white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
}
.plus {
  font-size: 60rpx;
  color: $text-placeholder;
}
.bt {
  font-size: 28rpx;
  font-weight: 600;
  margin: 12rpx 0;
}
.imgs {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
}
.img-wrap {
  position: relative;
  width: 150rpx;
  height: 150rpx;
  margin: 0 16rpx 16rpx 0;
  border-radius: 12rpx;
  overflow: visible;
}
.img {
  width: 150rpx;
  height: 150rpx;
  border-radius: 12rpx;
  background: $cream-white;
}
.add {
  background: $cream-white;
  color: $text-placeholder;
  font-size: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.img-del {
  position: absolute;
  right: -8rpx;
  top: -8rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $danger;
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.2);
  z-index: 2;
}
.textarea {
  width: 100%;
  height: 160rpx;
  background: $cream-white;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.tip {
  font-size: 22rpx;
  color: $text-secondary;
}
.spec-row {
  margin: 20rpx 0;
  padding: 20rpx;
  text-align: center;
  border: 2rpx dashed $coffee-brown;
  color: $coffee-brown;
  border-radius: 12rpx;
  font-size: 26rpx;
}
.spec-item {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
  border-bottom: 1rpx dashed $border-color;
  font-size: 24rpx;
  color: $text-secondary;
}
.s-left {
  flex-shrink: 0;
  width: 180rpx;
  display: flex;
  flex-direction: column;
}
.s-name {
  font-size: 26rpx;
  color: $text-primary;
}
.s-mode {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: $text-placeholder;
}
.s-items {
  flex: 1;
  min-width: 0;
  line-height: 36rpx;
}
.spec-empty {
  padding: 16rpx 0;
  font-size: 24rpx;
  color: $text-placeholder;
}
.addon-line {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  font-size: 24rpx;
}
.a-title {
  flex-shrink: 0;
  width: 180rpx;
  color: $text-primary;
}
.a-list {
  flex: 1;
  min-width: 0;
  color: $text-secondary;
}
.a-none {
  color: $text-placeholder;
}
.manage {
  margin-top: 12rpx;
  padding: 16rpx;
  text-align: center;
  border: 2rpx dashed $coffee-brown;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: $coffee-brown;
}
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: flex;
}
.save {
  flex: 1;
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
