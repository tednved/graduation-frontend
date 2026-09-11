// services/auth-api.js
// 登录、刷新、退出。令牌写入统一走 store/session-store.js。
//
// 这三个接口自身不参与 401 自动刷新：登录失败就是登录失败，
// 刷新失败会清空会话由页面跳登录页，退出必须无条件清空本地会话。

const request = require('./request.js');
const store = require('../store/session-store.js');
const id = require('../utils/id.js');

// 用 wx.login 拿到的 code 换取令牌。deviceId 用于服务端识别设备级刷新重放。
function wechatLogin(code, deviceId) {
  return request.request({
    method: 'POST',
    path: '/auth/wechat-login',
    data: { code: code, deviceId: deviceId },
    auth: false,
    skipAuthRefresh: true
  });
}

// 完整的登录流程：wx.login → 换令牌 → 落盘会话。
function loginWithWechat() {
  const deviceId = id.getDeviceId();
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (res) {
        if (!res || !res.code) {
          reject({
            code: 'AUTH_INVALID_CODE',
            message: '未能获取微信登录凭证，请重试',
            httpStatus: 0,
            requestId: null,
            action: 'toast'
          });
          return;
        }
        resolve(res.code);
      },
      fail: function () {
        reject({
          code: 'AUTH_INVALID_CODE',
          message: '微信登录失败，请重试',
          httpStatus: 0,
          requestId: null,
          action: 'toast'
        });
      }
    });
  }).then(function (code) {
    return wechatLogin(code, deviceId);
  }).then(function (tokenResponse) {
    return store.setSession(store.createSession(tokenResponse, deviceId));
  });
}

function refresh(refreshToken, deviceId) {
  return request.request({
    method: 'POST',
    path: '/auth/refresh',
    data: { refreshToken: refreshToken, deviceId: deviceId },
    auth: false,
    skipAuthRefresh: true
  });
}

// 退出登录：服务端调用失败也要清空本地会话，否则用户会卡在已失效的登录态。
function logout() {
  const session = store.getSession();
  const refreshToken = session && session.refreshToken;
  const done = function () {
    store.clearSession();
  };
  if (!refreshToken) {
    done();
    return Promise.resolve();
  }
  return request.request({
    method: 'POST',
    path: '/auth/logout',
    data: { refreshToken: refreshToken },
    auth: false,
    skipAuthRefresh: true
  }).then(done, done);
}

module.exports = {
  wechatLogin: wechatLogin,
  loginWithWechat: loginWithWechat,
  refresh: refresh,
  logout: logout
};
