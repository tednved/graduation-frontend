// pages/login/login.js
// 登录页。wx.login → 换取令牌 → 落盘会话。
// 服务端在 local/test 使用 Mock 微信登录，前端流程与真实环境一致。

const authApi = require('../../services/auth-api.js');
const store = require('../../store/session-store.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PROFILE_URL = '/pages/profile/profile';

Page({
  data: {
    submitting: false,
    canGoBack: false
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onShow: function () {
    if (store.getSession()) {
      this.enterApp();
      return;
    }
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    this.alive.setData(this, { canGoBack: pages.length > 1 });
  },

  enterApp: function () {
    wx.switchTab({ url: PROFILE_URL });
  },

  onLogin: function () {
    const self = this;
    if (this.data.submitting) return; // 防重复点击
    this.alive.setData(this, { submitting: true });
    authApi.loginWithWechat().then(function () {
      if (!self.alive.isAlive()) return;
      self.alive.setData(self, { submitting: false });
      self.enterApp();
    }, function (error) {
      self.alive.setData(self, { submitting: false });
      errorHandler.handleError(error);
    });
  },

  onBack: function () {
    if (this.data.canGoBack) wx.navigateBack();
  }
});
