<template>
  <view v-if="visible" class="mask" @click="close">
    <view class="panel" @click.stop>
      <view class="head">
        <image class="cover" :src="fixUrl(dish.cover)" mode="aspectFill" />
        <view class="head-info">
          <text class="name">{{ dish.name }}</text>
          <text class="price">¥{{ price(selectedPrice) }}</text>
          <text class="tip">{{ specTip }}</text>
        </view>
        <text class="close" @click="close">×</text>
      </view>

      <scroll-view class="body" scroll-y>
        <view v-for="g in groups" :key="g.id" class="group">
          <view class="group-title">
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
            >
              {{ it.name }}<text v-if="it.extraPrice" class="extra">+{{ price(it.extraPrice) }}</text>
            </text>
          </view>
        </view>

        <view v-if="addons.length" class="group">
          <view class="group-title"><text>加料</text><text class="tag">可选（可多选）</text></view>
          <view class="opts">
            <text
              v-for="a in addons"
              :key="a.id"
              class="opt"
              :class="{ active: selectedAddons.includes(a.id) }"
              @click="toggleAddon(a)"
            >
              {{ a.name }}<text class="extra">+{{ price(a.price) }}</text>
            </text>
          </view>
        </view>

        <view class="group">
          <view class="group-title"><text>备注</text></view>
          <input v-model="remark" class="remark" placeholder="少冰 / 去糖 / 不要葱" placeholder-class="ph" />
        </view>
      </scroll-view>

      <view class="foot">
        <ct-qty :value="quantity" @change="quantity = $event" />
        <view class="confirm" @click="confirm">加入购物车</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import CtQty from '@/components/ct-qty.vue';

const props = defineProps({ dish: { type: Object, default: () => ({}) }, visible: Boolean });
const emit = defineEmits(['close', 'confirm']);

const groups = ref([]);
const addons = ref([]);
const selected = ref({}); // groupId -> [itemId]
const selectedAddons = ref([]);
const remark = ref('');
const quantity = ref(1);

watch(
  () => [props.visible, props.dish.id],
  () => {
    if (!props.visible) return;
    groups.value = props.dish.specGroups || [];
    addons.value = props.dish.addons || [];
    selected.value = {};
    selectedAddons.value = [];
    remark.value = '';
    quantity.value = 1;
    groups.value.forEach((g) => {
      const def = g.items.filter((i) => i.isDefault).map((i) => i.id);
      if (def.length) selected.value[g.id] = g.multiSelect ? def : [def[0]];
    });
  },
  { immediate: true }
);

const specTip = computed(() => {
  const names = [];
  groups.value.forEach((g) => (selected.value[g.id] || []).forEach((id) => {
    const it = g.items.find((x) => x.id === id);
    if (it) names.push(it.name);
  }));
  return names.join(' / ') || '请选择规格';
});

const selectedPrice = computed(() => {
  let total = Number(props.dish.price || 0);
  groups.value.forEach((g) => (selected.value[g.id] || []).forEach((id) => {
    const it = g.items.find((x) => x.id === id);
    if (it) total += Number(it.extraPrice || 0);
  }));
  addons.value.forEach((a) => {
    if (selectedAddons.value.includes(a.id)) total += Number(a.price || 0);
  });
  return total;
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
function close() {
  emit('close');
}
function confirm() {
  const missing = groups.value.find((g) => g.isRequired && !(selected.value[g.id] || []).length);
  if (missing) {
    uni.showToast({ title: `请选择${missing.name}`, icon: 'none' });
    return;
  }
  const specItemIds = [];
  groups.value.forEach((g) => specItemIds.push(...(selected.value[g.id] || [])));
  emit('confirm', {
    quantity: quantity.value,
    specItemIds,
    specText: specTip.value === '请选择规格' ? '' : specTip.value,
    specExtra: Math.round((selectedPrice.value - Number(props.dish.price || 0)) * 100) / 100,
    addons: addons.value.filter((a) => selectedAddons.value.includes(a.id)),
    remark: remark.value,
  });
  close();
}
</script>

<style lang="scss" scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.panel {
  width: 100%;
  max-height: 78vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}
.head {
  position: relative;
  padding: 28rpx;
  display: flex;
  border-bottom: 1rpx solid $border-color;
}
.cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  background: $cream-white;
}
.head-info {
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
}
.price {
  margin-top: 8rpx;
  color: $coffee-brown;
  font-size: 30rpx;
}
.tip {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.close {
  position: absolute;
  right: 28rpx;
  top: 20rpx;
  font-size: 44rpx;
  color: $text-secondary;
}
.body {
  flex: 1;
  padding: 0 28rpx;
}
.group {
  padding: 24rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.group-title {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  font-weight: 600;
  .tag {
    margin-left: 12rpx;
    font-size: 20rpx;
    color: $text-secondary;
    font-weight: 400;
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
      color: #f7d9c4;
    }
  }
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
.foot {
  padding: 20rpx 28rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid $border-color;
}
.confirm {
  flex: 1;
  margin-left: 24rpx;
  height: 88rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
</style>
