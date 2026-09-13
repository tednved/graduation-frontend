// tests/order/order-view.test.js
// 锁定订单展示层映射：状态文案与色调、时间线事件、按钮与 allowedActions 的映射，
// 以及「哪些操作需要原因」。按钮只由后端 allowedActions 驱动是硬约束，这里逐条断言。

const { describe, it } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const orderView = require('../../utils/order-view.js');
const enums = require('../../constants/enums.js');

const SAMPLE_DETAIL = {
  id: '12',
  orderNo: 'O20260913001',
  status: 'PENDING_CONFIRMATION',
  tradeMode: 'OFFLINE',
  amount: '180.00',
  cancelReason: null,
  item: { itemId: '7', title: '九成新自行车', imageUrl: '/media/3', price: '180.00' },
  buyer: { id: '1', nickname: '买家甲', avatarUrl: null },
  seller: { id: '2', nickname: '卖家乙', avatarUrl: '/media/9' },
  allowedActions: ['CONFIRM', 'REJECT'],
  events: [
    {
      id: '1',
      action: 'CREATE',
      fromStatus: null,
      toStatus: 'PENDING_CONFIRMATION',
      operator: { id: '1', nickname: '买家甲' },
      remark: null,
      createdAt: '2026-09-13T08:30:00.000Z'
    },
    {
      id: '2',
      action: 'CANCEL',
      fromStatus: 'CONFIRMED',
      toStatus: 'CANCELLED',
      operator: { id: '2', nickname: '卖家乙' },
      remark: '商品有磕碰',
      createdAt: '2026-09-13T09:00:00.000Z'
    }
  ],
  createdAt: '2026-09-13T08:30:00.000Z',
  updatedAt: '2026-09-13T08:30:00.000Z'
};

describe('订单状态与文案映射', function () {
  it('全部 OrderStatus 都有中文文案与色调', function () {
    Object.keys(enums.OrderStatus).forEach(function (key) {
      const value = enums.OrderStatus[key];
      assert.notEqual(enums.ORDER_STATUS_LABEL[value], undefined, value + ' 缺少文案');
      assert.notEqual(enums.ORDER_STATUS_TONE[value], undefined, value + ' 缺少色调');
    });
    assert.equal(enums.orderStatusLabel('PENDING_RECEIPT'), '待收货');
    assert.equal(enums.orderStatusTone('COMPLETED'), 'success');
    assert.equal(enums.orderStatusTone('REJECTED'), 'danger');
    // 未知状态不能渲染成 undefined。
    assert.equal(enums.orderStatusLabel('NOPE'), '未知状态');
    assert.equal(enums.orderStatusTone('NOPE'), 'muted');
  });

  it('全部 OrderAction 都能翻译成按钮与事件文案', function () {
    Object.keys(enums.OrderAction).forEach(function (key) {
      const value = enums.OrderAction[key];
      assert.equal(typeof enums.ORDER_ACTION_LABEL[value], 'string', value + ' 缺少按钮文案');
      assert.equal(typeof enums.ORDER_EVENT_LABEL[value], 'string', value + ' 缺少事件文案');
    });
  });
});

