<template>
  <view class="page">
    <view class="card block">
      <view class="bt">快捷模板</view>
      <text class="tip">点一下直接套用常见咖啡规格组（可再自行修改），避免从零手敲</text>
      <view class="tpls">
        <text v-for="t in TEMPLATES" :key="t.name" class="tpl" @click="applyTpl(t)">+ {{ t.name }}</text>
      </view>
    </view>

    <view v-for="(g, gi) in groups" :key="g._k" class="card block gcard">
      <view class="g-head">
        <input v-model="g.name" class="g-name" placeholder="规格组名，如：杯型" placeholder-class="ph" />
        <text class="g-del" @click="removeGroup(gi)">删除</text>
      </view>

      <view class="g-set">
        <view class="seg">
          <text class="seg-item" :class="{ on: !g.multiSelect }" @click="setMulti(g, 0)">单选</text>
          <text class="seg-item" :class="{ on: g.multiSelect }" @click="setMulti(g, 1)">多选</text>
        </view>
        <view class="req">
          <text class="req-label">必选</text>
          <switch :checked="!!g.isRequired" color="#FF6FA5" @change="(e) => (g.isRequired = e.detail.value ? 1 : 0)" />
        </view>
        <view class="move">
          <text class="mv" :class="{ off: gi === 0 }" @click="moveGroup(gi, -1)">↑</text>
          <text class="mv" :class="{ off: gi === groups.length - 1 }" @click="moveGroup(gi, 1)">↓</text>
        </view>
      </view>

      <view v-for="(it, ii) in g.items" :key="it._k" class="item">
        <input v-model="it.name" class="i-name" placeholder="规格名称，如：大杯" placeholder-class="ph" />
        <view class="i-price">
          <text class="rmb">¥</text>
          <input v-model="it.extraPrice" class="i-num" type="digit" placeholder="0" placeholder-class="ph" />
        </view>
        <text class="i-def" :class="{ on: it.isDefault }" @click="toggleDefault(g, it)">
          {{ it.isDefault ? '默认' : '设为默认' }}
        </text>
        <text class="i-del" @click="removeItem(g, ii)">×</text>
      </view>

      <view class="add-item" @click="addItem(g)">+ 添加规格项</view>
    </view>

    <view class="card block">
      <view class="bt">门店加料库</view>
      <text class="tip">加料为门店共用，顾客在菜品详情页可多选，加价累加到售价</text>
      <view v-if="addons.length" class="addon-list">
        <text v-for="a in addons" :key="a.id" class="addon">
          {{ a.name }}<text class="p">+¥{{ price(a.price) }}</text>
        </text>
      </view>
      <view v-else class="empty">暂无加料，点下方按钮添加</view>
      <view class="manage" @click="goAddon">管理加料库</view>
    </view>

    <view v-if="!groups.length" class="empty-page">还没有配置规格，试试上方快捷模板</view>

    <view class="add-group" @click="addGroup">+ 新建规格组</view>

    <view class="footer">
      <view class="save" @click="save">保存规格</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { getDishSpec, saveDishSpec, addonList } from '@/api/merchant';
import { price } from '@/utils/format';

/** 咖啡店高频规格模板：与市面咖啡小程序一致的叫法 */
const TEMPLATES = [
  { name: '杯型', multiSelect: 0, isRequired: 1, items: [
    { name: '中杯', extraPrice: 0, isDefault: 1 },
    { name: '大杯', extraPrice: 3, isDefault: 0 },
  ] },
  { name: '温度', multiSelect: 0, isRequired: 1, items: [
    { name: '热', extraPrice: 0, isDefault: 1 },
    { name: '冰', extraPrice: 0, isDefault: 0 },
    { name: '常温', extraPrice: 0, isDefault: 0 },
  ] },
  { name: '糖度', multiSelect: 0, isRequired: 1, items: [
    { name: '标准糖', extraPrice: 0, isDefault: 1 },
    { name: '半糖', extraPrice: 0, isDefault: 0 },
    { name: '无糖', extraPrice: 0, isDefault: 0 },
  ] },
  { name: '奶型', multiSelect: 0, isRequired: 0, items: [
    { name: '标准奶', extraPrice: 0, isDefault: 1 },
    { name: '燕麦奶', extraPrice: 4, isDefault: 0 },
    { name: '脱脂奶', extraPrice: 0, isDefault: 0 },
  ] },
  { name: '浓缩', multiSelect: 0, isRequired: 0, items: [
    { name: '单份', extraPrice: 0, isDefault: 1 },
    { name: '双份', extraPrice: 5, isDefault: 0 },
  ] },
  { name: '小料', multiSelect: 1, isRequired: 0, items: [
    { name: '珍珠', extraPrice: 2, isDefault: 0 },
    { name: '椰果', extraPrice: 2, isDefault: 0 },
    { name: '奶油顶', extraPrice: 4, isDefault: 0 },
  ] },
];

