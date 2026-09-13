// services/notification-api.js
// 站内消息接口（OpenAPI 第八节 8.10）。只操作当前用户自己的消息。
//
// 单条已读与全部已读都是幂等写操作：请求层对写请求不自动重试，
// 页面点击后自行决定是否需要重试（重复调用不会产生额外副作用）。

const request = require('./request.js');

// 我的消息。read 省略表示全部；type 省略表示全部类型。
function list(params) {
  const source = params || {};
  const query = {
    page: source.page === undefined || source.page === null ? 0 : source.page,
    size: source.size === undefined || source.size === null ? 20 : source.size
  };
  // 注意：read 的 false 是有效筛选值，只有在显式给出布尔值时才带上，
  // 不能用 if (source.read) 判空，否则「只看未读」会退化成「全部」。
  if (typeof source.read === 'boolean') query.read = source.read;
  if (source.type) query.type = source.type;
  return request.request({ method: 'GET', path: '/notifications', query: query });
}

// 返回 { count }。
function unreadCount() {
  return request.request({ method: 'GET', path: '/notifications/unread-count' });
}

// 幂等，成功返回 204（请求层拆包为 undefined）。
function markRead(notificationId) {
  return request.request({ method: 'PUT', path: '/notifications/' + notificationId + '/read' });
}

// 返回 { updatedCount }。
function markAllRead() {
  return request.request({ method: 'PUT', path: '/notifications/read-all' });
}

module.exports = {
  list: list,
  unreadCount: unreadCount,
  markRead: markRead,
  markAllRead: markAllRead
};
