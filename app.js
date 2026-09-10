// app.js
// 仅保留最小可运行骨架。wx.login 与令牌、会话管理属于 FE-02，请勿在此自动调用登录链路。
App({
  globalData: {
    // 会话令牌与用户摘要由 FE-02 的 store/session-store.js 负责写入。
    userInfo: null
  }
})
