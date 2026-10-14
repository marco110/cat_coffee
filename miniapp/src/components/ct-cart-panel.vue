<template>
  <!-- 点单明细弹窗：点餐页与商品详情页共用，保证两处样式一致 -->
  <view
    v-if="visible && cart.count > 0"
    class="cart-mask"
    :style="{ paddingBottom: bottom }"
    @click="$emit('close')"
  >
    <view class="cart-panel" @click.stop>
      <view class="panel-handle" />
      <view class="cart-head">
        <text class="ch-title">已选 {{ cart.count }} 件</text>
        <text class="clear" @click="clear">🗑 清空</text>
      </view>
      <scroll-view class="cart-list" scroll-y>
        <view v-for="it in cart.items" :key="it.key" class="cart-item">
          <view class="ci-cover">
            <image v-if="it.cover" class="ci-img" :src="fixUrl(it.cover)" mode="aspectFill" />
            <ct-kitty v-else class="ci-ph" mode="face" :size="56" color="#ffd0e0" bow-color="#ffd84d" />
          </view>
          <view class="ci-info">
            <view class="ci-row">
              <text class="ci-name">{{ it.name }}</text>
              <text class="ci-price">¥{{ price((it.unitPrice + (it.addonAmount || 0)) * it.quantity) }}</text>
            </view>
            <view v-if="it.specText || it.remark" class="ci-tags">
              <text v-if="it.specText" class="ci-tag">{{ it.specText }}</text>
              <text v-if="it.remark" class="ci-tag remark">备注 {{ it.remark }}</text>
            </view>
            <text v-if="it.desc" class="ci-desc">{{ it.desc }}</text>
            <view class="ci-row ci-foot">
              <text class="ci-unit">¥{{ price(it.unitPrice + (it.addonAmount || 0)) }} / 份</text>
              <ct-qty :value="it.quantity" @change="(v) => cart.setQuantity(it.key, v)" />
            </view>
          </view>
        </view>
        <view class="list-bottom" />
      </scroll-view>
      <!-- 合计与「去结算」由底部购物车栏承担，弹窗内不重复展示 -->
    </view>
  </view>
</template>

<script setup>
import { watch } from 'vue';
import { price } from '@/utils/format';
import { fixUrl } from '@/config';
import { useCartStore } from '@/store/cart';
import CtQty from '@/components/ct-qty.vue';
import CtKitty from '@/components/ct-kitty.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 弹窗底边到屏幕底边的距离：默认紧贴购物车栏顶边（栏 bottom 8rpx + 高 100rpx） */
  bottom: { type: String, default: '108rpx' },
});
const emit = defineEmits(['close']);

const cart = useCartStore();

/** 数量被减到空时自动收起，避免留下一个空弹窗 */
watch(
  () => cart.count,
  (n) => {
    if (!n) emit('close');
  }
);

function clear() {
  cart.clear();
  emit('close');
}
</script>

<style lang="scss" scoped>
/* z-index 低于购物车栏(900)，保证弹窗展开时购物车栏仍可见可点 */
.cart-mask {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.45);
  z-index: 850;
  display: flex;
  align-items: flex-end;
}
.cart-panel {
  width: 100%;
  max-height: calc(100vh - 200rpx);
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -8rpx 40rpx rgba(240, 72, 128, 0.18);
  animation: sheet-up 0.22s ease-out;
}
@keyframes sheet-up {
  from {
    transform: translateY(40rpx);
    opacity: 0.6;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.panel-handle {
  align-self: center;
  margin-top: 12rpx;
  width: 72rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: $border-color;
}
.cart-head {
  padding: 18rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid $border-color;
  .ch-title {
    font-size: 30rpx;
    font-weight: 700;
    color: $text-primary;
  }
  .clear {
    color: $text-secondary;
    font-size: 26rpx;
  }
}
.cart-list {
  flex: 1;
  padding: 0 28rpx;
  box-sizing: border-box;
}
.cart-item {
  display: flex;
  padding: 24rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.ci-cover {
  flex-shrink: 0;
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: $cream-white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ci-img {
  width: 120rpx;
  height: 120rpx;
}
.ci-ph {
  opacity: 0.9;
}
/* min-width: 0 让菜名区域可压缩，避免长菜名 + 规格把整行撑出屏幕 */
.ci-info {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
}
.ci-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ci-name {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ci-price {
  flex-shrink: 0;
  margin-left: 16rpx;
  color: $pink-dark;
  font-size: 30rpx;
  font-weight: 700;
}
.ci-tags {
  margin-top: 8rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.ci-tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: $pink-soft;
  color: $pink-dark;
  font-size: 20rpx;
  &.remark {
    background: #fff4e0;
    color: #c98a2b;
  }
}
.ci-desc {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ci-foot {
  margin-top: 10rpx;
}
.ci-unit {
  font-size: 22rpx;
  color: $text-placeholder;
}
/* 底部留白：列表滚到底时最后一项不贴边 */
.list-bottom {
  height: 24rpx;
}
</style>
