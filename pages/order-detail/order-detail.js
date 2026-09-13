// pages/order-detail/order-detail.js
// 订单详情：商品快照、买卖双方、事件时间线与操作按钮。
//
// 按钮完全由后端返回的 allowedActions 驱动，前端不推断「这个状态下应该能做什么」；
// 后端每次请求仍会重新校验权限与状态。
//
// 写操作约定：
//   - 全部二次确认（拒单/取消还要填原因，2～200 字）；
//   - 进行中禁用按钮，防重复点击；
//   - 成功后用响应里的详情直接刷新页面（写接口返回的就是 OrderDetail），
//     失败不改动本地数据，只提示错误，因此不会留下错误的本地状态。

const orderApi = require('../../services/order-api.js');
const store = require('../../store/session-store.js');
const orderView = require('../../utils/order-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const INVALID_CODES = ['RESOURCE_NOT_FOUND', 'ORDER_OPERATION_FORBIDDEN'];
const ORDER_NO_ROUTE = '/pages/orders/orders';

// 动作 → service 方法。只包含需要原因的写操作之外的部分。
const RUNNERS = {
  CONFIRM: orderApi.confirm,
  DELIVER: orderApi.deliver,
  RECEIVE: orderApi.receive
};

const SUCCESS_MESSAGES = {
  CONFIRM: '已接单',
  REJECT: '已拒绝订单',
  CANCEL: '订单已取消',
  DELIVER: '已确认交付',
  RECEIVE: '已确认收货'
};

Page({
  data: {
    loading: true,
    failed: false,
    invalid: false,
    invalidReason: '',
    detail: null,
    acting: false,
    actingAction: ''
  },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    this.orderId = options && options.id ? String(options.id) : '';
    if (!this.orderId) {
      this.alive.setData(this, { loading: false, invalid: true, invalidReason: '缺少订单参数' });
      return;
    }
    this.loadDetail();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    this.loadDetail().then(function () {
      wx.stopPullDownRefresh();
    }, function () {
      wx.stopPullDownRefresh();
    });
  },

  loadDetail: function () {
    const self = this;
    if (!store.getSession()) {
      this.alive.setData(this, { loading: false, failed: false, invalid: true, invalidReason: '请先登录后查看订单' });
      return Promise.resolve();
    }
    this.alive.setData(this, { loading: !this.data.detail, failed: false });
    return orderApi.getDetail(this.orderId).then(function (detail) {
      self.applyDetail(detail);
    }, function (error) {
      const code = error && error.code;
      if (INVALID_CODES.indexOf(code) >= 0) {
        self.alive.setData(self, {
          loading: false,
          failed: false,
          invalid: true,
          invalidReason: code === 'ORDER_OPERATION_FORBIDDEN' ? '你无权查看该订单' : '该订单不存在',
          detail: null
        });
        return;
      }
      self.alive.setData(self, { loading: false, failed: true });
      errorHandler.handleError(error);
    });
  },

  // 详情只有一个写入口：写接口的响应与 GET 详情同构，因此不必再发一次 GET。
  applyDetail: function (detail) {
    this.alive.setData(this, {
      loading: false,
      failed: false,
      invalid: false,
      invalidReason: '',
      detail: orderView.buildOrderDetailView(detail)
    });
  },

  // ---- 操作 ----------------------------------------------------------------

  onTapAction: function (event) {
    const action = event.currentTarget.dataset.action;
    if (this.data.acting || !action) return;
    const self = this;
    if (orderView.needsReason(action)) {
      this.promptReason(action);
      return;
    }
    const confirmText = orderView.ACTION_CONFIRM_TEXT[action] || '确定执行该操作吗？';
    wx.showModal({
      title: '提示',
      content: confirmText,
      success: function (res) {
        if (res.confirm) self.runAction(action, null);
      }
    });
  },

  // 拒单/取消需要原因。用可输入的模态框收集，提交前做与 service 同一套长度校验。
  promptReason: function (action) {
    const self = this;
    wx.showModal({
      title: action === 'REJECT' ? '拒绝订单' : '取消订单',
      editable: true,
      placeholderText: '请填写原因（2～200 字）',
      success: function (res) {
        if (!res.confirm) return;
        const reason = typeof res.content === 'string' ? res.content : '';
        const message = orderView.validateReason(reason);
        if (message) {
          errorHandler.showToast(message);
          return;
        }
        self.runAction(action, reason);
      }
    });
  },

  runAction: function (action, reason) {
    const self = this;
    if (this.data.acting) return;
    let runner;
    if (action === 'REJECT') runner = function () { return orderApi.reject(self.orderId, reason); };
    else if (action === 'CANCEL') runner = function () { return orderApi.cancel(self.orderId, reason); };
    else runner = RUNNERS[action] ? function () { return RUNNERS[action](self.orderId); } : null;
    if (!runner) return;

    this.alive.setData(this, { acting: true, actingAction: action });
    runner().then(function (detail) {
      self.alive.setData(self, { acting: false, actingAction: '' });
      errorHandler.showToast(SUCCESS_MESSAGES[action] || '操作成功');
      if (detail) {
        self.applyDetail(detail);
        return;
      }
      // 理论上写接口总会返回详情；万一没有，退回一次 GET 而不是保留过期状态。
      self.loadDetail();
    }, function (error) {
      self.alive.setData(self, { acting: false, actingAction: '' });
      errorHandler.handleError(error);
    });
  },

  // ---- 跳转 ----------------------------------------------------------------

  onTapItem: function () {
    const detail = this.data.detail;
    if (!detail || !detail.itemId) return;
    wx.navigateTo({ url: orderView.itemDetailRoute(detail.itemId) });
  },

  onGoReview: function () {
    const detail = this.data.detail;
    if (!detail) return;
    wx.navigateTo({ url: detail.reviewRoute });
  },

  onGoOrders: function () {
    wx.redirectTo({ url: ORDER_NO_ROUTE + '?side=BUY' });
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadDetail();
  }
});
