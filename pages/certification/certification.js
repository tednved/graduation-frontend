// pages/certification/certification.js
// 校园认证。本阶段只支持 MANUAL：提交真实姓名与学号，不上传证据文件。
// 服务端只回传脱敏后的姓名与学号，页面不做任何明文留存。

const certApi = require('../../services/certification-api.js');
const store = require('../../store/session-store.js');
const enums = require('../../constants/enums.js');
const pageGuard = require('../../utils/page-guard.js');
const errorHandler = require('../../utils/error-handler.js');

const REAL_NAME_MIN = 2;
const REAL_NAME_MAX = 30;
const STUDENT_NO_MIN = 4;
const STUDENT_NO_MAX = 32;

Page({
  data: {
    loading: true,
    submitting: false,
    status: enums.CertificationStatus.NOT_SUBMITTED,
    statusLabel: '',
    statusTone: 'muted',
    certification: null,
    submittedAt: '',
    reviewedAt: '',
    rejectReason: '',
    realName: '',
    studentNo: ''
  },

  onLoad: function () {
    this.alive = pageGuard.createAlive();
    if (!store.getSession()) {
      errorHandler.requireLogin();
      return;
    }
    this.loadLatest();
  },

  onUnload: function () {
    this.alive.dispose();
  },

  onPullDownRefresh: function () {
    this.loadLatest(true);
  },

  loadLatest: function (fromPull) {
    const self = this;
    this.alive.setData(this, { loading: true });
    certApi.getLatest().then(function (data) {
      const status = (data && data.status) || enums.CertificationStatus.NOT_SUBMITTED;
      const application = (data && data.application) || null;
      self.alive.setData(self, {
        loading: false,
        status: status,
        statusLabel: enums.certificationStatusLabel(status),
        statusTone: enums.certificationStatusTone(status),
        certification: application,
        submittedAt: String((application && application.createdAt) || '').slice(0, 10),
        reviewedAt: String((application && application.reviewedAt) || '').slice(0, 10),
        rejectReason: (application && application.rejectReason) || ''
      });
    }, function (error) {
      self.alive.setData(self, { loading: false });
      errorHandler.handleError(error);
    }).then(function () {
      if (fromPull) wx.stopPullDownRefresh();
    });
  },

  onRealNameInput: function (event) {
    this.alive.setData(this, { realName: event.detail.value });
  },

  onStudentNoInput: function (event) {
    this.alive.setData(this, { studentNo: event.detail.value });
  },

  onSubmit: function () {
    const self = this;
    if (this.data.submitting) return;

    const realName = String(this.data.realName || '').trim();
    const studentNo = String(this.data.studentNo || '').trim();

    if (realName.length < REAL_NAME_MIN || realName.length > REAL_NAME_MAX) {
      errorHandler.showToast('姓名长度需为 ' + REAL_NAME_MIN + '-' + REAL_NAME_MAX + ' 个字符');
      return;
    }
    if (studentNo.length < STUDENT_NO_MIN || studentNo.length > STUDENT_NO_MAX) {
      errorHandler.showToast('学号长度需为 ' + STUDENT_NO_MIN + '-' + STUDENT_NO_MAX + ' 个字符');
      return;
    }

    this.alive.setData(this, { submitting: true });
    certApi.submitManual(realName, studentNo).then(function () {
      // 提交成功后立刻清空表单，明文不再留在页面数据里。
      self.alive.setData(self, { submitting: false, realName: '', studentNo: '' });
      errorHandler.showToast('已提交，等待管理员审核');
      self.loadLatest(false);
    }, function (error) {
      self.alive.setData(self, { submitting: false });
      errorHandler.handleError(error);
      // 已有待审申请时以服务端状态为准。
      if (error && error.code === 'CERTIFICATION_PENDING_EXISTS') self.loadLatest(false);
    });
  }
});
