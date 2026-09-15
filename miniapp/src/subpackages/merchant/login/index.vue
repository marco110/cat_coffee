<template>
  <view class="page">
    <ct-kitty class="bg-paw" mode="paw" :size="320" color="#ffffff" opacity="0.16" />
    <view class="brand">
      <view class="avatar">
        <ct-kitty mode="face" :size="110" color="#ff6fa5" bow-color="#ef3d6b" />
      </view>
      <text class="name">爱猫咖啡 · 店主端</text>
      <text class="sub">🎀 请使用超管开通的账号登录 🐾</text>
    </view>

    <view class="form">
      <view class="field">
        <text class="label">手机号</text>
        <input v-model="form.phone" class="input" type="number" maxlength="11" placeholder="请输入手机号" placeholder-class="ph" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input v-model="form.password" class="input" password placeholder="请输入密码" placeholder-class="ph" />
      </view>
      <view class="login-btn" :class="{ loading: loading }" @click="submit">{{ loading ? '登录中...' : '登录' }}</view>
      <view class="tip">忘记密码请联系平台管理员重置</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { merchantLogin } from '@/api/merchant';
import { useUserStore } from '@/store/user';
import CtKitty from '@/components/ct-kitty.vue';

const userStore = useUserStore();
const form = ref({ phone: '', password: '' });
const loading = ref(false);

async function submit() {
  if (!/^1[3-9]\d{9}$/.test(form.value.phone)) return uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
  if (!form.value.password) return uni.showToast({ title: '请输入密码', icon: 'none' });
  loading.value = true;
  try {
    const data = await merchantLogin(form.value);
    userStore.setMerchant({ token: data.token, user: data.user, store: data.store });
    uni.showToast({ title: '登录成功', icon: 'none' });
    setTimeout(() => uni.redirectTo({ url: '/subpackages/merchant/dashboard/index' }), 400);
  } catch (e) {
    uni.showToast({ title: e.msg || '登录失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page {
  position: relative;
  min-height: 100vh;
  padding: 0 60rpx;
  overflow: hidden;
  background: linear-gradient(180deg, #ff8fb8 0%, #ff6fa5 300rpx, $bg-page 300rpx);
}
.bg-paw {
  position: absolute;
  right: -40rpx;
  top: 40rpx;
  z-index: 0;
}
.brand {
  position: relative;
  z-index: 1;
  padding: 80rpx 0 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}
.avatar {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: #fff;
  border: 4rpx dashed rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(240, 72, 128, 0.25);
}
.logo {
  font-size: 90rpx;
}
.name {
  margin-top: 20rpx;
  font-size: 40rpx;
  font-weight: 700;
}
.sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.8;
}
.form {
  position: relative;
  z-index: 1;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  box-shadow: $shadow-pop;
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
.tip {
  margin-top: 28rpx;
  text-align: center;
  font-size: 24rpx;
  color: $text-secondary;
}
</style>
