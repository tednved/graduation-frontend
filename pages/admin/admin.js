// pages/admin/admin.js
// 管理员控制台：认证、用户、商品、全站订单与审计五个区域。
//
// 权限：入口在「我的」页按 GET /users/me 的 role 决定是否显示，但入口只是体验，
// 不是门禁。本页加载时自己再查一次 role，非 ADMIN 直接返回并提示；真正的授权在服务端
// 每个请求的事务内重新读库判定，降权立即生效。
//
// 四个区域共用一份列表状态（当前标签页永远只有一个列表），切换区域即清空并重新拉取，
// 避免不同区域的条目混在同一个 data.list 里。

const adminApi = require('../../services/admin-api.js');
const userApi = require('../../services/user-api.js');
const store = require('../../store/session-store.js');
const enums = require('../../constants/enums.js');
const adminView = require('../../utils/admin-view.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const PAGE_SIZE = 20;
const ITEM_DETAIL_ROUTE = '/pages/item-detail/item-detail';
const ADMIN_ORDER_DETAIL_ROUTE = '/pages/admin-order-detail/admin-order-detail';

const TAB_CERT = 'certifications';
const TAB_USER = 'users';
const TAB_ITEM = 'items';
const TAB_ORDER = 'orders';
const TAB_AUDIT = 'audit';

const TABS = [
  { key: TAB_CERT, label: '认证审核' },
  { key: TAB_USER, label: '用户' },
  { key: TAB_ITEM, label: '商品' },
  { key: TAB_ORDER, label: '订单' },
  { key: TAB_AUDIT, label: '审计' }
];

const EMPTY_TEXT = {
  certifications: { title: '没有符合条件的认证申请', desc: '换个状态筛选试试' },
  users: { title: '没有符合条件的用户', desc: '换个关键字或筛选条件试试' },
  items: { title: '没有符合条件的商品', desc: '换个状态或关键字试试' },
  orders: { title: '没有符合条件的订单', desc: '换个状态或关键字试试' },
  audit: { title: '没有审计记录', desc: '管理员操作后会计入这里' }
};

Page({
  data: {
    roleChecked: false,
    isAdmin: false,
    tabs: TABS,
    tab: TAB_CERT,

    loading: false,
    failed: false,
    list: [],
    page: 0,
    hasNext: false,
    loadingMore: false,
    acting: false,
    emptyTitle: '',
    emptyDesc: '',

    certStatusIndex: 0,
    certStatusOptions: enums.CERTIFICATION_STATUS_FILTER_OPTIONS,

    userKeyword: '',
    userStatusIndex: 0,
    userCertIndex: 0,
    userStatusOptions: enums.USER_STATUS_FILTER_OPTIONS,
    userCertOptions: enums.USER_CERTIFICATION_FILTER_OPTIONS,

    itemKeyword: '',
    itemStatusIndex: 0,
    itemStatusOptions: enums.ITEM_STATUS_FILTER_OPTIONS,

    orderKeyword: '',
    orderStatusIndex: 0,
    orderStatusOptions: enums.ORDER_STATUS_FILTER_OPTIONS,

    auditActionIndex: 0,
    auditActionOptions: enums.AUDIT_ACTION_FILTER_OPTIONS
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.checkRole();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    const self = this;
    this.loadFirstPage().then(function () {
      wx.stopPullDownRefresh();
    }, function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    this.loadMore();
  },

  // 角色校验独立于列表加载：不是管理员就不该发任何管理端请求。
  checkRole: function () {
    const self = this;
    if (!store.getSession()) {
      this.alive.setData(this, { roleChecked: true, isAdmin: false });
      this.denyAndBack('请先登录');
      return;
    }
    userApi.getMe().then(function (profile) {
      const isAdmin = !!profile && profile.role === enums.UserRole.ADMIN;
      if (!self.alive.setData(self, { roleChecked: true, isAdmin: isAdmin })) return;
      if (!isAdmin) {
        self.denyAndBack('仅管理员可访问管理台');
        return;
      }
      self.loadFirstPage();
    }, function (error) {
      self.alive.setData(self, { roleChecked: true, isAdmin: false });
      errorHandler.handleError(error);
      self.leave();
    });
  },

  // 非管理员一律退出本页：直接导航进来也不该看到管理台骨架。
  denyAndBack: function (message) {
    errorHandler.showToast(message);
    this.leave();
  },

  leave: function () {
    wx.navigateBack({
      fail: function () {
        // 直接进入（无返回栈）时退回「我的」页。
        wx.switchTab({ url: '/pages/profile/profile' });
      }
    });
  },

  onSwitchTab: function (event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.alive.setData(this, { tab: tab });
    this.loadFirstPage();
  },

  onCertStatusChange: function (event) {
    const index = Number(event.detail.value);
    if (index === this.data.certStatusIndex) return;
    this.alive.setData(this, { certStatusIndex: index });
    this.loadFirstPage();
  },

  onUserStatusChange: function (event) {
    const index = Number(event.detail.value);
    if (index === this.data.userStatusIndex) return;
    this.alive.setData(this, { userStatusIndex: index });
    this.loadFirstPage();
  },

  onUserCertChange: function (event) {
    const index = Number(event.detail.value);
    if (index === this.data.userCertIndex) return;
    this.alive.setData(this, { userCertIndex: index });
    this.loadFirstPage();
  },

  onItemStatusChange: function (event) {
    const index = Number(event.detail.value);
    if (index === this.data.itemStatusIndex) return;
    this.alive.setData(this, { itemStatusIndex: index });
    this.loadFirstPage();
  },

  onAuditActionChange: function (event) {
    const index = Number(event.detail.value);
    if (index === this.data.auditActionIndex) return;
    this.alive.setData(this, { auditActionIndex: index });
    this.loadFirstPage();
  },

  onOrderStatusChange: function (event) {
    const index = Number(event.detail.value);
    if (index === this.data.orderStatusIndex) return;
    this.alive.setData(this, { orderStatusIndex: index });
    this.loadFirstPage();
  },

  // 关键字输入。只在用户确认输入后查询，避免每敲一个字打一次接口。
  onUserKeywordInput: function (event) {
    this.alive.setData(this, { userKeyword: event.detail.value || '' });
  },

  onUserKeywordConfirm: function () {
    this.loadFirstPage();
  },

  onItemKeywordInput: function (event) {
    this.alive.setData(this, { itemKeyword: event.detail.value || '' });
  },

  onItemKeywordConfirm: function () {
    this.loadFirstPage();
  },

  onOrderKeywordInput: function (event) {
    this.alive.setData(this, { orderKeyword: event.detail.value || '' });
  },

  onOrderKeywordConfirm: function () {
    this.loadFirstPage();
  },

  // 当前区域的筛选参数。空串一律不下发（service 侧统一过滤）。
  currentQuery: function (page) {
    const tab = this.data.tab;
    if (tab === TAB_USER) {
      return {
        keyword: this.data.userKeyword.trim(),
        status: optionValue(this.data.userStatusOptions, this.data.userStatusIndex),
        certificationStatus: optionValue(this.data.userCertOptions, this.data.userCertIndex),
        page: page,
        size: PAGE_SIZE
      };
    }
    if (tab === TAB_ITEM) {
      return {
        keyword: this.data.itemKeyword.trim(),
        status: optionValue(this.data.itemStatusOptions, this.data.itemStatusIndex),
        page: page,
        size: PAGE_SIZE
      };
    }
    if (tab === TAB_AUDIT) {
      return {
        action: optionValue(this.data.auditActionOptions, this.data.auditActionIndex),
        page: page,
        size: PAGE_SIZE
      };
    }
    if (tab === TAB_ORDER) {
      return {
        keyword: this.data.orderKeyword.trim(),
        status: optionValue(this.data.orderStatusOptions, this.data.orderStatusIndex),
        page: page,
        size: PAGE_SIZE
      };
    }
    return {
      status: optionValue(this.data.certStatusOptions, this.data.certStatusIndex),
      page: page,
      size: PAGE_SIZE
    };
  },

  fetch: function (page) {
    const tab = this.data.tab;
    const query = this.currentQuery(page);
    if (tab === TAB_USER) return adminApi.listUsers(query);
    if (tab === TAB_ITEM) return adminApi.listItems(query);
    if (tab === TAB_ORDER) return adminApi.listOrders(query);
    if (tab === TAB_AUDIT) return adminApi.listAuditLogs(query);
    return adminApi.listCertifications(query);
  },

  buildList: function (tab, items) {
    if (tab === TAB_USER) return adminView.buildUserViews(items);
    if (tab === TAB_ITEM) return adminView.buildAdminItemViews(items);
    if (tab === TAB_ORDER) return adminView.buildAdminOrderViews(items);
    if (tab === TAB_AUDIT) return adminView.buildAuditLogViews(items);
    return adminView.buildCertificationViews(items);
  },

  loadFirstPage: function () {
    const self = this;
    const tab = this.data.tab;
    const empty = EMPTY_TEXT[tab] || { title: '暂无数据', desc: '' };
    this.alive.setData(this, {
      loading: true,
      failed: false,
      list: [],
      page: 0,
      hasNext: false,
      emptyTitle: empty.title,
      emptyDesc: empty.desc
    });
    return this.fetch(0).then(function (data) {
      self.alive.setData(self, {
        loading: false,
        list: self.buildList(tab, data && data.items),
        page: 0,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loading: false, failed: true, list: [] });
      errorHandler.handleError(error);
    });
  },

  loadMore: function () {
    const self = this;
    const tab = this.data.tab;
    if (this.data.loading || this.data.loadingMore || !this.data.hasNext) return;
    const nextPage = this.data.page + 1;
    this.alive.setData(this, { loadingMore: true });
    this.fetch(nextPage).then(function (data) {
      self.alive.setData(self, {
        loadingMore: false,
        list: self.data.list.concat(self.buildList(tab, data && data.items)),
        page: nextPage,
        hasNext: !!(data && data.hasNext)
      });
    }, function (error) {
      self.alive.setData(self, { loadingMore: false });
      errorHandler.handleError(error);
    });
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadFirstPage();
  },

  // 写操作统一走这里：进行中禁止重复提交，成功后整体重拉当前页，
  // 不用本地推断的新状态覆盖服务端返回的真相。
  runAction: function (runner, successText) {
    const self = this;
    if (this.data.acting) return;
    this.alive.setData(this, { acting: true });
    return runner().then(function () {
      self.alive.setData(self, { acting: false });
      errorHandler.showToast(successText);
      return self.loadFirstPage();
    }, function (error) {
      self.alive.setData(self, { acting: false });
      errorHandler.handleError(error);
    });
  },

  onApproveCertification: function (event) {
    const self = this;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '通过认证',
      content: '确认通过这条校园认证申请吗？通过后该用户即可下单。',
      success: function (res) {
        if (!res.confirm) return;
        self.runAction(function () {
          return adminApi.approveCertification(id);
        }, '已通过认证');
      }
    });
  },

  onRejectCertification: function (event) {
    const self = this;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.promptReason('驳回认证', '请填写驳回原因（2～200 字）', function (reason) {
      self.runAction(function () {
        return adminApi.rejectCertification(id, reason);
      }, '已驳回');
    });
  },

  // 启停共用：当前状态决定动作，二次确认里写清楚将要发生什么。
  // dataset 里传的是状态字符串而不是布尔：WXML 的 dataset 取值以字符串最稳定，
  // 「0 为真」这类判断不该有第二种解释。
  onToggleUser: function (event) {
    const self = this;
    const id = event.currentTarget.dataset.id;
    const nickname = event.currentTarget.dataset.nickname;
    const enabled = event.currentTarget.dataset.status === enums.UserStatus.ACTIVE;
    if (!id) return;
    // 服务端也会拒绝禁用自己（管理员不能把自己锁在门外），这里提前给一句更好懂的提示。
    if (enabled && this.isSelf(id)) {
      errorHandler.showToast('不能禁用当前登录账号');
      return;
    }
    wx.showModal({
      title: enabled ? '禁用账号' : '恢复账号',
      content: enabled
        ? '禁用后「' + nickname + '」的登录态立即失效，确定吗？'
        : '确定恢复「' + nickname + '」的账号吗？',
      success: function (res) {
        if (!res.confirm) return;
        self.runAction(function () {
          return enabled ? adminApi.disableUser(id) : adminApi.enableUser(id);
        }, enabled ? '已禁用' : '已恢复');
      }
    });
  },

  isSelf: function (id) {
    const user = store.getUser();
    return !!user && String(user.id) === String(id);
  },

  onOffShelfItem: function (event) {
    const self = this;
    const id = event.currentTarget.dataset.id;
    const title = event.currentTarget.dataset.title;
    if (!id) return;
    this.promptReason('强制下架', '请填写下架原因（2～200 字）', function (reason) {
      self.runAction(function () {
        return adminApi.offShelfItem(id, reason);
      }, '已下架「' + (title || '') + '」');
    });
  },

  // 需要原因的管理动作共用同一个输入式模态框，校验与 service 是同一套。
  promptReason: function (title, placeholder, onReason) {
    wx.showModal({
      title: title,
      editable: true,
      placeholderText: placeholder,
      success: function (res) {
        if (!res.confirm) return;
        const reason = typeof res.content === 'string' ? res.content : '';
        const text = adminApi.normalizeReason(reason);
        if (text === null) {
          errorHandler.showToast(adminApi.reasonError());
          return;
        }
        onReason(text);
      }
    });
  },

  onTapItem: function (event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: ITEM_DETAIL_ROUTE + '?id=' + id });
  },

  onTapOrder: function (event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: ADMIN_ORDER_DETAIL_ROUTE + '?id=' + id });
  },

  onTapUser: function (event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/user-reviews/user-reviews?id=' + id });
  }
});

// 筛选下拉的当前取值。索引越界或空串都返回空串，等价于「不筛选」。
function optionValue(options, index) {
  const option = options && options[index];
  return option ? option.value : '';
}
