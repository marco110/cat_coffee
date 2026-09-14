<template>
  <div class="layout">
    <aside class="cc-sidebar" :style="{ width: collapsed ? '72px' : '214px' }">
      <div class="logo">
        <KittyFace :size="collapsed ? 30 : 34" color="#ffffff" bow="#ffd84d" />
        <span v-if="!collapsed" class="logo-text">爱猫咖啡<span class="logo-sub">超管后台</span></span>
      </div>
      <el-menu
        class="menu"
        text-color="#fff"
        active-text-color="#F0487E"
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
      <div v-if="!collapsed" class="side-foot">🎀 今日也要元气满满 🐾</div>
    </aside>

    <section class="main">
      <header class="navbar">
        <el-icon class="fold" @click="collapsed = !collapsed">
          <component :is="collapsed ? 'Expand' : 'Fold'" />
        </el-icon>
        <el-breadcrumb separator="🎀">
          <el-breadcrumb-item>平台管理</el-breadcrumb-item>
          <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="right">
          <el-dropdown @command="onCommand">
            <span class="user">
              <span class="avatar"><el-icon><UserFilled /></el-icon></span>
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
import KittyFace from '@/components/KittyFace.vue';

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
  position: relative;
  background: linear-gradient(180deg, #ff8fb8 0%, #ff6fa5 48%, #ef3d6b 100%);
  transition: width 0.24s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 18px rgba(240, 72, 128, 0.18);
}
/* 侧边栏圆点暗纹 */
.cc-sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.22) 2px, transparent 2px);
  background-size: 22px 22px;
  pointer-events: none;
}
.logo {
  position: relative;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.35);
}
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  font-size: 16px;
  font-weight: 800;
  white-space: nowrap;
}
.logo-sub {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.85;
}
.menu {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.side-foot {
  position: relative;
  padding: 14px 10px 18px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  border-top: 1px dashed rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.navbar {
  height: 64px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  border-bottom: 1px solid var(--cc-border);
  box-shadow: 0 2px 12px rgba(240, 72, 128, 0.06);
}
.fold {
  font-size: 20px;
  cursor: pointer;
  color: var(--cc-pink);
}
.right {
  margin-left: auto;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--cc-text);
  font-weight: 600;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  transition: background 0.2s;
}
.user:hover {
  background: var(--cc-pink-soft);
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #ff9bc2, #ff6fa5);
  box-shadow: 0 3px 8px rgba(240, 72, 128, 0.3);
}
.content {
  flex: 1;
  overflow: auto;
}
</style>
