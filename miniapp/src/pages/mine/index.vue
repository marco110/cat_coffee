<template>
  <view class="page">
    <view class="user-card">
      <image class="avatar" :src="fixUrl(userInfo.avatar)" mode="aspectFill" />
      <view class="u-info">
        <text class="nickname">{{ userInfo.nickname || '微信用户' }}</text>
        <text v-if="userInfo.phone" class="phone">{{ userInfo.phone }}</text>
        <button v-else class="bind-btn" open-type="getPhoneNumber" @getphonenumber="onPhone">授权手机号</button>
      </view>
    </view>

    <view class="card member" @click="go('/pages/mine/member')">
      <view class="m-left">
        <text class="m-level">{{ member.levelName || '普通会员' }}</text>
        <text class="m-tip">{{ member.nextLevel ? `还需成长值 ${member.nextLevel.needGrowth} 升级 ${member.nextLevel.name}` : '已达最高等级' }}</text>
      </view>
      <view class="m-right">
        <text class="m-points">{{ member.points || 0 }}</text>
        <text class="m-label">积分</text>
      </view>
    </view>

    <view class="card grid">
      <view class="cell" @click="goList('ONGOING')">
        <text class="c-icon">🧾</text>
        <text class="c-text">进行中</text>
      </view>
      <view class="cell" @click="goList('COMPLETED')">
        <text class="c-icon">✅</text>
        <text class="c-text">已完成</text>
      </view>
      <view class="cell" @click="go('/pages/mine/coupon')">
        <text class="c-icon">🎟️</text>
        <text class="c-text">优惠券</text>
      </view>
      <view class="cell" @click="go('/pages/mine/points')">
        <text class="c-icon">⭐</text>
        <text class="c-text">积分明细</text>
      </view>
    </view>

    <view class="card list">
      <view class="row" @click="goList('')">
        <text>我的订单</text><text class="arrow">›</text>
      </view>
      <view class="row" @click="go('/pages/coupon/center')">
        <text>领券中心</text><text class="arrow">›</text>
      </view>
      <view class="row" @click="go('/pages/merchant-entry/index')">
        <text>店主入口</text><text class="arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { getProfile, bindPhone, getMemberInfo } from '@/api/customer';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import { useUserStore } from '@/store/user';
import { ensureLogin, DEFAULT_STORE_ID } from '@/utils/auth';

const userStore = useUserStore();
const userInfo = ref({});
const member = ref({});
const storeId = computed(() => userStore.storeId || String(DEFAULT_STORE_ID));

onLoad(async (opt) => {
  await ensureLogin();
  if (opt.bind === '1') uni.showToast({ title: '请授权手机号', icon: 'none' });
});
onShow(async () => {
  await load();
});

async function load() {
  try {
    userInfo.value = await getProfile();
    userStore.setSession({ token: userStore.token, userId: userInfo.value.id, userInfo: userInfo.value });
  } catch (e) {
    /* ignore */
  }
  try {
    member.value = await getMemberInfo(storeId.value);
  } catch (e) {
    member.value = { levelName: '普通会员', points: 0 };
  }
}

async function onPhone(e) {
  const code = e.detail.code;
  if (!code) return uni.showToast({ title: '已取消授权', icon: 'none' });
  try {
    await bindPhone({ code });
    uni.showToast({ title: '绑定成功', icon: 'none' });
    await load();
  } catch (err) {
    uni.showToast({ title: err.msg || '绑定失败', icon: 'none' });
  }
}

function go(url) {
  uni.navigateTo({ url });
}
function goList(status) {
  uni.navigateTo({ url: `/pages/order/list?status=${status || ''}` });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.user-card {
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx;
  border-radius: $radius-card;
  background: linear-gradient(135deg, #7d5940, #6f4e37);
  color: #fff;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  background: rgba(255, 255, 255, 0.2);
}
.u-info {
  margin-left: 28rpx;
  display: flex;
  flex-direction: column;
}
.nickname {
  font-size: 34rpx;
  font-weight: 600;
}
.phone {
  margin-top: 8rpx;
  font-size: 26rpx;
  opacity: 0.85;
}
.bind-btn {
  margin-top: 12rpx;
  padding: 8rpx 28rpx;
  font-size: 24rpx;
  color: $coffee-brown;
  background: #fff;
  border-radius: 30rpx;
  line-height: 1.6;
}
.member {
  margin-top: 24rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.m-level {
  font-size: 32rpx;
  font-weight: 700;
  color: $coffee-brown;
}
.m-tip {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.m-right {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.m-points {
  font-size: 40rpx;
  font-weight: 700;
  color: $cat-orange;
}
.m-label {
  font-size: 22rpx;
  color: $text-secondary;
}
.grid {
  margin-top: 24rpx;
  display: flex;
  padding: 28rpx 0;
}
.cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.c-icon {
  font-size: 44rpx;
}
.c-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $text-secondary;
}
.list {
  margin-top: 24rpx;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  font-size: 28rpx;
  border-bottom: 1rpx solid $border-color;
  &:last-child {
    border-bottom: none;
  }
}
.arrow {
  color: $text-placeholder;
}
</style>
