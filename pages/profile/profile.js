// pages/profile/profile.js
// “我的”页：展示当前用户资料、认证状态与入口。
// 未登录时只显示登录引导，不自动跳转，避免打断浏览。

const userApi = require('../../services/user-api.js');
const authApi = require('../../services/auth-api.js');
const store = require('../../store/session-store.js');
const enums = require('../../constants/enums.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');
const mediaUrl = require('../../utils/media-url.js');

const EDIT_ROUTE = '/pages/profile-edit/profile-edit';
const CERT_ROUTE = '/pages/certification/certification';
const FAVORITES_ROUTE = '/pages/favorites/favorites';
const ORDERS_ROUTE = '/pages/orders/orders';
const USER_REVIEWS_ROUTE = '/pages/user-reviews/user-reviews';
const ADMIN_ROUTE = '/pages/admin/admin';

const EMPTY_VIEW = {
  loggedIn: false,
  loading: false,
  profile: null,
  certLabel: '',
  certTone: 'muted',
  joinedAt: '',
  initial: '',
  isAdmin: false
};

Page({
  data: {
    loggedIn: false,
    loading: false,
    submitting: false,
    profile: null,
    certLabel: '',
    certTone: 'muted',
    joinedAt: '',
    initial: '',
    isAdmin: false
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    this.refresh(true);
  },

  onShow: function () {
    if (!store.getSession()) {
      this.alive.setData(this, EMPTY_VIEW);
      return;
    }
    this.alive.setData(this, { loggedIn: true });
    this.refresh(false);
  },

  refresh: function (fromPull) {
    const self = this;
    if (this.data.loading) {
      if (fromPull) wx.stopPullDownRefresh();
      return;
    }
    this.alive.setData(this, { loading: true });
    userApi.getMe().then(function (profile) {
      if (!profile) return;
      // 会话里的用户摘要同步刷新，其它页面读到的昵称/头像保持一致。
      const patch = { nickname: profile.nickname };
      if (profile.avatarUrl !== undefined) patch.avatarUrl = mediaUrl.resolveMediaUrl(profile.avatarUrl);
      store.updateUser(patch);

      profile.avatarUrl = mediaUrl.resolveMediaUrl(profile.avatarUrl);

      self.alive.setData(self, {
        loading: false,
        profile: profile,
        certLabel: enums.certificationStatusLabel(profile.certificationStatus),
        certTone: enums.certificationStatusTone(profile.certificationStatus),
        joinedAt: String(profile.createdAt || '').slice(0, 10),
        initial: String(profile.nickname || '').slice(0, 1),
        // 角色只存在于 GET /users/me：登录返回的用户摘要是 {id, nickname, avatarUrl}，
        // 因此管理台入口只能由这里的资料查询结果驱动，不能从会话里读。
        isAdmin: profile.role === enums.UserRole.ADMIN
      });
    }, function (error) {
      self.alive.setData(self, { loading: false });
      errorHandler.handleError(error);
    }).then(function () {
      if (fromPull) wx.stopPullDownRefresh();
    });
  },

  onGoLogin: function () {
    errorHandler.requireLogin();
  },

  onEditProfile: function () {
    wx.navigateTo({ url: EDIT_ROUTE });
  },

  onGoFavorites: function () {
    wx.navigateTo({ url: FAVORITES_ROUTE });
  },

  // 买入/卖出共用订单页，由 side 参数决定视角。
  onGoOrders: function (event) {
    const side = event.currentTarget.dataset.side === 'SELL' ? 'SELL' : 'BUY';
    wx.navigateTo({ url: ORDERS_ROUTE + '?side=' + side });
  },

  // 查看自己收到的公开评价。用户 ID 取自会话摘要，永远是十进制字符串。
  onGoMyReviews: function () {
    const user = store.getUser();
    if (!user || user.id === undefined || user.id === null || user.id === '') {
      errorHandler.requireLogin();
      return;
    }
    wx.navigateTo({ url: USER_REVIEWS_ROUTE + '?id=' + user.id });
  },

  onGoCertification: function () {
    wx.navigateTo({ url: CERT_ROUTE });
  },

  // 管理台入口只对 ADMIN 显示。入口隐藏不是门禁：管理页自己会再查一次角色。
  onGoAdmin: function () {
    wx.navigateTo({ url: ADMIN_ROUTE });
  },

  onLogout: function () {
    const self = this;
    if (this.data.submitting) return;
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: function (res) {
        if (!res.confirm) return;
        if (self.data.submitting) return;
        self.alive.setData(self, { submitting: true });
        // 服务端调用失败也会清空本地会话，避免留在已失效的登录态。
        authApi.logout().then(function () {
          self.alive.setData(self, Object.assign({ submitting: false }, EMPTY_VIEW));
          errorHandler.showToast('已退出登录');
        });
      }
    });
  }
});
