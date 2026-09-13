// utils/notification-view.js
// 消息展示层映射：类型文案、时间、未读标记与点击后的跳转目标。
//
// bizType 在契约里是自由字符串（"关联业务类型，用于前端跳转"），OpenAPI 与总纲都没有
// 固定取值表。这里按后端模块口径归一化处理，同时容忍大小写与常见别名，避免写死一个
// 尚未冻结的字面量导致消息点不开；取值表待 BE-09 落地后收敛。

const enums = require('../constants/enums.js');
const itemView = require('./item-view.js');
const orderView = require('./order-view.js');

const MAX_BADGE = 99;

// bizType → 路由。键统一大写后比较。
const ORDER_BIZ_TYPES = ['ORDER', 'ORDERS'];
const ITEM_BIZ_TYPES = ['ITEM', 'ITEMS'];

function targetRoute(bizType, bizId) {
  if (bizId === undefined || bizId === null || bizId === '') return '';
  const normalized = String(bizType || '').trim().toUpperCase();
  if (!normalized) return '';
  const id = String(bizId);
  if (ORDER_BIZ_TYPES.indexOf(normalized) >= 0) return orderView.orderDetailRoute(id);
  if (ITEM_BIZ_TYPES.indexOf(normalized) >= 0) return orderView.itemDetailRoute(id);
  return '';
}

function buildNotificationView(notification) {
  const source = notification || {};
  const route = targetRoute(source.bizType, source.bizId);
  return {
    id: source.id === undefined || source.id === null ? '' : String(source.id),
    type: source.type || '',
    typeLabel: enums.notificationTypeLabel(source.type),
    typeTone: enums.notificationTypeTone(source.type),
    title: source.title || '',
    content: source.content || '',
    read: source.read === true,
    bizType: source.bizType || '',
    bizId: source.bizId === undefined || source.bizId === null ? '' : String(source.bizId),
    route: route,
    navigable: !!route,
    time: orderView.formatDateTime(source.createdAt),
    dateText: itemView.formatDate(source.createdAt)
  };
}

function buildNotificationViews(notifications) {
  return (notifications || []).map(buildNotificationView);
}

// Tab 红点文案：0 条不显示（由调用方清除红点），超过 99 显示 99+。
function unreadBadgeText(count) {
  const value = Number(count);
  if (!isFinite(value) || value <= 0) return '';
  if (value > MAX_BADGE) return MAX_BADGE + '+';
  return String(Math.floor(value));
}

module.exports = {
  MAX_BADGE: MAX_BADGE,
  targetRoute: targetRoute,
  buildNotificationView: buildNotificationView,
  buildNotificationViews: buildNotificationViews,
  unreadBadgeText: unreadBadgeText
};
