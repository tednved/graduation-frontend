// utils/order-view.js
// 订单展示层映射。订单的状态、金额、双方、时间线与按钮反复出现在列表和详情，
// 集中在这里，页面只把结果放进 data。
//
// 契约约定：金额是两位小数字符串，时间是 UTC ISO-8601，ID 是十进制字符串；
// 站内媒体相对地址统一经 utils/media-url.js 转成绝对地址。
//
// 按钮唯一来源是后端 allowedActions：这里只做「翻译成文案 + 是否需要二次确认 + 是否需要原因」，
// 不新增任何前端推断的权限。

const enums = require('../constants/enums.js');
const itemView = require('./item-view.js');
const mediaUrl = require('./media-url.js');
const orderApi = require('../services/order-api.js');

const ORDER_DETAIL_ROUTE = '/pages/order-detail/order-detail';
const ITEM_DETAIL_ROUTE = '/pages/item-detail/item-detail';
const REVIEW_CREATE_ROUTE = '/pages/review-create/review-create';

// 需要二次确认的文案。写操作在执行前都必须弹确认框。
const ACTION_CONFIRM_TEXT = {
  CONFIRM: '确认接下这笔订单吗？确认后商品将为你保留。',
  REJECT: '拒绝后商品会重新上架，确定拒绝吗？',
  CANCEL: '取消后商品会重新上架，确定取消吗？',
  DELIVER: '确认已经把商品交给买家了吗？',
  RECEIVE: '确认已经收到商品吗？确认后订单完成。'
};

// 主操作（高亮展示）与危险操作（红色展示）的区分，只影响外观。
const PRIMARY_ACTIONS = ['CONFIRM', 'DELIVER', 'RECEIVE'];
const DANGER_ACTIONS = ['REJECT', 'CANCEL'];

function formatMoney(amount) {
  return itemView.formatPrice(amount);
}

function formatDateTime(instant) {
  if (!instant) return '';
  return String(instant).replace('T', ' ').slice(0, 16);
}

function buildUserView(user) {
  const source = user || {};
  return {
    id: source.id === undefined || source.id === null ? '' : String(source.id),
    nickname: source.nickname || '匿名同学',
    avatarUrl: mediaUrl.resolveMediaUrl(source.avatarUrl),
    initial: String(source.nickname || '匿').slice(0, 1)
  };
}

// 商品快照：下单时固化，商品后续修改不影响订单展示。
function buildItemSnapshotView(snapshot) {
  const source = snapshot || {};
  return {
    itemId: source.itemId === undefined || source.itemId === null ? '' : String(source.itemId),
    title: source.title || '',
    priceText: formatMoney(source.price),
    imageUrl: mediaUrl.resolveMediaUrl(source.imageUrl)
  };
}

// 列表条目（OrderSummary）：counterpart 在买入列表里是卖家，卖出列表里是买家。
function buildOrderSummaryView(order) {
  const source = order || {};
  const item = buildItemSnapshotView(source.item);
  const counterpart = buildUserView(source.counterpart);
  return {
    id: source.id === undefined || source.id === null ? '' : String(source.id),
    orderNo: source.orderNo || '',
    status: source.status || '',
    statusLabel: enums.orderStatusLabel(source.status),
    statusTone: enums.orderStatusTone(source.status),
    amountText: formatMoney(source.amount),
    itemId: item.itemId,
    itemTitle: item.title,
    itemImageUrl: item.imageUrl,
    counterpartName: counterpart.nickname,
    counterpartAvatarUrl: counterpart.avatarUrl,
    counterpartInitial: counterpart.initial,
    createdDate: itemView.formatDate(source.createdAt),
    createdAt: formatDateTime(source.createdAt)
  };
}

function buildOrderSummaryViews(orders) {
  return (orders || []).map(buildOrderSummaryView);
}

