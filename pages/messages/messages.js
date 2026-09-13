// pages/messages/messages.js
// 消息 Tab：真实列表、未读筛选、单条/全部已读、点击按 bizType/bizId 跳转。
//
// 点击顺序固定为「先标已读，再跳转」：标记失败时提示错误并保留未读状态，不跳转，
// 这样用户可以直接重试，也不会出现「本地显示已读但服务端仍未读」的错位。
// 单条已读与全部已读都是幂等写操作，重复点击不会产生额外副作用。
//
// 未读红点不在本地累加：每次拉取列表或标记已读后，都向 /notifications/unread-count
// 重新取数（见 utils/unread-badge.js），避免本地计数与服务端漂移。

const notificationApi = require('../../services/notification-api.js');
const store = require('../../store/session-store.js');
const notificationView = require('../../utils/notification-view.js');
const unreadBadge = require('../../utils/unread-badge.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;

Page({
  data: {
    loading: true,
    failed: false,
    needLogin: false,
    unreadOnly: false,
    items: [],
    page: 0,
    hasNext: false,
    loadingMore: false,
    markingAll: false,
    markingId: ''
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.loadFirstPage();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  // 从订单页返回时消息可能已变化（读到新通知、或刚标记过已读），回到本页即刷新。
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

  onToggleUnread: function () {
    this.alive.setData(this, { unreadOnly: !this.data.unreadOnly });
    this.loadFirstPage();
  },

  loadFirstPage: function () {
    const self = this;
    if (!store.getSession()) {
      unreadBadge.clear();
      this.alive.setData(this, { loading: false, failed: false, needLogin: true, items: [] });
      return Promise.resolve();
    }
    this.alive.setData(this, { loading: true, failed: false, needLogin: false });
    return notificationApi.list({
      read: this.data.unreadOnly ? false : undefined,
      page: 0,
      size: PAGE_SIZE
    }).then(function (data) {
      self.alive.setData(self, {
        loading: false,
        items: notificationView.buildNotificationViews(data && data.items),
        page: 0,
        hasNext: !!(data && data.hasNext)
      });
      unreadBadge.refresh();
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
    notificationApi.list({
      read: this.data.unreadOnly ? false : undefined,
      page: nextPage,
      size: PAGE_SIZE
    }).then(function (data) {
      self.alive.setData(self, {
        loadingMore: false,
        items: self.data.items.concat(notificationView.buildNotificationViews(data && data.items)),
        page: nextPage,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loadingMore: false });
      errorHandler.handleError(error);
    });
  },

  // 点击一条消息：先标已读（未读时），再按路由跳转。
  onTapItem: function (event) {
    const self = this;
    const dataset = event.currentTarget.dataset;
    const id = dataset.id;
    const item = this.findItem(id);
    if (!item) return;
    if (item.read) {
      this.navigate(item);
      return;
    }
    if (this.data.markingId) return;
    this.alive.setData(this, { markingId: id });
    notificationApi.markRead(id).then(function () {
      self.alive.setData(self, {
        markingId: '',
        items: self.data.items.map(function (entry) {
          return entry.id === id ? Object.assign({}, entry, { read: true }) : entry;
        })
      });
      unreadBadge.refresh();
      // 「只看未读」下已读的消息不再属于当前筛选，重新拉一页避免列表出现已读项。
      if (self.data.unreadOnly) {
        self.loadFirstPage();
        return;
      }
      self.navigate(item);
    }, function (error) {
      self.alive.setData(self, { markingId: '' });
      errorHandler.handleError(error);
    });
  },

  findItem: function (id) {
    const matched = this.data.items.filter(function (entry) {
      return entry.id === id;
    });
    return matched.length ? matched[0] : null;
  },

  navigate: function (item) {
    if (!item.navigable) {
      errorHandler.showToast('该消息没有可打开的内容');
      return;
    }
    wx.navigateTo({ url: item.route });
  },

  onMarkAll: function () {
    const self = this;
    if (this.data.markingAll) return;
    wx.showModal({
      title: '全部已读',
      content: '确定把全部消息标记为已读吗？',
      success: function (res) {
        if (!res.confirm) return;
        if (self.data.markingAll) return;
        self.alive.setData(self, { markingAll: true });
        notificationApi.markAllRead().then(function () {
          self.alive.setData(self, { markingAll: false });
          errorHandler.showToast('已全部标记为已读');
          self.loadFirstPage();
        }, function (error) {
          self.alive.setData(self, { markingAll: false });
          errorHandler.handleError(error);
        });
      }
    });
  },

  onGoLogin: function () {
    errorHandler.requireLogin();
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadFirstPage();
  }
});
