// pages/publish/publish.js
// 发布页：既是 Tab 页（新建商品），也承接详情页发起的编辑。
//
// 编辑入口说明：publish 是 TabBar 页，wx.switchTab 不能带参数，
// 因此详情页先把待编辑商品 ID 写入本地存储，本页 onShow 时取走并清空。
//
// 表单校验在 item-form.js（纯函数，可直接单测），本页只做收集与提示。

const itemApi = require('../../services/item-api.js');
const categoryApi = require('../../services/category-api.js');
const fileApi = require('../../services/file-api.js');
const userApi = require('../../services/user-api.js');
const store = require('../../store/session-store.js');
const enums = require('../../constants/enums.js');
const itemForm = require('./item-form.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const CERT_ROUTE = '/pages/certification/certification';
const EDIT_ITEM_KEY = 'item_edit_id';
const DRAFT_KEY = 'item_draft_v1';
const IMAGE_MAX = itemForm.IMAGE_MAX;

function readStorage(key) {
  try {
    const value = wx.getStorageSync(key);
    return value === '' || value === undefined ? null : value;
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    // 草稿写入失败不影响发布主流程。
  }
}

function clearStorage(key) {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    // 忽略
  }
}

// 把分类树压平成「一级 / 二级」选项，只保留启用节点。
function buildCategoryOptions(tree) {
  const roots = (tree && tree.categories) || [];
  const options = [];
  roots.forEach(function (root) {
    if (!root || root.status !== enums.CategoryStatus.ENABLED) return;
    (root.children || []).forEach(function (child) {
      if (!child || child.status !== enums.CategoryStatus.ENABLED) return;
      options.push({
        id: child.id,
        label: root.name + ' / ' + child.name
      });
    });
  });
  return options;
}

const CONDITION_OPTIONS = enums.ITEM_CONDITION_OPTIONS.map(function (value) {
  return { value: value, label: enums.itemConditionLabel(value) };
});

