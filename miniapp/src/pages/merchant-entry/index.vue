<template>
  <view class="page">
    <view class="hero">
      <text class="h-title">12卡coffee · 店主端</text>
      <text class="h-sub">接单、改单、管菜单、看经营数据</text>
    </view>

    <!-- 已登录：直接进入工作台 -->
    <view v-if="status === 'ok' && userStore.isMerchantLogin" class="card info">
      <text class="store">{{ userStore.merchantStore?.name }}</text>
      <text class="who">{{ userStore.merchantInfo?.realName }}（{{ roleText }}）</text>
      <view class="btn" @click="go('/subpackages/merchant/dashboard/index')">进入工作台</view>
      <view class="btn ghost" @click="logout">退出登录</view>
    </view>

    <!-- 账号已失效（被后台删除/禁用） -->
    <view v-else-if="status === 'removed'" class="card info">
      <text class="store warn">账号已失效</text>
      <text class="tip">您已不是店主/店员，请联系管理员处理</text>
      <view class="btn ghost" @click="logout">清除本地记录</view>
    </view>

    <!-- 未登录：账号密码登录（首次登录会绑定微信，之后自动识别免密进入） -->
    <view v-else class="card form">
      <text class="form-title">店主登录</text>
      <view class="field">
        <text class="label">手机号</text>
        <input v-model="form.phone" class="input" type="number" maxlength="11" placeholder="请输入手机号" placeholder-class="ph" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input v-model="form.password" class="input" password placeholder="请输入密码" placeholder-class="ph" />
      </view>
      <view class="login-btn" :class="{ loading: loading }" @click="submit">{{ loading ? '登录中...' : '登录' }}</view>
      <text class="tip">忘记密码请联系平台管理员重置</text>
    </view>

    <view class="card features">
      <view class="f"><text>⚡</text><text>新订单实时提醒</text></view>
      <view class="f"><text>✏️</text><text>随时改单、退款提示</text></view>
      <view class="f"><text>📊</text><text>营业额与热销分析</text></view>
      <view class="f"><text>🎟️</text><text>优惠券与会员运营</text></view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { ensureMerchant, wxLoginCode } from '@/utils/merchant-auth';
import { merchantLogin } from '@/api/merchant';

const userStore = useUserStore();
// 'init' | 'ok' | 'none' | 'removed'
const status = ref('init');
const roleText = computed(() => ({ OWNER: '店主', STAFF: '店员' }[userStore.merchantInfo?.role] || ''));

const form = ref({ phone: '', password: '' });
const loading = ref(false);

onShow(async () => {
  userStore.restore();
  // 已登录：直接进工作台，不展示店主入口页（点击「店主入口」时也已在前端短路）
  if (userStore.isMerchantLogin) {
    uni.redirectTo({ url: '/subpackages/merchant/dashboard/index' });
    return;
  }
  // 未登录：凭 openid 自动识别（无需密码、无需处理过期）
  status.value = await ensureMerchant();
});

async function submit() {
  if (!/^1[3-9]\d{9}$/.test(form.value.phone)) return uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
  if (!form.value.password) return uni.showToast({ title: '请输入密码', icon: 'none' });
  loading.value = true;
  try {
    // 带 wx.login code，便于后台首次绑定 openid，之后凭 openid 自动识别身份
    let code = '';
    try {
      code = await wxLoginCode();
    } catch (e) {
      /* 拿不到 code 也能登录，只是本次不绑定 openid */
    }
    const data = await merchantLogin({ ...form.value, code });
    userStore.setMerchant({ token: data.token, user: data.user, store: data.store });
    status.value = 'ok';
    uni.showToast({ title: '登录成功', icon: 'none' });
    setTimeout(() => uni.redirectTo({ url: '/subpackages/merchant/dashboard/index' }), 400);
  } catch (e) {
    uni.showToast({ title: e.msg || '登录失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function go(url) {
  uni.navigateTo({ url });
}
function logout() {
  userStore.clearMerchant();
  status.value = 'none';
  uni.showToast({ title: '已清除', icon: 'none' });
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
}
.hero {
  padding: 60rpx 40rpx;
  border-radius: $radius-card;
  background: $grad-brand;
  color: #fff;
}
.h-title {
  font-size: 42rpx;
  font-weight: 700;
}
.h-sub {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  opacity: 0.85;
}
.info {
  margin-top: 32rpx;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.store {
  font-size: 34rpx;
  font-weight: 700;
  &.warn {
    color: $coffee-brown;
  }
}
.who {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.tip {
  font-size: 26rpx;
  color: $text-secondary;
  margin-bottom: 32rpx;
}
.btn {
  margin-top: 28rpx;
  width: 100%;
  height: 88rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  &.ghost {
    background: #fff;
    color: $text-secondary;
    border: 1rpx solid $border-color;
  }
}
.form {
  margin-top: 32rpx;
  background: #fff;
  border-radius: $radius-card;
  padding: 48rpx 40rpx;
  box-shadow: $shadow-pop;
}
.form-title {
  font-size: 34rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}
.field {
  margin-bottom: 32rpx;
}
.label {
  font-size: 26rpx;
  color: $text-secondary;
}
.input {
  margin-top: 12rpx;
  height: 88rpx;
  border-bottom: 1rpx solid $border-color;
  font-size: 30rpx;
}
.ph {
  color: $text-placeholder;
}
.login-btn {
  margin-top: 40rpx;
  height: 92rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}
.features {
  margin-top: 32rpx;
  padding: 24rpx 32rpx;
}
.f {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: $text-secondary;
  text:nth-child(1) {
    margin-right: 16rpx;
    font-size: 32rpx;
  }
}
</style>
