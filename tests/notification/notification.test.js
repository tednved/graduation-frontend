// tests/notification/notification.test.js
// 锁定消息 service 的方法与路径、已读筛选参数、点击消息的跳转目标，
// 以及未读红点的设置与清理（登录后取真实未读数，退出后清除）。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const t = require('../helpers/transport.js');
const config = require('../../config/index.js');
const request = require('../../services/request.js');
const store = require('../../store/session-store.js');
const id = require('../../utils/id.js');
const notificationApi = require('../../services/notification-api.js');
const notificationView = require('../../utils/notification-view.js');
const unreadBadge = require('../../utils/unread-badge.js');
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
  http = autoTransport(200);
  request.__setTransport(http);
  store.setSession({ accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1', user: { id: '1' } });
});

describe('消息接口契约', function () {
  it('每个接口的方法与路径与 OpenAPI 一致', async function () {
    await notificationApi.list({});
    await notificationApi.unreadCount();
    await notificationApi.markRead('5');
    await notificationApi.markAllRead();

    assert.deepEqual(seen(http.calls), [
      'GET /notifications?page=0&size=20',
      'GET /notifications/unread-count',
      'PUT /notifications/5/read',
      'PUT /notifications/read-all'
    ]);
  });

  it('read=false 是有效筛选值，必须真的带上，不能退化成全部', async function () {
    await notificationApi.list({ read: false });
    assert.equal(pathOf(http.calls[0].url), '/notifications?page=0&size=20&read=false');

    await notificationApi.list({ read: true });
    assert.equal(pathOf(http.calls[1].url), '/notifications?page=0&size=20&read=true');

    // 省略才是全部：不传 read 参数。
    await notificationApi.list({ page: 1, size: 10 });
    assert.equal(pathOf(http.calls[2].url), '/notifications?page=1&size=10');
  });

  it('按类型筛选时才带 type', async function () {
    await notificationApi.list({ type: enums.NotificationType.ORDER_CREATED });
    assert.equal(pathOf(http.calls[0].url), '/notifications?page=0&size=20&type=ORDER_CREATED');
  });

  it('单条已读幂等返回 204，拆包为 undefined', async function () {
    request.__setTransport(autoTransport(204));
    assert.equal(await notificationApi.markRead('5'), undefined);
  });

  it('消息接口均携带令牌', async function () {
    await notificationApi.list({});
    await notificationApi.unreadCount();
    await notificationApi.markAllRead();
    http.calls.forEach(function (call) {
      assert.equal(call.header.Authorization, 'Bearer a1');
    });
  });

  it('全部已读是写请求，网络失败不自动重试', async function () {
    const deferred = t.createDeferredTransport();
    request.__setTransport(deferred);
    const promise = notificationApi.markAllRead();
    await t.tick();
    deferred.fail(0, { errMsg: 'request:fail' });
    await assert.rejects(promise, function (error) {
      return error.code === 'NETWORK_ERROR';
    });
    assert.equal(deferred.calls.length, 1);
  });
});

