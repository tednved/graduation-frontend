// tests/item/item-view.test.js
// 展示层映射与枚举文案。这些字符串直接出现在界面上，
// 与 OpenAPI 枚举的对应关系一旦漂移，用户会看到「未知状态」。

const { describe, it } = require('node:test');
const assert = require('node:assert');

const enums = require('../../constants/enums.js');
const itemView = require('../../utils/item-view.js');

describe('商品枚举文案', function () {
  it('每个状态都有中文文案与色调', function () {
    Object.keys(enums.ItemStatus).forEach(function (status) {
      assert.notEqual(enums.itemStatusLabel(status), '未知状态', status + ' 缺少文案');
      assert.ok(enums.itemStatusTone(status), status + ' 缺少色调');
    });
    assert.equal(enums.itemStatusLabel('ON_SALE'), '在售');
    assert.equal(enums.itemStatusTone('DELETED'), 'danger');
    assert.equal(enums.itemStatusTone('OFF_SHELF'), 'warning');
    // 未知取值的兜底，避免界面出现 undefined。
    assert.equal(enums.itemStatusLabel('SOMETHING'), '未知状态');
    assert.equal(enums.itemStatusTone('SOMETHING'), 'muted');
  });

  it('每个成色都有中文文案，且筛选项顺序固定', function () {
    assert.deepEqual(enums.ITEM_CONDITION_OPTIONS, ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']);
    assert.deepEqual(enums.ITEM_SORT_OPTIONS, ['NEWEST', 'PRICE_ASC', 'PRICE_DESC', 'POPULAR']);
    enums.ITEM_CONDITION_OPTIONS.forEach(function (condition) {
      assert.notEqual(enums.itemConditionLabel(condition), '未知成色', condition + ' 缺少文案');
    });
    assert.equal(enums.itemConditionLabel('LIKE_NEW'), '几乎全新');
    assert.equal(enums.itemConditionLabel('UNKNOWN'), '未知成色');
  });

  it('排序枚举与契约一致，默认最新发布', function () {
    assert.equal(enums.ItemSort.NEWEST, 'NEWEST');
    assert.equal(enums.ItemSort.PRICE_ASC, 'PRICE_ASC');
    assert.equal(enums.ItemSort.PRICE_DESC, 'PRICE_DESC');
    assert.equal(enums.ItemSort.POPULAR, 'POPULAR');
    assert.equal(enums.itemSortLabel(undefined), '最新发布');
  });
});

describe('列表卡片映射', function () {
  const card = {
    id: '7',
    title: '九成新自行车',
    price: '180.00',
    originalPrice: '299.00',
    condition: 'GOOD',
    status: 'ON_SALE',
    coverImageUrl: 'https://cdn.example.com/1.png',
    favoriteCount: 3
  };

  it('字段逐一映射，金额与状态转成展示文案', function () {
    const view = itemView.buildCardView(card);
    assert.equal(view.id, '7');
    assert.equal(view.priceText, '¥180.00');
    assert.equal(view.originalPriceText, '¥299.00');
    assert.equal(view.conditionLabel, '成色良好');
    assert.equal(view.statusLabel, '在售');
    assert.equal(view.statusTone, 'success');
    assert.equal(view.coverImageUrl, 'https://cdn.example.com/1.png');
    assert.equal(view.favoriteCount, 3);
    assert.equal(view.available, true);
  });

  it('原价不高于售价时不展示', function () {
    assert.equal(itemView.formatOriginalPrice('180.00', '180.00'), '');
    assert.equal(itemView.formatOriginalPrice('100.00', '180.00'), '');
    assert.equal(itemView.formatOriginalPrice(null, '180.00'), '');
    assert.equal(itemView.formatOriginalPrice('299.00', '180.00'), '¥299.00');
  });

  it('缺字段的卡片不会渲染出 undefined', function () {
    const view = itemView.buildCardView({});
    assert.equal(view.title, '');
    assert.equal(view.priceText, '—');
    assert.equal(view.originalPriceText, '');
    assert.equal(view.conditionLabel, '');
    assert.equal(view.favoriteCount, 0);
    assert.equal(view.available, false);
  });

  it('收藏列表里的下架商品被标记为不可用', function () {
    const view = itemView.buildCardView(Object.assign({}, card, { status: 'OFF_SHELF' }));
    assert.equal(view.available, false);
    assert.equal(view.statusLabel, '已下架');
    assert.equal(view.statusTone, 'warning');
  });

  it('批量映射保持顺序', function () {
    const views = itemView.buildCardViews([card, Object.assign({}, card, { id: '8' })]);
    assert.deepEqual(
      views.map(function (view) {
        return view.id;
      }),
      ['7', '8']
    );
    assert.deepEqual(itemView.buildCardViews(null), []);
  });
});

describe('详情映射', function () {
  const detail = {
    id: '7',
    title: '九成新自行车',
    description: '骑了半年，车况良好',
    price: '180.00',
    condition: 'GOOD',
    status: 'ON_SALE',
    images: [
      { fileId: '1', url: 'https://cdn.example.com/1.png', sortNo: 1 },
      { fileId: '2', url: '', sortNo: 2 }
    ],
    seller: { id: '2', nickname: '同学甲' },
    isOwner: true,
    canBuy: false,
    allowedActions: ['EDIT', 'OFF_SHELF', 'DELETE'],
    favoriteCount: 3,
    viewCount: 12,
    createdAt: '2026-09-10T10:00:00.000Z',
    version: 4
  };

  it('作者操作按 allowedActions 翻译成按钮，顺序不变', function () {
    const view = itemView.buildDetailView(detail);
    assert.deepEqual(
      view.ownerActions.map(function (action) {
        return action.action + ':' + action.label;
      }),
      ['EDIT:编辑', 'OFF_SHELF:下架', 'DELETE:删除']
    );
    assert.equal(view.canFavorite, false);
    assert.equal(view.isOwner, true);
    assert.equal(view.canBuy, false);
    assert.equal(view.version, 4);
  });

  it('无图或空 url 的图片被过滤掉', function () {
    const view = itemView.buildDetailView(detail);
    assert.deepEqual(
      view.images.map(function (image) {
        return image.fileId;
      }),
      ['1']
    );
  });

  it('买家视角：可收藏可下单，没有作者按钮', function () {
    const view = itemView.buildDetailView(
      Object.assign({}, detail, {
        isOwner: false,
        canBuy: true,
        allowedActions: ['FAVORITE', 'BUY']
      })
    );
    assert.deepEqual(view.ownerActions, []);
    assert.equal(view.canFavorite, true);
    assert.equal(view.canBuy, true);
    assert.equal(view.statusNotice, '');
  });

  it('非在售状态给出明确提示，作者与非作者措辞不同', function () {
    assert.equal(itemView.statusNotice('ON_SALE', false), '');
    assert.equal(itemView.statusNotice('OFF_SHELF', false), '该商品已下架');
    assert.equal(itemView.statusNotice('SOLD', false), '该商品已售出');
    assert.equal(itemView.statusNotice('RESERVED', false), '该商品已被预订');
    assert.equal(itemView.statusNotice('DELETED', true), '该商品已删除');
    assert.match(itemView.statusNotice('DRAFT', true), /^草稿/);
  });

  it('匿名详情不渲染出 undefined 字段', function () {
    const view = itemView.buildDetailView({ id: '7', title: '单车', status: 'ON_SALE' });
    assert.equal(view.sellerName, '');
    assert.equal(view.priceText, '—');
    assert.equal(view.conditionLabel, '');
    assert.equal(view.publishedAt, '');
    assert.deepEqual(view.images, []);
    assert.equal(view.isOwner, false);
  });

  it('发布时间只保留日期部分', function () {
    assert.equal(itemView.formatDate('2026-09-10T10:00:00.000Z'), '2026-09-10');
    assert.equal(itemView.formatDate(null), '');
    const view = itemView.buildDetailView(detail);
    assert.equal(view.publishedAt, '2026-09-10');
  });
});
