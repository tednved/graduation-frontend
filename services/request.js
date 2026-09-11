// services/request.js
// 统一的请求层：令牌注入、请求标识、ApiResponse 拆包、错误归一化、
// 401 单飞刷新 + 一次重放、网络失败仅 GET 重试。
//
// 约定（与已合并 OpenAPI 和 contract-decisions 一致）：
//   - 成功响应体一律是 ApiResponse，业务数据在 data 字段；204 无响应体。
//   - 401 且带令牌时刷新一次并重放一次；登录/刷新接口自身不参与刷新。
//   - USER_DISABLED 立即清空本地会话，由调用方决定跳转。
//   - 写请求永不自动重试，避免重复提交。

const config = require('../config/index.js');
const id = require('../utils/id.js');
const store = require('../store/session-store.js');
const errors = require('../constants/error-codes.js');

const NETWORK_ERROR_MESSAGE = '网络连接失败，请检查网络后重试';
const REFRESH_PATH = '/auth/refresh';

let transport = defaultTransport;
let uploadTransport = defaultUploadTransport;
let refreshPromise = null;

function defaultTransport(options) {
  wx.request(options);
}

function defaultUploadTransport(options) {
  wx.uploadFile(options);
}

// 供测试替换网络实现。
function __setTransport(fn) {
  transport = fn;
}

function __setUploadTransport(fn) {
  uploadTransport = fn;
}

function __resetForTest() {
  transport = defaultTransport;
  uploadTransport = defaultUploadTransport;
  refreshPromise = null;
}

