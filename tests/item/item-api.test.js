// tests/item/item-api.test.js
// 锁定商品与收藏 service 实际发出的方法、路径、查询参数与请求体，
// 并确保单校区约束——这两个模块同样不得出现 campusId。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const t = require('../helpers/transport.js');
const config = require('../../config/index.js');
const request = require('../../services/request.js');
const store = require('../../store/session-store.js');
const id = require('../../utils/id.js');
const itemApi = require('../../services/item-api.js');
const favoriteApi = require('../../services/favorite-api.js');

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
    return call.method + ' ' + pathOf(call.url);
  });
}

const SAMPLE_FORM = {
  title: '九成新自行车',
  description: '骑了半年，车况良好，可小刀',
  price: '180',
  condition: 'GOOD',
  categoryId: '12',
  imageFileIds: [3, 4]
};

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

describe('商品与收藏接口契约', function () {
  it('每个接口的方法与路径与 OpenAPI 一致', async function () {
    await itemApi.search({});
    await itemApi.getDetail('7');
    await itemApi.createItem(SAMPLE_FORM);
    await itemApi.updateItem('7', Object.assign({ version: 2 }, SAMPLE_FORM));
    await itemApi.publishItem('7');
    await itemApi.takeOffShelf('7');
    await itemApi.removeItem('7');
    await itemApi.listMine({});
    await favoriteApi.add('7');
    await favoriteApi.remove('7');
    await favoriteApi.status('7');
    await favoriteApi.listMine({});

    assert.deepEqual(seen(http.calls), [
      'GET /items?page=0&size=20',
      'GET /items/7',
      'POST /items',
      'PUT /items/7',
      'POST /items/7/publish',
      'POST /items/7/off-shelf',
      'DELETE /items/7',
      'GET /users/me/items?page=0&size=20',
      'PUT /items/7/favorite',
      'DELETE /items/7/favorite',
      'GET /items/7/favorite-status',
      'GET /users/me/favorites?page=0&size=20'
    ]);
  });

  it('搜索省略空筛选，但始终带分页参数', async function () {
    // 空筛选既不出现在 URL 里，也不能变成 keyword= 这种空值参数。
    await itemApi.search({
      keyword: '   ',
      categoryId: null,
      condition: '',
      minPrice: '',
      maxPrice: null,
      sort: null
    });
    assert.equal(pathOf(http.calls[0].url), '/items?page=0&size=20');

    await itemApi.search({ keyword: ' 自行车 ', categoryId: '12', page: 2, size: 5 });
    assert.equal(
      decodeURIComponent(pathOf(http.calls[1].url)),
      '/items?keyword=自行车&categoryId=12&page=2&size=5'
    );
  });

  it('搜索的金额筛选项被归一化为两位小数字符串', async function () {
    await itemApi.search({ minPrice: '10', maxPrice: '99.5' });
    assert.equal(pathOf(http.calls[0].url), '/items?minPrice=10.00&maxPrice=99.50&page=0&size=20');
  });

  it('金额归一化拒绝无法表示为两位小数的输入', function () {
    assert.equal(itemApi.normalizeMoney('10'), '10.00');
    assert.equal(itemApi.normalizeMoney('10.5'), '10.50');
    assert.equal(itemApi.normalizeMoney(' 0 '), '0.00');
    assert.equal(itemApi.normalizeMoney(''), null);
    assert.equal(itemApi.normalizeMoney('   '), null);
    assert.equal(itemApi.normalizeMoney(null), null);
    assert.equal(itemApi.normalizeMoney(undefined), null);
    // 下列写法都不符合契约的 MoneyAmount 模式，宁可省略也不能发出非法值。
    assert.equal(itemApi.normalizeMoney('1e3'), null);
    assert.equal(itemApi.normalizeMoney('-1'), null);
    assert.equal(itemApi.normalizeMoney('10.999'), null);
    assert.equal(itemApi.normalizeMoney('abc'), null);
    assert.equal(itemApi.normalizeMoney('99999999999999999999999'), null);
  });

  it('创建请求体字段与 CreateItemRequest 一致，原价留空发 null', async function () {
    await itemApi.createItem(SAMPLE_FORM);
    const body = http.calls[0].data;
    assert.deepEqual(Object.keys(body).sort(), [
      'categoryId',
      'condition',
      'description',
      'imageFileIds',
      'originalPrice',
      'price',
      'title'
    ]);
    assert.equal(body.price, '180.00');
    assert.equal(body.originalPrice, null);
    assert.deepEqual(body.imageFileIds, ['3', '4']);
    // 创建请求不带 version（乐观锁只属于修改）。
    assert.equal(body.version, undefined);
  });

  it('修改请求携带 version，且字段与创建同构', async function () {
    await itemApi.updateItem('7', Object.assign({ version: 3 }, SAMPLE_FORM, { originalPrice: '299' }));
    const body = http.calls[0].data;
    assert.equal(body.version, 3);
    assert.equal(body.originalPrice, '299.00');
    assert.deepEqual(body.imageFileIds, ['3', '4']);
  });

  it('搜索公开可访问，其余接口携带令牌', async function () {
    await itemApi.search({});
    assert.equal(http.calls[0].header.Authorization, undefined, '搜索不应携带令牌');

    await itemApi.getDetail('7');
    assert.equal(http.calls[1].header.Authorization, 'Bearer a1');
  });

  it('未登录时详情退化为匿名请求，而不是拒绝', async function () {
    store.clearSession();
    await itemApi.getDetail('7');
    assert.equal(http.calls[0].header.Authorization, undefined);
  });

  it('取消收藏与删除返回 204 时拆包为 undefined', async function () {
    request.__setTransport(autoTransport(204));
    assert.equal(await favoriteApi.remove('7'), undefined);
    assert.equal(await itemApi.removeItem('7'), undefined);
  });

  it('任何请求都不出现校区字段（单校区由后端绑定）', async function () {
    await itemApi.search({ keyword: '自行车', page: 0, size: 20 });
    await itemApi.getDetail('7');
    await itemApi.createItem(SAMPLE_FORM);
    await itemApi.updateItem('7', Object.assign({ version: 1 }, SAMPLE_FORM));
    await itemApi.publishItem('7');
    await itemApi.takeOffShelf('7');
    await itemApi.removeItem('7');
    await itemApi.listMine({ status: 'DRAFT' });
    await favoriteApi.add('7');
    await favoriteApi.remove('7');
    await favoriteApi.status('7');
    await favoriteApi.listMine({});

    http.calls.forEach(function (call) {
      const payload = (call.url || '') + '|' + JSON.stringify(call.data === undefined ? null : call.data);
      assert.equal(/campus/i.test(payload), false, '请求中出现校区字段：' + payload);
    });
  });

  it('我的发布按状态筛选时才带 status', async function () {
    await itemApi.listMine({ status: 'OFF_SHELF', page: 1, size: 10 });
    assert.equal(pathOf(http.calls[0].url), '/users/me/items?page=1&size=10&status=OFF_SHELF');

    await itemApi.listMine({ page: 0, size: 20 });
    assert.equal(pathOf(http.calls[1].url), '/users/me/items?page=0&size=20');
  });
});
