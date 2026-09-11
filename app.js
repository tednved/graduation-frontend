// app.js
// 应用启动时恢复本地会话并订阅会话变化。
// 这里不自动调用 wx.login：登录是用户在登录页显式触发的动作，
// 未登录时首页与分类仍可浏览。

const store = require('./store/session-store.js');

App({
  globalData: {
    // 会话摘要，与 store/session-store.js 保持一致（未登录为 null）。
    session: null
  },

  onLaunch: function () {
    this.globalData.session = store.getSession();
    this.unsubscribeSession = store.subscribe(function (session) {
      this.globalData.session = session;
    }.bind(this));
  },

  onShow: function () {
    // 从后台回来时以存储为准，避免与其它页面写入的会话不一致。
    this.globalData.session = store.getSession();
  }
});
