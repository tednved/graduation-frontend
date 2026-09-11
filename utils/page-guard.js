// utils/page-guard.js
// 页面存活守卫。异步回调返回时页面可能已经卸载，
// 此时调用 setData 会触发控制台告警，这里统一拦截。

function createAlive() {
  let alive = true;
  return {
    isAlive: function () {
      return alive;
    },
    dispose: function () {
      alive = false;
    },
    // 页面已卸载时返回 false，调用方据此提前结束后续逻辑。
    setData: function (page, data) {
      if (!alive || !page || typeof page.setData !== 'function') return false;
      page.setData(data);
      return true;
    }
  };
}

module.exports = {
  createAlive: createAlive
};
