// 将后端返回的站内媒体相对地址转换为小程序可直接访问的绝对地址。
// 业务 API 位于 /api/v1，而公开文件位于 /media，不能把 `/media/{id}`
// 直接交给 <image>，否则小程序会将其视为自身资源路径。

const config = require('../config/index.js');

function resolveMediaUrl(url) {
  if (!url) return '';
  const value = String(url);
  if (/^(?:https?:|wxfile:|cloud:|data:)/i.test(value)) return value;
  if (value.charAt(0) !== '/') return value;

  const origin = String(config.baseUrl || '').match(/^(https?:\/\/[^/]+)/i);
  return origin ? origin[1] + value : value;
}

module.exports = {
  resolveMediaUrl: resolveMediaUrl
};
