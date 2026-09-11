// utils/id.js
// 请求标识与设备标识的生成。
//
// 约束（来自 OpenAPI 的 RequestId schema）：只允许 ASCII 字母、数字、下划线和连字符，
// 长度 1～64。小程序环境不保证存在 crypto，因此用时间戳 + 计数器 + 随机串组合，
// 保证同一会话内不重复。

const DEVICE_ID_KEY = 'device_id';

// 允许的字符集与长度上限
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

let sequence = 0;

function randomBlock(length) {
  let out = '';
  while (out.length < length) {
    out += Math.floor(Math.random() * 0x100000000).toString(36);
  }
  return out.slice(0, length);
}

function isValidId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

// 每次调用都产生一个新的请求标识。
function newRequestId() {
  sequence = (sequence + 1) % 0xffff;
  const id = 'r' + Date.now().toString(36) + '-' + sequence.toString(36) + '-' + randomBlock(8);
  // 极端情况下长度仍在上限内，这里做一次保护性截断。
  return id.length > 64 ? id.slice(0, 64) : id;
}

function newDeviceId() {
  const id = 'd' + Date.now().toString(36) + '-' + randomBlock(10);
  return id.length > 64 ? id.slice(0, 64) : id;
}

function readStoredDeviceId() {
  try {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
    const value = wx.getStorageSync(DEVICE_ID_KEY);
    return isValidId(value) ? value : null;
  } catch (error) {
    return null;
  }
}

function persistDeviceId(value) {
  try {
    if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') return;
    wx.setStorageSync(DEVICE_ID_KEY, value);
  } catch (error) {
    // 存储不可用时退化为进程内设备标识，不阻断登录流程。
  }
}

let cachedDeviceId = null;

// 设备标识生成一次并持久化；存储损坏或不可用时重新生成，绝不抛错。
function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = readStoredDeviceId();
  if (stored) {
    cachedDeviceId = stored;
    return cachedDeviceId;
  }
  const created = newDeviceId();
  persistDeviceId(created);
  cachedDeviceId = created;
  return cachedDeviceId;
}

// 仅供测试：清空进程内缓存。
function __resetForTest() {
  cachedDeviceId = null;
  sequence = 0;
}

module.exports = {
  ID_PATTERN: ID_PATTERN,
  DEVICE_ID_KEY: DEVICE_ID_KEY,
  newRequestId: newRequestId,
  newDeviceId: newDeviceId,
  getDeviceId: getDeviceId,
  isValidId: isValidId,
  __resetForTest: __resetForTest
};
