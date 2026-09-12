// pages/item-detail/item-detail.js
// 商品详情：图片、价格、成色、描述、卖家、状态与操作入口。
//
// 按钮完全由后端返回的 allowedActions 驱动，前端不自行推断权限；
// 后端每次请求仍会重新校验，因此这里的判断只影响展示。
//
// 编辑入口：publish 是 TabBar 页，wx.switchTab 不能带参数，
// 所以先把商品 ID 写入本地存储，由 publish 页 onShow 时取走。
//
// 下单（BUY）属于 MVP-03，本页只保留入口提示，不发起任何订单请求。

const itemApi = require('../../services/item-api.js');
const favoriteApi = require('../../services/favorite-api.js');
const store = require('../../store/session-store.js');
const itemView = require('../../utils/item-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const EDIT_ITEM_KEY = 'item_edit_id';
const PUBLISH_TAB = '/pages/publish/publish';
const INVALID_CODES = ['ITEM_NOT_FOUND', 'ITEM_UNAVAILABLE'];

Page({
  data: {
    loading: true,
    failed: false,
    invalid: false,
    invalidReason: '',
    item: null,
    images: [],
    current: 0,
    favorited: false,
    favoriteCount: 0,
    canFavorite: false,
    favoriting: false,
    acting: false
  },

  onLoad: function (options) {
    this.alive = pageGuard.createAlive();
    this.itemId = options && options.id ? String(options.id) : '';
    if (!this.itemId) {
      this.alive.setData(this, { loading: false, invalid: true, invalidReason: '缺少商品参数' });
      return;
    }
    this.loadDetail();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  // 从编辑页返回时刷新，避免展示过期的标题、价格或状态。
  onShow: function () {
    if (this.itemId && !this.data.loading && !this.data.invalid) this.loadDetail();
  },

  onPullDownRefresh: function () {
    if (!this.itemId) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadDetail().then(function () {
      wx.stopPullDownRefresh();
    }, function () {
      wx.stopPullDownRefresh();
    });
  },

  loadDetail: function () {
    const self = this;
    this.alive.setData(this, { loading: !this.data.item, failed: false });
    return itemApi.getDetail(this.itemId).then(function (item) {
      const view = itemView.buildDetailView(item);
      self.alive.setData(self, {
        loading: false,
        failed: false,
        invalid: false,
        invalidReason: '',
        item: view,
        images: view.images,
        current: 0,
        // 匿名请求 favorited 为 null，此时按钮展示为未收藏但点击会引导登录。
        favorited: item.favorited === true,
        favoriteCount: view.favoriteCount,
        canFavorite: view.canFavorite
      });
    }, function (error) {
      const code = error && error.code;
      if (INVALID_CODES.indexOf(code) >= 0) {
        self.alive.setData(self, {
          loading: false,
          failed: false,
          invalid: true,
          invalidReason: '该商品不存在或已被删除',
          item: null
        });
        return;
      }
      self.alive.setData(self, { loading: false, failed: true });
      errorHandler.handleError(error);
    });
  },

  onSwiperChange: function (event) {
    this.alive.setData(this, { current: event.detail.current });
  },

  onPreviewImage: function (event) {
    const urls = this.data.images.map(function (image) {
      return image.url;
    });
    if (!urls.length) return;
    wx.previewImage({ current: urls[Number(event.currentTarget.dataset.index)], urls: urls });
  },

  // ---- 收藏 ----------------------------------------------------------------

  // 立即反馈：先改本地状态与计数，失败再回滚，避免等网络往返才变色。
  onToggleFavorite: function () {
    const self = this;
    if (this.data.favoriting || !this.data.item) return;
    if (!store.getSession()) {
      errorHandler.requireLogin();
      return;
    }

    const next = !this.data.favorited;
    const delta = next ? 1 : -1;
    this.alive.setData(this, {
      favoriting: true,
      favorited: next,
      favoriteCount: Math.max(0, this.data.favoriteCount + delta)
    });

    const action = next ? favoriteApi.add(this.itemId) : favoriteApi.remove(this.itemId);
    action.then(function () {
      self.alive.setData(self, { favoriting: false });
    }, function (error) {
      self.alive.setData(self, {
        favoriting: false,
        favorited: !next,
        favoriteCount: Math.max(0, self.data.favoriteCount - delta)
      });
      errorHandler.handleError(error);
    });
  },

  // ---- 作者操作 ------------------------------------------------------------

  onTapAction: function (event) {
    const action = event.currentTarget.dataset.action;
    if (this.data.acting) return;
    if (action === 'EDIT') {
      this.startEdit();
      return;
    }
    if (action === 'PUBLISH') {
      this.runAction('已上架', itemApi.publishItem);
      return;
    }
    if (action === 'OFF_SHELF') {
      this.confirmAction('下架后其他同学将看不到该商品，确定下架吗？', '已下架', itemApi.takeOffShelf);
      return;
    }
    if (action === 'DELETE') {
      this.confirmAction('删除后不可恢复，确定删除吗？', '已删除', itemApi.removeItem, true);
      return;
    }
    if (action === 'BUY') {
      errorHandler.showToast('下单功能将在下一阶段开放');
    }
  },

  startEdit: function () {
    try {
      wx.setStorageSync(EDIT_ITEM_KEY, this.itemId);
    } catch (error) {
      errorHandler.showToast('无法进入编辑，请重试');
      return;
    }
    wx.switchTab({ url: PUBLISH_TAB });
  },

  confirmAction: function (content, successMessage, runner, leaveAfter) {
    const self = this;
    wx.showModal({
      title: '提示',
      content: content,
      success: function (res) {
        if (res.confirm) self.runAction(successMessage, runner, leaveAfter);
      }
    });
  },

  runAction: function (successMessage, runner, leaveAfter) {
    const self = this;
    this.alive.setData(this, { acting: true });
    runner(this.itemId).then(function () {
      self.alive.setData(self, { acting: false });
      errorHandler.showToast(successMessage);
      if (leaveAfter) {
        // 删除后详情已无意义，返回上一页；没有上一页时回到首页。
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.switchTab({ url: '/pages/home/home' });
        return;
      }
      self.loadDetail();
    }, function (error) {
      self.alive.setData(self, { acting: false });
      errorHandler.handleError(error);
    });
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadDetail();
  },

  onGoHome: function () {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
