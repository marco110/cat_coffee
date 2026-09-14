import { defineStore } from 'pinia';

const KEY = 'cc_user';
const MKEY = 'cc_merchant';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userId: '',
    userInfo: null,
    // 扫码场景：s{storeId}t{tableId}
    scene: '',
    storeId: '',
    tableId: '',
    tableNo: '',
    orderType: 'TAKEAWAY',
    merchantToken: '',
    merchantInfo: null,
    merchantStore: null,
  }),
  getters: {
    isLogin: (s) => !!s.token,
    needBindPhone: (s) => !!s.token && !(s.userInfo && s.userInfo.phone),
    isMerchantLogin: (s) => !!s.merchantToken,
  },
  actions: {
    restore() {
      try {
        const raw = uni.getStorageSync(KEY);
        if (raw) Object.assign(this, JSON.parse(raw));
        const m = uni.getStorageSync(MKEY);
        if (m) Object.assign(this, JSON.parse(m));
      } catch (e) {
        /* ignore */
      }
    },
    setSession({ token, userId, userInfo }) {
      this.token = token || '';
      this.userId = userId || '';
      this.userInfo = userInfo || null;
      this.persist();
    },
    setScene(scene) {
      const m = /^s(\d+)t(\d+)$/.exec(String(scene).trim());
      this.scene = scene;
      if (m) {
        this.storeId = m[1];
        this.tableId = m[2];
      }
      this.persist();
    },
    setStore({ storeId, tableId, tableNo, orderType }) {
      if (storeId) this.storeId = String(storeId);
      if (tableId !== undefined) this.tableId = String(tableId || '');
      if (tableNo !== undefined) this.tableNo = tableNo || '';
      if (orderType) this.orderType = orderType;
      this.persist();
    },
    setMerchant({ token, user, store }) {
      this.merchantToken = token || '';
      this.merchantInfo = user || null;
      this.merchantStore = store || null;
      this.persistMerchant();
    },
    clear() {
      this.token = '';
      this.userId = '';
      this.userInfo = null;
      uni.removeStorageSync(KEY);
    },
    clearMerchant() {
      this.merchantToken = '';
      this.merchantInfo = null;
      this.merchantStore = null;
      uni.removeStorageSync(MKEY);
    },
    persist() {
      uni.setStorageSync(
        KEY,
        JSON.stringify({
          token: this.token,
          userId: this.userId,
          userInfo: this.userInfo,
          scene: this.scene,
          storeId: this.storeId,
          tableId: this.tableId,
          tableNo: this.tableNo,
          orderType: this.orderType,
        })
      );
    },
    persistMerchant() {
      uni.setStorageSync(
        MKEY,
        JSON.stringify({
          merchantToken: this.merchantToken,
          merchantInfo: this.merchantInfo,
          merchantStore: this.merchantStore,
        })
      );
    },
  },
});
