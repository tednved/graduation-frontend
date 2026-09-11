// tests/helpers/transport.js
// 可手动控制响应时机的传输替身，用于验证单飞刷新、重放与并发行为。

function createDeferredTransport() {
  const calls = [];
  const transport = function (options) {
    calls.push(options);
  };
  transport.calls = calls;

  transport.respond = function (index, res) {
    const call = calls[index];
    if (!call) throw new Error('没有第 ' + index + ' 次调用');
    call.success(res);
  };

  transport.respondJson = function (index, statusCode, body) {
    transport.respond(index, { statusCode: statusCode, data: body, header: {} });
  };

  transport.fail = function (index, cause) {
    const call = calls[index];
    if (!call) throw new Error('没有第 ' + index + ' 次调用');
    call.fail(cause || { errMsg: 'request:fail' });
  };

  transport.urls = function () {
    return calls.map(function (call) {
      return call.url;
    });
  };

  return transport;
}

// 等待挂起的 Promise 链跑完。
function tick() {
  return new Promise(function (resolve) {
    setImmediate(resolve);
  });
}

function ok(data) {
  return {
    code: 'OK',
    message: 'success',
    requestId: 'r-test',
    timestamp: '2026-09-11T00:00:00.000Z',
    data: data
  };
}

function apiError(code, message) {
  return {
    code: code,
    message: message || code,
    data: null,
    requestId: 'r-test',
    timestamp: '2026-09-11T00:00:00.000Z'
  };
}

function tokenResponse(overrides) {
  return Object.assign({
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshExpiresIn: 2592000,
    user: { id: '1', nickname: '测试用户', avatarUrl: null },
    certificationStatus: 'NOT_SUBMITTED'
  }, overrides || {});
}

module.exports = {
  createDeferredTransport: createDeferredTransport,
  tick: tick,
  ok: ok,
  apiError: apiError,
  tokenResponse: tokenResponse
};
