<template>
  <view class="page">
    <view class="card block">
      <view class="row">
        <text class="label">券名称</text>
        <input v-model="form.name" class="input" placeholder="如：新客立减5元" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">券类型</text>
        <picker :range="TYPES" range-key="label" :value="typeIndex" @change="onType">
          <view class="picker">{{ TYPES[typeIndex].label }}</view>
        </picker>
      </view>
      <view v-if="form.type === 'FULL_REDUCE'" class="row">
        <text class="label">门槛金额</text>
        <input v-model="form.thresholdAmount" class="input" type="digit" placeholder="满减门槛，需大于 0" placeholder-class="ph" />
      </view>
      <view v-if="form.type !== 'DISCOUNT'" class="row">
        <text class="label">优惠金额</text>
        <input v-model="form.discountAmount" class="input" type="digit" placeholder="如 5" placeholder-class="ph" />
      </view>
      <view v-if="form.type === 'DISCOUNT'" class="row">
        <text class="label">折扣率</text>
        <input v-model="form.discountRate" class="input" type="digit" placeholder="0.85 表示 8.5 折" placeholder-class="ph" />
      </view>
      <view v-if="form.type === 'DISCOUNT'" class="row">
        <text class="label">最高抵扣</text>
        <input v-model="form.maxDiscount" class="input" type="digit" placeholder="不填则不限" placeholder-class="ph" />
      </view>
    </view>

    <view class="card block">
      <view class="row">
        <text class="label">有效期类型</text>
        <picker :range="VALIDS" range-key="label" :value="validIndex" @change="onValid">
          <view class="picker">{{ VALIDS[validIndex].label }}</view>
        </picker>
      </view>
      <view v-if="form.validType === 'DAYS'" class="row">
        <text class="label">有效天数</text>
        <input v-model="form.validDays" class="input" type="number" placeholder="领取后 N 天内有效" placeholder-class="ph" />
      </view>
      <template v-else>
        <view class="row">
          <text class="label">开始日期</text>
          <picker mode="date" :value="form.validStart" @change="(e) => (form.validStart = e.detail.value)">
            <view class="picker">{{ form.validStart || '请选择' }}</view>
          </picker>
        </view>
        <view class="row">
          <text class="label">结束日期</text>
          <picker mode="date" :value="form.validEnd" @change="(e) => (form.validEnd = e.detail.value)">
            <view class="picker">{{ form.validEnd || '请选择' }}</view>
          </picker>
        </view>
      </template>
      <view class="row">
        <text class="label">发放总量</text>
        <input v-model="form.totalCount" class="input" type="number" placeholder="0 表示不限量" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">每人限领</text>
        <input v-model="form.perUserLimit" class="input" type="number" placeholder="默认 1" placeholder-class="ph" />
      </view>
      <view class="row">
        <text class="label">开放领取</text>
        <switch :checked="form.isPublic" color="#6F4E37" @change="(e) => (form.isPublic = e.detail.value)" />
      </view>
      <view class="row">
        <text class="label">使用说明</text>
        <input v-model="form.description" class="input" placeholder="如：仅限堂食" placeholder-class="ph" />
      </view>
    </view>

    <view class="save" @click="save">保存</view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { couponDetail, createCoupon, updateCoupon } from '@/api/merchant';

const TYPES = [
  { label: '满减券', value: 'FULL_REDUCE' },
  { label: '折扣券', value: 'DISCOUNT' },
  { label: '代金券', value: 'CASH' },
];
const VALIDS = [
  { label: '领取后 N 天有效', value: 'DAYS' },
  { label: '固定有效期', value: 'RANGE' },
];

const form = ref({
  id: '',
  name: '',
  type: 'FULL_REDUCE',
  thresholdAmount: 0,
  discountAmount: 5,
  discountRate: 0.85,
  maxDiscount: '',
  validType: 'DAYS',
  validDays: 7,
  validStart: '',
  validEnd: '',
  totalCount: 0,
  perUserLimit: 1,
  isPublic: true,
  description: '',
});

const typeIndex = computed(() => TYPES.findIndex((t) => t.value === form.value.type));
const validIndex = computed(() => VALIDS.findIndex((t) => t.value === form.value.validType));

function onType(e) {
  form.value.type = TYPES[e.detail.value].value;
}
function onValid(e) {
  form.value.validType = VALIDS[e.detail.value].value;
}

onLoad(async (opt) => {
  if (opt.id) {
    const d = await couponDetail(opt.id);
    form.value = { ...form.value, ...d, isPublic: !!d.isPublic };
  }
});

async function save() {
  if (!form.value.name) return uni.showToast({ title: '请填写券名称', icon: 'none' });
  try {
    if (form.value.id) await updateCoupon(form.value.id, form.value);
    else await createCoupon(form.value);
    uni.showToast({ title: '保存成功', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 500);
  } catch (e) {
    uni.showToast({ title: e.msg || '保存失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 200rpx;
}
.block {
  padding: 8rpx 24rpx;
  margin-bottom: 20rpx;
}
.row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $border-color;
  &:last-child {
    border-bottom: none;
  }
}
.label {
  width: 240rpx;
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
.save {
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
