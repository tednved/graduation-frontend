// constants/error-codes.js
// 总纲 §7.2 全部 25 个错误码的前端副本。
// 每个错误码给出用户可读文案和 action 提示，页面与请求层不写死字符串。
//
// action 语义：
//   toast        直接提示，留在当前页
//   reauth       需要重新登录（跳登录页）
//   clearSession 清空本地会话（随后由页面决定跳转）
//   retry        可提示用户重试
//   none         静默处理

const ACTION = {
  TOAST: 'toast',
  REAUTH: 'reauth',
  CLEAR_SESSION: 'clearSession',
  RETRY: 'retry',
  NONE: 'none'
};

const ERROR_CODES = {
  VALIDATION_ERROR: { message: '请求参数不合法', action: ACTION.TOAST },
  AUTH_INVALID_CODE: { message: '微信登录凭证无效，请重试', action: ACTION.TOAST },
  AUTH_UNAUTHORIZED: { message: '登录状态已失效，请重新登录', action: ACTION.REAUTH },
  AUTH_REFRESH_INVALID: { message: '登录状态已失效，请重新登录', action: ACTION.CLEAR_SESSION },
  AUTH_FORBIDDEN: { message: '没有权限执行该操作', action: ACTION.TOAST },
  USER_DISABLED: { message: '账号已被停用，请联系管理员', action: ACTION.CLEAR_SESSION },
  USER_CERTIFICATION_REQUIRED: { message: '请先完成校园认证', action: ACTION.TOAST },
  RESOURCE_NOT_FOUND: { message: '内容不存在或已被删除', action: ACTION.TOAST },
  CERTIFICATION_PENDING_EXISTS: { message: '已有认证申请正在审核中', action: ACTION.TOAST },
  CERTIFICATION_ALREADY_REVIEWED: { message: '该认证申请已被审核', action: ACTION.TOAST },
  CATEGORY_IN_USE: { message: '分类下存在在售商品，无法停用', action: ACTION.TOAST },
  FILE_INVALID_TYPE: { message: '仅支持 JPEG、PNG、WebP 图片', action: ACTION.TOAST },
  FILE_TOO_LARGE: { message: '图片超过大小限制', action: ACTION.TOAST },
  FILE_NOT_OWNED: { message: '该文件不属于当前账号', action: ACTION.TOAST },
  ITEM_NOT_EDITABLE: { message: '当前状态下商品不可编辑', action: ACTION.TOAST },
  ITEM_NOT_AVAILABLE: { message: '商品当前不可购买', action: ACTION.TOAST },
  ITEM_SELF_PURCHASE: { message: '不能购买自己发布的商品', action: ACTION.TOAST },
  ITEM_CONCURRENTLY_RESERVED: { message: '商品已被他人下单', action: ACTION.TOAST },
  ITEM_SELF_OPERATION: { message: '不能对自己发布的商品执行该操作', action: ACTION.TOAST },
  ORDER_ILLEGAL_STATUS_TRANSITION: { message: '订单当前状态不允许该操作', action: ACTION.TOAST },
  ORDER_OPERATION_FORBIDDEN: { message: '你没有权限操作该订单', action: ACTION.TOAST },
  ORDER_DUPLICATE_REQUEST: { message: '请求重复，请勿重复提交', action: ACTION.TOAST },
  REVIEW_NOT_ALLOWED: { message: '当前订单不可评价', action: ACTION.TOAST },
  REVIEW_ALREADY_EXISTS: { message: '你已评价过该订单', action: ACTION.TOAST },
  INTERNAL_ERROR: { message: '服务异常，请稍后重试', action: ACTION.RETRY }
};

// 客户端本地合成的错误码，不在 §7.2 中，仅用于网络层失败。
const NETWORK_ERROR = 'NETWORK_ERROR';

const DEFAULT_MESSAGE = '请求失败，请稍后重试';

function messageForCode(code) {
  const entry = ERROR_CODES[code];
  return (entry && entry.message) || DEFAULT_MESSAGE;
}

function actionForCode(code) {
  const entry = ERROR_CODES[code];
  return (entry && entry.action) || ACTION.TOAST;
}

// 响应体不是合法 ApiError 时，按 HTTP 状态给出可用的兜底错误码。
function fallbackCodeForStatus(status) {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'AUTH_UNAUTHORIZED';
    case 403:
      return 'AUTH_FORBIDDEN';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 409:
      return 'ORDER_DUPLICATE_REQUEST';
    case 413:
      return 'FILE_TOO_LARGE';
    default:
      return 'INTERNAL_ERROR';
  }
}

// 把一次失败的 HTTP 响应归一化为 {code, message, httpStatus, requestId}。
// body 是已解析的 ApiError，或解析失败时为 null/undefined。
function normalizeHttpError(status, body, requestId) {
  const parsed = body && typeof body === 'object' ? body : null;
  const code = (parsed && typeof parsed.code === 'string' && parsed.code) || fallbackCodeForStatus(status);
  const message = (parsed && typeof parsed.message === 'string' && parsed.message) || messageForCode(code);
  return {
    code: code,
    message: message,
    httpStatus: status,
    requestId: (parsed && parsed.requestId) || requestId || null,
    action: actionForCode(code)
  };
}

module.exports = {
  ACTION: ACTION,
  ERROR_CODES: ERROR_CODES,
  NETWORK_ERROR: NETWORK_ERROR,
  DEFAULT_MESSAGE: DEFAULT_MESSAGE,
  messageForCode: messageForCode,
  actionForCode: actionForCode,
  fallbackCodeForStatus: fallbackCodeForStatus,
  normalizeHttpError: normalizeHttpError
};
