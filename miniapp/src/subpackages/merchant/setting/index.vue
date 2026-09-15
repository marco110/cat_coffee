<template>
  <view class="page">
    <view class="card block">
      <view class="bt">门店信息</view>
      <view class="row"><text class="label">门店名称</text><input v-model="store.name" class="input" placeholder-class="ph" /></view>
      <view class="row"><text class="label">联系电话</text><input v-model="store.phone" class="input" placeholder-class="ph" /></view>
      <view class="row"><text class="label">省 / 市 / 区</text>
        <view class="inline">
          <input v-model="store.province" class="mini" placeholder="省" placeholder-class="ph" />
          <input v-model="store.city" class="mini" placeholder="市" placeholder-class="ph" />
          <input v-model="store.district" class="mini" placeholder="区" placeholder-class="ph" />
        </view>
      </view>
      <view class="row"><text class="label">详细地址</text><input v-model="store.address" class="input" placeholder-class="ph" /></view>
      <view class="row"><text class="label">营业开始</text><input v-model="store.businessHoursStart" class="input" placeholder="09:00" placeholder-class="ph" /></view>
      <view class="row"><text class="label">营业结束</text><input v-model="store.businessHoursEnd" class="input" placeholder="22:00" placeholder-class="ph" /></view>
      <view class="row"><text class="label">门店公告</text><textarea v-model="store.announcement" class="textarea" placeholder-class="ph" /></view>
      <view class="save" @click="saveStore">保存门店信息</view>
    </view>

    <view class="card block">
      <view class="bt">经营设置</view>
      <view class="row"><text class="label">营业状态</text><switch :checked="store.businessStatus === 1" color="#FF6FA5" @change="onBusiness" /></view>
      <view class="row"><text class="label">自动接单</text><switch :checked="c.autoAcceptOrder" color="#FF6FA5" @change="(e) => (c.autoAcceptOrder = e.detail.value)" /></view>
      <view class="row"><text class="label">展示销量</text><switch :checked="c.showSales" color="#FF6FA5" @change="(e) => (c.showSales = e.detail.value)" /></view>
      <view class="row"><text class="label">展示售罄菜品</text><switch :checked="c.showSoldOutDish" color="#FF6FA5" @change="(e) => (c.showSoldOutDish = e.detail.value)" /></view>
      <view class="row"><text class="label">会员功能</text><switch :checked="c.memberEnabled" color="#FF6FA5" @change="(e) => (c.memberEnabled = e.detail.value)" /></view>
      <view class="row"><text class="label">积分功能</text><switch :checked="c.pointsEnabled" color="#FF6FA5" @change="(e) => (c.pointsEnabled = e.detail.value)" /></view>
      <view class="row"><text class="label">1 元 = N 积分</text><input v-model="c.pointsRate" class="input" type="digit" placeholder-class="ph" /></view>
      <view class="row"><text class="label">1 元 = N 成长值</text><input v-model="c.growthRate" class="input" type="digit" placeholder-class="ph" /></view>
      <view class="row"><text class="label">多少积分 = 1 元</text><input v-model="c.pointsDeductRatio" class="input" type="number" placeholder-class="ph" /></view>
      <view class="row"><text class="label">积分抵扣上限（%）</text><input v-model="c.pointsDeductMaxRate" class="input" type="digit" placeholder="0 表示不限" placeholder-class="ph" /></view>
      <view class="row"><text class="label">抵扣最小单位（分）</text><input v-model="c.pointsDeductStep" class="input" type="number" placeholder-class="ph" /></view>
      <view class="save" @click="saveConfig">保存经营设置</view>
    </view>

    <view class="card block">
      <view class="bt">
        <text>店员账号</text>
        <text class="add" @click="addUser">+ 添加</text>
      </view>
      <view v-for="u in users" :key="u.id" class="user">
        <view class="u-info">
          <text class="u-name">{{ u.realName }} <text class="u-role">{{ ROLE[u.role] }}</text></text>
          <text class="u-meta">{{ u.phone }} · {{ u.status === 1 ? '启用' : '停用' }}</text>
        </view>
        <text class="op" @click="resetPwd(u)">重置密码</text>
      </view>
      <ct-empty v-if="!users.length" text="暂无店员账号" />
    </view>

    <view class="logout" @click="logout">退出登录</view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { storeInfo, updateStoreInfo, updateStoreConfig, updateBusinessStatus, storeUserList, createStoreUser, resetStoreUserPassword } from '@/api/merchant';
import { useUserStore } from '@/store/user';
import CtEmpty from '@/components/ct-empty.vue';

const ROLE = { OWNER: '店主', STAFF: '店员' };
const userStore = useUserStore();
const store = ref({});
const c = reactive({
  autoAcceptOrder: false,
  showSales: true,
  showSoldOutDish: true,
  memberEnabled: true,
  pointsEnabled: true,
  pointsRate: 1,
  growthRate: 1,
  pointsDeductRatio: 100,
  pointsDeductMaxRate: 30,
  pointsDeductStep: 100,
});
const users = ref([]);

