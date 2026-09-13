// tests/order/order-api.test.js
// 锁定订单 service 实际发出的方法、路径与请求体，并锁住两件事关资金安全的约定：
//   1. 写请求在网络失败时绝不自动重试（避免重复下单）；
//   2. clientRequestId 完全由调用方决定，service 不会自己换一个（否则幂等键失去意义）。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const t = require('../helpers/transport.js');
const config = require('../../config/index.js');
const request = require('../../services/request.js');
const store = require('../../store/session-store.js');
const id = require('../../utils/id.js');
const orderApi = require('../../services/order-api.js');
const enums = require('../../constants/enums.js');

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
  http = autoTransport(201);
  request.__setTransport(http);
  store.setSession({ accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1', user: { id: '1' } });
});

describe('订单接口契约', function () {
  it('每个接口的方法与路径与 OpenAPI 一致', async function () {
    await orderApi.create('7', 'req-1');
    await orderApi.getDetail('9');
    await orderApi.confirm('9');
    await orderApi.reject('9', '商品与描述不符');
    await orderApi.cancel('9', '不想要了');
    await orderApi.deliver('9');
    await orderApi.receive('9');
    await orderApi.listMine({ side: enums.OrderSide.BUY });

    assert.deepEqual(seen(http.calls), [
      'POST /orders',
      'GET /orders/9',
      'POST /orders/9/confirm',
      'POST /orders/9/reject',
      'POST /orders/9/cancel',
      'POST /orders/9/deliver',
      'POST /orders/9/receive',
      'GET /users/me/orders?side=BUY&page=0&size=20'
    ]);
  });

  it('创建订单的请求体只含契约要求的三字段，且 ID 保持十进制字符串', async function () {
    await orderApi.create(7, 'req-1');
    const body = http.calls[0].data;
    assert.deepEqual(Object.keys(body).sort(), ['clientRequestId', 'itemId', 'tradeMode']);
    assert.equal(body.itemId, '7');
    assert.equal(body.tradeMode, 'OFFLINE');
    assert.equal(body.clientRequestId, 'req-1');
  });

  it('clientRequestId 由调用方提供，service 不会替换成新值', async function () {
    const first = orderApi.newClientRequestId();
    assert.equal(id.isValidId(first), true, '生成的幂等键必须符合 RequestId 字符集与长度');
    assert.notEqual(first, orderApi.newClientRequestId(), '两次生成不应相同');

    // 同一个键连续两次调用，两次请求体里的键必须完全一致：
    // 这正是页面「网络失败不换 ID」时的重放路径。
    await orderApi.create('7', first);
    await orderApi.create('7', first);
    assert.equal(http.calls[0].data.clientRequestId, first);
    assert.equal(http.calls[1].data.clientRequestId, first);
  });

  it('缺少 clientRequestId 或 itemId 时不发请求，直接拒绝', async function () {
    await assert.rejects(function () {
      return orderApi.create('7', '');
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
    await assert.rejects(function () {
      return orderApi.create('', 'req-1');
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
    assert.equal(http.calls.length, 0, '前端校验失败不应产生任何请求');
  });

  it('写请求在网络失败时不自动重试，只发一次', async function () {
    const deferred = t.createDeferredTransport();
    request.__setTransport(deferred);
    const promise = orderApi.create('7', 'req-1');
    await t.tick();
    deferred.fail(0, { errMsg: 'request:fail' });
    await assert.rejects(promise, function (error) {
      return error.code === 'NETWORK_ERROR';
    });
    assert.equal(deferred.calls.length, 1, '写请求失败后不得自动重发');
  });

  it('拒单与取消必须带 2～200 字原因', async function () {
    assert.equal(orderApi.normalizeReason(' 商品有质量问题 '), '商品有质量问题');
    assert.equal(orderApi.normalizeReason('好'), null, '1 字不满足最小长度');
    assert.equal(orderApi.normalizeReason('  '), null);
    assert.equal(orderApi.normalizeReason(''), null);
    assert.equal(orderApi.normalizeReason(null), null);
    assert.equal(orderApi.normalizeReason(undefined), null);
    assert.equal(orderApi.normalizeReason('原'.repeat(200)).length, 200);
    assert.equal(orderApi.normalizeReason('原'.repeat(201)), null, '超过 200 字应被拒绝');

    await orderApi.reject('9', '  商品与描述不符  ');
    assert.deepEqual(http.calls[0].data, { reason: '商品与描述不符' });

    await orderApi.cancel('9', '临时不想要了');
    assert.deepEqual(http.calls[1].data, { reason: '临时不想要了' });
  });

  it('非法原因在本地就被拦住，不产生请求', async function () {
    await assert.rejects(function () {
      return orderApi.reject('9', '短');
    }, function (error) {
      return error.code === 'VALIDATION_ERROR' && /原因/.test(error.message);
    });
    await assert.rejects(function () {
      return orderApi.cancel('9', '原'.repeat(201));
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
    assert.equal(http.calls.length, 0);
  });

  it('我的订单 side 必填（默认买入），status 省略时不传', async function () {
    await orderApi.listMine({ side: enums.OrderSide.SELL, page: 1, size: 10 });
    assert.equal(pathOf(http.calls[0].url), '/users/me/orders?side=SELL&page=1&size=10');

    await orderApi.listMine({ side: enums.OrderSide.BUY, status: enums.OrderStatus.COMPLETED });
    assert.equal(
      pathOf(http.calls[1].url),
      '/users/me/orders?side=BUY&page=0&size=20&status=COMPLETED'
    );

    // side 非法时退化为 BUY，而不是发一个契约外的值。
    await orderApi.listMine({ side: 'SOMETHING' });
    assert.equal(pathOf(http.calls[2].url), '/users/me/orders?side=BUY&page=0&size=20');
  });

  it('订单接口均携带令牌，且请求里不出现校区字段', async function () {
    await orderApi.create('7', 'req-1');
    await orderApi.getDetail('9');
    await orderApi.listMine({ side: enums.OrderSide.BUY });
    http.calls.forEach(function (call) {
      assert.equal(call.header.Authorization, 'Bearer a1');
      const payload = (call.url || '') + '|' + JSON.stringify(call.data === undefined ? null : call.data);
      assert.equal(/campus/i.test(payload), false, '请求中出现校区字段：' + payload);
    });
  });

  it('未登录时订单请求不带令牌（由页面负责引导登录）', async function () {
    store.clearSession();
    await orderApi.listMine({ side: enums.OrderSide.BUY });
    assert.equal(http.calls[0].header.Authorization, undefined);
  });
});
