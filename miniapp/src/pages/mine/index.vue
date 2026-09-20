<template>
  <view class="page">
    <view class="user-card">
      <ct-kitty class="card-paw" mode="paw" :size="200" color="#ffffff" opacity="0.18" />
      <image class="avatar" :src="fixUrl(userInfo.avatar)" mode="aspectFill" />
      <view class="u-info">
        <text class="nickname">{{ userInfo.nickname || '微信用户' }}</text>
        <text v-if="userInfo.phone" class="phone">{{ userInfo.phone }}</text>
        <button v-else class="bind-btn" open-type="getPhoneNumber" @getphonenumber="onPhone">授权手机号</button>
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
import { ref, computed, onMounted } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { getProfile, bindPhone, getMemberInfo, getOngoing } from '@/api/customer';
import { fixUrl } from '@/config';
import { price } from '@/utils/format';
import { useUserStore } from '@/store/user';
import { ensureLogin, DEFAULT_STORE_ID } from '@/utils/auth';
import CtKitty from '@/components/ct-kitty.vue';

const userStore = useUserStore();
const userInfo = ref({});
const member = ref({});
const ongoingCount = ref(0);
const storeId = computed(() => userStore.storeId || String(DEFAULT_STORE_ID));

onLoad(async () => {
  await ensureLogin();
});
onShow(async () => {
  await load();
  // 从点餐页跳转过来授权手机号（tabBar 跳转不带参数，用标记传递）
  if (userStore.pendingBind) {
    userStore.setPendingBind(false);
    if (!userInfo.value.phone) uni.showToast({ title: '请点击上方「授权手机号」', icon: 'none' });
  }
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

/** 微信一键授权手机号 */
async function onPhone(e) {
  const detail = e.detail || {};
  if (detail.code) return doBind({ code: detail.code });
  // 没拿到 code：区分「用户取消」和「授权失败（如未开通手机号快速验证权限）」
  const errMsg = String(detail.errMsg || '');
  if (/cancel|deny/i.test(errMsg)) return uni.showToast({ title: '已取消授权', icon: 'none' });
  uni.showModal({
    title: '手机号授权失败',
    content: '暂无法获取微信手机号，可改为手动输入手机号绑定',
    confirmText: '手动输入',
    cancelText: '稍后再说',
    success: (r) => r.confirm && inputPhone(),
  });
}

/** 兜底：手动输入手机号绑定 */
function inputPhone() {
  uni.showModal({
    title: '绑定手机号',
    editable: true,
    placeholderText: '请输入 11 位手机号',
    success: async (r) => {
      if (!r.confirm) return;
      const phone = String(r.content || '').trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) return uni.showToast({ title: '手机号格式不正确', icon: 'none' });
      await doBind({ phone });
    },
  });
}

async function doBind(payload) {
  try {
    await bindPhone(payload);
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
