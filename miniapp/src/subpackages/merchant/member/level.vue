<template>
  <view class="page">
    <view v-for="l in list" :key="l.id" class="card item">
      <view class="top">
        <text class="name">{{ l.name }}</text>
        <text class="discount">{{ discountText(l.discount) }}</text>
      </view>
      <view class="meta">等级值 {{ l.levelValue }} · 成长值门槛 {{ l.growthThreshold }}</view>
      <view v-if="l.benefits" class="benefits">{{ l.benefits }}</view>
      <view class="ops" v-if="!l.isDefault">
        <text class="op" @click="edit(l)">编辑</text>
        <text class="op danger" @click="remove(l)">删除</text>
      </view>
    </view>

    <view class="add-btn" @click="edit(null)">+ 新建等级</view>

    <view v-if="editing" class="mask" @click="editing = false">
      <view class="panel" @click.stop>
        <view class="p-head">{{ form.id ? '编辑等级' : '新建等级' }}</view>
        <view class="f"><text class="label">等级名称</text><input v-model="form.name" class="input" placeholder="如：银卡会员" placeholder-class="ph" /></view>
        <view class="f"><text class="label">成长值门槛</text><input v-model="form.growthThreshold" class="input" type="number" placeholder="0" placeholder-class="ph" /></view>
        <view class="f"><text class="label">折扣率</text><input v-model="form.discount" class="input" type="digit" placeholder="0.95 表示 95 折" placeholder-class="ph" /></view>
        <view class="f"><text class="label">等级值</text><input v-model="form.levelValue" class="input" type="number" placeholder="1 起递增" placeholder-class="ph" /></view>
        <view class="f"><text class="label">等级权益</text><input v-model="form.benefits" class="input" placeholder="生日券、优先出杯等" placeholder-class="ph" /></view>
        <view class="p-btns">
          <text class="cancel" @click="editing = false">取消</text>
          <text class="ok" @click="save">保存</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { levelList, createLevel, updateLevel, deleteLevel } from '@/api/merchant';
import { discountText } from '@/utils/format';

const list = ref([]);
const editing = ref(false);
const form = ref({ id: '', name: '', growthThreshold: 0, discount: 1, levelValue: 1, benefits: '' });

async function load() {
  list.value = await levelList();
}
function edit(l) {
  form.value = l ? { ...l } : { id: '', name: '', growthThreshold: 0, discount: 1, levelValue: list.value.length + 1, benefits: '' };
  editing.value = true;
}
async function save() {
  if (!form.value.name) return uni.showToast({ title: '请填写等级名称', icon: 'none' });
  const rate = Number(form.value.discount);
  if (!(rate > 0 && rate <= 1)) return uni.showToast({ title: '折扣率需在 0 ~ 1 之间', icon: 'none' });
  if (form.value.id) await updateLevel(form.value.id, form.value);
  else await createLevel(form.value);
  editing.value = false;
  load();
}
async function remove(l) {
  uni.showModal({
    title: '删除等级',
    content: `确认删除「${l.name}」？该等级下会员将回落到默认等级`,
    success: async (r) => {
      if (!r.confirm) return;
      await deleteLevel(l.id);
      load();
    },
  });
}

onMounted(() => load());
onShow(() => load());
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 180rpx;
}
.item {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
}
.discount {
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 111, 165, 0.12);
  color: $coffee-brown;
  font-size: 24rpx;
}
.meta {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.benefits {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $text-primary;
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
  &.danger {
    color: $danger;
    border-color: $danger;
  }
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
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel {
  width: 84%;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
}
.p-head {
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}
.f {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}
.label {
  width: 200rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.input {
  flex: 1;
  font-size: 28rpx;
  text-align: right;
}
.ph {
  color: $text-placeholder;
}
.p-btns {
  margin-top: 28rpx;
  display: flex;
}
.cancel,
.ok {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.cancel {
  border: 1rpx solid $border-color;
  color: $text-secondary;
  margin-right: 20rpx;
}
.ok {
  background: $coffee-brown;
  color: #fff;
}
</style>
