// pages/search/search.js
// 搜索页：关键词 + 价格区间 + 成色 + 排序。
// 关键词输入走 300ms 防抖；任何筛选条件变化都重置分页重新查询。
// 搜索接口公开（security: []），因此不依赖登录态。

const itemApi = require('../../services/item-api.js');
const enums = require('../../constants/enums.js');
const itemView = require('../../utils/item-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;
const DETAIL_ROUTE = '/pages/item-detail/item-detail';
const HISTORY_KEY = 'search_history_v1';
const HISTORY_MAX = 10;
const DEBOUNCE_MS = 300;
const KEYWORD_MAX = 50;

const SORT_OPTIONS = enums.ITEM_SORT_OPTIONS.map(function (value) {
  return { value: value, label: enums.itemSortLabel(value) };
});

const CONDITION_FILTER_OPTIONS = [{ value: '', label: '不限成色' }].concat(
  enums.ITEM_CONDITION_OPTIONS.map(function (value) {
    return { value: value, label: enums.itemConditionLabel(value) };
  })
);

Page({
  data: {
    keyword: '',
    keywordMax: KEYWORD_MAX,
    sortOptions: SORT_OPTIONS,
    sortIndex: 0,
    conditionOptions: CONDITION_FILTER_OPTIONS,
    conditionIndex: 0,
    minPrice: '',
    maxPrice: '',
    history: [],
    items: [],
    loading: false,
    failed: false,
    searched: false,
    loadingMore: false,
    page: 0,
    hasNext: false
  },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    this.timer = null;
    const initialKeyword = options && options.keyword ? String(options.keyword).slice(0, KEYWORD_MAX) : '';
    this.alive.setData(this, { keyword: initialKeyword, history: readHistory() });
    if (initialKeyword) this.loadFirstPage();
  },

  onUnload: function () {
    if (this.timer) clearTimeout(this.timer);
    this.alive.dispose();
  },

  onReachBottom: function () {
    this.loadMore();
  },

  // ---- 查询 ----------------------------------------------------------------

  buildQuery: function (page) {
    const query = { page: page, size: PAGE_SIZE };
    const keyword = String(this.data.keyword || '').trim();
    if (keyword) query.keyword = keyword;
    const condition = this.data.conditionOptions[this.data.conditionIndex];
    if (condition && condition.value) query.condition = condition.value;
    const sort = this.data.sortOptions[this.data.sortIndex];
    if (sort && sort.value) query.sort = sort.value;
    if (!isBlank(this.data.minPrice)) query.minPrice = this.data.minPrice;
    if (!isBlank(this.data.maxPrice)) query.maxPrice = this.data.maxPrice;
    return query;
  },

  // 筛选条件变化后，当前结果已失效：清空列表并回到第一页。
  reload: function () {
    this.alive.setData(this, { items: [], page: 0, hasNext: false, searched: true });
    this.loadFirstPage();
  },

  loadFirstPage: function () {
    const self = this;
    this.alive.setData(this, { loading: true, failed: false, searched: true });
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

  // ---- 筛选交互 ------------------------------------------------------------

  onKeywordInput: function (event) {
    const self = this;
    this.alive.setData(this, { keyword: event.detail.value });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(function () {
      self.timer = null;
      self.rememberKeyword();
      self.reload();
    }, DEBOUNCE_MS);
  },

  onKeywordConfirm: function () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.rememberKeyword();
    this.reload();
  },

  onClearKeyword: function () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.alive.setData(this, { keyword: '' });
    this.reload();
  },

  onTapHistory: function (event) {
    const keyword = event.currentTarget.dataset.keyword;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.alive.setData(this, { keyword: keyword });
    this.reload();
  },

  onClearHistory: function () {
    writeHistory([]);
    this.alive.setData(this, { history: [] });
  },

  onSortChange: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    if (index === this.data.sortIndex) return;
    this.alive.setData(this, { sortIndex: index });
    this.reload();
  },

  onConditionChange: function (event) {
    const index = Number(event.detail.value);
    this.alive.setData(this, { conditionIndex: index });
    this.reload();
  },

  onMinPriceInput: function (event) {
    this.alive.setData(this, { minPrice: event.detail.value });
  },

  onMaxPriceInput: function (event) {
    this.alive.setData(this, { maxPrice: event.detail.value });
  },

  onApplyPrice: function () {
    const min = this.data.minPrice;
    const max = this.data.maxPrice;
    const minInvalid = !isBlank(min) && !isMoney(min);
    const maxInvalid = !isBlank(max) && !isMoney(max);
    if (minInvalid || maxInvalid) {
      errorHandler.showToast('价格需为大于 0 且最多两位小数的数字');
      return;
    }
    if (!isBlank(min) && !isBlank(max) && Number(min) > Number(max)) {
      errorHandler.showToast('最低价不能高于最高价');
      return;
    }
    this.reload();
  },

  onResetFilters: function () {
    this.alive.setData(this, {
      sortIndex: 0,
      conditionIndex: 0,
      minPrice: '',
      maxPrice: ''
    });
    this.reload();
  },

  onTapItem: function (event) {
    wx.navigateTo({ url: DETAIL_ROUTE + '?id=' + event.currentTarget.dataset.id });
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadFirstPage();
  },

  // ---- 搜索历史 ------------------------------------------------------------

  rememberKeyword: function () {
    const keyword = String(this.data.keyword || '').trim();
    if (!keyword) return;
    const next = [keyword].concat(
      this.data.history.filter(function (item) {
        return item !== keyword;
      })
    );
    const trimmed = next.slice(0, HISTORY_MAX);
    writeHistory(trimmed);
    this.alive.setData(this, { history: trimmed });
  }
});

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function isMoney(value) {
  const text = String(value).trim();
  return MONEY_PATTERN.test(text) && Number(text) > 0;
}

function readHistory() {
  try {
    const value = wx.getStorageSync(HISTORY_KEY);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function writeHistory(list) {
  try {
    wx.setStorageSync(HISTORY_KEY, list);
  } catch (error) {
    // 历史记录写入失败不影响搜索。
  }
}
