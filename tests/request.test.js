// tests/request.test.js
// 覆盖验收要求的关键路径：单飞刷新、退出竞态、204、GET 一次网络重试、
// 写请求不重试、USER_DISABLED 清空会话、登录/刷新不参与自动刷新。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('./helpers/wx-stub.js');
wxStub.install();

const t = require('./helpers/transport.js');
const config = require('../config/index.js');
const request = require('../services/request.js');
const store = require('../store/session-store.js');
const id = require('../utils/id.js');
const userApi = require('../services/user-api.js');
const certApi = require('../services/certification-api.js');
const categoryApi = require('../services/category-api.js');
const fileApi = require('../services/file-api.js');
const authApi = require('../services/auth-api.js');

let transport;

// 立即挂上 catch，避免测试期间出现未处理的 Promise 拒绝。
function capture(promise) {
  const box = { error: null, value: undefined, settled: false };
  box.promise = promise.then(
    function (value) {
      box.value = value;
      box.settled = true;
    },
    function (error) {
      box.error = error;
      box.settled = true;
    }
  );
  return box;
}

beforeEach(function () {
  wxStub.reset();
  store.__resetForTest();
  id.__resetForTest();
  request.__resetForTest();
  transport = t.createDeferredTransport();
  request.__setTransport(transport);
  store.setSession({
    accessToken: 'a1',
    refreshToken: 'r1',
    deviceId: 'd1',
    user: { id: '1', nickname: 'n' },
    certificationStatus: 'NOT_SUBMITTED'
  });
});