function buildQuery(query) {
  if (!query || typeof query !== 'object') return '';
  const parts = [];
  Object.keys(query).forEach(function (key) {
    const value = query[key];
    if (value === undefined || value === null) return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  return parts.length ? '?' + parts.join('&') : '';
}

function buildUrl(opts) {
  const path = opts.path.charAt(0) === '/' ? opts.path : '/' + opts.path;
  return config.baseUrl + path + buildQuery(opts.query);
}

function buildHeader(opts, requestId) {
  const header = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId
  };
  if (opts.auth !== false) {
    const token = store.getAccessToken();
    if (token) header.Authorization = 'Bearer ' + token;
  }
  return header;
}

function networkError(cause, requestId) {
  return {
    code: errors.NETWORK_ERROR,
    message: NETWORK_ERROR_MESSAGE,
    httpStatus: 0,
    requestId: requestId || null,
    action: errors.ACTION.RETRY,
    cause: cause || null
  };
}

// 204 无响应体；其余情况兼容服务端返回已解析对象或 JSON 字符串。
function parseBody(res) {
  const raw = res && res.data;
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

function normalizeOptions(options) {
  const opts = options || {};
  return {
    method: (opts.method || 'GET').toUpperCase(),
    path: opts.path,
    query: opts.query || null,
    data: opts.data,
    auth: opts.auth !== false,
    skipAuthRefresh: opts.skipAuthRefresh === true,
    timeout: opts.timeout || config.requestTimeout
  };
}

// 一次底层发送。GET 遇到网络失败时按配置重试，写请求立即失败。
// 同一个逻辑请求的 requestId 在重试之间保持不变，便于后端日志串联。
function perform(opts, requestId, attempt) {
  return new Promise(function (resolve, reject) {
    const payload = {
      url: buildUrl(opts),
      method: opts.method,
      header: buildHeader(opts, requestId),
      timeout: opts.timeout,
      success: function (res) {
        // 统一响应形状：微信回调给的是 statusCode，归一化后下游只认 statusCode。
        resolve({
          statusCode: res ? res.statusCode : 0,
          data: res ? res.data : null,
          header: res ? res.header : null
        });
      },
      fail: function (cause) {
        if (opts.method === 'GET' && attempt < config.maxNetworkRetries) {
          perform(opts, requestId, attempt + 1).then(resolve, reject);
          return;
        }
        reject(networkError(cause, requestId));
      }
    };
    // GET 的参数已拼进 URL，避免再被序列化一次。
    if (opts.method !== 'GET') payload.data = opts.data;
    transport(payload);
  });
}

// 单飞刷新：并发的 401 只会触发一次刷新，其余请求等同一个 Promise。
function ensureRefresh() {
  if (refreshPromise) return refreshPromise;

  const session = store.getSession();
  const refreshToken = session && session.refreshToken;
  if (!refreshToken) {
    return Promise.reject({
      code: 'AUTH_UNAUTHORIZED',
      message: errors.messageForCode('AUTH_UNAUTHORIZED'),
      httpStatus: 401,
      requestId: null,
      action: errors.ACTION.REAUTH
    });
  }

  const startGeneration = store.getGeneration();
  const deviceId = session.deviceId || id.getDeviceId();
  const requestId = id.newRequestId();
  const refreshOpts = normalizeOptions({
    method: 'POST',
    path: REFRESH_PATH,
    data: { refreshToken: refreshToken, deviceId: deviceId },
    auth: false,
    skipAuthRefresh: true
  });

  refreshPromise = perform(refreshOpts, requestId, 0).then(function (res) {
    const body = parseBody(res);
    if (res.statusCode >= 200 && res.statusCode < 300 && body) {
      // 退出登录会推进 generation，此时刷新结果必须被丢弃。
      if (store.getGeneration() !== startGeneration) {
        return Promise.reject(refreshCanceled());
      }
      store.setSession(store.createSession(body.data || body, deviceId));
      return true;
    }
    if (body && body.code === 'AUTH_REFRESH_INVALID') store.clearSession();
    return Promise.reject(normalizeFailure(res, body, requestId, 'AUTH_REFRESH_INVALID'));
  }).then(function (result) {
    refreshPromise = null;
    return result;
  }, function (error) {
    refreshPromise = null;
    return Promise.reject(error);
  });

  return refreshPromise;
}

function refreshCanceled() {
  return {
    code: 'AUTH_UNAUTHORIZED',
    message: errors.messageForCode('AUTH_UNAUTHORIZED'),
    httpStatus: 401,
    requestId: null,
    action: errors.ACTION.REAUTH
  };
}

function normalizeFailure(res, body, requestId, fallbackCode) {
  const normalized = errors.normalizeHttpError(res ? res.statusCode : 0, body, requestId);
  if (fallbackCode && (!body || typeof body.code !== 'string')) normalized.code = fallbackCode;
  normalized.message = errors.messageForCode(normalized.code) || normalized.message;
  normalized.action = errors.actionForCode(normalized.code);
  return normalized;
}

function unwrap(res, body) {
  if (res.statusCode === 204) return undefined;
  if (body && typeof body === 'object') return body.data;
  return res.data;
}

function sendRequest(opts, requestId, allowReplay) {
  return perform(opts, requestId, 0).then(function (res) {
    const body = parseBody(res);
    const code = body && typeof body.code === 'string' ? body.code : null;

    if (code === 'USER_DISABLED') store.clearSession();

    if (res.statusCode >= 200 && res.statusCode < 300) return unwrap(res, body);

    if (
      res.statusCode === 401 &&
      allowReplay &&
      opts.auth !== false &&
      !opts.skipAuthRefresh
    ) {
      return ensureRefresh().then(function () {
        return sendRequest(opts, requestId, false);
      });
    }

    if (code === 'AUTH_REFRESH_INVALID') store.clearSession();

    return Promise.reject(normalizeFailure(res, body, requestId, null));
  });
}

// 发出一个请求，成功时 resolve 拆包后的 data（204 为 undefined）。
function request(options) {
  const opts = normalizeOptions(options);
  return sendRequest(opts, id.newRequestId(), true);
}

// 文件上传。使用 wx.uploadFile，字段名固定为 file。
// 上传属于写操作，网络失败不重试；401 仍会刷新一次后重放。
function performUpload(opts, requestId, allowReplay) {
  return new Promise(function (resolve, reject) {
    uploadTransport({
      url: buildUrl(opts),
      filePath: opts.filePath,
      name: opts.name,
      formData: opts.formData || {},
      header: buildHeader(opts, requestId),
      timeout: opts.timeout,
      success: function (res) {
        // 统一响应形状：微信回调给的是 statusCode，归一化后下游只认 statusCode。
        resolve({
          statusCode: res ? res.statusCode : 0,
          data: res ? res.data : null,
          header: res ? res.header : null
        });
      },
      fail: function (cause) {
        reject(networkError(cause, requestId));
      }
    });
  }).then(function (res) {
    const body = parseBody(res);
    const code = body && typeof body.code === 'string' ? body.code : null;

    if (code === 'USER_DISABLED') store.clearSession();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body && typeof body === 'object' ? body.data : body;
    }

    if (res.statusCode === 401 && allowReplay && opts.auth !== false && !opts.skipAuthRefresh) {
      return ensureRefresh().then(function () {
        return performUpload(opts, requestId, false);
      });
    }

    if (code === 'AUTH_REFRESH_INVALID') store.clearSession();

    return Promise.reject(
      errors.normalizeHttpError(res.statusCode, body, requestId)
    );
  });
}

function upload(options) {
  const source = options || {};
  const opts = {
    path: source.path,
    query: source.query || null,
    filePath: source.filePath,
    name: source.name || 'file',
    formData: source.formData || {},
    auth: source.auth !== false,
    skipAuthRefresh: source.skipAuthRefresh === true,
    timeout: source.timeout || config.uploadTimeout
  };
  return performUpload(opts, id.newRequestId(), true);
}

module.exports = {
  request: request,
  upload: upload,
  ensureRefresh: ensureRefresh,
  __setTransport: __setTransport,
  __setUploadTransport: __setUploadTransport,
  __resetForTest: __resetForTest,
  __buildUrl: buildUrl
};
