// pages/review-create/review-create.js
// 创建评价：先查资格，再提交 1～5 星评分与最多 500 字内容。
//
// 资格完全由后端裁定（GET /orders/{id}/review-eligibility）：只有 canReview 为 true 才渲染表单，
// 否则展示「已评价」或「当前不可评价」。前端不根据订单状态自行推断能否评价。
//
// 对端昵称是展示信息，取不到时降级为中性文案，不影响提交。

const reviewApi = require('../../services/review-api.js');
const orderApi = require('../../services/order-api.js');
const store = require('../../store/session-store.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const STARS = [1, 2, 3, 4, 5];

Page({
  data: {
    loading: true,
    failed: false,
    invalid: false,
    invalidReason: '',
    orderId: '',
    canReview: false,
    alreadyReviewed: false,
    counterpartReviewed: false,
    counterpartName: '交易的另一方',
    rating: 5,
    stars: STARS,
    content: '',
    contentLength: 0,
    contentMax: reviewApi.CONTENT_MAX,
    submitting: false
  },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    this.orderId = options && options.orderId ? String(options.orderId) : '';
    this.myUserId = '';
    const user = store.getUser();
    if (user && user.id !== undefined && user.id !== null) this.myUserId = String(user.id);
    if (!this.orderId) {
      this.alive.setData(this, { loading: false, invalid: true, invalidReason: '缺少订单参数' });
      return;
    }
    this.alive.setData(this, { orderId: this.orderId });
    this.loadEligibility();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  loadEligibility: function () {
    const self = this;
    if (!store.getSession()) {
      this.alive.setData(this, { loading: false, invalid: true, invalidReason: '请先登录后再评价' });
      return Promise.resolve();
    }
    this.alive.setData(this, { loading: true, failed: false });
    return reviewApi.eligibility(this.orderId).then(function (data) {
      const eligibility = data || {};
      const canReview = eligibility.canReview === true;
      self.alive.setData(self, {
        loading: false,
        failed: false,
        invalid: false,
        canReview: canReview,
        alreadyReviewed: !canReview && !!eligibility.myReviewId,
        counterpartReviewed: eligibility.counterpartReviewed === true
      });
      // 只有能评价时才需要展示对端；取不到就沿用中性文案。
      if (canReview) self.loadCounterpartName();
    }, function (error) {
      const code = error && error.code;
      if (code === 'RESOURCE_NOT_FOUND' || code === 'ORDER_OPERATION_FORBIDDEN') {
        self.alive.setData(self, {
          loading: false,
          failed: false,
          invalid: true,
          invalidReason: '该订单不存在或你不是交易双方'
        });
        return;
      }
      self.alive.setData(self, { loading: false, failed: true });
      errorHandler.handleError(error);
    });
  },

  loadCounterpartName: function () {
    const self = this;
    orderApi.getDetail(this.orderId).then(function (order) {
      if (!order) return;
      const counterpart = String(order.buyer && order.buyer.id) === self.myUserId ? order.seller : order.buyer;
      if (counterpart && counterpart.nickname) {
        self.alive.setData(self, { counterpartName: counterpart.nickname });
      }
    }, function () {
      // 昵称只是展示信息，失败不打断评价流程。
    });
  },

  onSelectRating: function (event) {
    const rating = reviewApi.normalizeRating(event.currentTarget.dataset.value);
    if (rating === null || rating === this.data.rating) return;
    this.alive.setData(this, { rating: rating });
  },

  onContentInput: function (event) {
    const value = event.detail.value || '';
    this.alive.setData(this, { content: value, contentLength: value.length });
  },

  onSubmit: function () {
    const self = this;
    if (this.data.submitting || !this.data.canReview) return;
    const payload = { orderId: this.orderId, rating: this.data.rating, content: this.data.content };
    const message = reviewApi.validate(payload);
    if (message) {
      errorHandler.showToast(message);
      return;
    }
    this.alive.setData(this, { submitting: true });
    reviewApi.create(payload).then(function () {
      self.alive.setData(self, { submitting: false });
      errorHandler.showToast('评价已提交');
      wx.navigateBack();
    }, function (error) {
      self.alive.setData(self, { submitting: false });
      errorHandler.handleError(error);
      // REVIEW_ALREADY_EXISTS 说明资格已过期（例如本页停留期间在别处提交过），重新查一次资格。
      if (error && error.code === 'REVIEW_ALREADY_EXISTS') self.loadEligibility();
    });
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadEligibility();
  }
});
