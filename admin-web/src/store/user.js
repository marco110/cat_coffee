import { defineStore } from 'pinia';

export const useUserStore = defineStore('adminUser', {
  state: () => ({
    token: localStorage.getItem('cc_admin_token') || '',
    user: JSON.parse(localStorage.getItem('cc_admin_user') || 'null'),
  }),
  getters: {
    isLogin: (s) => !!s.token,
  },
  actions: {
    setSession({ token, user }) {
      this.token = token;
      this.user = user;
      localStorage.setItem('cc_admin_token', token);
      localStorage.setItem('cc_admin_user', JSON.stringify(user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('cc_admin_token');
      localStorage.removeItem('cc_admin_user');
    },
  },
});
