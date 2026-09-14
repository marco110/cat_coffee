import { defineStore } from 'pinia';

/** 购物车：同一菜品 + 不同规格视为不同行 */
function makeKey(item) {
  return [item.dishId, (item.specItemIds || []).slice().sort().join('-'), (item.addonIds || []).slice().sort().join('-'), item.remark || ''].join('|');
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    storeId: '',
    items: [],
  }),
  getters: {
    count: (s) => s.items.reduce((n, i) => n + i.quantity, 0),
    goodsAmount(s) {
      const total = s.items.reduce((sum, i) => sum + (i.unitPrice + (i.addonAmount || 0)) * i.quantity, 0);
      return Math.round(total * 100) / 100;
    },
  },
  actions: {
    bindStore(storeId) {
      if (this.storeId && String(this.storeId) !== String(storeId)) this.clear();
      this.storeId = String(storeId);
    },
    add(dish, { specItemIds = [], specText = '', specExtra = 0, addons = [], quantity = 1, remark = '' } = {}) {
      const addonAmount = addons.reduce((s, a) => s + (a.price || 0), 0);
      const payload = {
        dishId: String(dish.id),
        name: dish.name,
        cover: dish.cover,
        unitPrice: Math.round((dish.price + specExtra) * 100) / 100,
        specItemIds,
        specText,
        addonIds: addons.map((a) => a.id),
        addonAmount: Math.round(addonAmount * 100) / 100,
        remark,
        quantity,
      };
      payload.key = makeKey(payload);
      const exist = this.items.find((i) => i.key === payload.key);
      if (exist) exist.quantity = Math.min(99, exist.quantity + quantity);
      else this.items.push(payload);
    },
    setQuantity(key, quantity) {
      const item = this.items.find((i) => i.key === key);
      if (!item) return;
      if (quantity <= 0) return this.remove(key);
      item.quantity = Math.min(99, quantity);
    },
    remove(key) {
      this.items = this.items.filter((i) => i.key !== key);
    },
    clear() {
      this.items = [];
    },
    /** 提交订单所需的精简结构 */
    toPayload() {
      return this.items.map((i) => ({
        dishId: i.dishId,
        quantity: i.quantity,
        specItemIds: i.specItemIds || [],
        addonIds: i.addonIds || [],
        remark: i.remark || '',
      }));
    },
  },
});
