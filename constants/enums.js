// constants/enums.js
// 总纲 §4 枚举的前端副本。取值必须与 OpenAPI 中的枚举逐字一致：
// 不使用 ordinal、别名或大小写变体。
// 枚举变化顺序：总纲 → 数据库 → Java → OpenAPI → 前端 constants → 测试。

const CertificationStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

const CertificationType = {
  STUDENT_CARD: 'STUDENT_CARD',
  CAMPUS_EMAIL: 'CAMPUS_EMAIL',
  MANUAL: 'MANUAL'
};

const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
};

const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN'
};

const CategoryStatus = {
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED'
};

const FileBizType = {
  ITEM_IMAGE: 'ITEM_IMAGE',
  AVATAR: 'AVATAR',
  CERTIFICATION_EVIDENCE: 'CERTIFICATION_EVIDENCE'
};

const ItemStatus = {
  DRAFT: 'DRAFT',
  ON_SALE: 'ON_SALE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  OFF_SHELF: 'OFF_SHELF',
  DELETED: 'DELETED'
};

const ItemCondition = {
  NEW: 'NEW',
  LIKE_NEW: 'LIKE_NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR'
};

// 搜索排序白名单。默认 NEWEST，与契约一致。
const ItemSort = {
  NEWEST: 'NEWEST',
  PRICE_ASC: 'PRICE_ASC',
  PRICE_DESC: 'PRICE_DESC',
  POPULAR: 'POPULAR'
};

// 公开列表只展示在售商品；其余状态用于「我的发布」与详情页的状态提示。
const ITEM_STATUS_LABEL = {
  DRAFT: '草稿',
  ON_SALE: '在售',
  RESERVED: '已预订',
  SOLD: '已售出',
  OFF_SHELF: '已下架',
  DELETED: '已删除'
};

const ITEM_STATUS_TONE = {
  DRAFT: 'muted',
  ON_SALE: 'success',
  RESERVED: 'warning',
  SOLD: 'muted',
  OFF_SHELF: 'warning',
  DELETED: 'danger'
};

const ITEM_CONDITION_LABEL = {
  NEW: '全新',
  LIKE_NEW: '几乎全新',
  GOOD: '成色良好',
  FAIR: '成色一般'
};

const ITEM_SORT_LABEL = {
  NEWEST: '最新发布',
  PRICE_ASC: '价格从低到高',
  PRICE_DESC: '价格从高到低',
  POPULAR: '最受欢迎'
};

// 下拉筛选项的顺序即界面顺序，避免页面里再写一遍取值。
const ITEM_CONDITION_OPTIONS = [ItemCondition.NEW, ItemCondition.LIKE_NEW, ItemCondition.GOOD, ItemCondition.FAIR];
const ITEM_SORT_OPTIONS = [ItemSort.NEWEST, ItemSort.PRICE_ASC, ItemSort.PRICE_DESC, ItemSort.POPULAR];

// 交易方式。MVP 只接受 OFFLINE；SIMULATED_PAYMENT 保留在枚举中但不可提交。
const TradeMode = {
  OFFLINE: 'OFFLINE',
  SIMULATED_PAYMENT: 'SIMULATED_PAYMENT'
};

const OrderStatus = {
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  PENDING_RECEIPT: 'PENDING_RECEIPT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED'
};

// 订单操作。前端按钮只由后端 allowedActions 驱动，这里的取值仅用于翻译文案。
const OrderAction = {
  CREATE: 'CREATE',
  CONFIRM: 'CONFIRM',
  REJECT: 'REJECT',
  CANCEL: 'CANCEL',
  DELIVER: 'DELIVER',
  RECEIVE: 'RECEIVE'
};

// 契约层枚举：同一路径上的买卖视角，不是领域状态。
const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL'
};

const ReviewStatus = {
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN'
};

const NotificationType = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_REJECTED: 'ORDER_REJECTED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  SYSTEM: 'SYSTEM'
};

