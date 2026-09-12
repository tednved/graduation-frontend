// pages/home/home.js
// 首页：搜索入口 + 分类快捷筛选 + 商品流。
// 商品流只展示 ON_SALE（后端保证），分页 20 条/页。

const itemApi = require('../../services/item-api.js');
const categoryApi = require('../../services/category-api.js');
const enums = require('../../constants/enums.js');
const itemView = require('../../utils/item-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;
const SEARCH_ROUTE = '/pages/search/search';
const DETAIL_ROUTE = '/pages/item-detail/item-detail';
const ALL_CATEGORY = 'ALL';

Page({
  data: {
    loading: true,
    failed: false,
    items: [],
    page: 0,
    hasNext: false,
    loadingMore: false,
    categories: [],
    activeCategoryId: ALL_CATEGORY
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.loadCategories();
    this.loadFirstPage();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    const done = function () {
      wx.stopPullDownRefresh();
    };
    this.loadFirstPage().then(done, done);
  },

  onReachBottom: function () {
    this.loadMore();
  },

  loadCategories: function () {
    const self = this;
    categoryApi.getTree().then(function (tree) {
      const roots = ((tree && tree.categories) || []).filter(function (node) {
        return node && node.status === enums.CategoryStatus.ENABLED;
      });
      self.alive.setData(self, {
        categories: roots.map(function (node) {
          return { id: node.id, name: node.name };
        })
      });
    }, function () {
      // 分类加载失败不影响商品流，首页仍可用。
    });
  },

  buildQuery: function (page) {
    const query = { page: page, size: PAGE_SIZE };
    if (this.data.activeCategoryId && this.data.activeCategoryId !== ALL_CATEGORY) {
      query.categoryId = this.data.activeCategoryId;
    }
    return query;
  },

  loadFirstPage: function () {
    const self = this;
    this.alive.setData(this, { loading: true, failed: false });
    return itemApi.search(this.buildQuery(0)).then(function (data) {
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
    itemApi.search(this.buildQuery(nextPage)).then(function (data) {
      const more = itemView.buildCardViews(data && data.items);
      self.alive.setData(self, {
        loadingMore: false,
        items: self.data.items.concat(more),
        page: nextPage,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loadingMore: false });
      errorHandler.handleError(error);
    });
  },

  onTapCategory: function (event) {
    const id = event.currentTarget.dataset.id;
    if (String(id) === String(this.data.activeCategoryId)) return;
    this.alive.setData(this, { activeCategoryId: id, items: [] });
    this.loadFirstPage();
  },

  onTapSearch: function () {
    wx.navigateTo({ url: SEARCH_ROUTE });
  },

  onTapItem: function (event) {
    wx.navigateTo({ url: DETAIL_ROUTE + '?id=' + event.currentTarget.dataset.id });
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadFirstPage();
  }
});
