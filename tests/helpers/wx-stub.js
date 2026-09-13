// tests/helpers/wx-stub.js
// 最小 wx 全局替身。只在测试里安装，模块本身在业务代码里从不写 wx 之外的全局。

const storage = new Map();

// TabBar 红点的调用记录。业务代码通过它设置/清除未读红点，
// 测试断言「登录后设置、退出后被清除」这类行为时需要看到实际调用。
const tabBarBadgeCalls = [];

let installed = false;

function install() {
  if (installed) return;
  installed = true;
  global.wx = {
    getStorageSync: function (key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync: function (key, value) {
      storage.set(key, value);
    },
    removeStorageSync: function (key) {
      storage.delete(key);
    },
    showToast: function () {},
    showModal: function (options) {
      if (options && options.success) options.success({ confirm: true });
    },
    navigateTo: function () {},
    reLaunch: function () {},
    switchTab: function () {},
    navigateBack: function () {},
    stopPullDownRefresh: function () {},
    chooseMedia: function () {},
    login: function (options) {
      if (options && options.success) options.success({ code: 'test-login-code' });
    },
    setTabBarBadge: function (options) {
      tabBarBadgeCalls.push({ type: 'set', index: options && options.index, text: options && options.text });
      if (options && options.success) options.success({});
    },
    removeTabBarBadge: function (options) {
      tabBarBadgeCalls.push({ type: 'remove', index: options && options.index });
      if (options && options.success) options.success({});
    },
    setNavigationBarTitle: function () {},
    request: function () {
      throw new Error('wx.request 不应被直接调用：测试需先 __setTransport');
    },
    uploadFile: function () {
      throw new Error('wx.uploadFile 不应被直接调用：测试需先 __setUploadTransport');
    }
  };
}

function reset() {
  storage.clear();
  tabBarBadgeCalls.length = 0;
}

module.exports = {
  install: install,
  reset: reset,
  storage: storage,
  tabBarBadgeCalls: tabBarBadgeCalls
};
