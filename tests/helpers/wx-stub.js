// tests/helpers/wx-stub.js
// 最小 wx 全局替身。只在测试里安装，模块本身在业务代码里从不写 wx 之外的全局。

const storage = new Map();

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
}

module.exports = {
  install: install,
  reset: reset,
  storage: storage
};
