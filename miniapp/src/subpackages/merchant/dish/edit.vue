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
        <switch :checked="form.isDiscount" color="#6F4E37" @change="(e) => (form.isDiscount = e.detail.value)" />
      </view>
      <view class="row">
        <text class="label">门店推荐</text>
        <switch :checked="form.isRecommend" color="#6F4E37" @change="(e) => (form.isRecommend = e.detail.value)" />
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
      <text class="tip">规格用于计算加价（如大杯 +3 元），加料直接累加到售价</text>
      <view class="spec-row" @click="goSpec">配置规格 / 加料</view>
      <view v-for="g in specPreview" :key="g.name" class="spec-item">
        <text class="s-name">{{ g.name }}</text>
        <text class="s-items">{{ g.items.map((i) => `${i.name}${i.extraPrice ? '+' + i.extraPrice : ''}`).join(' / ') }}</text>
      </view>
    </view>

    <view class="card block">
      <view class="row">
        <text class="label">售卖状态</text>
        <switch :checked="form.status === 'ON'" color="#6F4E37" @change="(e) => (form.status = e.detail.value ? 'ON' : 'OFF')" />
      </view>
      <view class="row">
        <text class="label">今日售罄</text>
        <switch :checked="form.soldOut" color="#6F4E37" @change="(e) => (form.soldOut = e.detail.value)" />
      </view>
    </view>

    <view class="footer">
      <view v-if="form.id" class="del" @click="remove">删除菜品</view>
      <view class="save" @click="save">保存</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { dishDetail, createDish, updateDish, deleteDish, categoryList, getDishSpec } from '@/api/merchant';
import { uploadFile } from '@/api/request';
import { fixUrl } from '@/config';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const cats = ref([]);
const catIndex = ref(-1);
const specPreview = ref([]);
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
  description: '',
  tags: '',
  isDiscount: true,
  isRecommend: false,
  status: 'ON',
  soldOut: false,
});

const loading = ref(false);

onLoad(async (opt) => {
  cats.value = await categoryList();
  if (opt.id) {
    const d = await dishDetail(opt.id);
    form.value = {
      ...form.value,
      ...d,
      isDiscount: !!d.isDiscount,
      isRecommend: !!d.isRecommend,
      soldOut: !!d.soldOut,
      status: Number(d.status) === 1 ? 'ON' : 'OFF',
      stockMode: d.stockMode || 'UNLIMITED',
      tags: (d.tags || []).join(','),
    };
    catIndex.value = cats.value.findIndex((c) => c.id === d.categoryId);
    try {
      const spec = await getDishSpec(opt.id);
      specPreview.value = spec.specGroups || [];
    } catch (e) {
      /* ignore */
    }
  }
});

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

function goSpec() {
  uni.showToast({ title: '规格配置请在 Web 管理后台或联系超管配置', icon: 'none' });
}

async function save() {
  if (!form.value.name) return uni.showToast({ title: '请填写菜品名称', icon: 'none' });
  if (!form.value.categoryId) return uni.showToast({ title: '请选择分类', icon: 'none' });
  if (!Number(form.value.price)) return uni.showToast({ title: '请填写售价', icon: 'none' });
  if (loading.value) return;
  loading.value = true;
  const payload = {
    ...form.value,
    tags: form.value.tags ? String(form.value.tags).split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
    isDiscount: form.value.isDiscount ? 1 : 0,
    isRecommend: form.value.isRecommend ? 1 : 0,
    soldOut: form.value.soldOut ? 1 : 0,
    status: form.value.status === 'ON' ? 1 : 0,
    stockMode: form.value.stockMode,
    dailyLimit: Number(form.value.dailyLimit || 0),
  };
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

async function remove() {
  uni.showModal({
    title: '删除菜品',
    content: '确认删除该菜品？删除后不可恢复',
    success: async (r) => {
      if (!r.confirm) return;
      await deleteDish(form.value.id);
      uni.showToast({ title: '已删除', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 500);
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
  padding: 12rpx 0;
  font-size: 24rpx;
  color: $text-secondary;
}
.s-name {
  width: 160rpx;
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
.del {
  width: 240rpx;
  height: 92rpx;
  border-radius: $radius-button;
  border: 1rpx solid $danger;
  color: $danger;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  margin-right: 20rpx;
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
