// services/order-api.js
// 订单接口（OpenAPI 第八节 8.8）。字段与方法严格对齐契约，未使用的字段一律不发。
//
// 幂等：POST /orders 以「当前用户 + clientRequestId」为幂等键，同键同内容的重放返回 200 与原订单，
// 因此 clientRequestId 由调用方（页面）在用户点击下单时生成一次并在重试之间复用；
// 请求层本身对写请求不自动重试，两者共同保证不会重复下单。
//
// 所有 ID 一律按十进制字符串处理：BIGINT 超出 JS 安全整数范围，parseInt/Number 会丢精度。

const request = require('./request.js');
const id = require('../utils/id.js');
const enums = require('../constants/enums.js');

const REASON_MIN = 2;
const REASON_MAX = 200;

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

// 下单幂等键。与请求层的 X-Request-Id 是两件事：后者标识一次 HTTP 往返，
// 前者标识一次「用户下单意图」，因此只在用户动作发生时生成。
function newClientRequestId() {
  return id.newRequestId();
}

// 原因长度 2～200（契约 OrderReasonRequest）。先做前端校验，后端仍会重复校验。
function normalizeReason(reason) {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < REASON_MIN || text.length > REASON_MAX) return null;
  return text;
}

function reasonError() {
  return '请填写 ' + REASON_MIN + '～' + REASON_MAX + ' 字的原因';
}

// 创建订单。MVP 只接受 OFFLINE。
function create(itemId, clientRequestId, tradeMode) {
  if (itemId === undefined || itemId === null || itemId === '') {
    return validationError('缺少商品参数');
  }
  if (typeof clientRequestId !== 'string' || !clientRequestId.length || clientRequestId.length > 64) {
    return validationError('缺少下单请求标识');
  }
  return request.request({
    method: 'POST',
    path: '/orders',
    data: {
      itemId: String(itemId),
      tradeMode: tradeMode || enums.TradeMode.OFFLINE,
      clientRequestId: clientRequestId
    }
  });
}

// 仅买家、卖家或管理员可见；返回快照、事件时间线与 allowedActions。
function getDetail(orderId) {
  return request.request({ method: 'GET', path: '/orders/' + orderId });
}

function confirm(orderId) {
  return request.request({ method: 'POST', path: '/orders/' + orderId + '/confirm' });
}

function reject(orderId, reason) {
  const text = normalizeReason(reason);
  if (text === null) return validationError(reasonError());
  return request.request({ method: 'POST', path: '/orders/' + orderId + '/reject', data: { reason: text } });
}

function cancel(orderId, reason) {
  const text = normalizeReason(reason);
  if (text === null) return validationError(reasonError());
  return request.request({ method: 'POST', path: '/orders/' + orderId + '/cancel', data: { reason: text } });
}

function deliver(orderId) {
  return request.request({ method: 'POST', path: '/orders/' + orderId + '/deliver' });
}

function receive(orderId) {
  return request.request({ method: 'POST', path: '/orders/' + orderId + '/receive' });
}

// 我的订单：side 必填（BUY 买入 / SELL 卖出），status 省略表示全部。
function listMine(params) {
  const source = params || {};
  const query = {
    side: source.side === enums.OrderSide.SELL ? enums.OrderSide.SELL : enums.OrderSide.BUY,
    page: source.page === undefined || source.page === null ? 0 : source.page,
    size: source.size === undefined || source.size === null ? 20 : source.size
  };
  if (source.status) query.status = source.status;
  return request.request({ method: 'GET', path: '/users/me/orders', query: query });
}

module.exports = {
  REASON_MIN: REASON_MIN,
  REASON_MAX: REASON_MAX,
  newClientRequestId: newClientRequestId,
  normalizeReason: normalizeReason,
  reasonError: reasonError,
  create: create,
  getDetail: getDetail,
  confirm: confirm,
  reject: reject,
  cancel: cancel,
  deliver: deliver,
  receive: receive,
  listMine: listMine
};
