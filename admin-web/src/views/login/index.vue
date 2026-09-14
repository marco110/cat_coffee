<template>
  <div class="login-page">
    <div class="blob b1" />
    <div class="blob b2" />
    <div class="blob b3" />
    <span v-for="d in decors" :key="d.k" class="decor" :style="d.style">{{ d.text }}</span>

    <div class="panel">
      <div class="brand">
        <div class="avatar">
          <KittyFace :size="72" color="#ff6fa5" bow="#ef3d6b" />
          <span class="bow"><i /></span>
        </div>
        <h1>爱猫咖啡</h1>
        <p>🍰 扫码点餐 · 平台管理后台 🍰</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="submit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入管理员账号" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item prop="captchaCode">
          <div class="captcha-row">
            <el-input v-model="form.captchaCode" placeholder="请输入验证码" :prefix-icon="Key" />
            <img v-if="captcha.image" class="captcha" :src="captcha.image" alt="验证码" @click="refreshCaptcha" />
          </div>
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="submit">登 录</el-button>
      </el-form>

      <div class="tip">连续 5 次密码错误账号将被锁定 15 分钟</div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Key } from '@element-plus/icons-vue';
import { getCaptcha, login } from '@/api';
import { useUserStore } from '@/store/user';
import KittyFace from '@/components/KittyFace.vue';

const DECORS = [
  { text: '🐾', left: '12%', top: '18%', delay: '0s', dur: '7s' },
  { text: '🎀', left: '82%', top: '14%', delay: '0.8s', dur: '8s' },
  { text: '💗', left: '18%', top: '72%', delay: '1.6s', dur: '9s' },
  { text: '☕', left: '78%', top: '68%', delay: '0.4s', dur: '8.5s' },
  { text: '🍓', left: '58%', top: '86%', delay: '2.2s', dur: '10s' },
  { text: '🐱', left: '38%', top: '8%', delay: '1.2s', dur: '9.5s' },
];
const decors = DECORS.map((d, i) => ({
  k: i,
  text: d.text,
  style: { left: d.left, top: d.top, animationDelay: d.delay, animationDuration: d.dur },
}));

const router = useRouter();
const store = useUserStore();
const formRef = ref();
const loading = ref(false);
const captcha = ref({ captchaId: '', image: '' });
const form = reactive({ username: '', password: '', captchaCode: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaCode: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
};

async function refreshCaptcha() {
  try {
    captcha.value = await getCaptcha();
  } catch (e) {
    /* ignore */
  }
}

async function submit() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const data = await login({
        username: form.username,
        password: form.password,
        captchaId: captcha.value.captchaId,
        captchaCode: form.captchaCode,
      });
      store.setSession({ token: data.token, user: data.user });
      ElMessage.success('欢迎回来～');
      router.push('/dashboard');
    } catch (e) {
      await refreshCaptcha();
      form.captchaCode = '';
    } finally {
      loading.value = false;
    }
  });
}

onMounted(() => refreshCaptcha());
</script>

<style scoped>
.login-page {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(150deg, #ffe0ec 0%, #fff2f7 45%, #f3fbfa 100%);
  background-image: radial-gradient(rgba(255, 111, 165, 0.16) 2px, transparent 2px),
    radial-gradient(rgba(255, 216, 77, 0.16) 2px, transparent 2px),
    linear-gradient(150deg, #ffe0ec 0%, #fff2f7 45%, #f3fbfa 100%);
  background-size: 26px 26px, 26px 26px, 100% 100%;
  background-position: 0 0, 13px 13px, 0 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(6px);
  opacity: 0.5;
}
.b1 {
  width: 240px;
  height: 240px;
  background: #ffc2da;
  top: -70px;
  left: -60px;
}
.b2 {
  width: 200px;
  height: 200px;
  background: #ffe6a3;
  bottom: -60px;
  right: -40px;
}
.b3 {
  width: 150px;
  height: 150px;
  background: #b8ece5;
  top: 45%;
  right: 12%;
}

.decor {
  position: absolute;
  font-size: 30px;
  opacity: 0.75;
  animation-name: float;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  user-select: none;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(-6deg);
  }
  50% {
    transform: translateY(-16px) rotate(8deg);
  }
}

.panel {
  position: relative;
  z-index: 2;
  width: 410px;
  background: #fff;
  border: 2px solid #ffd9e6;
  border-radius: 28px;
  padding: 34px 34px 24px;
  box-shadow: 0 18px 44px rgba(240, 72, 128, 0.18);
}
.panel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 8px;
  border-radius: 26px 26px 0 0;
  background: linear-gradient(90deg, #ff6fa5, #ffd84d 40%, #6fd3c7 70%, #b79bdd);
}

.brand {
  text-align: center;
  margin-bottom: 26px;
}
.avatar {
  position: relative;
  width: 96px;
  height: 96px;
  margin: 0 auto 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, #fff6f9, #ffe3ee);
  border: 2px dashed #ffc2da;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar :deep(.kitty-face) {
  margin-top: 2px;
}
.bow {
  position: absolute;
  top: 4px;
  right: -6px;
  width: 26px;
  height: 14px;
}
.bow::before,
.bow::after {
  content: '';
  position: absolute;
  top: 0;
  width: 12px;
  height: 14px;
  background: #ef3d6b;
}
.bow::before {
  left: 0;
  border-radius: 4px 8px 8px 4px;
  transform: rotate(-12deg);
}
.bow::after {
  right: 0;
  border-radius: 8px 4px 4px 8px;
  transform: rotate(12deg);
}
.bow i {
  position: absolute;
  left: 50%;
  top: 3px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: #ff86a8;
  z-index: 1;
}

.brand h1 {
  margin: 6px 0 4px;
  font-size: 25px;
  font-weight: 800;
  color: #f0487e;
  letter-spacing: 2px;
}
.brand p {
  margin: 0;
  font-size: 13px;
  color: #a8889c;
}

.captcha-row {
  display: flex;
  gap: 12px;
  width: 100%;
}
.captcha {
  width: 120px;
  height: 40px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid #ffd9e6;
}
.submit {
  width: 100%;
  height: 44px;
  font-size: 16px;
  letter-spacing: 4px;
}
.tip {
  margin-top: 18px;
  text-align: center;
  font-size: 12px;
  color: #a8889c;
}
</style>
