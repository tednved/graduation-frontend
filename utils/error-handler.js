// utils/error-handler.js
// 页面统一的错误出口。把请求层归一化后的错误映射为一次提示或一次跳转，
// 页面不再自己判断错误码该弹提示还是该重新登录。

const errors = require('../constants/error-codes.js');
const store = require('../store/session-store.js');

const LOGIN_ROUTE = 'pages/login/login';
const PROFILE_ROUTE = 'pages/profile/profile';

let pushingLogin = false;

function currentRoute() {
  if (typeof getCurrentPages !== 'function') return '';
  const pages = getCurrentPages();
  if (!pages || !pages.length) return '';
  const page = pages[pages.length - 1];
  return (page && page.route) || '';
}

function isOnLoginPage() {
  return currentRoute() === LOGIN_ROUTE;
}

// 未登录时的正常引导：入栈登录页，登录成功后可返回原页面。
function requireLogin() {
  if (isOnLoginPage() || pushingLogin) return false;
  pushingLogin = true;
  wx.navigateTo({
    url: '/' + LOGIN_ROUTE,
    complete: function () {
      pushingLogin = false;
    }
  });
  return true;
}

// 会话被服务端判定失效：清空本地会话并重开到登录页，避免用户回到已失效的页面。
function toLogin() {
  store.clearSession();
  if (isOnLoginPage()) return false;
  wx.reLaunch({ url: '/' + LOGIN_ROUTE });
  return true;
}

function showToast(message) {
  wx.showToast({ title: message, icon: 'none' });
}

// 统一出口。返回处理后的错误对象，便于调用方在需要时继续读取 code。
function handleError(error) {
  const err = error || {};
  const code = err.code || errors.NETWORK_ERROR;
  const action = err.action || errors.actionForCode(code);
  const message = err.message || errors.messageForCode(code);

  if (action === errors.ACTION.CLEAR_SESSION) {
    store.clearSession();
    if (!isOnLoginPage()) wx.reLaunch({ url: '/' + LOGIN_ROUTE });
    return err;
  }
  if (action === errors.ACTION.REAUTH) {
    toLogin();
    return err;
  }
  showToast(message);
  return err;
}

module.exports = {
  LOGIN_ROUTE: LOGIN_ROUTE,
  PROFILE_ROUTE: PROFILE_ROUTE,
  handleError: handleError,
  requireLogin: requireLogin,
  toLogin: toLogin,
  showToast: showToast,
  currentRoute: currentRoute
};