describe('request 层', function () {
  it('并发 401 只触发一次刷新，并各自重放一次', async function () {
    const first = capture(userApi.getMe());
    const second = capture(certApi.getLatest());
    await t.tick();

    assert.equal(transport.calls.length, 2);
    transport.respondJson(0, 401, t.apiError('AUTH_UNAUTHORIZED'));
    transport.respondJson(1, 401, t.apiError('AUTH_UNAUTHORIZED'));
    await t.tick();

    assert.equal(transport.calls.length, 3, '并发 401 只应产生一次刷新请求');
    assert.equal(transport.calls[2].url, config.baseUrl + '/auth/refresh');
    assert.deepEqual(transport.calls[2].data, { refreshToken: 'r1', deviceId: 'd1' });

    transport.respondJson(2, 200, t.ok(t.tokenResponse({ accessToken: 'a2', refreshToken: 'r2' })));
    await t.tick();

    assert.equal(transport.calls.length, 5, '每个请求各重放一次');
    transport.respondJson(3, 200, t.ok({ id: '1', nickname: 'n' }));
    transport.respondJson(4, 200, t.ok({ status: 'NOT_SUBMITTED', application: null }));

    await Promise.all([first.promise, second.promise]);
    assert.equal(first.value.nickname, 'n');
    assert.equal(second.value.status, 'NOT_SUBMITTED');
    assert.equal(store.getAccessToken(), 'a2');
    assert.equal(store.getRefreshToken(), 'r2');
  });

  it('刷新失败时清空会话并以 AUTH_REFRESH_INVALID 拒绝', async function () {
    const box = capture(userApi.getMe());
    await t.tick();
    transport.respondJson(0, 401, t.apiError('AUTH_UNAUTHORIZED'));
    await t.tick();
    transport.respondJson(1, 401, t.apiError('AUTH_REFRESH_INVALID'));
    await box.promise;

    assert.equal(box.error.code, 'AUTH_REFRESH_INVALID');
    assert.equal(box.error.action, 'clearSession');
    assert.equal(store.getSession(), null);
    assert.equal(transport.calls.length, 2);
  });

  it('退出登录期间返回的刷新结果不会复活会话', async function () {
    const box = capture(userApi.getMe());
    await t.tick();
    transport.respondJson(0, 401, t.apiError('AUTH_UNAUTHORIZED'));
    await t.tick();
    assert.equal(transport.calls.length, 2, '刷新请求已发出');

    store.clearSession(); // 用户在刷新返回前退出

    transport.respondJson(1, 200, t.ok(t.tokenResponse({ accessToken: 'a2', refreshToken: 'r2' })));
    await box.promise;

    assert.equal(store.getSession(), null, '刷新结果不得写回会话');
    assert.equal(box.error.code, 'AUTH_UNAUTHORIZED');
    assert.equal(transport.calls.length, 2, '不得重放原请求');
  });

  it('204 解析为 undefined 并清空本地会话', async function () {
    const box = capture(authApi.logout());
    await t.tick();
    assert.equal(transport.calls[0].url, config.baseUrl + '/auth/logout');
    transport.respond(0, { statusCode: 204, data: '', header: {} });
    await box.promise;

    assert.equal(box.value, undefined);
    assert.equal(store.getSession(), null);
  });

  it('GET 网络失败自动重试一次，并复用同一请求标识', async function () {
    const box = capture(userApi.getMe());
    await t.tick();
    const firstId = transport.calls[0].header['X-Request-Id'];

    transport.fail(0, { errMsg: 'request:fail timeout' });
    await t.tick();

    assert.equal(transport.calls.length, 2);
    assert.equal(transport.calls[1].url, transport.calls[0].url);
    assert.equal(transport.calls[1].header['X-Request-Id'], firstId);

    transport.respondJson(1, 200, t.ok({ id: '1', nickname: 'n' }));
    await box.promise;
    assert.equal(box.value.nickname, 'n');
  });

  it('GET 重试后仍失败则以 NETWORK_ERROR 拒绝', async function () {
    const box = capture(userApi.getMe());
    await t.tick();
    transport.fail(0, { errMsg: 'request:fail timeout' });
    await t.tick();
    transport.fail(1, { errMsg: 'request:fail timeout' });
    await box.promise;

    assert.equal(box.error.code, 'NETWORK_ERROR');
    assert.equal(box.error.action, 'retry');
    assert.equal(transport.calls.length, 2);
  });

  it('写请求网络失败不自动重试', async function () {
    const box = capture(certApi.submitManual('TestUser', '2021000000'));
    await t.tick();
    transport.fail(0, { errMsg: 'request:fail timeout' });
    await box.promise;

    assert.equal(transport.calls.length, 1, '写请求不得自动重试');
    assert.equal(box.error.code, 'NETWORK_ERROR');
  });

  it('USER_DISABLED 立即清空本地会话且不触发刷新', async function () {
    const box = capture(userApi.getMe());
    await t.tick();
    transport.respondJson(0, 403, t.apiError('USER_DISABLED'));
    await box.promise;

    assert.equal(store.getSession(), null);
    assert.equal(box.error.code, 'USER_DISABLED');
    assert.equal(box.error.action, 'clearSession');
    assert.equal(transport.calls.length, 1);
  });

  it('登录接口 401 不参与自动刷新', async function () {
    const box = capture(authApi.wechatLogin('test-login-code', 'd1'));
    await t.tick();
    transport.respondJson(0, 401, t.apiError('AUTH_INVALID_CODE'));
    await box.promise;

    assert.equal(transport.calls.length, 1);
    assert.equal(box.error.code, 'AUTH_INVALID_CODE');
  });

  it('重放后再次 401 不再刷新', async function () {
    const box = capture(userApi.getMe());
    await t.tick();
    transport.respondJson(0, 401, t.apiError('AUTH_UNAUTHORIZED'));
    await t.tick();
    transport.respondJson(1, 200, t.ok(t.tokenResponse()));
    await t.tick();
    transport.respondJson(2, 401, t.apiError('AUTH_UNAUTHORIZED'));
    await box.promise;

    assert.equal(transport.calls.length, 3, '总共只有一次刷新与一次重放');
    assert.equal(box.error.code, 'AUTH_UNAUTHORIZED');
  });

  it('受保护请求带 Bearer 令牌，公开分类接口不带令牌', async function () {
    const first = capture(userApi.getMe());
    const second = capture(categoryApi.getTree());
    await t.tick();

    assert.equal(transport.calls[0].header.Authorization, 'Bearer a1');
    assert.equal(transport.calls[1].header.Authorization, undefined);

    transport.respondJson(0, 200, t.ok({ id: '1', nickname: 'n' }));
    transport.respondJson(1, 200, t.ok({ categories: [] }));
    await Promise.all([first.promise, second.promise]);
  });

  it('请求标识符合契约且每个逻辑请求独立', async function () {
    const first = capture(userApi.getMe());
    const second = capture(certApi.getLatest());
    await t.tick();

    const ids = transport.calls.map(function (call) {
      return call.header['X-Request-Id'];
    });
    ids.forEach(function (value) {
      assert.equal(id.isValidId(value), true);
      assert.ok(value.length <= 64);
    });
    assert.notEqual(ids[0], ids[1]);

    transport.respondJson(0, 200, t.ok({ id: '1', nickname: 'n' }));
    transport.respondJson(1, 200, t.ok({ status: 'NOT_SUBMITTED' }));
    await Promise.all([first.promise, second.promise]);
  });

  it('URL 与查询串按契约拼接，空值参数被忽略', function () {
    assert.equal(
      request.__buildUrl({ path: '/files', query: { bizType: 'AVATAR' } }),
      config.baseUrl + '/files?bizType=AVATAR'
    );
    assert.equal(
      request.__buildUrl({ path: '/users/me', query: { a: null, b: undefined } }),
      config.baseUrl + '/users/me'
    );
  });

  it('上传固定使用 file 字段并返回 FileObject', async function () {
    const uploadTransport = t.createDeferredTransport();
    request.__setUploadTransport(uploadTransport);

    const box = capture(fileApi.uploadAvatar('wxfile://tmp/avatar.png'));
    await t.tick();

    assert.equal(uploadTransport.calls[0].url, config.baseUrl + '/files?bizType=AVATAR');
    assert.equal(uploadTransport.calls[0].name, 'file');
    assert.equal(uploadTransport.calls[0].header.Authorization, 'Bearer a1');

    uploadTransport.respondJson(0, 201, t.ok({
      fileId: '9',
      url: 'http://127.0.0.1:8080/static/avatar.png',
      bizType: 'AVATAR',
      contentType: 'image/png',
      sizeBytes: 1024,
      createdAt: '2026-09-11T00:00:00.000Z'
    }));
    await box.promise;

    assert.equal(box.value.fileId, '9');
    assert.equal(box.value.bizType, 'AVATAR');
  });

  it('登录成功后写入会话（wx.login → 换取令牌）', async function () {
    store.clearSession();
    const box = capture(authApi.loginWithWechat());
    await t.tick();

    assert.equal(transport.calls[0].url, config.baseUrl + '/auth/wechat-login');
    assert.deepEqual(transport.calls[0].data, { code: 'test-login-code', deviceId: id.getDeviceId() });

    transport.respondJson(0, 200, t.ok(t.tokenResponse({ accessToken: 'fresh-access' })));
    await box.promise;

    assert.equal(store.getAccessToken(), 'fresh-access');
    assert.equal(store.getSession().certificationStatus, 'NOT_SUBMITTED');
  });
});