// 单个事件：动作 + 从哪个状态到哪个状态 + 谁操作的 + 时间 + 备注（拒单/取消原因）。
function buildEventView(event) {
  const source = event || {};
  const operator = buildUserView(source.operator);
  return {
    id: source.id === undefined || source.id === null ? '' : String(source.id),
    action: source.action || '',
    actionLabel: enums.orderEventLabel(source.action),
    fromStatusLabel: source.fromStatus ? enums.orderStatusLabel(source.fromStatus) : '',
    toStatusLabel: enums.orderStatusLabel(source.toStatus),
    toStatusTone: enums.orderStatusTone(source.toStatus),
    operatorName: operator.nickname,
    remark: source.remark || '',
    time: formatDateTime(source.createdAt)
  };
}

function buildEventViews(events) {
  return (events || []).map(buildEventView);
}

// 订单操作按钮。allowedActions 里出现什么就渲染什么，未知动作直接忽略（而不是猜一个标签）。
function buildActionView(action) {
  const label = enums.ORDER_ACTION_LABEL[action];
  if (!label) return null;
  return {
    action: action,
    label: label,
    primary: PRIMARY_ACTIONS.indexOf(action) >= 0,
    danger: DANGER_ACTIONS.indexOf(action) >= 0,
    confirmText: ACTION_CONFIRM_TEXT[action] || '',
    needsReason: needsReason(action)
  };
}

function buildActionViews(actions) {
  return (actions || [])
    .map(buildActionView)
    .filter(function (view) {
      return view !== null;
    });
}

// 拒单与取消必须带原因（契约 OrderReasonRequest）。
function needsReason(action) {
  return action === enums.OrderAction.REJECT || action === enums.OrderAction.CANCEL;
}

// 前端原因校验，通过返回 ''。真正的长度约束由 services/order-api.js 统一实现。
function validateReason(reason) {
  if (orderApi.normalizeReason(reason) === null) return orderApi.reasonError();
  return '';
}

function buildOrderDetailView(order) {
  const source = order || {};
  const summary = buildOrderSummaryView(source);
  const item = buildItemSnapshotView(source.item);
  const buyer = buildUserView(source.buyer);
  const seller = buildUserView(source.seller);
  return Object.assign(summary, {
    tradeMode: source.tradeMode || '',
    cancelReason: source.cancelReason || '',
    item: item,
    buyer: buyer,
    seller: seller,
    actions: buildActionViews(source.allowedActions),
    events: buildEventViews(source.events),
    // 评价入口只在订单完成时出现；能否真正提交由评价页查 review-eligibility 决定。
    canReview: source.status === enums.OrderStatus.COMPLETED,
    reviewRoute: REVIEW_CREATE_ROUTE + '?orderId=' + summary.id,
    confirmedAt: formatDateTime(source.confirmedAt),
    deliveredAt: formatDateTime(source.deliveredAt),
    completedAt: formatDateTime(source.completedAt),
    cancelledAt: formatDateTime(source.cancelledAt),
    updatedAt: formatDateTime(source.updatedAt)
  });
}

// 页面跳转地址。集中在这里，避免各页面各拼一次字符串。
function orderDetailRoute(orderId) {
  return ORDER_DETAIL_ROUTE + '?id=' + orderId;
}

function itemDetailRoute(itemId) {
  return ITEM_DETAIL_ROUTE + '?id=' + itemId;
}

module.exports = {
  ORDER_DETAIL_ROUTE: ORDER_DETAIL_ROUTE,
  ITEM_DETAIL_ROUTE: ITEM_DETAIL_ROUTE,
  REVIEW_CREATE_ROUTE: REVIEW_CREATE_ROUTE,
  ACTION_CONFIRM_TEXT: ACTION_CONFIRM_TEXT,
  formatMoney: formatMoney,
  formatDateTime: formatDateTime,
  buildUserView: buildUserView,
  buildItemSnapshotView: buildItemSnapshotView,
  buildOrderSummaryView: buildOrderSummaryView,
  buildOrderSummaryViews: buildOrderSummaryViews,
  buildEventView: buildEventView,
  buildEventViews: buildEventViews,
  buildActionView: buildActionView,
  buildActionViews: buildActionViews,
  needsReason: needsReason,
  validateReason: validateReason,
  buildOrderDetailView: buildOrderDetailView,
  orderDetailRoute: orderDetailRoute,
  itemDetailRoute: itemDetailRoute
};
