import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 通用组件：全局注册（本项目 pages.json 的 easycom 规则在 CLI 构建下不生效，
// 组件不会被打进产物，因此在 main.js 统一注册，编译后会写入 app.json 的 usingComponents）
import CtCartBar from '@/components/ct-cart-bar.vue';
import CtDishItem from '@/components/ct-dish-item.vue';
import CtEmpty from '@/components/ct-empty.vue';
import CtKitty from '@/components/ct-kitty.vue';
import CtQty from '@/components/ct-qty.vue';
import CtSpecPopup from '@/components/ct-spec-popup.vue';
import CtStatusTag from '@/components/ct-status-tag.vue';

const GLOBAL_COMPONENTS = {
  'ct-cart-bar': CtCartBar,
  'ct-dish-item': CtDishItem,
  'ct-empty': CtEmpty,
  'ct-kitty': CtKitty,
  'ct-qty': CtQty,
  'ct-spec-popup': CtSpecPopup,
  'ct-status-tag': CtStatusTag,
};

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  Object.entries(GLOBAL_COMPONENTS).forEach(([name, comp]) => app.component(name, comp));
  return { app };
}