describe('消息展示与跳转映射', function () {
  it('订单类消息跳到订单详情，商品类跳到商品详情', function () {
    assert.equal(notificationView.targetRoute('ORDER', '12'), '/pages/order-detail/order-detail?id=12');
    assert.equal(notificationView.targetRoute('ITEM', '7'), '/pages/item-detail/item-detail?id=7');
    // 大小写与别名容忍：契约没有冻结 bizType 取值表，写死一个会点不开消息。
    assert.equal(notificationView.targetRoute('order', '12'), '/pages/order-detail/order-detail?id=12');
    assert.equal(notificationView.targetRoute('Orders', '12'), '/pages/order-detail/order-detail?id=12');
    // 未知类型或缺少 bizId 时不跳转。
    assert.equal(notificationView.targetRoute('SYSTEM', '1'), '');
    assert.equal(notificationView.targetRoute('ORDER', null), '');
    assert.equal(notificationView.targetRoute(null, '1'), '');
  });

  it('消息条目映射类型文案、未读状态与跳转地址，ID 保持字符串', function () {
    // 契约里 DecimalId 是字符串：超出安全整数范围的 BIGINT 必须以字符串原样透传，
    // 这里用超过 Number.MAX_SAFE_INTEGER 的 ID 证明没有经过任何数值转换。
    const bigId = '9007199254740993';
    const view = notificationView.buildNotificationView({
      id: bigId,
      type: 'ORDER_CREATED',
      title: '有人想买你的商品',
      content: '买家已下单，请尽快处理',
      bizType: 'ORDER',
      bizId: bigId,
      read: false,
      createdAt: '2026-09-13T08:30:00.000Z'
    });
    assert.equal(view.id, bigId);
    assert.equal(view.bizId, bigId);
    assert.equal(view.typeLabel, '买家下单');
    assert.equal(view.typeTone, 'warning');
    assert.equal(view.read, false);
    assert.equal(view.navigable, true);
    assert.equal(view.route, '/pages/order-detail/order-detail?id=' + bigId);
    assert.equal(view.time, '2026-09-13 08:30');
  });

  it('未读数为 0 不显示红点，超过 99 显示 99+', function () {
    assert.equal(notificationView.unreadBadgeText(0), '');
    assert.equal(notificationView.unreadBadgeText(-1), '');
    assert.equal(notificationView.unreadBadgeText(undefined), '');
    assert.equal(notificationView.unreadBadgeText(1), '1');
    assert.equal(notificationView.unreadBadgeText(99), '99');
    assert.equal(notificationView.unreadBadgeText(100), '99+');
  });

  it('全部 NotificationType 都有中文文案', function () {
    Object.keys(enums.NotificationType).forEach(function (key) {
      const value = enums.NotificationType[key];
      assert.equal(typeof enums.NOTIFICATION_TYPE_LABEL[value], 'string', value + ' 缺少文案');
      assert.equal(typeof enums.NOTIFICATION_TYPE_TONE[value], 'string', value + ' 缺少色调');
    });
  });
});

describe('未读红点', function () {
  it('登录时取真实未读数并设置红点', async function () {
    http = autoTransport(200, { count: 3 });
    request.__setTransport(http);
    const text = await unreadBadge.refresh();
    assert.equal(text, '3');
    assert.equal(pathOf(http.calls[0].url), '/notifications/unread-count');
    assert.deepEqual(wxStub.tabBarBadgeCalls, [{ type: 'set', index: 3, text: '3' }]);
  });

  it('未读数为 0 时清除红点', async function () {
    http = autoTransport(200, { count: 0 });
    request.__setTransport(http);
    await unreadBadge.refresh();
    assert.deepEqual(wxStub.tabBarBadgeCalls, [{ type: 'remove', index: 3 }]);
  });

  it('退出登录后清除红点，且不再请求未读数', async function () {
    store.clearSession();
    await unreadBadge.refresh();
    assert.equal(http.calls.length, 0, '未登录不应请求未读数');
    assert.deepEqual(wxStub.tabBarBadgeCalls, [{ type: 'remove', index: 3 }]);
  });

  it('未读数请求失败时保留现有红点，不误清', async function () {
    const deferred = t.createDeferredTransport();
    request.__setTransport(deferred);
    const promise = unreadBadge.refresh();
    await t.tick();
    // 未读数是 GET，请求层会按配置重试一次网络失败，两次都要显式失败。
    deferred.fail(0, { errMsg: 'request:fail' });
    await t.tick();
    deferred.fail(1, { errMsg: 'request:fail' });
    await promise;
    assert.deepEqual(wxStub.tabBarBadgeCalls, []);
  });

  it('超过 99 条显示 99+', async function () {
    http = autoTransport(200, { count: 150 });
    request.__setTransport(http);
    await unreadBadge.refresh();
    assert.deepEqual(wxStub.tabBarBadgeCalls, [{ type: 'set', index: 3, text: '99+' }]);
  });
});
