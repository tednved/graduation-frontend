// utils/admin-view.js
// 管理台展示层映射：认证申请、用户、商品、审计四类条目各一个 build 函数。
//
// 契约约定：ID 是十进制字符串，金额是两位小数字符串，时间是 UTC ISO-8601；
// 站内媒体相对地址统一经 utils/media-url.js 转成绝对地址。
// 角色与状态文案取自 constants/enums.js，页面不写死取值。

const enums = require('../constants/enums.js');
const itemView = require('./item-view.js');
const mediaUrl = require('./media-url.js');
const orderView = require('./order-view.js');

function formatDateTime(instant) {
  return orderView.formatDateTime(instant);
}

function idOf(value) {
  return value === undefined || value === null ? '' : String(value);
}

// 认证申请：后端只给脱敏姓名与学号，前端没有可还原的原文，也不该有。
function buildCertificationView(certification) {
  const source = certification || {};
  const campus = source.campus || {};
  return {
    id: idOf(source.id),
    userId: idOf(source.userId),
    campusName: campus.name || '—',
    typeLabel: enums.CERTIFICATION_TYPE_LABEL[source.type] || source.type || '',
    realNameMasked: source.realNameMasked || '',
    studentNoMasked: source.studentNoMasked || '',
    status: source.status || '',
    statusLabel: enums.certificationStatusLabel(source.status),
    statusTone: enums.certificationStatusTone(source.status),
    rejectReason: source.rejectReason || '',
    reviewedAt: formatDateTime(source.reviewedAt),
    createdAt: formatDateTime(source.createdAt),
    createdDate: itemView.formatDate(source.createdAt),
    // 只有待审核的申请给出通过/驳回按钮，已审完的条目只读。
    pending: source.status === enums.CertificationStatus.PENDING
  };
}

function buildCertificationViews(list) {
  return (list || []).map(buildCertificationView);
}

function buildUserView(user) {
  const source = user || {};
  const campus = source.campus || {};
  return {
    id: idOf(source.id),
    nickname: source.nickname || '匿名同学',
    avatarUrl: mediaUrl.resolveMediaUrl(source.avatarUrl),
    initial: String(source.nickname || '匿').slice(0, 1),
    phone: source.phone || '未填写',
    roleLabel: enums.userRoleLabel(source.role),
    isAdmin: source.role === enums.UserRole.ADMIN,
    status: source.status || '',
    statusLabel: enums.userStatusLabel(source.status),
    statusTone: enums.userStatusTone(source.status),
    enabled: source.status === enums.UserStatus.ACTIVE,
    campusName: campus.name || '—',
    certificationStatus: source.certificationStatus || '',
    certLabel: enums.certificationStatusLabel(source.certificationStatus),
    certTone: enums.certificationStatusTone(source.certificationStatus),
    averageRating: source.averageRating === undefined || source.averageRating === null ? '—' : String(source.averageRating),
    reviewCount: source.reviewCount === undefined || source.reviewCount === null ? 0 : source.reviewCount,
    createdDate: itemView.formatDate(source.createdAt),
    lastLoginAt: formatDateTime(source.lastLoginAt)
  };
}

function buildUserViews(list) {
  return (list || []).map(buildUserView);
}

function buildAdminItemView(item) {
  const source = item || {};
  const seller = source.seller || {};
  const category = source.category || {};
  return {
    id: idOf(source.id),
    title: source.title || '',
    priceText: itemView.formatPrice(source.price),
    status: source.status || '',
    statusLabel: enums.itemStatusLabel(source.status),
    statusTone: enums.itemStatusTone(source.status),
    sellerName: seller.nickname || '匿名同学',
    sellerId: idOf(seller.id),
    categoryName: category.name || '—',
    adminLock: source.adminLock === true,
    offShelfReason: source.offShelfReason || '',
    favoriteCount: source.favoriteCount === undefined || source.favoriteCount === null ? 0 : source.favoriteCount,
    viewCount: source.viewCount === undefined || source.viewCount === null ? 0 : source.viewCount,
    createdDate: itemView.formatDate(source.createdAt),
    updatedAt: formatDateTime(source.updatedAt),
    // 只有在售与草稿能强制下架：已下架/已删除不需要再下架一次，而已预订（有进行中订单）
    // 与已售出的商品一旦被下架，订单就再也走不完，服务端也会按 ITEM_NOT_EDITABLE 拒绝。
    offShelfable: source.status === enums.ItemStatus.ON_SALE || source.status === enums.ItemStatus.DRAFT
  };
}

function buildAdminItemViews(list) {
  return (list || []).map(buildAdminItemView);
}

// 审计详情的键值串。结构随动作变化，只做展示，不解释含义。
function formatDetail(detail) {
  if (!detail || typeof detail !== 'object') return '';
  return Object.keys(detail)
    .map(function (key) {
      const value = detail[key];
      return key + '=' + (value === null || value === undefined ? '' : String(value));
    })
    .join('  ');
}

function buildAuditLogView(log) {
  const source = log || {};
  const operator = source.operator || {};
  return {
    id: idOf(source.id),
    operatorName: operator.nickname || '系统',
    operatorId: idOf(operator.id),
    action: source.action || '',
    actionLabel: enums.auditActionLabel(source.action),
    targetType: source.targetType || '',
    targetTypeLabel: enums.auditTargetTypeLabel(source.targetType),
    targetId: idOf(source.targetId),
    requestId: source.requestId || '',
    detailText: formatDetail(source.detail),
    createdAt: formatDateTime(source.createdAt)
  };
}

function buildAuditLogViews(list) {
  return (list || []).map(buildAuditLogView);
}

module.exports = {
  buildCertificationView: buildCertificationView,
  buildCertificationViews: buildCertificationViews,
  buildUserView: buildUserView,
  buildUserViews: buildUserViews,
  buildAdminItemView: buildAdminItemView,
  buildAdminItemViews: buildAdminItemViews,
  formatDetail: formatDetail,
  buildAuditLogView: buildAuditLogView,
  buildAuditLogViews: buildAuditLogViews
};