const dishId = ref('');
const groups = ref([]);
const addons = ref([]);
const loading = ref(false);
let seed = 0;
// 规格编辑是本地未保存状态，只在首次进入时拉取，避免从加料页返回时被服务端数据覆盖
let loaded = false;
const uid = () => `k${++seed}`;

onLoad((opt) => {
  dishId.value = opt.id || '';
  const name = decodeURIComponent(opt.name || '');
  uni.setNavigationBarTitle({ title: name ? `${name} · 规格` : '规格配置' });
});
onShow(() => {
  if (!loaded) {
    loaded = true;
    loadSpec();
  }
  loadAddons();
});

async function loadSpec() {
  if (!dishId.value) return;
  try {
    const list = await getDishSpec(dishId.value);
    groups.value = (list || []).map((g) => normalizeGroup(g));
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

function normalizeGroup(g) {
  return {
    _k: uid(),
    name: g.name || '',
    multiSelect: Number(g.multiSelect) ? 1 : 0,
    isRequired: Number(g.isRequired) === 0 ? 0 : 1,
    sort: Number(g.sort || 0),
    items: (g.items || []).map((i) => ({
      _k: uid(),
      name: i.name || '',
      extraPrice: String(Number(i.extraPrice || 0)),
      isDefault: Number(i.isDefault) ? 1 : 0,
      sort: Number(i.sort || 0),
    })),
  };
}

function addGroup() {
  groups.value.push({ _k: uid(), name: '', multiSelect: 0, isRequired: 1, sort: groups.value.length, items: [] });
}
function addItem(g) {
  g.items.push({ _k: uid(), name: '', extraPrice: '0', isDefault: 0, sort: g.items.length });
}
function removeItem(g, ii) {
  g.items.splice(ii, 1);
}
function removeGroup(gi) {
  uni.showModal({
    title: '删除规格组',
    content: '删除后顾客将无法选择该组规格，确认删除？',
    success: (r) => r.confirm && groups.value.splice(gi, 1),
  });
}
function moveGroup(gi, dir) {
  const target = gi + dir;
  if (target < 0 || target >= groups.value.length) return;
  const arr = groups.value;
  [arr[gi], arr[target]] = [arr[target], arr[gi]];
}
function setMulti(g, v) {
  g.multiSelect = v;
  if (!v) {
    // 单选：最多保留一个默认项
    let keep = false;
    g.items.forEach((it) => {
      if (it.isDefault) {
        if (keep) it.isDefault = 0;
        else keep = true;
      }
    });
  }
}
function toggleDefault(g, it) {
  const on = !it.isDefault;
  if (on && !g.multiSelect) g.items.forEach((x) => (x.isDefault = 0));
  it.isDefault = on ? 1 : 0;
}
function applyTpl(t) {
  if (groups.value.some((g) => g.name === t.name)) return uni.showToast({ title: `已存在「${t.name}」`, icon: 'none' });
  groups.value.push({ _k: uid(), name: t.name, multiSelect: t.multiSelect, isRequired: t.isRequired, sort: groups.value.length, items: t.items.map((i, idx) => ({ _k: uid(), name: i.name, extraPrice: String(i.extraPrice), isDefault: i.isDefault, sort: idx })) });
  uni.showToast({ title: `已添加「${t.name}」`, icon: 'none' });
}
function goAddon() {
  uni.navigateTo({ url: '/subpackages/merchant/addon/index' });
}

/** 后端是整体覆盖式保存，这里提交完整的 groups */
async function save() {
  if (!dishId.value) return;
  const payload = [];
  for (const g of groups.value) {
    const name = String(g.name || '').trim();
    if (!name) return uni.showToast({ title: '请填写规格组名', icon: 'none' });
    const items = [];
    for (const [ii, it] of g.items.entries()) {
      const itName = String(it.name || '').trim();
      if (!itName) continue;
      items.push({
        name: itName,
        extraPrice: Math.round(Number(it.extraPrice || 0) * 100) / 100,
        isDefault: it.isDefault ? 1 : 0,
        sort: ii,
      });
    }
    if (!items.length) return uni.showToast({ title: `「${name}」至少添加一个规格项`, icon: 'none' });
    payload.push({ name, isRequired: g.isRequired, multiSelect: g.multiSelect, sort: Number(g.sort || 0), items });
  }
  if (loading.value) return;
  loading.value = true;
  try {
    await saveDishSpec(dishId.value, payload);
    uni.showToast({ title: '规格已保存', icon: 'none' });
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
  padding: 24rpx 24rpx 220rpx;
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
.ph {
  color: $text-placeholder;
}
.tpls {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.tpl {
  padding: 10rpx 24rpx;
  border-radius: $radius-tag;
  background: $pink-soft;
  color: $pink-dark;
  font-size: 24rpx;
}
.gcard {
  border-left: 6rpx solid $pink-light;
}
.g-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $border-color;
}
.g-name {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 600;
}
.g-del {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  color: $danger;
}
.g-set {
  margin: 16rpx 0;
  display: flex;
  align-items: center;
}
.seg {
  display: flex;
  background: $cream-white;
  border-radius: 26rpx;
  padding: 4rpx;
}
.seg-item {
  padding: 8rpx 24rpx;
  border-radius: 22rpx;
  font-size: 24rpx;
  color: $text-secondary;
  &.on {
    background: $coffee-brown;
    color: #fff;
  }
}
.req {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.req-label {
  margin-right: 10rpx;
  font-size: 24rpx;
  color: $text-secondary;
}
.move {
  margin-left: 20rpx;
  display: flex;
  gap: 10rpx;
}
.mv {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $cream-white;
  color: $text-primary;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  &.off {
    color: $text-placeholder;
    opacity: 0.5;
  }
}
.item {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-top: 1rpx dashed $border-color;
}
.i-name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
}
.i-price {
  flex-shrink: 0;
  margin-left: 16rpx;
  display: flex;
  align-items: center;
  background: $cream-white;
  border-radius: 24rpx;
  padding: 8rpx 16rpx;
}
.rmb {
  font-size: 22rpx;
  color: $text-secondary;
}
.i-num {
  width: 90rpx;
  margin-left: 6rpx;
  font-size: 26rpx;
  text-align: right;
  color: $pink-dark;
  font-weight: 600;
}
.i-def {
  flex-shrink: 0;
  margin-left: 16rpx;
  padding: 6rpx 16rpx;
  border-radius: $radius-tag;
  border: 1rpx solid $border-color;
  font-size: 22rpx;
  color: $text-secondary;
  &.on {
    background: $pink-dark;
    border-color: $pink-dark;
    color: #fff;
  }
}
.i-del {
  flex-shrink: 0;
  margin-left: 12rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: $danger;
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-item,
.manage,
.add-group {
  margin-top: 16rpx;
  padding: 18rpx;
  text-align: center;
  border: 2rpx dashed $coffee-brown;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: $coffee-brown;
}
.add-group {
  background: #fff;
}
.addon-list {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.addon {
  padding: 8rpx 20rpx;
  border-radius: $radius-tag;
  background: $cream-white;
  font-size: 24rpx;
  color: $text-primary;
  .p {
    margin-left: 8rpx;
    color: $pink-dark;
  }
}
.empty,
.empty-page {
  margin-top: 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: $text-placeholder;
}
.empty-page {
  margin-top: 60rpx;
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
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