const ORDER_STATUS_LABEL = {
  PENDING_CONFIRMATION: '待卖家接单',
  CONFIRMED: '待交付',
  PENDING_RECEIPT: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REJECTED: '已拒绝'
};

const ORDER_STATUS_TONE = {
  PENDING_CONFIRMATION: 'warning',
  CONFIRMED: 'warning',
  PENDING_RECEIPT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'muted',
  REJECTED: 'danger'
};

// 订单按钮文案。与 allowedActions 的取值一一对应。
const ORDER_ACTION_LABEL = {
  CREATE: '下单',
  CONFIRM: '接单',
  REJECT: '拒绝订单',
  CANCEL: '取消订单',
  DELIVER: '确认交付',
  RECEIVE: '确认收货'
};

// 订单事件时间线的动作文案，与按钮文案分开：一个是「要做什么」，一个是「做过什么」。
const ORDER_EVENT_LABEL = {
  CREATE: '创建订单',
  CONFIRM: '卖家接单',
  REJECT: '卖家拒绝',
  CANCEL: '订单取消',
  DELIVER: '卖家交付',
  RECEIVE: '买家收货'
};

// 状态筛选下拉项。空串表示不传 status 参数。
const ORDER_STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: OrderStatus.PENDING_CONFIRMATION, label: ORDER_STATUS_LABEL.PENDING_CONFIRMATION },
  { value: OrderStatus.CONFIRMED, label: ORDER_STATUS_LABEL.CONFIRMED },
  { value: OrderStatus.PENDING_RECEIPT, label: ORDER_STATUS_LABEL.PENDING_RECEIPT },
  { value: OrderStatus.COMPLETED, label: ORDER_STATUS_LABEL.COMPLETED },
  { value: OrderStatus.CANCELLED, label: ORDER_STATUS_LABEL.CANCELLED },
  { value: OrderStatus.REJECTED, label: ORDER_STATUS_LABEL.REJECTED }
];

const NOTIFICATION_TYPE_LABEL = {
  ORDER_CREATED: '买家下单',
  ORDER_CONFIRMED: '订单已接单',
  ORDER_REJECTED: '订单被拒绝',
  ORDER_CANCELLED: '订单已取消',
  ORDER_DELIVERED: '卖家已交付',
  ORDER_COMPLETED: '订单已完成',
  REVIEW_RECEIVED: '收到新评价',
  SYSTEM: '系统消息'
};

const NOTIFICATION_TYPE_TONE = {
  ORDER_CREATED: 'warning',
  ORDER_CONFIRMED: 'warning',
  ORDER_REJECTED: 'danger',
  ORDER_CANCELLED: 'muted',
  ORDER_DELIVERED: 'warning',
  ORDER_COMPLETED: 'success',
  REVIEW_RECEIVED: 'success',
  SYSTEM: 'muted'
};

// 评价评分筛选下拉项。空串表示不传 rating 参数。
const REVIEW_RATING_FILTER_OPTIONS = [
  { value: '', label: '全部评分' },
  { value: '5', label: '5 星' },
  { value: '4', label: '4 星' },
  { value: '3', label: '3 星' },
  { value: '2', label: '2 星' },
  { value: '1', label: '1 星' }
];

// 认证状态的中文文案。页面不直接写死，统一从这里取。
const CERTIFICATION_STATUS_LABEL = {
  NOT_SUBMITTED: '未认证',
  PENDING: '审核中',
  APPROVED: '已认证',
  REJECTED: '未通过'
};

// 认证状态的视觉基调，用作 WXML 上的 class 后缀（badge--success 等）。
const CERTIFICATION_STATUS_TONE = {
  NOT_SUBMITTED: 'muted',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger'
};

// 当前 MVP 只开放人工审核；其余取值保留在枚举中但不可提交。
const CERTIFICATION_TYPE_LABEL = {
  STUDENT_CARD: '学生证',
  CAMPUS_EMAIL: '校园邮箱',
  MANUAL: '人工审核'
};

