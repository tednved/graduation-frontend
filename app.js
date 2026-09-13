// app.js
// 应用启动时恢复本地会话并订阅会话变化。
// 这里不自动调用 wx.login：登录是用户在登录页显式触发的动作，
// 未登录时首页与分类仍可浏览。
//
// 消息 Tab 的未读红点也在这里统一驱动：启动与回到前台时向
// /notifications/unread-count 取一次真实未读数；登录态翻转时刷新或清除。
// 红点逻辑本身在 utils/unread-badge.js，这里只负责触发时机。

const store = require('./store/session-store.js');
const unreadBadge = require('./utils/unread-badge.js');

App({
  globalData: {
    // 会话摘要，与 store/session-store.js 保持一致（未登录为 null）。
    session: null
  },

  onLaunch: function () {
    this.globalData.session = store.getSession();
    this.loggedIn = !!this.globalData.session;
    this.unsubscribeSession = store.subscribe(function (session) {
      this.globalData.session = session;
      const loggedIn = !!session;
      // 只在登录态真正翻转时动红点：令牌轮换会反复触发 setSession，
      // 每次都打一次未读数既浪费请求也容易与页面自身的刷新打架。
      if (loggedIn === this.loggedIn) return;
      this.loggedIn = loggedIn;
      if (loggedIn) unreadBadge.refresh();
      else unreadBadge.clear();
    }.bind(this));
  },

  onShow: function () {
    // 从后台回来时以存储为准，避免与其它页面写入的会话不一致。
    this.globalData.session = store.getSession();
    this.loggedIn = !!this.globalData.session;
    unreadBadge.refresh();
  }
});
