// tests/error-codes.test.js
// 错误码与枚举是前后端契约的一部分，这里逐字锁定，防止实现期间走样。

const { describe, it } = require('node:test');
const assert = require('node:assert');

const errors = require('../constants/error-codes.js');
const enums = require('../constants/enums.js');

// 总纲 §7.2 的全部错误码，顺序与契约一致。
const CONTRACT_CODES = [
  'VALIDATION_ERROR',
  'AUTH_INVALID_CODE',
  'AUTH_UNAUTHORIZED',
  'AUTH_REFRESH_INVALID',
  'AUTH_FORBIDDEN',
  'USER_DISABLED',
  'USER_CERTIFICATION_REQUIRED',
  'RESOURCE_NOT_FOUND',
  'CERTIFICATION_PENDING_EXISTS',
  'CERTIFICATION_ALREADY_REVIEWED',
  'CATEGORY_IN_USE',
  'FILE_INVALID_TYPE',
  'FILE_TOO_LARGE',
  'FILE_NOT_OWNED',
  'ITEM_NOT_EDITABLE',
  'ITEM_NOT_AVAILABLE',
  'ITEM_SELF_PURCHASE',
  'ITEM_CONCURRENTLY_RESERVED',
  'ITEM_SELF_OPERATION',
  'ORDER_ILLEGAL_STATUS_TRANSITION',
  'ORDER_OPERATION_FORBIDDEN',
  'ORDER_DUPLICATE_REQUEST',
  'REVIEW_NOT_ALLOWED',
  'REVIEW_ALREADY_EXISTS',
  'INTERNAL_ERROR'
];

describe('错误码', function () {
  it('与契约的 25 个错误码逐字一致', function () {
    assert.equal(CONTRACT_CODES.length, 25);
    assert.deepEqual(Object.keys(errors.ERROR_CODES), CONTRACT_CODES);
  });

  it('每个错误码都有文案与处理动作', function () {
    CONTRACT_CODES.forEach(function (code) {
      assert.equal(typeof errors.messageForCode(code), 'string');
      assert.ok(errors.messageForCode(code).length > 0, code + ' 缺少文案');
      assert.equal(typeof errors.actionForCode(code), 'string');
    });
  });

  it('会话类错误映射到清空会话或重新登录', function () {
    assert.equal(errors.actionForCode('AUTH_UNAUTHORIZED'), errors.ACTION.REAUTH);
    assert.equal(errors.actionForCode('AUTH_REFRESH_INVALID'), errors.ACTION.CLEAR_SESSION);
    assert.equal(errors.actionForCode('USER_DISABLED'), errors.ACTION.CLEAR_SESSION);
    assert.equal(errors.actionForCode('INTERNAL_ERROR'), errors.ACTION.RETRY);
  });

  it('未知错误码回退到默认文案与提示', function () {
    assert.equal(errors.messageForCode('NOPE'), errors.DEFAULT_MESSAGE);
    assert.equal(errors.actionForCode('NOPE'), errors.ACTION.TOAST);
  });

  it('按 HTTP 状态给出兜底错误码', function () {
    assert.equal(errors.fallbackCodeForStatus(400), 'VALIDATION_ERROR');
    assert.equal(errors.fallbackCodeForStatus(401), 'AUTH_UNAUTHORIZED');
    assert.equal(errors.fallbackCodeForStatus(403), 'AUTH_FORBIDDEN');
    assert.equal(errors.fallbackCodeForStatus(404), 'RESOURCE_NOT_FOUND');
    assert.equal(errors.fallbackCodeForStatus(413), 'FILE_TOO_LARGE');
    assert.equal(errors.fallbackCodeForStatus(500), 'INTERNAL_ERROR');
  });

  it('响应体不是合法 ApiError 时按状态兜底', function () {
    const normalized = errors.normalizeHttpError(500, null, 'r-1');
    assert.equal(normalized.code, 'INTERNAL_ERROR');
    assert.equal(normalized.requestId, 'r-1');
    assert.equal(normalized.action, errors.ACTION.RETRY);

    const withBody = errors.normalizeHttpError(409, { code: 'CERTIFICATION_PENDING_EXISTS' }, 'r-2');
    assert.equal(withBody.code, 'CERTIFICATION_PENDING_EXISTS');
    assert.equal(withBody.message, errors.messageForCode('CERTIFICATION_PENDING_EXISTS'));
  });
});

describe('枚举', function () {
  it('认证状态与契约一致', function () {
    assert.deepEqual(Object.values(enums.CertificationStatus), [
      'NOT_SUBMITTED',
      'PENDING',
      'APPROVED',
      'REJECTED'
    ]);
  });

  it('认证类型与文件业务类型与契约一致', function () {
    assert.deepEqual(Object.values(enums.CertificationType), ['STUDENT_CARD', 'CAMPUS_EMAIL', 'MANUAL']);
    assert.deepEqual(Object.values(enums.FileBizType), ['ITEM_IMAGE', 'AVATAR', 'CERTIFICATION_EVIDENCE']);
    assert.deepEqual(Object.values(enums.CategoryStatus), ['ENABLED', 'DISABLED']);
    assert.deepEqual(Object.values(enums.UserRole), ['USER', 'ADMIN']);
    assert.deepEqual(Object.values(enums.UserStatus), ['ACTIVE', 'DISABLED']);
  });

  it('认证状态有中文文案与视觉基调', function () {
    Object.values(enums.CertificationStatus).forEach(function (status) {
      assert.ok(enums.certificationStatusLabel(status).length > 0);
      assert.ok(enums.certificationStatusTone(status).length > 0);
    });
    assert.equal(enums.certificationStatusLabel('PENDING'), '审核中');
  });
});
