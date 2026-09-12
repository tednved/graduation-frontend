// store/session-store.js
// 会话的唯一来源。令牌、设备标识与用户摘要只在这里读写。
//
// 持久化字段：{ accessToken, refreshToken, deviceId, user, certificationStatus, savedAt }
// 存储不可用或内容损坏时一律返回 null，绝不抛错——页面据此走未登录分支。
//
// generation 用于解决「退出登录期间并发 401 刷新把会话写回来」的竞态：
// clearSession() 会自增 generation，刷新流程只有在 generation 未变化时才写回。

const STORAGE_KEY = 'session_v1';

let cache = null;
let generation = 0;
let listeners = [];

function safeGetRaw() {
  try {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw === '' || raw === undefined ? null : raw;
  } catch (error) {
    return null;
  }
}

function safeSetRaw(value) {
  try {
    if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') return;
    wx.setStorageSync(STORAGE_KEY, value);
  } catch (error) {
    // 存储写入失败不阻断内存态；下次启动会回到未登录。
  }
}

function safeRemoveRaw() {
  try {
    if (typeof wx === 'undefined' || typeof wx.removeStorageSync !== 'function') return;
    wx.removeStorageSync(STORAGE_KEY);
  } catch (error) {
    // 忽略
  }
}

// 只有结构合法的会话才被接受。accessToken 是后续所有受保护请求的前提。
function isValidSession(value) {
  return !!value && typeof value === 'object' && typeof value.accessToken === 'string' && value.accessToken.length > 0;
}

function notify() {
  const current = cache;
  listeners.slice().forEach(function (listener) {
    try {
      listener(current);
    } catch (error) {
      // 单个订阅者出错不影响其他订阅者。
    }
  });
}

// 读取当前会话；没有会话或内容损坏时返回 null。
function getSession() {
  if (cache) return cache;
  const raw = safeGetRaw();
  if (!isValidSession(raw)) {
    cache = null;
    return null;
  }
  cache = raw;
  return cache;
}

// 用 TokenResponse 构造会话对象，登录与刷新共用同一套字段名。
function createSession(tokenResponse, deviceId) {
  const data = tokenResponse || {};
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    deviceId: deviceId || null,
    user: data.user || null,
    // TokenResponse 的 certificationStatus 在顶层，用于首屏判断能否发布。
    certificationStatus: data.certificationStatus || null,
    savedAt: Date.now()
  };
}

function setSession(session) {
  if (!isValidSession(session)) return null;
  cache = session;
  safeSetRaw(session);
  notify();
  return cache;
}

// 清空会话并推进 generation：此后开始的刷新结果不再被接受。
function clearSession() {
  generation += 1;
  cache = null;
  safeRemoveRaw();
  notify();
  return null;
}

function getGeneration() {
  return generation;
}

function getAccessToken() {
  const session = getSession();
  return session ? session.accessToken : null;
}

function getRefreshToken() {
  const session = getSession();
  return session ? session.refreshToken : null;
}

function getUser() {
  const session = getSession();
  return session ? session.user : null;
}

// 局部更新用户摘要（例如资料保存成功后同步昵称、头像）。
function updateUser(patch) {
  const session = getSession();
  if (!session || !patch || typeof patch !== 'object') return session;
  const next = {};
  Object.keys(session).forEach(function (key) {
    next[key] = session[key];
  });
  next.user = Object.assign({}, session.user || {}, patch);
  if (Object.prototype.hasOwnProperty.call(patch, 'certificationStatus')) {
    next.certificationStatus = patch.certificationStatus;
    delete next.user.certificationStatus;
  }
  return setSession(next);
}

function subscribe(listener) {
  if (typeof listener !== 'function') return function () {};
  listeners.push(listener);
  return function unsubscribe() {
    listeners = listeners.filter(function (item) {
      return item !== listener;
    });
  };
}

// 仅供测试：清空进程内状态。存储由测试自己的 wx 替身负责。
function __resetForTest() {
  cache = null;
  generation = 0;
  listeners = [];
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  getSession: getSession,
  createSession: createSession,
  setSession: setSession,
  clearSession: clearSession,
  getGeneration: getGeneration,
  getAccessToken: getAccessToken,
  getRefreshToken: getRefreshToken,
  getUser: getUser,
  updateUser: updateUser,
  subscribe: subscribe,
  isValidSession: isValidSession,
  __resetForTest: __resetForTest
};
