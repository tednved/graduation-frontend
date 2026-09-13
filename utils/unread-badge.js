// utils/unread-badge.js
// 消息 Tab 的未读红点。红点只由 /notifications/unread-count 驱动，不在本地累加计数，
// 避免本地计数与后端真实未读数漂移。
//
// 触发时机（见 app.js 与 pages/messages）：
//   - 应用启动与回到前台；
//   - 登录态翻转（登录后刷新、退出后清除）；
//   - 消息页标记已读后。
//
// 未登录时一律清除红点；网络失败时保持现状（不因为一次请求失败就把红点抹掉）。

const notificationApi = require('../services/notification-api.js');
const store = require('../store/session-store.js');
const notificationView = require('./notification-view.js');

// TabBar 顺序：首页 / 分类 / 发布 / 消息 / 我的 → 消息是第 4 项，下标 3。
const MESSAGES_TAB_INDEX = 3;

function supportsTabBarBadge() {
  return typeof wx !== 'undefined' && typeof wx.setTabBarBadge === 'function';
}

function supportsRemoveBadge() {
  return typeof wx !== 'undefined' && typeof wx.removeTabBarBadge === 'function';
}

// 应用红点。文案由 notification-view 统一决定（0 条等于不显示）。
function apply(count) {
  const text = notificationView.unreadBadgeText(count);
  if (!text) return clear();
  if (!supportsTabBarBadge()) return false;
  try {
    wx.setTabBarBadge({ index: MESSAGES_TAB_INDEX, text: text });
    return true;
  } catch (error) {
    // 红点不是关键路径：基础库不支持或 TabBar 尚未就绪时静默跳过。
    return false;
  }
}

function clear() {
  if (!supportsRemoveBadge()) return false;
  try {
    wx.removeTabBarBadge({ index: MESSAGES_TAB_INDEX });
    return true;
  } catch (error) {
    return false;
  }
}

// 拉取未读数并应用。未登录直接清除；请求失败保留现有红点。
function refresh() {
  if (!store.getSession()) {
    clear();
    return Promise.resolve('');
  }
  return notificationApi.unreadCount().then(function (data) {
    const count = data && data.count !== undefined ? data.count : 0;
    apply(count);
    return notificationView.unreadBadgeText(count);
  }, function () {
    return '';
  });
}

module.exports = {
  MESSAGES_TAB_INDEX: MESSAGES_TAB_INDEX,
  apply: apply,
  clear: clear,
  refresh: refresh
};
