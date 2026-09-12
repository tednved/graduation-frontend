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
  CERTIFICATION_STATUS_LABEL: CERTIFICATION_STATUS_LABEL,
  CERTIFICATION_STATUS_TONE: CERTIFICATION_STATUS_TONE,
  CERTIFICATION_TYPE_LABEL: CERTIFICATION_TYPE_LABEL,
  ITEM_STATUS_LABEL: ITEM_STATUS_LABEL,
  ITEM_STATUS_TONE: ITEM_STATUS_TONE,
  ITEM_CONDITION_LABEL: ITEM_CONDITION_LABEL,
  ITEM_SORT_LABEL: ITEM_SORT_LABEL,
  ITEM_CONDITION_OPTIONS: ITEM_CONDITION_OPTIONS,
  ITEM_SORT_OPTIONS: ITEM_SORT_OPTIONS,
  certificationStatusLabel: certificationStatusLabel,
  certificationStatusTone: certificationStatusTone,
  itemStatusLabel: itemStatusLabel,
  itemStatusTone: itemStatusTone,
  itemConditionLabel: itemConditionLabel,
  itemSortLabel: itemSortLabel
};
