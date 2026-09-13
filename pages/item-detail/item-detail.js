// pages/item-detail/item-detail.js
// 商品详情：图片、价格、成色、描述、卖家、状态与操作入口。
//
// 按钮完全由后端返回的 allowedActions 驱动，前端不自行推断权限；
// 后端每次请求仍会重新校验，因此这里的判断只影响展示。
//
// 编辑入口：publish 是 TabBar 页，wx.switchTab 不能带参数，
// 所以先把商品 ID 写入本地存储，由 publish 页 onShow 时取走。
//
// 下单（BUY）：卖家接单前不落任何本地状态，只有后端 201/200 返回订单详情后才跳订单详情页。
//
// 幂等键 clientRequestId 只在用户点击「我想要」时生成一次：
//   - 网络失败（响应未到达，订单可能已经创建）保留同一个键，重试是同键幂等重放，不会重复下单；
//   - HTTP 层拒绝（订单肯定没创建）才丢弃重来，避免同键换商品触发 ORDER_DUPLICATE_REQUEST。

const itemApi = require('../../services/item-api.js');
const favoriteApi = require('../../services/favorite-api.js');
const orderApi = require('../../services/order-api.js');
const store = require('../../store/session-store.js');
const enums = require('../../constants/enums.js');
const errors = require('../../constants/error-codes.js');
const itemView = require('../../utils/item-view.js');
const orderView = require('../../utils/order-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const EDIT_ITEM_KEY = 'item_edit_id';
const PUBLISH_TAB = '/pages/publish/publish';
const CERT_ROUTE = '/pages/certification/certification';
const INVALID_CODES = ['ITEM_NOT_FOUND', 'ITEM_UNAVAILABLE'];
// 这些错误意味着商品已不可下单，刷新详情让 allowedActions 反映最新状态。
const REFRESH_CODES = ['ITEM_CONCURRENTLY_RESERVED', 'ITEM_NOT_AVAILABLE', 'ITEM_SELF_PURCHASE'];

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
      this.startOrder();
    }
  },

  // ---- 下单 ----------------------------------------------------------------

  startOrder: function () {
    const self = this;
    if (this.data.acting) return;
    const session = store.getSession();
    if (!session) {
      errorHandler.requireLogin();
      return;
    }
    // 未认证下单直接引导认证：后端也会返回 USER_CERTIFICATION_REQUIRED，这里提前拦住少一次往返。
    if (session.certificationStatus !== enums.CertificationStatus.APPROVED) {
      wx.showModal({
        title: '需要校园认证',
        content: '下单前需要先完成校园认证，是否现在去认证？',
        confirmText: '去认证',
        success: function (res) {
          if (res.confirm) wx.navigateTo({ url: CERT_ROUTE });
        }
      });
      return;
    }
    // 作者不能购买自己的商品；以后端返回的 isOwner 为准，这里只做提前提示。
    if (this.data.item && this.data.item.isOwner) {
      errorHandler.showToast('不能购买自己发布的商品');
      return;
    }

    const clientRequestId = this.pendingClientRequestId || orderApi.newClientRequestId();
    this.pendingClientRequestId = clientRequestId;
    this.alive.setData(this, { acting: true });
    orderApi.create(this.itemId, clientRequestId).then(function (detail) {
      // 下单成功后幂等键完成使命；再点一次是新的下单意图，应当是新订单。
      self.pendingClientRequestId = null;
      self.alive.setData(self, { acting: false });
      errorHandler.showToast('下单成功，等待卖家接单');
      wx.navigateTo({ url: orderView.orderDetailRoute(detail && detail.id ? detail.id : '') });
    }, function (error) {
      const code = error && error.code;
      // 网络失败保留原键：服务端可能已经建单，换键会真的重复下单。
      if (code !== errors.NETWORK_ERROR) self.pendingClientRequestId = null;
      self.alive.setData(self, { acting: false });
      errorHandler.handleError(error);
      if (REFRESH_CODES.indexOf(code) >= 0) self.loadDetail();
    });
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
