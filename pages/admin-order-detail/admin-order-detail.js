// 管理员专属订单只读详情。个人订单详情仍只认买卖双方。
const adminApi = require('../../services/admin-api.js');
const orderView = require('../../utils/order-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

Page({
  data: { loading: true, failed: false, invalid: false, detail: null },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    this.orderId = options && options.id ? String(options.id) : '';
    if (!this.orderId) {
      this.alive.setData(this, { loading: false, invalid: true });
      return;
    }
    this.loadDetail();
  },

  onUnload: function () { this.alive.dispose(); },

  loadDetail: function () {
    const self = this;
    this.alive.setData(this, { loading: true, failed: false });
    return adminApi.getOrder(this.orderId).then(function (data) {
      const detail = orderView.buildOrderDetailView(data);
      // 管理入口永远只读，不展示评价或买卖命令。
      detail.actions = [];
      detail.canReview = false;
      self.alive.setData(self, { loading: false, invalid: false, detail: detail });
    }, function (error) {
      if (error && error.code === 'RESOURCE_NOT_FOUND') {
        self.alive.setData(self, { loading: false, invalid: true, detail: null });
        return;
      }
      self.alive.setData(self, { loading: false, failed: true });
      errorHandler.handleError(error);
    });
  },

  onRetry: function () { if (!this.data.loading) this.loadDetail(); }
});
