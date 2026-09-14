<template>
  <div class="login-page">
    <div class="panel">
      <div class="brand">
        <div class="logo">🐾</div>
        <h1>爱猫咖啡</h1>
        <p>扫码点餐 · 平台管理后台</p>
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
      ElMessage.success('登录成功');
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
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6f4e37 0%, #4a3527 100%);
}
.panel {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.brand {
  text-align: center;
  margin-bottom: 28px;
}
.logo {
  font-size: 48px;
}
.brand h1 {
  margin: 8px 0 4px;
  font-size: 24px;
  color: #6f4e37;
}
.brand p {
  margin: 0;
  font-size: 13px;
  color: #9c8b7a;
}
.captcha-row {
  display: flex;
  gap: 12px;
  width: 100%;
}
.captcha {
  width: 120px;
  height: 40px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #ede4d9;
}
.submit {
  width: 100%;
}
.tip {
  margin-top: 20px;
  text-align: center;
  font-size: 12px;
  color: #9c8b7a;
}
</style>
