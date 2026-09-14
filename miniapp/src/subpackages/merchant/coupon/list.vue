<template>
  <view class="page">
    <view class="kpis">
      <view class="kpi"><text class="v">{{ stats.totalGrant || 0 }}</text><text class="l">累计发放</text></view>
      <view class="kpi"><text class="v">{{ stats.totalUsed || 0 }}</text><text class="l">已使用</text></view>
      <view class="kpi"><text class="v">{{ stats.usedRate || '0%' }}</text><text class="l">核销率</text></view>
      <view class="kpi"><text class="v">{{ stats.totalUnused || 0 }}</text><text class="l">未使用</text></view>
    </view>

    <view v-for="c in list" :key="c.id" class="card item">
      <view class="top">
        <view class="c-left">
          <text class="c-value">{{ couponValue(c) }}</text>
          <text class="c-threshold">满{{ price(c.thresholdAmount) }}可用</text>
        </view>
        <view class="c-right">
          <text class="c-name">{{ c.name }}</text>
          <text class="c-meta">{{ c.validType === 'DAYS' ? `领取后 ${c.validDays} 天有效` : `${dateText(c.validStart)} ~ ${dateText(c.validEnd)}` }}</text>
          <text class="c-meta">已领 {{ c.issuedCount }}{{ c.totalCount ? ` / ${c.totalCount}` : '' }} · 已用 {{ c.usedCount }}</text>
        </view>
        <text class="status" :class="{ off: c.status !== 'RUNNING' }">{{ statusText(c.status) }}</text>
      </view>
      <view class="ops">
        <text class="op" @click="edit(c)">编辑</text>
        <text class="op" @click="toggle(c)">{{ c.status === 'RUNNING' ? '暂停' : '启用' }}</text>
        <text class="op" @click="grant(c)">定向发放</text>
        <text class="op danger" @click="remove(c)">删除</text>
      </view>
    </view>

    <ct-empty v-if="!list.length" text="暂无优惠券" />
    <view class="add-btn" @click="edit(null)">+ 新建优惠券</view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { couponList, couponStats, updateCouponStatus, deleteCoupon, grantCoupon, memberList } from '@/api/merchant';
import { price, couponValue, dateText } from '@/utils/format';

const list = ref([]);
const stats = ref({});

const STATUS_TEXT = { RUNNING: '进行中', PAUSED: '已暂停', ENDED: '已结束' };
const statusText = (s) => STATUS_TEXT[s] || s;

async function load() {
  const [d, s] = await Promise.all([couponList({ pageSize: 50 }), couponStats()]);
  list.value = d.list;
  const rows = Array.isArray(s) ? s : [];
  const totalGrant = rows.reduce((sum, r) => sum + Number(r.issued || 0), 0);
  const totalUsed = rows.reduce((sum, r) => sum + Number(r.used || 0), 0);
  const totalUnused = rows.reduce((sum, r) => sum + Number(r.unused || 0), 0);
  stats.value = {
    totalGrant,
    totalUsed,
    totalUnused,
    usedRate: totalGrant ? `${Math.round((totalUsed / totalGrant) * 100)}%` : '0%',
  };
}
function edit(c) {
  uni.navigateTo({ url: `/subpackages/merchant/coupon/edit?id=${c ? c.id : ''}` });
}
async function toggle(c) {
  await updateCouponStatus(c.id, c.status === 'RUNNING' ? 'PAUSED' : 'RUNNING');
  load();
}
async function remove(c) {
  uni.showModal({
    title: '删除优惠券',
    content: `确认删除「${c.name}」？`,
    success: async (r) => {
      if (!r.confirm) return;
      await deleteCoupon(c.id);
      load();
    },
  });
}
async function grant(c) {
  uni.showModal({
    title: '定向发放',
    content: `输入会员手机号，向其发放「${c.name}」`,
    editable: true,
    placeholderText: '会员手机号',
    success: async (r) => {
      if (!r.confirm || !r.content) return;
      const phone = r.content.trim();
      try {
        const data = await memberList({ keyword: phone, pageSize: 10 });
        const members = data.list || [];
        const member = members.find((m) => m.phone && m.phone.includes(phone)) || members[0];
        if (!member) return uni.showToast({ title: '未找到该会员', icon: 'none' });
        await grantCoupon({ couponId: c.id, userIds: [member.userId] });
        uni.showToast({ title: '发放成功', icon: 'none' });
        load();
      } catch (e) {
        uni.showToast({ title: e.msg || '发放失败', icon: 'none' });
      }
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
.kpis {
  display: flex;
  background: #fff;
  border-radius: $radius-card;
  padding: 28rpx 0;
  margin-bottom: 24rpx;
}
.kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.v {
  font-size: 34rpx;
  font-weight: 700;
  color: $coffee-brown;
}
.l {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.item {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.top {
  display: flex;
  align-items: center;
}
.c-left {
  width: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1rpx dashed $border-color;
}
.c-value {
  font-size: 40rpx;
  font-weight: 700;
  color: $coffee-brown;
}
.c-threshold {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: $text-secondary;
}
.c-right {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}
.c-name {
  font-size: 30rpx;
  font-weight: 600;
}
.c-meta {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.status {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  color: $success;
  background: rgba(103, 194, 58, 0.12);
  &.off {
    color: $text-secondary;
    background: rgba(156, 139, 122, 0.12);
  }
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
</style>