Page({
  data: {
    checking: true,
    blocked: false,
    blockedReason: '',
    loadingCategories: false,
    categoryOptions: [],
    categoryIndex: -1,
    categoryId: null,
    conditionOptions: CONDITION_OPTIONS,
    conditionIndex: -1,
    condition: null,
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    images: [],
    uploading: false,
    submitting: false,
    editingId: null,
    editingVersion: null,
    imageMax: IMAGE_MAX
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.dirty = false;
    this.loadCategories();
  },

  onShow: function () {
    this.applyPendingEdit();
    this.checkAccess();
  },

  onHide: function () {
    this.saveDraft();
  },

  onUnload: function () {
    this.saveDraft();
    this.disableLeaveAlert();
    this.alive.dispose();
  },

  // 未登录引导登录；已登录但未认证则引导认证。未认证时表单不可用。
  checkAccess: function () {
    const self = this;
    if (!store.getSession()) {
      this.alive.setData(this, { checking: false, blocked: true, blockedReason: '请先登录后再发布商品' });
      return;
    }
    this.alive.setData(this, { checking: true });
    userApi.getMe().then(function (profile) {
      const approved = profile && profile.certificationStatus === enums.CertificationStatus.APPROVED;
      self.alive.setData(self, {
        checking: false,
        blocked: !approved,
        blockedReason: approved ? '' : '校园认证通过后才能发布商品'
      });
      if (approved) self.autoRestoreDraft();
    }, function (error) {
      self.alive.setData(self, { checking: false });
      errorHandler.handleError(error);
    });
  },

  // 自动恢复草稿：仅在编辑模式之外、且表单还是空的时候，避免覆盖用户正在填的内容。
  autoRestoreDraft: function () {
    if (this.data.editingId) return;
    if (this.dirty || this.data.title || this.data.images.length) return;
    const draft = readStorage(DRAFT_KEY);
    if (!draft) return;
    this.restoreDraft(draft);
  },

  onGoLogin: function () {
    errorHandler.requireLogin();
  },

  onGoCertification: function () {
    wx.navigateTo({ url: CERT_ROUTE });
  },

  loadCategories: function () {
    const self = this;
    this.alive.setData(this, { loadingCategories: true });
    categoryApi.getTree().then(function (tree) {
      const options = buildCategoryOptions(tree);
      self.alive.setData(self, { loadingCategories: false, categoryOptions: options });
    }, function (error) {
      self.alive.setData(self, { loadingCategories: false });
      errorHandler.handleError(error);
    });
  },

  // ---- 编辑模式 ------------------------------------------------------------

  applyPendingEdit: function () {
    const pendingId = readStorage(EDIT_ITEM_KEY);
    if (!pendingId || this.data.editingId) return;
    clearStorage(EDIT_ITEM_KEY);
    const self = this;
    itemApi.getDetail(pendingId).then(function (item) {
      if (!item) return;
      self.alive.setData(self, {
        editingId: item.id,
        editingVersion: item.version,
        title: item.title || '',
        description: item.description || '',
        price: item.price === null || item.price === undefined ? '' : String(item.price),
        originalPrice:
          item.originalPrice === null || item.originalPrice === undefined ? '' : String(item.originalPrice),
        condition: item.condition || null,
        conditionIndex: indexOfCondition(item.condition),
        categoryId: item.category && item.category.id ? item.category.id : null,
        images: (item.images || []).map(function (image) {
          return { fileId: image.fileId, url: image.url, tempPath: '' };
        })
      });
      self.syncCategoryIndex();
      wx.setNavigationBarTitle({ title: '编辑商品' });
    }, function (error) {
      errorHandler.handleError(error);
    });
  },

  syncCategoryIndex: function () {
    const target = this.data.categoryId;
    const index = this.data.categoryOptions.findIndex(function (option) {
      return String(option.id) === String(target);
    });
    if (index >= 0) this.alive.setData(this, { categoryIndex: index });
  },

  // ---- 表单输入 ------------------------------------------------------------

  markDirty: function () {
    this.dirty = true;
    if (typeof wx.enableAlertBeforeUnload === 'function') {
      wx.enableAlertBeforeUnload({ message: '商品尚未提交，确定离开吗？' });
    }
  },

  disableLeaveAlert: function () {
    if (typeof wx.disableAlertBeforeUnload === 'function') wx.disableAlertBeforeUnload();
  },

  onTitleInput: function (event) {
    this.alive.setData(this, { title: event.detail.value });
    this.markDirty();
  },

  onDescriptionInput: function (event) {
    this.alive.setData(this, { description: event.detail.value });
    this.markDirty();
  },

  onPriceInput: function (event) {
    this.alive.setData(this, { price: event.detail.value });
    this.markDirty();
  },

  onOriginalPriceInput: function (event) {
    this.alive.setData(this, { originalPrice: event.detail.value });
    this.markDirty();
  },

  onConditionChange: function (event) {
    const index = Number(event.detail.value);
    const option = this.data.conditionOptions[index];
    this.alive.setData(this, { conditionIndex: index, condition: option ? option.value : null });
    this.markDirty();
  },

  onCategoryChange: function (event) {
    const index = Number(event.detail.value);
    const option = this.data.categoryOptions[index];
    this.alive.setData(this, { categoryIndex: index, categoryId: option ? option.id : null });
    this.markDirty();
  },

  // ---- 图片 ----------------------------------------------------------------

  onChooseImage: function () {
    const self = this;
    if (this.data.uploading || this.data.submitting) return;
    const remaining = IMAGE_MAX - this.data.images.length;
    if (remaining <= 0) {
      errorHandler.showToast('最多上传 ' + IMAGE_MAX + ' 张图片');
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        self.uploadAll((res && res.tempFiles) || []);
      }
    });
  },

  // 逐张上传。单张失败不影响已成功的图片，用户可以再次选择补齐。
  uploadAll: function (tempFiles) {
    const self = this;
    const paths = tempFiles
      .map(function (file) {
        return file && (file.tempFilePath || file.path);
      })
      .filter(function (path) {
        return !!path;
      });
    if (!paths.length) return;

    this.alive.setData(this, { uploading: true });
    let index = 0;
    let failed = 0;

    function next() {
      if (index >= paths.length) {
        self.alive.setData(self, { uploading: false });
        if (failed > 0) errorHandler.showToast(failed + ' 张图片上传失败，请重试');
        if (index > 0) self.markDirty();
        return;
      }
      const path = paths[index];
      index += 1;
      fileApi.uploadItemImage(path).then(function (file) {
        if (!file || !file.fileId) {
          failed += 1;
          next();
          return;
        }
        const images = self.data.images.concat([
          { fileId: String(file.fileId), url: file.url || path, tempPath: path }
        ]);
        self.alive.setData(self, { images: images });
        next();
      }, function (error) {
        failed += 1;
        errorHandler.handleError(error);
        next();
      });
    }

    next();
  },

  onPreviewImage: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    const urls = this.data.images
      .map(function (image) {
        return image.url;
      })
      .filter(function (url) {
        return !!url;
      });
    if (!urls.length) return;
    wx.previewImage({ current: urls[index], urls: urls });
  },

  // 排序用上移/下移，避免在小程序里引入拖拽依赖。
  onMoveImage: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    const delta = Number(event.currentTarget.dataset.delta);
    const target = index + delta;
    const images = this.data.images.slice();
    if (target < 0 || target >= images.length) return;
    const moved = images.splice(index, 1)[0];
    images.splice(target, 0, moved);
    this.alive.setData(this, { images: images });
    this.markDirty();
  },

  onRemoveImage: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.alive.setData(this, { images: images });
    this.markDirty();
  },

  // ---- 草稿 ----------------------------------------------------------------

  currentForm: function () {
    return {
      title: this.data.title,
      description: this.data.description,
      price: this.data.price,
      originalPrice: this.data.originalPrice,
      condition: this.data.condition,
      categoryId: this.data.categoryId,
      imageFileIds: this.data.images.map(function (image) {
        return image.fileId;
      })
    };
  },

  saveDraft: function () {
    if (!this.dirty || this.data.submitting) return;
    const draft = this.currentForm();
    draft.images = this.data.images;
    draft.editingId = this.data.editingId;
    writeStorage(DRAFT_KEY, draft);
  },

  onRestoreDraft: function () {
    const draft = readStorage(DRAFT_KEY);
    if (!draft) {
      errorHandler.showToast('没有可恢复的草稿');
      return;
    }
    this.restoreDraft(draft);
    errorHandler.showToast('已恢复草稿');
  },

  restoreDraft: function (draft) {
    const source = draft || readStorage(DRAFT_KEY);
    if (!source) return;
    this.dirty = true;
    this.alive.setData(this, {
      title: source.title || '',
      description: source.description || '',
      price: source.price === null || source.price === undefined ? '' : String(source.price),
      originalPrice:
        source.originalPrice === null || source.originalPrice === undefined ? '' : String(source.originalPrice),
      condition: source.condition || null,
      conditionIndex: indexOfCondition(source.condition),
      categoryId: source.categoryId || null,
      images: (source.images || []).filter(function (image) {
        return image && image.fileId;
      })
    });
    this.syncCategoryIndex();
  },

  onDiscardDraft: function () {
    clearStorage(DRAFT_KEY);
    this.dirty = false;
    this.disableLeaveAlert();
    this.alive.setData(this, {
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      condition: null,
      conditionIndex: -1,
      categoryId: null,
      categoryIndex: -1,
      images: []
    });
    errorHandler.showToast('已清空');
  },

  // ---- 提交 ----------------------------------------------------------------

  // mode 为 true 时创建/保存后立即上架。
  onSubmit: function (event) {
    const publishAfter = event && event.currentTarget ? event.currentTarget.dataset.publish === '1' : false;
    const self = this;
    if (this.data.submitting || this.data.uploading) return;

    const form = this.currentForm();
    const message = itemForm.validateItemForm(form);
    if (message) {
      errorHandler.showToast(message);
      return;
    }

    this.alive.setData(this, { submitting: true });
    const saving = this.data.editingId
      ? itemApi.updateItem(this.data.editingId, itemForm.buildPayload(form, this.data.editingVersion))
      : itemApi.createItem(itemForm.buildPayload(form));

    saving.then(function (item) {
      if (!publishAfter) {
        self.finishSubmit('已保存草稿');
        return item;
      }
      return itemApi.publishItem(item.id).then(function () {
        self.finishSubmit('已上架');
      }, function (error) {
        // 商品已创建但上架失败：草稿仍在，提示用户到详情处理。
        self.alive.setData(self, { submitting: false });
        errorHandler.handleError(error);
      });
    }, function (error) {
      self.alive.setData(self, { submitting: false });
      errorHandler.handleError(error);
      // 认证失效等情况下重新评估访问条件。
      if (error && error.code === 'USER_CERTIFICATION_REQUIRED') self.checkAccess();
    });
  },

  finishSubmit: function (message) {
    this.dirty = false;
    this.disableLeaveAlert();
    clearStorage(DRAFT_KEY);
    this.alive.setData(this, {
      submitting: false,
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      condition: null,
      conditionIndex: -1,
      categoryId: null,
      categoryIndex: -1,
      images: [],
      editingId: null,
      editingVersion: null
    });
    wx.setNavigationBarTitle({ title: '发布' });
    errorHandler.showToast(message);
    wx.switchTab({ url: '/pages/home/home' });
  }
});

function indexOfCondition(condition) {
  for (let i = 0; i < CONDITION_OPTIONS.length; i += 1) {
    if (CONDITION_OPTIONS[i].value === condition) return i;
  }
  return -1;
}
