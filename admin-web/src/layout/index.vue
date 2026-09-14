<template>
  <div class="layout">
    <aside class="cc-sidebar" :style="{ width: collapsed ? '64px' : '210px' }">
      <div class="logo">
        <span class="logo-icon">🐾</span>
        <span v-if="!collapsed" class="logo-text">爱猫咖啡 · 超管</span>
      </div>
      <el-menu
        class="menu"
        background-color="#6F4E37"
        text-color="#E8DCD0"
        active-text-color="#FFFFFF"
        :default-active="activePath"
        :collapse="collapsed"
        :collapse-transition="false"
        router
      >
        <el-menu-item v-for="m in MENUS" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
    </aside>

    <section class="main">
      <header class="navbar">
        <el-icon class="fold" @click="collapsed = !collapsed">
          <component :is="collapsed ? 'Expand' : 'Fold'" />
        </el-icon>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>平台管理</el-breadcrumb-item>
          <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="right">
          <el-dropdown @command="onCommand">
            <span class="user">
              <el-icon><UserFilled /></el-icon>
              <span class="name">{{ user?.realName || user?.username || '管理员' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </section>

    <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
      <el-form :model="pwdForm" label-width="90px">
        <el-form-item label="原密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="pwdForm.confirmPassword" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { updatePassword } from '@/api';
import { useUserStore } from '@/store/user';

const MENUS = [
  { path: '/dashboard', title: '首页看板', icon: 'DataLine' },
  { path: '/store', title: '门店管理', icon: 'Shop' },
  { path: '/store-user', title: '店主账号管理', icon: 'User' },
  { path: '/order', title: '订单查询', icon: 'Tickets' },
  { path: '/member-level', title: '会员等级体系', icon: 'Medal' },
  { path: '/config', title: '平台配置', icon: 'Setting' },
  { path: '/log-operation', title: '操作日志', icon: 'Document' },
  { path: '/log-login', title: '登录日志', icon: 'Key' },
  { path: '/file', title: '素材管理', icon: 'Picture' },
];

const route = useRoute();
const router = useRouter();
const store = useUserStore();
const user = computed(() => store.user);
const collapsed = ref(false);
const activePath = computed(() => route.path);

const pwdVisible = ref(false);
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });

async function submitPassword() {
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    return ElMessage.warning('两次输入的密码不一致');
  }
  if (pwdForm.value.newPassword.length < 6) return ElMessage.warning('新密码至少 6 位');
  await updatePassword({ oldPassword: pwdForm.value.oldPassword, newPassword: pwdForm.value.newPassword });
  ElMessage.success('密码修改成功，请重新登录');
  pwdVisible.value = false;
  doLogout();
}

function doLogout() {
  store.logout();
  router.push('/login');
}

function onCommand(cmd) {
  if (cmd === 'password') {
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    pwdVisible.value = true;
  } else if (cmd === 'logout') {
    doLogout();
  }
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100%;
}
.cc-sidebar {
  background: #6f4e37;
  transition: width 0.2s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.logo-icon {
  font-size: 22px;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}
.menu {
  flex: 1;
  overflow-y: auto;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.navbar {
  height: 60px;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.fold {
  font-size: 20px;
  cursor: pointer;
  color: #6f4e37;
}
.right {
  margin-left: auto;
}
.user {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #3d2c1e;
}
.content {
  flex: 1;
  overflow: auto;
}
</style>
