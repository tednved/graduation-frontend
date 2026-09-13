// pages/orders/orders.js
// 我的订单：买入 / 卖出两个视角 + 状态筛选 + 分页。
//
// side 是契约里同一路径上的枚举（BUY / SELL），所以两个视角共用本页，
// 由入口路由参数决定，切换视角时重置分页——不同 side 的列表不能混在一起。

const orderApi = require('../../services/order-api.js');
const store = require('../../store/session-store.js');
const enums = require('../../constants/enums.js');
const orderView = require('../../utils/order-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;

Page({
  data: {
    side: enums.OrderSide.BUY,
    loading: true,
    failed: false,
    needLogin: false,
    orders: [],
    page: 0,
    hasNext: false,
    loadingMore: false,
    statusIndex: 0,
    statusOptions: enums.ORDER_STATUS_FILTER_OPTIONS,
    emptyTitle: '还没有订单',
    emptyDesc: ''
  },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    const side = options && options.side === enums.OrderSide.SELL ? enums.OrderSide.SELL : enums.OrderSide.BUY;
    this.alive.setData(this, sideView(side));
    this.loadFirstPage();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  // 从订单详情操作完返回时列表状态可能已变（例如已接单），回到列表即刷新。
  onShow: function () {
    if (!this.data.loading && !this.data.needLogin) this.loadFirstPage();
  },

  onPullDownRefresh: function () {
    this.loadFirstPage().then(function () {
      wx.stopPullDownRefresh();
    }, function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    this.loadMore();
  },

  // 切换买卖视角：换 side 必须清空列表并回到第一页。
  onSwitchSide: function (event) {
    const side = event.currentTarget.dataset.side;
    if (!side || side === this.data.side) return;
    this.alive.setData(this, sideView(side));
    this.loadFirstPage();
  },

  onStatusChange: function (event) {
    const index = Number(event.detail.value);
    const option = this.data.statusOptions[index];
    if (!option || index === this.data.statusIndex) return;
    this.alive.setData(this, { statusIndex: index });
    this.loadFirstPage();
  },

  currentStatus: function () {
    const option = this.data.statusOptions[this.data.statusIndex];
    return option ? option.value : '';
  },

  loadFirstPage: function () {
    const self = this;
    if (!store.getSession()) {
      this.alive.setData(this, { loading: false, failed: false, needLogin: true, orders: [] });
      return Promise.resolve();
    }
    this.alive.setData(this, { loading: true, failed: false, needLogin: false });
    return orderApi.listMine({
      side: this.data.side,
      status: this.currentStatus(),
      page: 0,
      size: PAGE_SIZE
    }).then(function (data) {
      self.alive.setData(self, {
        loading: false,
        orders: orderView.buildOrderSummaryViews(data && data.items),
        page: 0,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loading: false, failed: true, orders: [] });
      errorHandler.handleError(error);
    });
  },

  loadMore: function () {
    const self = this;
    if (this.data.loading || this.data.loadingMore || !this.data.hasNext) return;
    const nextPage = this.data.page + 1;
    this.alive.setData(this, { loadingMore: true });
    orderApi.listMine({
      side: this.data.side,
      status: this.currentStatus(),
      page: nextPage,
      size: PAGE_SIZE
    }).then(function (data) {
      self.alive.setData(self, {
        loadingMore: false,
        orders: self.data.orders.concat(orderView.buildOrderSummaryViews(data && data.items)),
        page: nextPage,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loadingMore: false });
      errorHandler.handleError(error);
    });
  },

  onTapOrder: function (event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: orderView.orderDetailRoute(id) });
  },

  onGoLogin: function () {
    errorHandler.requireLogin();
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadFirstPage();
  }
});

// 视角切换时的静态文案与列表重置。抽成纯函数，避免两处 setData 写法不一致。
function sideView(side) {
  const isSell = side === enums.OrderSide.SELL;
  return {
    side: isSell ? enums.OrderSide.SELL : enums.OrderSide.BUY,
    loading: true,
    failed: false,
    orders: [],
    page: 0,
    hasNext: false,
    emptyTitle: isSell ? '还没有卖出的订单' : '还没有买到的订单',
    emptyDesc: isSell ? '有人下单后订单会出现在这里' : '在商品详情页点「我想要」即可下单'
  };
}