function certificationStatusLabel(status) {
  return CERTIFICATION_STATUS_LABEL[status] || '未知状态';
}

function certificationStatusTone(status) {
  return CERTIFICATION_STATUS_TONE[status] || 'muted';
}

function itemStatusLabel(status) {
  return ITEM_STATUS_LABEL[status] || '未知状态';
}

function itemStatusTone(status) {
  return ITEM_STATUS_TONE[status] || 'muted';
}

function itemConditionLabel(condition) {
  return ITEM_CONDITION_LABEL[condition] || '未知成色';
}

function itemSortLabel(sort) {
  return ITEM_SORT_LABEL[sort] || '最新发布';
}

function orderStatusLabel(status) {
  return ORDER_STATUS_LABEL[status] || '未知状态';
}

function orderStatusTone(status) {
  return ORDER_STATUS_TONE[status] || 'muted';
}

function orderActionLabel(action) {
  return ORDER_ACTION_LABEL[action] || action || '';
}

function orderEventLabel(action) {
  return ORDER_EVENT_LABEL[action] || ORDER_ACTION_LABEL[action] || action || '';
}

function notificationTypeLabel(type) {
  return NOTIFICATION_TYPE_LABEL[type] || '消息';
}

function notificationTypeTone(type) {
  return NOTIFICATION_TYPE_TONE[type] || 'muted';
}

module.exports = {
  CertificationStatus: CertificationStatus,
  CertificationType: CertificationType,
  UserStatus: UserStatus,
  UserRole: UserRole,
  CategoryStatus: CategoryStatus,
  FileBizType: FileBizType,
  ItemStatus: ItemStatus,
  ItemCondition: ItemCondition,
  ItemSort: ItemSort,
  TradeMode: TradeMode,
  OrderStatus: OrderStatus,
  OrderAction: OrderAction,
  OrderSide: OrderSide,
  ReviewStatus: ReviewStatus,
  NotificationType: NotificationType,
  CERTIFICATION_STATUS_LABEL: CERTIFICATION_STATUS_LABEL,
  CERTIFICATION_STATUS_TONE: CERTIFICATION_STATUS_TONE,
  CERTIFICATION_TYPE_LABEL: CERTIFICATION_TYPE_LABEL,
  ITEM_STATUS_LABEL: ITEM_STATUS_LABEL,
  ITEM_STATUS_TONE: ITEM_STATUS_TONE,
  ITEM_CONDITION_LABEL: ITEM_CONDITION_LABEL,
  ITEM_SORT_LABEL: ITEM_SORT_LABEL,
  ITEM_CONDITION_OPTIONS: ITEM_CONDITION_OPTIONS,
  ITEM_SORT_OPTIONS: ITEM_SORT_OPTIONS,
  ORDER_STATUS_LABEL: ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE: ORDER_STATUS_TONE,
  ORDER_ACTION_LABEL: ORDER_ACTION_LABEL,
  ORDER_EVENT_LABEL: ORDER_EVENT_LABEL,
  ORDER_STATUS_FILTER_OPTIONS: ORDER_STATUS_FILTER_OPTIONS,
  NOTIFICATION_TYPE_LABEL: NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE: NOTIFICATION_TYPE_TONE,
  REVIEW_RATING_FILTER_OPTIONS: REVIEW_RATING_FILTER_OPTIONS,
  certificationStatusLabel: certificationStatusLabel,
  certificationStatusTone: certificationStatusTone,
  itemStatusLabel: itemStatusLabel,
  itemStatusTone: itemStatusTone,
  itemConditionLabel: itemConditionLabel,
  itemSortLabel: itemSortLabel,
  orderStatusLabel: orderStatusLabel,
  orderStatusTone: orderStatusTone,
  orderActionLabel: orderActionLabel,
  orderEventLabel: orderEventLabel,
  notificationTypeLabel: notificationTypeLabel,
  notificationTypeTone: notificationTypeTone
};