async function load() {
  const d = await storeInfo();
  store.value = d || {};
  const bool = (v, def = false) => (v === undefined || v === null ? def : Number(v) === 1);
  c.autoAcceptOrder = bool(d.autoAcceptOrder, false);
  c.showSales = bool(d.showSales, true);
  c.showSoldOutDish = bool(d.showSoldOutDish, true);
  c.memberEnabled = bool(d.memberEnabled, true);
  c.pointsEnabled = bool(d.pointsEnabled, true);
  c.pointsRate = Number(d.pointsRate ?? 1);
  c.growthRate = Number(d.growthRate ?? 1);
  c.pointsDeductRatio = Number(d.pointsDeductRatio ?? 100);
  c.pointsDeductMaxRate = Number(d.pointsDeductMaxRate ?? 30);
  c.pointsDeductStep = Number(d.pointsDeductStep ?? 100);
  users.value = await storeUserList();
}

async function saveStore() {
  await updateStoreInfo({
    name: store.value.name,
    phone: store.value.phone,
    province: store.value.province,
    city: store.value.city,
    district: store.value.district,
    address: store.value.address,
    businessHoursStart: store.value.businessHoursStart,
    businessHoursEnd: store.value.businessHoursEnd,
    announcement: store.value.announcement,
  });
  uni.showToast({ title: '已保存', icon: 'none' });
}

async function saveConfig() {
  await updateStoreConfig({
    autoAcceptOrder: c.autoAcceptOrder ? 1 : 0,
    showSales: c.showSales ? 1 : 0,
    showSoldOutDish: c.showSoldOutDish ? 1 : 0,
    memberEnabled: c.memberEnabled ? 1 : 0,
    pointsEnabled: c.pointsEnabled ? 1 : 0,
    pointsRate: Number(c.pointsRate),
    growthRate: Number(c.growthRate),
    pointsDeductRatio: Number(c.pointsDeductRatio),
    pointsDeductMaxRate: Number(c.pointsDeductMaxRate),
    pointsDeductStep: Number(c.pointsDeductStep),
  });
  uni.showToast({ title: '已保存', icon: 'none' });
}

async function onBusiness(e) {
  const status = e.detail.value ? 1 : 0;
  store.value.businessStatus = status;
  await updateBusinessStatus(status);
}

function addUser() {
  uni.showModal({
    title: '添加店员',
    editable: true,
    placeholderText: '姓名,手机号,角色(OWNER/STAFF)',
    success: async (r) => {
      if (!r.confirm || !r.content) return;
      const [realName, phone, role] = r.content.split(/[,，]/).map((s) => s.trim());
      try {
        await createStoreUser({ realName, phone, role: role || 'STAFF' });
        uni.showToast({ title: '已添加，初始密码 123456', icon: 'none', duration: 2500 });
        load();
      } catch (err) {
        uni.showToast({ title: err.msg || '添加失败', icon: 'none' });
      }
    },
  });
}

async function resetPwd(u) {
  uni.showModal({
    title: '重置密码',
    content: `确认将 ${u.realName} 的密码重置为 123456？`,
    success: async (r) => {
      if (!r.confirm) return;
      await resetStoreUserPassword(u.id);
      uni.showToast({ title: '已重置为 123456', icon: 'none' });
      load();
    },
  });
}

function logout() {
  userStore.clearMerchant();
  uni.reLaunch({ url: '/pages/merchant-entry/index' });
}

onMounted(() => load());
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 80rpx;
}
.block {
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.bt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.add {
  font-size: 24rpx;
  color: $coffee-brown;
  font-weight: 400;
}
.row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $border-color;
}
.label {
  width: 260rpx;
  font-size: 26rpx;
  color: $text-secondary;
}
.input {
  flex: 1;
  font-size: 28rpx;
  text-align: right;
}
.inline {
  flex: 1;
  display: flex;
}
.mini {
  width: 30%;
  font-size: 26rpx;
  text-align: center;
  border-bottom: 1rpx solid $border-color;
  margin-right: 3%;
}
.textarea {
  flex: 1;
  height: 140rpx;
  font-size: 26rpx;
  background: $cream-white;
  border-radius: 12rpx;
  padding: 16rpx;
}
.ph {
  color: $text-placeholder;
}
.save {
  margin-top: 28rpx;
  height: 84rpx;
  border-radius: $radius-button;
  background: $coffee-brown;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
.user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx dashed $border-color;
}
.u-name {
  font-size: 28rpx;
}
.u-role {
  margin-left: 12rpx;
  font-size: 20rpx;
  color: $cat-orange;
}
.u-meta {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
.op {
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid $border-color;
  font-size: 24rpx;
}
.logout {
  margin-top: 40rpx;
  height: 88rpx;
  border-radius: $radius-button;
  border: 1rpx solid $danger;
  color: $danger;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
</style>
