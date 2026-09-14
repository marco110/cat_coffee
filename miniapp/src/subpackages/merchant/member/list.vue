<template>
  <view class="page">
    <input v-model="keyword" class="search" placeholder="搜索昵称 / 手机号" placeholder-class="ph" @confirm="load(true)" />

    <view v-for="m in list" :key="m.id" class="card item">
      <view class="top">
        <image class="avatar" :src="fixUrl(m.avatar)" mode="aspectFill" />
        <view class="m-info">
          <text class="name">{{ m.nickname }} <text class="level">{{ m.levelName }}</text></text>
          <text class="meta">{{ m.phone || '未授权手机号' }} · {{ m.orderCount }} 单 · 累计 ¥{{ price(m.totalConsume) }}</text>
          <text class="meta">积分 {{ m.points }} · 成长值 {{ m.growth }}</text>
        </view>
      </view>
      <view class="ops">
        <text class="op" @click="adjust(m, 'POINTS')">调整积分</text>
        <text class="op" @click="adjust(m, 'GROWTH')">调整成长值</text>
      </view>
    </view>

    <ct-empty v-if="!list.length" text="暂无会员" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onReachBottom } from '@dcloudio/uni-app';
import { memberList, adjustMember } from '@/api/merchant';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';

const list = ref([]);
const keyword = ref('');
const page = ref(1);

async function load(reset = true) {
  if (reset) page.value = 1;
  const data = await memberList({ keyword: keyword.value, page: page.value, pageSize: 20 });
  list.value = reset ? data.list : [...list.value, ...data.list];
}

function adjust(m, type) {
  const title = { POINTS: '调整积分', GROWTH: '调整成长值' }[type];
  const current = type === 'POINTS' ? m.points : m.growth;
  uni.showModal({
    title,
    content: `当前：${current}，输入变更值（可填负数）`,
    editable: true,
    placeholderText: '如 100 或 -50',
    success: async (r) => {
      if (!r.confirm) return;
      const num = Number(r.content);
      if (!num) return uni.showToast({ title: '请输入数值', icon: 'none' });
      try {
        await adjustMember({
          userId: m.userId,
          points: type === 'POINTS' ? num : 0,
          growth: type === 'GROWTH' ? num : 0,
          remark: '店主手动调整',
        });
        uni.showToast({ title: '已调整', icon: 'none' });
        load(true);
      } catch (e) {
        uni.showToast({ title: e.msg || '调整失败', icon: 'none' });
      }
    },
  });
}

onMounted(() => load(true));
onReachBottom(() => {
  page.value += 1;
  load(false);
});
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.search {
  height: 72rpx;
  background: #fff;
  border-radius: 36rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
  margin-bottom: 20rpx;
}
.ph {
  color: $text-placeholder;
}
.item {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.top {
  display: flex;
  align-items: center;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 48rpx;
  background: $cream-white;
}
.m-info {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
}
.level {
  margin-left: 12rpx;
  font-size: 20rpx;
  color: $cat-orange;
  font-weight: 400;
}
.meta {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.ops {
  margin-top: 20rpx;
  display: flex;
  justify-content: flex-end;
}
.op {
  margin-left: 16rpx;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid $border-color;
  font-size: 24rpx;
}
</style>
