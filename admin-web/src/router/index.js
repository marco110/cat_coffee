import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/store/user';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '首页看板', icon: 'DataLine' } },
      { path: 'store', name: 'Store', component: () => import('@/views/store/list.vue'), meta: { title: '门店管理', icon: 'Shop' } },
      { path: 'store-user', name: 'StoreUser', component: () => import('@/views/storeUser/list.vue'), meta: { title: '店主账号管理', icon: 'User' } },
      { path: 'order', name: 'Order', component: () => import('@/views/order/list.vue'), meta: { title: '订单查询', icon: 'Tickets' } },
      { path: 'member-level', name: 'MemberLevel', component: () => import('@/views/memberLevel/template.vue'), meta: { title: '会员等级体系', icon: 'Medal' } },
      { path: 'config', name: 'Config', component: () => import('@/views/config/platform.vue'), meta: { title: '平台配置', icon: 'Setting' } },
      { path: 'log-operation', name: 'LogOperation', component: () => import('@/views/log/operation.vue'), meta: { title: '操作日志', icon: 'Document' } },
      { path: 'log-login', name: 'LogLogin', component: () => import('@/views/log/login.vue'), meta: { title: '登录日志', icon: 'Key' } },
      { path: 'file', name: 'File', component: () => import('@/views/file/list.vue'), meta: { title: '素材管理', icon: 'Picture' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const store = useUserStore();
  if (to.path !== '/login' && !store.isLogin) return '/login';
  if (to.path === '/login' && store.isLogin) return '/dashboard';
  return true;
});

router.afterEach((to) => {
  if (to.meta?.title) document.title = `爱猫咖啡 · ${to.meta.title}`;
});

export default router;