describe('订单列表与详情视图', function () {
  it('列表条目映射金额、对方与商品快照', function () {
    const view = orderView.buildOrderSummaryView({
      id: 12,
      orderNo: 'O1',
      status: 'CONFIRMED',
      amount: '180.00',
      item: { itemId: 7, title: '自行车', imageUrl: '/media/3' },
      counterpart: { id: 2, nickname: '卖家乙', avatarUrl: '/media/9' },
      createdAt: '2026-09-13T08:30:00.000Z'
    });
    assert.equal(view.id, '12');
    assert.equal(view.itemId, '7');
    assert.equal(view.amountText, '¥180.00');
    assert.equal(view.statusLabel, '待交付');
    assert.equal(view.counterpartName, '卖家乙');
    assert.equal(view.counterpartInitial, '卖');
    // 站内相对媒体地址必须转成绝对地址，否则小程序把它当本地资源导致图片空白。
    assert.equal(view.itemImageUrl, 'http://127.0.0.1:8080/media/3');
    assert.equal(view.counterpartAvatarUrl, 'http://127.0.0.1:8080/media/9');
  });

  it('详情包含双方、快照、时间线与 allowedActions 按钮', function () {
    const view = orderView.buildOrderDetailView(SAMPLE_DETAIL);
    assert.equal(view.buyer.nickname, '买家甲');
    assert.equal(view.seller.nickname, '卖家乙');
    assert.equal(view.item.title, '九成新自行车');
    assert.equal(view.statusLabel, '待卖家接单');
    assert.equal(view.canReview, false);
    assert.deepEqual(
      view.actions.map(function (action) {
        return action.action;
      }),
      ['CONFIRM', 'REJECT']
    );
    assert.equal(view.actions[0].label, '接单');
    assert.equal(view.actions[0].primary, true);
    assert.equal(view.actions[0].needsReason, false);
    assert.equal(view.actions[1].label, '拒绝订单');
    assert.equal(view.actions[1].danger, true);
    assert.equal(view.actions[1].needsReason, true);
    // 二次确认文案必须存在，页面据此弹确认框。
    assert.ok(view.actions[0].confirmText.length > 0);
    assert.ok(view.actions[1].confirmText.length > 0);
  });

  it('allowedActions 为空时不渲染任何按钮，也不猜测权限', function () {
    const view = orderView.buildOrderDetailView(Object.assign({}, SAMPLE_DETAIL, { allowedActions: [] }));
    assert.deepEqual(view.actions, []);
  });

  it('未知动作被忽略而不是渲染成无文案的按钮', function () {
    const view = orderView.buildOrderDetailView(
      Object.assign({}, SAMPLE_DETAIL, { allowedActions: ['CONFIRM', 'SOMETHING_NEW'] })
    );
    assert.equal(view.actions.length, 1);
    assert.equal(view.actions[0].action, 'CONFIRM');
  });

  it('时间线按事件逐条映射，创建事件没有前置状态', function () {
    const events = orderView.buildEventViews(SAMPLE_DETAIL.events);
    assert.equal(events.length, 2);
    assert.equal(events[0].actionLabel, '创建订单');
    assert.equal(events[0].fromStatusLabel, '');
    assert.equal(events[0].toStatusLabel, '待卖家接单');
    assert.equal(events[0].operatorName, '买家甲');
    assert.equal(events[0].time, '2026-09-13 08:30');
    assert.equal(events[1].actionLabel, '订单取消');
    assert.equal(events[1].fromStatusLabel, '待交付');
    assert.equal(events[1].toStatusLabel, '已取消');
    assert.equal(events[1].remark, '商品有磕碰');
  });

  it('订单完成才出现评价入口', function () {
    const view = orderView.buildOrderDetailView(Object.assign({}, SAMPLE_DETAIL, { status: 'COMPLETED' }));
    assert.equal(view.canReview, true);
    assert.equal(view.reviewRoute, '/pages/review-create/review-create?orderId=12');
  });

  it('需要原因的动作只有拒单与取消', function () {
    assert.equal(orderView.needsReason('REJECT'), true);
    assert.equal(orderView.needsReason('CANCEL'), true);
    assert.equal(orderView.needsReason('CONFIRM'), false);
    assert.equal(orderView.needsReason('DELIVER'), false);
    assert.equal(orderView.needsReason('RECEIVE'), false);
  });

  it('原因校验与 service 使用同一套长度约束', function () {
    assert.equal(orderView.validateReason('商品有质量问题'), '');
    assert.equal(orderView.validateReason('好'), '请填写 2～200 字的原因');
    assert.equal(orderView.validateReason(''), '请填写 2～200 字的原因');
    assert.equal(orderView.validateReason('原'.repeat(201)), '请填写 2～200 字的原因');
  });

  it('跳转地址集中生成，ID 不做数字转换', function () {
    assert.equal(orderView.orderDetailRoute('9007199254740993'), '/pages/order-detail/order-detail?id=9007199254740993');
    assert.equal(orderView.itemDetailRoute('9007199254740993'), '/pages/item-detail/item-detail?id=9007199254740993');
  });
});
