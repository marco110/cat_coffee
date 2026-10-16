import { defineStore } from 'pinia';
import { getAppConfig } from '@/api/customer';

const CACHE_KEY = 'app_mode_cache';

export const useAppStore = defineStore('app', {
  state: () => ({
    // 本地缓存兜底，保证审核版本在无网/首屏也能稳定呈现
    mode: uni.getStorageSync(CACHE_KEY) || 'PROD',
  }),
  getters: {
    isReview: (s) => s.mode === 'REVIEW',
    isProd: (s) => s.mode === 'PROD',
  },
  actions: {
    async loadAppConfig() {
      try {
        const data = await getAppConfig();
        const mode = data && data.mode === 'REVIEW' ? 'REVIEW' : 'PROD';
        if (mode !== this.mode) this.mode = mode;
        uni.setStorageSync(CACHE_KEY, this.mode);
      } catch (e) {
        // 网络异常时保留本地缓存值，不阻断首屏
        this.mode = 'REVIEW';
        uni.setStorageSync(CACHE_KEY, 'REVIEW');
      }
    },
  },
});
