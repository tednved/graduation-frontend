// services/item-api.js
// 商品接口。字段与方法严格对齐已合并 OpenAPI（第八节 8.6）。
//
// 单校区约束：任何请求都不携带 campusId，创建时校区由后端绑定 MAIN。

const request = require('./request.js');

// 金额在契约里是两位小数字符串（^[0-9]+\.[0-9]{2}$）。前端的数字输入统一在这里
// 收敛成线格式，避免 "10" 与 "10.00" 两种写法同时出现在请求里。
function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  // 只接受十进制、最多两位小数的写法：拒绝 1e3、负数、多小数点，
  // 以及 10.999 这类会被 toFixed 悄悄四舍五入的输入。
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const num = Number(text);
  if (!isFinite(num)) return null;
  const fixed = num.toFixed(2);
  // 超过 1e21 会退化成指数写法，不再符合契约的两位小数字符串。
  if (fixed.indexOf('e') >= 0 || fixed.indexOf('E') >= 0) return null;
  return fixed;
}

// 搜索参数：省略空值，只发送有意义的筛选项。
// 契约中 keyword 长度 1～50，空串在下拉选项里表示「不限」。
function normalizeSearchParams(params) {
  const source = params || {};
  const query = {};

  const keyword = typeof source.keyword === 'string' ? source.keyword.trim() : '';
  if (keyword) query.keyword = keyword;
  if (source.categoryId) query.categoryId = source.categoryId;
  if (source.condition) query.condition = source.condition;

  const minPrice = normalizeMoney(source.minPrice);
  if (minPrice !== null) query.minPrice = minPrice;
  const maxPrice = normalizeMoney(source.maxPrice);
  if (maxPrice !== null) query.maxPrice = maxPrice;

  if (source.sort) query.sort = source.sort;

  query.page = source.page === undefined || source.page === null ? 0 : source.page;
  query.size = source.size === undefined || source.size === null ? 20 : source.size;
  return query;
}

// 公开搜索：只返回 ON_SALE，匿名可访问。
function search(params) {
  return request.request({
    method: 'GET',
    path: '/items',
    query: normalizeSearchParams(params),
    auth: false
  });
}

// 公开详情。携带令牌时后端额外返回 favorited/isOwner/canBuy；
// 未登录时会话里没有令牌，请求自然退化为匿名，页面无需分支。
function getDetail(itemId) {
  return request.request({ method: 'GET', path: '/items/' + itemId });
}

// 创建草稿。imageFileIds 必须是有序的 ITEM_IMAGE 文件 ID 列表。
function createItem(payload) {
  return request.request({ method: 'POST', path: '/items', data: buildWriteBody(payload) });
}

// 全量替换；必须携带当前 version，否则后端返回 ITEM_NOT_EDITABLE。
function updateItem(itemId, payload) {
  return request.request({ method: 'PUT', path: '/items/' + itemId, data: buildWriteBody(payload) });
}

function buildWriteBody(payload) {
  const source = payload || {};
  const body = {
    title: source.title,
    description: source.description,
    price: normalizeMoney(source.price),
    condition: source.condition,
    categoryId: source.categoryId,
    imageFileIds: (source.imageFileIds || []).map(String)
  };
  // 原价留空表示没有原价，契约允许 null。
  body.originalPrice = normalizeMoney(source.originalPrice);
  if (source.version !== undefined && source.version !== null) body.version = source.version;
  return body;
}

function publishItem(itemId) {
  return request.request({ method: 'POST', path: '/items/' + itemId + '/publish' });
}

function takeOffShelf(itemId) {
  return request.request({ method: 'POST', path: '/items/' + itemId + '/off-shelf' });
}

// 删除是状态变更（DELETED），成功返回 204，无响应体。
function removeItem(itemId) {
  return request.request({ method: 'DELETE', path: '/items/' + itemId });
}

// 我的发布：包含全部状态，可按状态筛选。
function listMine(params) {
  const source = params || {};
  const query = {
    page: source.page === undefined || source.page === null ? 0 : source.page,
    size: source.size === undefined || source.size === null ? 20 : source.size
  };
  if (source.status) query.status = source.status;
  return request.request({ method: 'GET', path: '/users/me/items', query: query });
}

module.exports = {
  normalizeMoney: normalizeMoney,
  normalizeSearchParams: normalizeSearchParams,
  search: search,
  getDetail: getDetail,
  createItem: createItem,
  updateItem: updateItem,
  publishItem: publishItem,
  takeOffShelf: takeOffShelf,
  removeItem: removeItem,
  listMine: listMine
};
