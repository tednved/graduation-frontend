// pages/favorites/favorites.js
// 我的收藏：分页列表，可在列表内直接取消收藏。
// 已下架/已删除的商品仍会出现在列表里，但明确标注状态——
// 这是契约行为（收藏记录不因商品状态变化而消失），静默隐藏会让用户以为数据丢了。

const favoriteApi = require('../../services/favorite-api.js');
const store = require('../../store/session-store.js');
const itemView = require('../../utils/item-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;
const DETAIL_ROUTE = '/pages/item-detail/item-detail';

Page({
  data: {
    loading: true,
    failed: false,
    needLogin: false,
    items: [],
    page: 0,
    hasNext: false,
    loadingMore: false,
    removingId: null
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.loadFirstPage();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onShow: function () {
    // 从详情页取消收藏后返回，列表需要同步。
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

  loadFirstPage: function () {
    const self = this;
    if (!store.getSession()) {
      this.alive.setData(this, { loading: false, failed: false, needLogin: true, items: [] });
      return Promise.resolve();
    }
    this.alive.setData(this, { loading: true, failed: false, needLogin: false });
    return favoriteApi.listMine({ page: 0, size: PAGE_SIZE }).then(function (data) {
      self.alive.setData(self, {
        loading: false,
        items: itemView.buildCardViews(data && data.items),
        page: 0,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loading: false, failed: true, items: [] });
      errorHandler.handleError(error);
    });
  },

  loadMore: function () {
    const self = this;
    if (this.data.loading || this.data.loadingMore || !this.data.hasNext) return;
    const nextPage = this.data.page + 1;
    this.alive.setData(this, { loadingMore: true });
    favoriteApi.listMine({ page: nextPage, size: PAGE_SIZE }).then(function (data) {
      self.alive.setData(self, {
        loadingMore: false,
        items: self.data.items.concat(itemView.buildCardViews(data && data.items)),
        page: nextPage,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loadingMore: false });
      errorHandler.handleError(error);
    });
  },

  // 取消收藏是幂等的，本地立即移除；失败则把整页拉回来纠正。
  onRemove: function (event) {
    const self = this;
    const id = event.currentTarget.dataset.id;
    if (this.data.removingId) return;
    this.alive.setData(this, { removingId: id });
    favoriteApi.remove(id).then(function () {
      const remain = self.data.items.filter(function (item) {
        return String(item.id) !== String(id);
      });
      self.alive.setData(self, { removingId: null, items: remain });
      errorHandler.showToast('已取消收藏');
    }, function (error) {
      self.alive.setData(self, { removingId: null });
      errorHandler.handleError(error);
      self.loadFirstPage();
    });
  },

  onTapItem: function (event) {
    wx.navigateTo({ url: DETAIL_ROUTE + '?id=' + event.currentTarget.dataset.id });
  },

  onGoLogin: function () {
    errorHandler.requireLogin();
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadFirstPage();
  },

  onGoHome: function () {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
