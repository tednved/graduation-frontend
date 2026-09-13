// services/admin-api.js
// 管理端接口（OpenAPI 管理端四节）。字段与方法严格对齐契约，未使用的字段一律不发。
//
// 进入本文件的方法都要求调用者是 ADMIN，但前端不做任何权限推断：
// 服务端在事务内重新读库判定角色，降权立即生效。页面上「入口是否可见」只是体验，
// 不是门禁——直接导航到管理页也要由服务端返回 403 才算真的拦住。
//
// 所有 ID 一律按十进制字符串处理：BIGINT 超出 JS 安全整数范围，parseInt/Number 会丢精度。

const request = require('./request.js');

const REASON_MIN = 2;
const REASON_MAX = 200;
const VALIDATION_ERROR = 'VALIDATION_ERROR';
const DEFAULT_PAGE_SIZE = 20;

function validationError(message) {
  return Promise.reject({
    code: VALIDATION_ERROR,
    message: message,
    httpStatus: 0,
    requestId: null,
    action: 'toast'
  });
}

// 原因长度 2～200（契约 AdminReasonRequest / RejectCertificationRequest）。先做前端校验，后端仍会重复校验。
function normalizeReason(reason) {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < REASON_MIN || text.length > REASON_MAX) return null;
  return text;
}

function reasonError() {
  return '请填写 ' + REASON_MIN + '～' + REASON_MAX + ' 字的原因';
}

// 分页参数统一补齐：page 从 0 开始，size 省略时用默认值。
function pageQuery(source) {
  return {
    page: source.page === undefined || source.page === null ? 0 : source.page,
    size: source.size === undefined || source.size === null ? DEFAULT_PAGE_SIZE : source.size
  };
}

// 可选筛选项只在有值时下发，空串等同于「不筛选」。
// 字符串先去掉首尾空白：小程序输入框很容易留下空白，空白关键字不该被当成筛选条件发出去。
function putIfPresent(query, key, value) {
  if (value === undefined || value === null) return;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return;
  query[key] = normalized;
}

// 认证审核列表。status 省略表示全部。
function listCertifications(params) {
  const source = params || {};
  const query = pageQuery(source);
  putIfPresent(query, 'status', source.status);
  return request.request({ method: 'GET', path: '/admin/certifications', query: query });
}

function approveCertification(id) {
  return request.request({ method: 'POST', path: '/admin/certifications/' + id + '/approve' });
}

function rejectCertification(id, reason) {
  const text = normalizeReason(reason);
  if (text === null) return validationError(reasonError());
  return request.request({
    method: 'POST',
    path: '/admin/certifications/' + id + '/reject',
    data: { reason: text }
  });
}

// 用户列表：关键字、账号状态、认证状态三个筛选都可以省略。
function listUsers(params) {
  const source = params || {};
  const query = pageQuery(source);
  putIfPresent(query, 'keyword', source.keyword);
  putIfPresent(query, 'status', source.status);
  putIfPresent(query, 'certificationStatus', source.certificationStatus);
  return request.request({ method: 'GET', path: '/admin/users', query: query });
}

// 禁用会同时撤销该用户全部刷新令牌；后端拒绝禁用自己。
function disableUser(id) {
  return request.request({ method: 'POST', path: '/admin/users/' + id + '/disable' });
}

function enableUser(id) {
  return request.request({ method: 'POST', path: '/admin/users/' + id + '/enable' });
}

// 商品列表：不受 ON_SALE 限制。后端的 status 是列表，这里只发单个取值，
// 请求层把 query 值按 String() 序列化，发数组会拼成 "A,B" 而不是重复参数。
function listItems(params) {
  const source = params || {};
  const query = pageQuery(source);
  putIfPresent(query, 'status', source.status);
  putIfPresent(query, 'keyword', source.keyword);
  putIfPresent(query, 'sellerId', source.sellerId);
  return request.request({ method: 'GET', path: '/admin/items', query: query });
}

function offShelfItem(id, reason) {
  const text = normalizeReason(reason);
  if (text === null) return validationError(reasonError());
  return request.request({
    method: 'POST',
    path: '/admin/items/' + id + '/off-shelf',
    data: { reason: text }
  });
}

// 审计查询，只读。from / to 是 UTC ISO-8601，接口层两端都含。
function listAuditLogs(params) {
  const source = params || {};
  const query = pageQuery(source);
  putIfPresent(query, 'operatorId', source.operatorId);
  putIfPresent(query, 'action', source.action);
  putIfPresent(query, 'targetType', source.targetType);
  putIfPresent(query, 'targetId', source.targetId);
  putIfPresent(query, 'from', source.from);
  putIfPresent(query, 'to', source.to);
  return request.request({ method: 'GET', path: '/admin/audit-logs', query: query });
}

module.exports = {
  REASON_MIN: REASON_MIN,
  REASON_MAX: REASON_MAX,
  DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
  normalizeReason: normalizeReason,
  reasonError: reasonError,
  listCertifications: listCertifications,
  approveCertification: approveCertification,
  rejectCertification: rejectCertification,
  listUsers: listUsers,
  disableUser: disableUser,
  enableUser: enableUser,
  listItems: listItems,
  offShelfItem: offShelfItem,
  listAuditLogs: listAuditLogs
};
