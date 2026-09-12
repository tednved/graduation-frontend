// config/index.js
// 前端运行时配置。这里只放环境相关常量，不放任何密钥或令牌。
// 后端基础路径见已合并 OpenAPI 的 servers：/api/v1。

const config = {
  // 后端基础路径。微信开发者工具本地联调指向本机后端服务。
  baseUrl: 'http://127.0.0.1:8080/api/v1',

  // 普通请求超时（毫秒）
  requestTimeout: 10000,

  // 文件上传超时（毫秒）。上传比普通请求慢，单独给更长的超时。
  uploadTimeout: 60000,

  // 网络层失败（不是 HTTP 错误）时 GET 的自动重试次数。
  // 写请求永不自动重试：避免重复下单、重复提交认证等副作用。
  maxNetworkRetries: 1
};

module.exports = config;
