// tests/admin/admin-view.test.js
// 管理台展示层映射：四类条目的 ID 保持十进制字符串、金额两位小数、媒体地址转绝对、
// 状态与角色文案取自 enums，动作按钮由条目状态决定而不是前端猜权限。

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('../helpers/wx-stub.js');
wxStub.install();

const adminView = require('../../utils/admin-view.js');

beforeEach(function () {
  wxStub.reset();
});

describe('认证申请视图', function () {
  it('保留脱敏后的姓名学号，待审核才给出操作按钮', function () {
    const pending = adminView.buildCertificationView({
      id: 7,
      userId: 31,
      campus: { id: 1, name: '主校区' },
      type: 'MANUAL',
      realNameMasked: '张*',
      studentNoMasked: '2021****01',
      status: 'PENDING',
      rejectReason: null,
      reviewedAt: null,
      createdAt: '2026-09-12T03:20:00.000Z'
    });
    assert.equal(pending.id, '7');
    assert.equal(pending.userId, '31');
    assert.equal(pending.campusName, '主校区');
    assert.equal(pending.typeLabel, '人工审核');
    assert.equal(pending.realNameMasked, '张*');
    assert.equal(pending.studentNoMasked, '2021****01');
    assert.equal(pending.statusLabel, '审核中');
    assert.equal(pending.statusTone, 'warning');
    assert.equal(pending.pending, true);
    assert.equal(pending.createdAt, '2026-09-12 03:20');

    const approved = adminView.buildCertificationView({ id: '8', status: 'APPROVED', reviewedAt: '2026-09-12T09:00:00.000Z' });
    assert.equal(approved.pending, false);
    assert.equal(approved.statusLabel, '已认证');
    assert.equal(approved.statusTone, 'success');
  });
});

describe('管理端用户视图', function () {
  it('状态决定启停按钮，管理员与角色文案正确', function () {
    const view = adminView.buildUserView({
      id: 3,
      nickname: '小王',
      avatarUrl: '/media/12',
      phone: '13800000000',
      role: 'USER',
      status: 'ACTIVE',
      campus: { id: 1, name: '主校区' },
      certificationStatus: 'APPROVED',
      averageRating: '4.50',
      reviewCount: 6,
      createdAt: '2026-09-01T00:00:00.000Z',
      lastLoginAt: '2026-09-13T01:02:00.000Z'
    });
    assert.equal(view.id, '3');
    assert.equal(view.avatarUrl, 'http://127.0.0.1:8080/media/12');
    assert.equal(view.initial, '小');
    assert.equal(view.roleLabel, '用户');
    assert.equal(view.isAdmin, false);
    assert.equal(view.statusLabel, '正常');
    assert.equal(view.statusTone, 'success');
    assert.equal(view.enabled, true);
    assert.equal(view.certLabel, '已认证');
    assert.equal(view.averageRating, '4.50');
    assert.equal(view.createdDate, '2026-09-01');
    assert.equal(view.lastLoginAt, '2026-09-13 01:02');

    const disabled = adminView.buildUserView({ id: '4', nickname: '小李', role: 'ADMIN', status: 'DISABLED' });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.statusLabel, '已禁用');
    assert.equal(disabled.roleLabel, '管理员');
    assert.equal(disabled.isAdmin, true);
    assert.equal(disabled.phone, '未填写');
  });

  it('没有评分时显示占位符而不是 0.00', function () {
    const view = adminView.buildUserView({ id: '5', nickname: '新人', averageRating: null, reviewCount: 0 });
    assert.equal(view.averageRating, '—');
    assert.equal(view.reviewCount, 0);
  });
});

describe('管理端商品视图', function () {
  it('只有在售与草稿提供下架按钮：已预订/已售出下架会把订单卡死', function () {
    const onSale = adminView.buildAdminItemView({
      id: 9,
      title: '二手自行车',
      price: '128.00',
      status: 'ON_SALE',
      seller: { id: 6, nickname: '卖家甲', avatarUrl: null },
      category: { id: 2, name: '交通工具' },
      adminLock: false,
      offShelfReason: null,
      favoriteCount: 3,
      viewCount: 40,
      createdAt: '2026-09-10T00:00:00.000Z'
    });
    assert.equal(onSale.id, '9');
    assert.equal(onSale.priceText, '¥128.00');
    assert.equal(onSale.statusLabel, '在售');
    assert.equal(onSale.statusTone, 'success');
    assert.equal(onSale.sellerName, '卖家甲');
    assert.equal(onSale.sellerId, '6');
    assert.equal(onSale.categoryName, '交通工具');
    assert.equal(onSale.offShelfable, true);

    // 草稿还没上架，管理员仍可锁定。
    assert.equal(adminView.buildAdminItemView({ id: '11', status: 'DRAFT' }).offShelfable, true);
    // 已预订（有进行中订单）与已售出的商品一旦下架，接单/拒单/取消/收货会被商品状态拦下，按钮必须隐藏。
    assert.equal(adminView.buildAdminItemView({ id: '12', status: 'RESERVED' }).offShelfable, false);
    assert.equal(adminView.buildAdminItemView({ id: '13', status: 'SOLD' }).offShelfable, false);

    const offShelf = adminView.buildAdminItemView({
      id: '10',
      status: 'OFF_SHELF',
      adminLock: true,
      offShelfReason: '涉嫌违规'
    });
    assert.equal(offShelf.offShelfable, false);
    assert.equal(offShelf.adminLock, true);
    assert.equal(offShelf.offShelfReason, '涉嫌违规');
  });
});

describe('审计视图', function () {
  it('动作与目标类型翻译成文案，详情压成键值串', function () {
    const view = adminView.buildAuditLogView({
      id: 21,
      operator: { id: 2, nickname: '管理员', avatarUrl: null },
      action: 'ITEM_ADMIN_OFF_SHELF',
      targetType: 'ITEM',
      targetId: 9,
      requestId: 'req-1',
      detail: { reason: '涉嫌违规', adminLock: true },
      createdAt: '2026-09-13T02:30:00.000Z'
    });
    assert.equal(view.id, '21');
    assert.equal(view.actionLabel, '强制下架商品');
    assert.equal(view.targetTypeLabel, '商品');
    assert.equal(view.targetId, '9');
    assert.equal(view.operatorName, '管理员');
    assert.equal(view.detailText, 'reason=涉嫌违规  adminLock=true');
    assert.equal(view.createdAt, '2026-09-13 02:30');
  });

  it('未知动作原样展示，缺详情时不产生空白键值', function () {
    const view = adminView.buildAuditLogView({
      id: '22',
      operator: null,
      action: 'FUTURE_ACTION',
      targetType: 'FUTURE_TARGET',
      targetId: null,
      detail: null
    });
    assert.equal(view.actionLabel, 'FUTURE_ACTION');
    assert.equal(view.targetTypeLabel, 'FUTURE_TARGET');
    assert.equal(view.targetId, '');
    assert.equal(view.operatorName, '系统');
    assert.equal(view.detailText, '');
    assert.equal(adminView.formatDetail(undefined), '');
    assert.equal(adminView.formatDetail({ a: null }), 'a=');
  });

  it('列表映射保持条目顺序', function () {
    const views = adminView.buildAuditLogViews([{ id: 1 }, { id: 2 }]);
    assert.deepEqual(
      views.map(function (item) {
        return item.id;
      }),
      ['1', '2']
    );
    assert.deepEqual(adminView.buildUserViews(null), []);
    assert.deepEqual(adminView.buildAdminItemViews(undefined), []);
    assert.deepEqual(adminView.buildCertificationViews([]), []);
  });
});
