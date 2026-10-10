<template>
  <view class="page">
    <!-- 头像卡片 -->
    <view class="head-card">
      <ct-kitty class="card-paw" mode="paw" :size="160" color="#ffffff" opacity="0.18" />
      <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image class="avatar" :src="avatarUrl" mode="aspectFill" />
        <text class="avatar-tip">点击更换</text>
      </button>
      <text class="head-tip">支持微信头像或从相册选择</text>
    </view>

    <!-- 昵称 -->
    <view class="form-card">
      <view class="f-row">
        <text class="f-label">昵称</text>
        <input
          class="f-input"
          type="nickname"
          :value="nickname"
          placeholder="想一个可爱的昵称吧"
          placeholder-class="f-ph"
          maxlength="30"
          @input="nickname = $event.detail.value"
        />
      </view>
      <view class="f-row last">
        <text class="f-label">手机号</text>
        <input
          class="f-input"
          type="number"
          maxlength="11"
          :value="phone"
          placeholder="选填，便于店主联系你"
          placeholder-class="f-ph"
          @input="phone = $event.detail.value"
        />
        <text v-if="phone" class="f-clear" @click="phone = ''">清除</text>
      </view>
      <text class="f-note">手机号非必填，仅用于店主联系；填写后可在订单中看到</text>
    </view>

    <button class="save-btn" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getProfile, updateProfile } from '@/api/customer';
import { uploadFile } from '@/api/request';
import { fixUrl } from '@/config';
import { useUserStore } from '@/store/user';
import { ensureLogin } from '@/utils/auth';
import CtKitty from '@/components/ct-kitty.vue';

const userStore = useUserStore();
const nickname = ref('');
const phone = ref('');
const avatarRemote = ref('');
const saving = ref(false);

/** 头像为空时显示包内默认头像（渐变粉猫脸） */
const DEFAULT_AVATAR = '/static/avatar/default.png';
const avatarUrl = computed(() => fixUrl(avatarRemote.value) || DEFAULT_AVATAR);

onShow(async () => {
  await ensureLogin();
  try {
    const p = await getProfile();
    fill(p);
  } catch (e) {
    /* ignore */
  }
});

function fill(p) {
  avatarRemote.value = p.avatar || '';
  nickname.value = p.nickname || '';
  phone.value = p.phone || '';
  userStore.setSession({ token: userStore.token, userId: p.id, userInfo: p });
}

/** 微信头像填写能力：回调为本地临时文件，上传后换 URL */
async function onChooseAvatar(e) {
  const file = (e.detail && e.detail.avatarUrl) || '';
  if (!file) return;
  uni.showLoading({ title: '上传中', mask: true });
  try {
    const url = await uploadFile(file, { auth: 'customer', bizType: 'AVATAR' });
    avatarRemote.value = url;
    uni.hideLoading();
  } catch (err) {
    uni.hideLoading();
    return uni.showToast({ title: err.msg || '头像上传失败', icon: 'none' });
  }
}

async function save() {
  const name = String(nickname.value || '').trim();
  if (!name) return uni.showToast({ title: '昵称不能为空', icon: 'none' });
  const p = String(phone.value || '').trim();
  if (p && !/^1[3-9]\d{9}$/.test(p)) return uni.showToast({ title: '手机号格式不正确', icon: 'none' });
  if (saving.value) return;
  saving.value = true;
  try {
    const data = await updateProfile({ nickname: name, avatar: avatarRemote.value, phone: p });
    fill(data);
    uni.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 600);
  } catch (err) {
    uni.showToast({ title: err.msg || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
}
.head-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 40rpx;
  border-radius: $radius-card;
  background: $grad-brand;
}
.card-paw {
  position: absolute;
  right: -20rpx;
  bottom: -30rpx;
}
.avatar-btn {
  position: relative;
  z-index: 2;
  width: 160rpx;
  height: 160rpx;
  padding: 0;
  margin: 0;
  border-radius: 80rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.2);
  &::after {
    border: none;
  }
}
.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 80rpx;
}
.avatar-tip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 44rpx;
  line-height: 44rpx;
  font-size: 22rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  text-align: center;
}
.head-tip {
  position: relative;
  z-index: 2;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}
.form-card {
  margin-top: 24rpx;
  padding: 0 32rpx;
  border-radius: $radius-card;
  background: #fff;
}
.f-row {
  display: flex;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1rpx solid $border-color;
  &.last {
    border-bottom: none;
  }
}
.f-label {
  width: 140rpx;
  font-size: 28rpx;
  color: $text-primary;
}
.f-input {
  flex: 1;
  font-size: 28rpx;
  color: $text-primary;
}
.f-ph {
  color: $text-placeholder;
}
.f-clear {
  padding: 4rpx 20rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: $pink-dark;
  background: $cream-white;
}
.f-note {
  display: block;
  padding-bottom: 28rpx;
  font-size: 22rpx;
  color: $text-placeholder;
}
.save-btn {
  margin-top: 48rpx;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 46rpx;
  font-size: 32rpx;
  color: #fff;
  background: $grad-brand;
  &::after {
    border: none;
  }
}
</style>
