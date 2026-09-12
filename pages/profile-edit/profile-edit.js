// pages/profile-edit/profile-edit.js
// 编辑资料。只允许修改昵称、头像与手机号；
// 校区由后端按单校区自动绑定，前端不提供选择，也不能修改。
//
// 头像流程：wx.chooseMedia 选图 → 客户端先查大小 → 上传得到 FileObject →
// 保存时把 fileId 放进 PATCH 请求。清空头像用显式 null。

const userApi = require('../../services/user-api.js');
const fileApi = require('../../services/file-api.js');
const store = require('../../store/session-store.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');
const mediaUrl = require('../../utils/media-url.js');

const NICKNAME_MAX = 20;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const PHONE_PATTERN = /^1[3-9][0-9]{9}$/;

Page({
  data: {
    loading: true,
    submitting: false,
    uploading: false,
    nickname: '',
    phone: '',
    avatarUrl: ''
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    this.original = { nickname: '', phone: '' };
    this.avatarChange = null; // null 未改动；{ fileId } 新上传；'clear' 清空
    if (!store.getSession()) {
      errorHandler.requireLogin();
      return;
    }
    this.loadProfile();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  loadProfile: function () {
    const self = this;
    userApi.getMe().then(function (profile) {
      if (!profile) return;
      self.original = {
        nickname: profile.nickname || '',
        phone: profile.phone || ''
      };
      self.alive.setData(self, {
        loading: false,
        nickname: self.original.nickname,
        phone: self.original.phone,
        avatarUrl: mediaUrl.resolveMediaUrl(profile.avatarUrl)
      });
    }, function (error) {
      self.alive.setData(self, { loading: false });
      errorHandler.handleError(error);
    });
  },

  onNicknameInput: function (event) {
    this.alive.setData(this, { nickname: event.detail.value });
  },

  onPhoneInput: function (event) {
    this.alive.setData(this, { phone: event.detail.value });
  },

  onChooseAvatar: function () {
    const self = this;
    if (this.data.uploading || this.data.submitting) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        // 先做客户端大小检查，避免白传一次大文件。
        if (file.size && file.size > AVATAR_MAX_BYTES) {
          errorHandler.showToast('头像不能超过 2MB');
          return;
        }
        self.uploadAvatar(file.tempFilePath);
      }
    });
  },

  uploadAvatar: function (filePath) {
    const self = this;
    this.alive.setData(this, { uploading: true });
    fileApi.uploadAvatar(filePath).then(function (fileObject) {
      if (!fileObject || !fileObject.fileId) {
        self.alive.setData(self, { uploading: false });
        errorHandler.showToast('头像上传失败，请重试');
        return;
      }
      self.avatarChange = { fileId: fileObject.fileId };
      self.alive.setData(self, {
        uploading: false,
        avatarUrl: mediaUrl.resolveMediaUrl(fileObject.url) || filePath
      });
    }, function (error) {
      self.alive.setData(self, { uploading: false });
      errorHandler.handleError(error);
    });
  },

  onClearAvatar: function () {
    if (this.data.uploading || this.data.submitting) return;
    this.avatarChange = 'clear';
    this.alive.setData(this, { avatarUrl: '' });
  },

  buildPatch: function () {
    const nickname = String(this.data.nickname || '').trim();
    const phone = String(this.data.phone || '').trim();
    const patch = {};

    if (nickname !== this.original.nickname) patch.nickname = nickname;
    if (phone !== this.original.phone) patch.phone = phone === '' ? null : phone;
    if (this.avatarChange === 'clear') patch.avatarFileId = null;
    if (this.avatarChange && this.avatarChange.fileId) patch.avatarFileId = this.avatarChange.fileId;

    return { nickname: nickname, phone: phone, patch: patch };
  },

  onSave: function () {
    const self = this;
    if (this.data.submitting || this.data.uploading) return;

    const built = this.buildPatch();

    if (!built.nickname) {
      errorHandler.showToast('昵称不能为空');
      return;
    }
    if (built.nickname.length > NICKNAME_MAX) {
      errorHandler.showToast('昵称最多 ' + NICKNAME_MAX + ' 个字符');
      return;
    }
    if (built.phone && !PHONE_PATTERN.test(built.phone)) {
      errorHandler.showToast('请输入正确的手机号');
      return;
    }
    if (!Object.keys(built.patch).length) {
      errorHandler.showToast('没有需要保存的修改');
      wx.navigateBack();
      return;
    }

    this.alive.setData(this, { submitting: true });
    userApi.updateMe(built.patch).then(function (profile) {
      if (profile) {
        const patch = { nickname: profile.nickname };
        if (profile.avatarUrl !== undefined) patch.avatarUrl = profile.avatarUrl;
        store.updateUser(patch);
      }
      self.alive.setData(self, { submitting: false });
      errorHandler.showToast('已保存');
      wx.navigateBack();
    }, function (error) {
      self.alive.setData(self, { submitting: false });
      errorHandler.handleError(error);
    });
  }
});
