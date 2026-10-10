<template>
  <view class="page">
    <view class="user-card" @click="go('/pages/mine/profile')">
      <ct-kitty class="card-paw" mode="paw" :size="200" color="#ffffff" opacity="0.18" />
      <image class="avatar" :src="avatarUrl" mode="aspectFill" />
      <view class="u-info">
        <text class="nickname">{{ userInfo.nickname || '爱猫咖啡用户' }}</text>
        <text class="phone" :class="{ empty: !userInfo.phone }">
          {{ userInfo.phone || '手机号未填写' }}
        </text>
      </view>
      <view class="u-edit">
        <text class="edit-txt">编辑资料</text>
        <text class="arrow">›</text>
      </view>
      <ct-kitty class="card-kitty" mode="face" :size="110" color="#ffffff" bow-color="#ffd84d" />
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
        <view class="c-icon-wrap">
          <text class="c-icon">🧾</text>
          <text v-if="ongoingCount" class="badge">{{ ongoingCount > 99 ? '99+' : ongoingCount }}</text>
        </view>
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
import { ref, computed } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { getProfile, getMemberInfo, getOngoing } from '@/api/customer';
import { fixUrl } from '@/config';
import { useUserStore } from '@/store/user';
import { ensureLogin, DEFAULT_STORE_ID } from '@/utils/auth';
import CtKitty from '@/components/ct-kitty.vue';

const userStore = useUserStore();
const userInfo = ref({});
const member = ref({});
const ongoingCount = ref(0);
const storeId = computed(() => userStore.storeId || String(DEFAULT_STORE_ID));

/** 头像为空时显示包内默认头像（渐变粉猫脸） */
const DEFAULT_AVATAR = '/static/avatar/default.png';
const avatarUrl = computed(() => fixUrl(userInfo.value.avatar) || DEFAULT_AVATAR);

onLoad(async () => {
  await ensureLogin();
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
  loadOngoing();
}

/** 进行中订单数（PENDING/ACCEPTED/MAKING/READY） */
async function loadOngoing() {
  try {
    const data = await getOngoing();
    ongoingCount.value = Number(data.count) || 0;
  } catch (e) {
    ongoingCount.value = 0;
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
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx;
  border-radius: $radius-card;
  background: $grad-brand;
  color: #fff;
}
.card-paw {
  position: absolute;
  right: -30rpx;
  bottom: -40rpx;
  z-index: 0;
}
.card-kitty {
  position: relative;
  z-index: 1;
  margin-left: auto;
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
  &.empty {
    opacity: 0.6;
  }
}
.u-edit {
  margin-left: auto;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  padding: 8rpx 0 8rpx 24rpx;
  .edit-txt {
    font-size: 24rpx;
    opacity: 0.9;
  }
  .arrow {
    margin-left: 6rpx;
    color: rgba(255, 255, 255, 0.9);
  }
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
.c-icon-wrap {
  position: relative;
}
.c-icon {
  font-size: 44rpx;
}
.badge {
  position: absolute;
  top: -10rpx;
  right: -22rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 6rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: $pink-dark;
  color: #fff;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
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
