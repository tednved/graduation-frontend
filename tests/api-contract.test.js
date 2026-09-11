// tests/api-contract.test.js
// 锁定各 service 实际发出的方法、路径与请求体，
// 并确保单校区约束——任何请求都不出现 campusId。

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

function autoTransport(statusCode) {
  const calls = [];
  const transport = function (options) {
    calls.push(options);
    options.success({ statusCode: statusCode, data: t.ok({}), header: {} });
  };
  transport.calls = calls;
  return transport;
}

function pathOf(url) {
  return url.slice(config.baseUrl.length);
}

let http;
let uploads;

beforeEach(function () {
  wxStub.reset();
  store.__resetForTest();
  id.__resetForTest();
  request.__resetForTest();
  http = autoTransport(200);
  uploads = autoTransport(201);
  request.__setTransport(http);
  request.__setUploadTransport(uploads);
  store.setSession({ accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1', user: { id: '1' } });
});

describe('接口调用契约', function () {
  it('每个接口的方法与路径与 OpenAPI 一致', async function () {
    await userApi.getMe();
    await userApi.updateMe({ nickname: 'TestUser' });
    await certApi.submitManual('TestUser', '2021000000');
    await certApi.getLatest();
    await categoryApi.getTree();
    await fileApi.uploadAvatar('wxfile://tmp/avatar.png');
    await authApi.wechatLogin('test-login-code', 'd1');
    await authApi.logout();

    const seen = http.calls.map(function (call) {
      return call.method + ' ' + pathOf(call.url);
    });
    assert.deepEqual(seen, [
      'GET /users/me',
      'PATCH /users/me',
      'POST /certifications',
      'GET /certifications/me/latest',
      'GET /categories/tree',
      'POST /auth/wechat-login',
      'POST /auth/logout'
    ]);
    // wx.uploadFile 没有 method 参数，语义固定为 POST。
    assert.deepEqual(
      uploads.calls.map(function (call) {
        return pathOf(call.url);
      }),
      ['/files?bizType=AVATAR']
    );
  });

  it('认证提交只带 MANUAL 与明文姓名学号，不带证据文件', async function () {
    await certApi.submitManual('TestUser', '2021000000');
    const body = http.calls[0].data;
    assert.deepEqual(Object.keys(body).sort(), ['realName', 'studentNo', 'type']);
    assert.equal(body.type, 'MANUAL');
    assert.equal(body.realName, 'TestUser');
    assert.equal(body.studentNo, '2021000000');
    assert.equal(body.evidenceFileId, undefined);
  });

  it('资料更新只发送需要变更的字段', async function () {
    await userApi.updateMe({ nickname: 'TestUser' });
    assert.deepEqual(http.calls[0].data, { nickname: 'TestUser' });

    await userApi.updateMe({ avatarFileId: null, phone: null });
    assert.deepEqual(http.calls[1].data, { avatarFileId: null, phone: null });
  });

  it('任何请求都不出现校区字段（单校区由后端绑定）', async function () {
    await userApi.getMe();
    await userApi.updateMe({ nickname: 'TestUser' });
    await certApi.submitManual('TestUser', '2021000000');
    await certApi.getLatest();
    await categoryApi.getTree();
    await fileApi.uploadAvatar('wxfile://tmp/avatar.png');
    await authApi.wechatLogin('test-login-code', 'd1');

    const all = http.calls.concat(uploads.calls);
    all.forEach(function (call) {
      const payload = (call.url || '') + '|' + JSON.stringify(call.data === undefined ? null : call.data);
      assert.equal(/campus/i.test(payload), false, '请求中出现校区字段：' + payload);
    });
  });

  it('分类树公开可访问，不携带令牌', async function () {
    await categoryApi.getTree();
    assert.equal(http.calls[0].header.Authorization, undefined);
  });
});
