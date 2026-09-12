// services/certification-api.js
// 校园认证。本阶段只走 MANUAL（姓名 + 学号），不上传证据文件。

const request = require('./request.js');
const CertificationType = require('../constants/enums.js').CertificationType;

// 提交人工审核申请。成功返回 Certification（含掩码后的姓名与学号）。
function submitManual(realName, studentNo) {
  return request.request({
    method: 'POST',
    path: '/certifications',
    data: { type: CertificationType.MANUAL, realName: realName, studentNo: studentNo }
  });
}

// 查询最近一次申请。从未提交时返回 { status: 'NOT_SUBMITTED', application: null }，仍是 200。
function getLatest() {
  return request.request({ method: 'GET', path: '/certifications/me/latest' });
}

module.exports = {
  submitManual: submitManual,
  getLatest: getLatest
};
