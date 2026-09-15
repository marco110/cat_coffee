<template>
  <text class="tag" :class="cls">{{ text }}</text>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ status: { type: String, default: '' } });
const MAP = {
  PENDING: { t: '待接单', c: 'warn' },
  ACCEPTED: { t: '已接单', c: 'brown' },
  MAKING: { t: '制作中', c: 'brown' },
  READY: { t: '待取餐', c: 'success' },
  COMPLETED: { t: '已完成', c: 'grey' },
  CANCELLED: { t: '已取消', c: 'grey' },
  REJECTED: { t: '已拒单', c: 'danger' },
  UNPAID: { t: '待收款', c: 'warn' },
  PAID: { t: '已收款', c: 'success' },
};
const item = computed(() => MAP[props.status] || { t: props.status, c: 'grey' });
const text = computed(() => item.value.t);
const cls = computed(() => item.value.c);
</script>

<style lang="scss" scoped>
.tag {
  padding: 4rpx 16rpx;
  border-radius: $radius-tag;
  font-size: 22rpx;
}
.brown {
  color: $coffee-brown;
  background: rgba(255, 111, 165, 0.12);
}
.warn {
  color: $warning;
  background: rgba(230, 162, 60, 0.12);
}
.success {
  color: $success;
  background: rgba(103, 194, 58, 0.12);
}
.danger {
  color: $danger;
  background: rgba(245, 108, 108, 0.12);
}
.grey {
  color: $text-secondary;
  background: rgba(156, 139, 122, 0.12);
}
</style>
