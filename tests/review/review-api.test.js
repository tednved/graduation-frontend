// tests/review/review-api.test.js
// 锁定评价 service 的方法、路径与请求体，以及评分 1～5、内容 ≤500 的前端校验。
// 评价资格必须先查接口，本文件同时断言资格接口的路径。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const t = require('../helpers/transport.js');
const config = require('../../config/index.js');
const request = require('../../services/request.js');
const store = require('../../store/session-store.js');
const id = require('../../utils/id.js');
const reviewApi = require('../../services/review-api.js');
const reviewView = require('../../utils/review-view.js');

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

describe('评价接口契约', function () {
  it('每个接口的方法与路径与 OpenAPI 一致', async function () {
    await reviewApi.create({ orderId: '12', rating: 5, content: '很好' });
    await reviewApi.eligibility('12');
    await reviewApi.listByUser('2', {});
    await reviewApi.getCredit('2');

    assert.deepEqual(seen(http.calls), [
      'POST /reviews',
      'GET /orders/12/review-eligibility',
      'GET /users/2/reviews?page=0&size=20',
      'GET /users/2/credit'
    ]);
  });

  it('创建评价的请求体只含 orderId/rating/content，orderId 保持十进制字符串', async function () {
    await reviewApi.create({ orderId: 12, rating: 4, content: '  商品不错  ' });
    const body = http.calls[0].data;
    assert.deepEqual(Object.keys(body).sort(), ['content', 'orderId', 'rating']);
    assert.equal(body.orderId, '12');
    assert.equal(body.rating, 4);
    assert.equal(body.content, '商品不错');
  });

  it('内容为空时省略字段，而不是发空串', async function () {
    await reviewApi.create({ orderId: '12', rating: 5 });
    assert.deepEqual(http.calls[0].data, { orderId: '12', rating: 5 });

    await reviewApi.create({ orderId: '12', rating: 5, content: '   ' });
    assert.deepEqual(http.calls[1].data, { orderId: '12', rating: 5 });
  });

  it('评分只接受 1～5 的整数', function () {
    assert.equal(reviewApi.normalizeRating(1), 1);
    assert.equal(reviewApi.normalizeRating(5), 5);
    assert.equal(reviewApi.normalizeRating('3'), 3);
    assert.equal(reviewApi.normalizeRating(0), null);
    assert.equal(reviewApi.normalizeRating(6), null);
    assert.equal(reviewApi.normalizeRating(3.5), null);
    assert.equal(reviewApi.normalizeRating('3.5'), null);
    assert.equal(reviewApi.normalizeRating(''), null);
    assert.equal(reviewApi.normalizeRating(null), null);
    assert.equal(reviewApi.normalizeRating(undefined), null);
    assert.equal(reviewApi.normalizeRating('abc'), null);
  });

  it('内容最多 500 字，超长在本地被拦住', function () {
    assert.equal(reviewApi.normalizeContent('评'.repeat(500)).length, 500);
    assert.equal(reviewApi.normalizeContent('评'.repeat(501)), null);

    const message = reviewApi.validate({ orderId: '12', rating: 5, content: '评'.repeat(501) });
    assert.equal(message, '评价内容最多 500 字');

    return assert.rejects(function () {
      return reviewApi.create({ orderId: '12', rating: 5, content: '评'.repeat(501) });
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
  });

  it('缺少订单或评分非法时不发请求', async function () {
    assert.equal(reviewApi.validate({ rating: 5 }), '缺少订单参数');
    assert.equal(reviewApi.validate({ orderId: '12' }), '请选择 1～5 星评分');
    assert.equal(reviewApi.validate({ orderId: '12', rating: 5 }), '');

    await assert.rejects(function () {
      return reviewApi.create({ orderId: '12', rating: 0 });
    }, function (error) {
      return error.code === 'VALIDATION_ERROR';
    });
    assert.equal(http.calls.length, 0);
  });

  it('公开接口不携带令牌，资格接口携带令牌', async function () {
    await reviewApi.getCredit('2');
    await reviewApi.listByUser('2', {});
    assert.equal(http.calls[0].header.Authorization, undefined, '信用摘要应匿名可访问');
    assert.equal(http.calls[1].header.Authorization, undefined, '公开评价应匿名可访问');

    await reviewApi.eligibility('12');
    assert.equal(http.calls[2].header.Authorization, 'Bearer a1');
  });

  it('按评分筛选时才带 rating，并过滤掉非法评分', async function () {
    await reviewApi.listByUser('2', { rating: 5, page: 1, size: 10 });
    assert.equal(pathOf(http.calls[0].url), '/users/2/reviews?page=1&size=10&rating=5');

    await reviewApi.listByUser('2', { rating: 9 });
    assert.equal(pathOf(http.calls[1].url), '/users/2/reviews?page=0&size=20');
  });
});

describe('信用摘要与评价视图', function () {
  it('分布按 5→1 星展开，百分比基于评价总数', function () {
    const view = reviewView.buildCreditView({
      userId: 2,
      averageRating: '4.50',
      reviewCount: 4,
      distribution: { '1': 0, '2': 0, '3': 1, '4': 0, '5': 3 }
    });
    assert.equal(view.averageText, '4.50');
    assert.equal(view.reviewCount, 4);
    assert.equal(view.empty, false);
    assert.deepEqual(
      view.distribution.map(function (bucket) {
        return bucket.star + ':' + bucket.count + ':' + bucket.percent;
      }),
      ['5:3:75', '4:0:0', '3:1:25', '2:0:0', '1:0:0']
    );
  });

  it('没有评价时平均分展示为占位符而不是 0.00', function () {
    const view = reviewView.buildCreditView({ userId: '2', averageRating: '0.00', reviewCount: 0, distribution: {} });
    assert.equal(view.averageText, '—');
    assert.equal(view.empty, true);
    view.distribution.forEach(function (bucket) {
      assert.equal(bucket.percent, 0);
    });
  });

  it('评价条目映射星级与头像绝对地址', function () {
    const view = reviewView.buildReviewView({
      id: 5,
      orderId: 12,
      reviewer: { id: 1, nickname: '买家甲', avatarUrl: '/media/9' },
      rating: 4,
      content: '很好',
      status: 'VISIBLE',
      createdAt: '2026-09-13T08:30:00.000Z'
    });
    assert.equal(view.id, '5');
    assert.equal(view.orderId, '12');
    assert.equal(view.ratingText, '4 分');
    assert.deepEqual(
      view.stars.map(function (star) {
        return star.on;
      }),
      [true, true, true, true, false]
    );
    assert.equal(view.reviewerAvatarUrl, 'http://127.0.0.1:8080/media/9');
    assert.equal(view.createdDate, '2026-09-13');
  });
});
