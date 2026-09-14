// tests/admin/admin-api.test.js
// 锁定管理端 service 的方法、路径、查询参数与请求体，以及原因 2～200 的前端校验。
// 管理端四个区域都不带数组参数：请求层把 query 值按 String() 序列化，
// 发数组会拼成 "A,B" 而不是重复参数，因此商品状态筛选只发单值。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const t = require('../helpers/transport.js');
const config = require('../../config/index.js');
const request = require('../../services/request.js');
const store = require('../../store/session-store.js');
const id = require('../../utils/id.js');
const adminApi = require('../../services/admin-api.js');

function autoTransport(statusCode, data) {
  const calls = [];
  const transport = function (options) {
    calls.push(options);
    options.success({
      statusCode: statusCode,
      data: statusCode === 204 ? null : t.ok(data === undefined ? {} : data),
      header: {}
    });
  };
  transport.calls = calls;
  return transport;
}

function pathOf(url) {
  return url.slice(config.baseUrl.length);
}

function decodedPathOf(url) {
  return decodeURIComponent(pathOf(url));
}

function seen(calls) {
  return calls.map(function (call) {
    return call.method + ' ' + decodeURIComponent(pathOf(call.url));
  });
}

let http;

beforeEach(function () {
  wxStub.reset();
  store.__resetForTest();
  id.__resetForTest();
  request.__resetForTest();
  http = autoTransport(200);
  request.__setTransport(http);
  store.setSession({ accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1', user: { id: '2' } });
});

describe('管理端接口契约', function () {
  it('每个接口的方法与路径与 OpenAPI 一致', async function () {
    await adminApi.listCertifications({});
    await adminApi.approveCertification('7');
    await adminApi.rejectCertification('7', '材料不清');
    await adminApi.listUsers({});
    await adminApi.disableUser('3');
    await adminApi.enableUser('3');
    await adminApi.listItems({});
    await adminApi.offShelfItem('9', '违规内容');
    await adminApi.listOrders({});
    await adminApi.getOrder('11');
    await adminApi.listAuditLogs({});

    assert.deepEqual(seen(http.calls), [
      'GET /admin/certifications?page=0&size=20',
      'POST /admin/certifications/7/approve',
      'POST /admin/certifications/7/reject',
      'GET /admin/users?page=0&size=20',
      'POST /admin/users/3/disable',
      'POST /admin/users/3/enable',
      'GET /admin/items?page=0&size=20',
      'POST /admin/items/9/off-shelf',
      'GET /admin/orders?page=0&size=20',
      'GET /admin/orders/11',
      'GET /admin/audit-logs?page=0&size=20'
    ]);
  });

  it('幂等写接口没有请求体，原因接口只发 reason', async function () {
    await adminApi.approveCertification('7');
    await adminApi.disableUser('3');
    assert.equal(http.calls[0].data, undefined);
    assert.equal(http.calls[1].data, undefined);

    await adminApi.rejectCertification('7', '  材料看不清  ');
    assert.deepEqual(http.calls[2].data, { reason: '材料看不清' });

    await adminApi.offShelfItem('9', ' 违规内容 ');
    assert.deepEqual(http.calls[3].data, { reason: '违规内容' });
  });

  it('可选筛选项只在有值时下发，空串等价于不筛选', async function () {
    await adminApi.listCertifications({ status: '', page: 0, size: 20 });
    assert.equal(decodedPathOf(http.calls[0].url), '/admin/certifications?page=0&size=20');

    await adminApi.listCertifications({ status: 'PENDING', page: 1, size: 10 });
    assert.equal(decodedPathOf(http.calls[1].url), '/admin/certifications?page=1&size=10&status=PENDING');

    await adminApi.listUsers({ keyword: '  ', status: 'DISABLED', certificationStatus: '' });
    assert.equal(decodedPathOf(http.calls[2].url), '/admin/users?page=0&size=20&status=DISABLED');

    await adminApi.listItems({ status: 'OFF_SHELF', keyword: '手机', sellerId: '5' });
    assert.equal(decodedPathOf(http.calls[3].url), '/admin/items?page=0&size=20&status=OFF_SHELF&keyword=手机&sellerId=5');

    await adminApi.listOrders({ status: 'CONFIRMED', keyword: ' O2026 ', buyerId: '8', sellerId: '9' });
    assert.equal(
      decodedPathOf(http.calls[4].url),
      '/admin/orders?page=0&size=20&status=CONFIRMED&buyerId=8&sellerId=9&keyword=O2026'
    );

    await adminApi.listAuditLogs({ action: 'USER_DISABLE', from: '2026-09-01T00:00:00.000Z' });
    assert.equal(
      decodedPathOf(http.calls[5].url),
      '/admin/audit-logs?page=0&size=20&action=USER_DISABLE&from=2026-09-01T00:00:00.000Z'
    );
  });

  it('商品状态筛选只发单个取值，不发数组', async function () {
    await adminApi.listItems({ status: 'ON_SALE' });
    assert.equal(decodedPathOf(http.calls[0].url), '/admin/items?page=0&size=20&status=ON_SALE');
    assert.equal(http.calls[0].url.indexOf('%2C') < 0, true, '不应出现逗号拼接的多状态');
  });

  it('原因长度 2～200，越界在本地被拦住且不发请求', async function () {
    assert.equal(adminApi.normalizeReason('ab'), 'ab');
    assert.equal(adminApi.normalizeReason('  ' + 'x'.repeat(200) + '  ').length, 200);
    assert.equal(adminApi.normalizeReason(''), null);
    assert.equal(adminApi.normalizeReason('a'), null);
    assert.equal(adminApi.normalizeReason('x'.repeat(201)), null);
    assert.equal(adminApi.normalizeReason(null), null);
    assert.equal(adminApi.reasonError(), '请填写 2～200 字的原因');

    await assert.rejects(function () {
      return adminApi.rejectCertification('7', '短');
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
    await assert.rejects(function () {
      return adminApi.offShelfItem('9', 'x'.repeat(201));
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
    assert.equal(http.calls.length, 0);
  });

  it('管理端请求一律携带令牌', async function () {
    await adminApi.listUsers({});
    assert.equal(http.calls[0].header.Authorization, 'Bearer a1');
  });

  it('服务端 403 原样抛出，不在前端改写成成功', async function () {
    // 直接给一个 ApiError 响应体，不套 ApiResponse 外壳——失败响应本来就是这个形状。
    request.__setTransport(function (options) {
      options.success({
        statusCode: 403,
        data: t.apiError('AUTH_FORBIDDEN', '无权访问'),
        header: {}
      });
    });
    await assert.rejects(function () {
      return adminApi.listAuditLogs({});
    }, function (error) {
      return error.code === 'AUTH_FORBIDDEN' && error.httpStatus === 403;
    });
  });
});
