// constants/enums.js
// 总纲 §4 枚举的前端副本。取值必须与 OpenAPI 中的枚举逐字一致：
// 不使用 ordinal、别名或大小写变体。
// 枚举变化顺序：总纲 → 数据库 → Java → OpenAPI → 前端 constants → 测试。

const CertificationStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

const CertificationType = {
  STUDENT_CARD: 'STUDENT_CARD',
  CAMPUS_EMAIL: 'CAMPUS_EMAIL',
  MANUAL: 'MANUAL'
};

const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
};

const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN'
};

const CategoryStatus = {
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED'
};

const FileBizType = {
  ITEM_IMAGE: 'ITEM_IMAGE',
  AVATAR: 'AVATAR',
  CERTIFICATION_EVIDENCE: 'CERTIFICATION_EVIDENCE'
};

// 认证状态的中文文案。页面不直接写死，统一从这里取。
const CERTIFICATION_STATUS_LABEL = {
  NOT_SUBMITTED: '未认证',
  PENDING: '审核中',
  APPROVED: '已认证',
  REJECTED: '未通过'
};

// 认证状态的视觉基调，用作 WXML 上的 class 后缀（badge--success 等）。
const CERTIFICATION_STATUS_TONE = {
  NOT_SUBMITTED: 'muted',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger'
};

// 当前 MVP 只开放人工审核；其余取值保留在枚举中但不可提交。
const CERTIFICATION_TYPE_LABEL = {
  STUDENT_CARD: '学生证',
  CAMPUS_EMAIL: '校园邮箱',
  MANUAL: '人工审核'
};

function certificationStatusLabel(status) {
  return CERTIFICATION_STATUS_LABEL[status] || '未知状态';
}

function certificationStatusTone(status) {
  return CERTIFICATION_STATUS_TONE[status] || 'muted';
}

module.exports = {
  CertificationStatus: CertificationStatus,
  CertificationType: CertificationType,
  UserStatus: UserStatus,
  UserRole: UserRole,
  CategoryStatus: CategoryStatus,
  FileBizType: FileBizType,
  CERTIFICATION_STATUS_LABEL: CERTIFICATION_STATUS_LABEL,
  CERTIFICATION_STATUS_TONE: CERTIFICATION_STATUS_TONE,
  CERTIFICATION_TYPE_LABEL: CERTIFICATION_TYPE_LABEL,
  certificationStatusLabel: certificationStatusLabel,
  certificationStatusTone: certificationStatusTone
};
