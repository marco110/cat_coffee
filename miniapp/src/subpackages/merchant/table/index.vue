<template>
  <view class="page">
    <view class="card block">
      <view class="bt">批量生成桌位</view>
      <view class="f">
        <text class="label">桌号规则</text>
        <view class="inline">
          <input v-model="batch.prefix" class="mini" placeholder="前缀 A" placeholder-class="ph" />
          <input v-model="batch.start" class="mini" type="number" placeholder="起始 1" placeholder-class="ph" />
          <text>~</text>
          <input v-model="batch.end" class="mini" type="number" placeholder="结束 10" placeholder-class="ph" />
        </view>
      </view>
      <view class="f">
        <text class="label">所属区域</text>
        <input v-model="batch.area" class="input" placeholder="如：靠窗区" placeholder-class="ph" />
      </view>
      <view class="f">
        <text class="label">每桌人数</text>
        <input v-model="batch.seats" class="input" type="number" placeholder="默认 2" placeholder-class="ph" />
      </view>
      <view class="gen" @click="generate">生成桌位</view>
    </view>

    <view v-for="g in groups" :key="g.area" class="card block">
      <view class="bt">{{ g.area }}（{{ g.tables.length }}）</view>
      <view class="tables">
        <view v-for="t in g.tables" :key="t.id" class="t" :class="{ busy: t.inUse }" @click="openQr(t)">
          <text class="t-no">{{ t.tableNo }}</text>
          <text class="t-meta">{{ t.seats }}人 · {{ t.inUse ? '使用中' : '空闲' }}</text>
          <text class="t-qr">查看二维码</text>
        </view>
      </view>
    </view>

    <ct-empty v-if="!groups.length" text="暂无桌位，请先批量生成" />

    <view v-if="qrVisible" class="mask" @click="qrVisible = false">
      <view class="qr-panel" @click.stop>
        <text class="qr-title">{{ qrTable.tableNo }} 桌点餐码</text>
        <image class="qr" :src="qrTable.qrcode" mode="widthFix" />
        <text class="qr-tip">场景值：{{ qrTable.scene }}</text>
        <view class="qr-save" @click="saveQr">保存到相册</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { tableList, batchCreateTable } from '@/api/merchant';
import CtEmpty from '@/components/ct-empty.vue';

const tables = ref([]);
const batch = ref({ prefix: 'A', start: 1, end: 10, area: '', seats: 2 });
const qrVisible = ref(false);
const qrTable = ref({});

const groups = computed(() => {
  const map = new Map();
  tables.value.forEach((t) => {
    const key = t.area || '默认区域';
    if (!map.has(key)) map.set(key, { area: key, tables: [] });
    map.get(key).tables.push(t);
  });
  return [...map.values()];
});

async function load() {
  const data = await tableList();
  tables.value = Array.isArray(data) ? data : data.list || [];
}

async function generate() {
  const { prefix, start, end, area, seats } = batch.value;
  if (!end || Number(end) < Number(start)) return uni.showToast({ title: '桌位区间不正确', icon: 'none' });
  try {
    const res = await batchCreateTable({
      prefix: prefix || 'A',
      start: Number(start),
      end: Number(end),
      area: area || '默认区域',
      seats: Number(seats) || 2,
    });
    uni.showToast({ title: res.msg || '生成成功', icon: 'none' });
    await load();
  } catch (e) {
    uni.showToast({ title: e.msg || '生成失败', icon: 'none' });
  }
}

function openQr(t) {
  qrTable.value = t;
  qrVisible.value = true;
}

function saveQr() {
  uni.downloadFile({
    url: qrTable.value.qrcode,
    success: (res) => {
      uni.saveImageToPhotosAlbum({ filePath: res.tempFilePath, success: () => uni.showToast({ title: '已保存', icon: 'none' }) });
    },
    fail: () => uni.showToast({ title: '保存失败', icon: 'none' }),
  });
}

onMounted(() => load());
onShow(() => load());
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.block {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.bt {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.f {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
}
.label {
  width: 180rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.inline {
  flex: 1;
  display: flex;
  align-items: center;
}
.mini {
  width: 130rpx;
  text-align: center;
  font-size: 26rpx;
  border-bottom: 1rpx solid $border-color;
  margin: 0 8rpx;
}
.input {
  flex: 1;
  font-size: 26rpx;
  text-align: right;
}
.ph {
  color: $text-placeholder;
}
.gen {
  margin-top: 24rpx;
  height: 84rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
.tables {
  display: flex;
  flex-wrap: wrap;
}
.t {
  width: 30%;
  margin: 0 3% 20rpx 0;
  padding: 20rpx 0;
  border-radius: 12rpx;
  background: $cream-white;
  display: flex;
  flex-direction: column;
  align-items: center;
  &.busy {
    background: rgba(255, 169, 200, 0.22);
  }
}
.t-no {
  font-size: 30rpx;
  font-weight: 600;
}
.t-meta {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: $text-secondary;
}
.t-qr {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: $coffee-brown;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-panel {
  width: 70%;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.qr-title {
  font-size: 30rpx;
  font-weight: 600;
}
.qr {
  width: 400rpx;
  margin: 24rpx 0;
  background: $cream-white;
}
.qr-tip {
  font-size: 22rpx;
  color: $text-secondary;
  word-break: break-all;
  text-align: center;
}
.qr-save {
  margin-top: 24rpx;
  width: 100%;
  height: 80rpx;
  border-radius: 40rpx;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
</style>
