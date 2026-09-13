// pages/user-reviews/user-reviews.js
// 用户评价页：信用摘要（平均分 + 1～5 分分布）+ 公开评价分页，可按评分筛选。
//
// 两个接口都是公开接口（security: []），匿名可看，因此本页不需要登录态，
// 也不做未登录引导——被禁用用户的历史评价同样可以查看。

const reviewApi = require('../../services/review-api.js');
const enums = require('../../constants/enums.js');
const reviewView = require('../../utils/review-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;

Page({
  data: {
    userId: '',
    nickname: '',
    loading: true,
    failed: false,
    invalid: false,
    invalidReason: '',
    credit: null,
    reviews: [],
    page: 0,
    hasNext: false,
    loadingMore: false,
    ratingIndex: 0,
    ratingOptions: enums.REVIEW_RATING_FILTER_OPTIONS
  },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    this.userId = options && options.id ? String(options.id) : '';
    const nickname = options && options.nickname ? decodeURIComponent(options.nickname) : '';
    if (!this.userId) {
      this.alive.setData(this, { loading: false, invalid: true, invalidReason: '缺少用户参数' });
      return;
    }
    if (nickname) wx.setNavigationBarTitle({ title: nickname + ' 的评价' });
    this.alive.setData(this, { userId: this.userId, nickname: nickname });
    this.loadCredit();
    this.loadFirstPage();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    const self = this;
    this.loadCredit().then(function () {
      return self.loadFirstPage();
    }).then(function () {
      wx.stopPullDownRefresh();
    }, function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    this.loadMore();
  },

  loadCredit: function () {
    const self = this;
    return reviewApi.getCredit(this.userId).then(function (credit) {
      self.alive.setData(self, { credit: reviewView.buildCreditView(credit) });
    }, function (error) {
      // 信用摘要失败不阻塞评价列表：列表本身仍可用。
      self.alive.setData(self, { credit: null });
      if (error && error.code === 'RESOURCE_NOT_FOUND') {
        self.alive.setData(self, { invalid: true, invalidReason: '该用户不存在' });
      }
    });
  },

  currentRating: function () {
    const option = this.data.ratingOptions[this.data.ratingIndex];
    return option ? option.value : '';
  },

  loadFirstPage: function () {
    const self = this;
    this.alive.setData(this, { loading: true, failed: false });
    return reviewApi.listByUser(this.userId, {
      rating: this.currentRating(),
      page: 0,
      size: PAGE_SIZE
    }).then(function (data) {
      self.alive.setData(self, {
        loading: false,
        reviews: reviewView.buildReviewViews(data && data.items),
        page: 0,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loading: false, failed: true, reviews: [] });
      errorHandler.handleError(error);
    });
  },

  loadMore: function () {
    const self = this;
    if (this.data.loading || this.data.loadingMore || !this.data.hasNext) return;
    const nextPage = this.data.page + 1;
    this.alive.setData(this, { loadingMore: true });
    reviewApi.listByUser(this.userId, {
      rating: this.currentRating(),
      page: nextPage,
      size: PAGE_SIZE
    }).then(function (data) {
      self.alive.setData(self, {
        loadingMore: false,
        reviews: self.data.reviews.concat(reviewView.buildReviewViews(data && data.items)),
        page: nextPage,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loadingMore: false });
      errorHandler.handleError(error);
    });
  },

  onRatingChange: function (event) {
    const index = Number(event.detail.value);
    if (!this.data.ratingOptions[index] || index === this.data.ratingIndex) return;
    this.alive.setData(this, { ratingIndex: index });
    this.loadFirstPage();
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadCredit();
    this.loadFirstPage();
  }
});
