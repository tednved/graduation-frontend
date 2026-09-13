// services/review-api.js
// 评价与信用接口（OpenAPI 第八节 8.9）。
//
// 评价的可见性、资格与对端状态都由后端裁定：页面先查 /orders/{id}/review-eligibility，
// 只有 canReview 为 true 才提交，不在前端推断「订单完成了就一定能评价」。
//
// 校验：评分 1～5 的整数，内容最多 500 字（可省略）。前端校验后后端仍会重复校验。

const request = require('./request.js');

const RATING_MIN = 1;
const RATING_MAX = 5;
const CONTENT_MAX = 500;

const VALIDATION_ERROR = 'VALIDATION_ERROR';

function validationError(message) {
  return Promise.reject({
    code: VALIDATION_ERROR,
    message: message,
    httpStatus: 0,
    requestId: null,
    action: 'toast'
  });
}

// 评分必须是 1～5 的整数。拒绝 "3.5"、0、6 与空值。
function normalizeRating(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && !/^[1-5]$/.test(value.trim())) return null;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(num) || num < RATING_MIN || num > RATING_MAX) return null;
  return num;
}

// 内容可省略；省略与空白等价，都表示「只打分不写字」。超出 500 字返回 null。
function normalizeContent(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > CONTENT_MAX) return null;
  return text;
}

// 组装请求体。content 为空时省略字段而不是发空串，避免后端把空串当作有内容。
function buildCreateBody(payload) {
  const source = payload || {};
  const rating = normalizeRating(source.rating);
  const content = normalizeContent(source.content);
  const body = {
    orderId: source.orderId === undefined || source.orderId === null ? null : String(source.orderId),
    rating: rating
  };
  if (content !== null) body.content = content;
  if (source.version !== undefined && source.version !== null) body.version = source.version;
  return body;
}

// 提交前的前端校验，返回 '' 表示通过。orderId 必须是十进制字符串。
function validate(payload) {
  const source = payload || {};
  if (!source.orderId) return '缺少订单参数';
  if (normalizeRating(source.rating) === null) {
    return '请选择 ' + RATING_MIN + '～' + RATING_MAX + ' 星评分';
  }
  const rawContent = source.content;
  if (rawContent !== null && rawContent !== undefined && String(rawContent).trim().length > CONTENT_MAX) {
    return '评价内容最多 ' + CONTENT_MAX + ' 字';
  }
  return '';
}

function create(payload) {
  const message = validate(payload);
  if (message) return validationError(message);
  return request.request({ method: 'POST', path: '/reviews', data: buildCreateBody(payload) });
}

// 仅订单双方可见：本人是否可评价、本人已有评价、对端是否已评价。
function eligibility(orderId) {
  return request.request({ method: 'GET', path: '/orders/' + orderId + '/review-eligibility' });
}

// 公开接口：某用户收到的可见评价，可按评分筛选。
function listByUser(userId, params) {
  const source = params || {};
  const query = {
    page: source.page === undefined || source.page === null ? 0 : source.page,
    size: source.size === undefined || source.size === null ? 20 : source.size
  };
  const rating = normalizeRating(source.rating);
  if (rating !== null) query.rating = rating;
  return request.request({ method: 'GET', path: '/users/' + userId + '/reviews', query: query, auth: false });
}

// 公开接口：平均分、评价总数与 1～5 分分布。
function getCredit(userId) {
  return request.request({ method: 'GET', path: '/users/' + userId + '/credit', auth: false });
}

module.exports = {
  RATING_MIN: RATING_MIN,
  RATING_MAX: RATING_MAX,
  CONTENT_MAX: CONTENT_MAX,
  normalizeRating: normalizeRating,
  normalizeContent: normalizeContent,
  buildCreateBody: buildCreateBody,
  validate: validate,
  create: create,
  eligibility: eligibility,
  listByUser: listByUser,
  getCredit: getCredit
};
