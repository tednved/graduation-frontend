// pages/category/category.js
// 两级分类树。数据来自公开接口 GET /categories/tree，未登录也可浏览。
// 本阶段只展示分类；分类下的商品列表属于后续任务。

const categoryApi = require('../../services/category-api.js');
const enums = require('../../constants/enums.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

// 公开接口只返回启用节点，这里再按状态过滤一次，避免停用分类进入 UI。
function pickEnabled(nodes) {
  return (nodes || []).filter(function (node) {
    return node && node.status === enums.CategoryStatus.ENABLED;
  });
}

Page({
  data: {
    loading: false,
    failed: false,
    categories: [],
    activeId: null,
    activeName: '',
    activeChildren: []
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.loadTree();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    this.loadTree(true);
  },

  loadTree: function (fromPull) {
    const self = this;
    this.alive.setData(this, { loading: true, failed: false });
    categoryApi.getTree().then(function (data) {
      const parents = pickEnabled(data && data.categories);
      if (!parents.length) {
        self.alive.setData(self, { loading: false, categories: [] });
        return;
      }
      const first = parents[0];
      self.alive.setData(self, {
        loading: false,
        categories: parents,
        activeId: first.id,
        activeName: first.name,
        activeChildren: pickEnabled(first.children)
      });
    }, function (error) {
      self.alive.setData(self, { loading: false, failed: true });
      errorHandler.handleError(error);
    }).then(function () {
      if (fromPull) wx.stopPullDownRefresh();
    });
  },

  onSelectParent: function (event) {
    const id = String(event.currentTarget.dataset.id);
    const node = this.data.categories.filter(function (item) {
      return String(item.id) === id;
    })[0];
    if (!node || String(node.id) === String(this.data.activeId)) return;
    this.alive.setData(this, {
      activeId: node.id,
      activeName: node.name,
      activeChildren: pickEnabled(node.children)
    });
  },

  onTapLeaf: function () {
    // 商品列表不在本任务的交付范围内，这里明确说明而不是给出空页面。
    errorHandler.showToast('分类已就绪，商品列表将在后续任务实现');
  },

  onRetry: function () {
    if (this.data.loading) return;
    this.loadTree();
  }
});
