// tests/session-store.test.js
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const wxStub = require('./helpers/wx-stub.js');
wxStub.install();

const store = require('../store/session-store.js');

beforeEach(function () {
  wxStub.reset();
  store.__resetForTest();
});

describe('session-store', function () {
  it('没有会话时返回 null', function () {
    assert.equal(store.getSession(), null);
    assert.equal(store.getAccessToken(), null);
    assert.equal(store.getRefreshToken(), null);
    assert.equal(store.getUser(), null);
  });

  it('写入后可从存储恢复（模拟冷启动）', function () {
    const session = { accessToken: 'a1', refreshToken: 'r1', deviceId: 'd1', user: { nickname: 'n' } };
    store.setSession(session);

    // 只清内存缓存，存储保留，等价于小程序重新启动。
    store.__resetForTest();

    assert.equal(store.getSession().accessToken, 'a1');
    assert.equal(store.getRefreshToken(), 'r1');
    assert.equal(store.getUser().nickname, 'n');
  });

  it('存储内容损坏时返回 null 而不抛错', function () {
    wxStub.storage.set(store.STORAGE_KEY, 42);
    assert.equal(store.getSession(), null);

    wxStub.storage.set(store.STORAGE_KEY, { accessToken: '' });
    store.__resetForTest();
    assert.equal(store.getSession(), null);

    wxStub.storage.set(store.STORAGE_KEY, { refreshToken: 'only-refresh' });
    store.__resetForTest();
    assert.equal(store.getSession(), null);
  });

  it('createSession 把顶层 certificationStatus 一并保存', function () {
    const session = store.createSession(
      {
        accessToken: 'a1',
        refreshToken: 'r1',
        user: { id: '1', nickname: 'n' },
        certificationStatus: 'PENDING'
      },
      'd1'
    );
    assert.equal(session.accessToken, 'a1');
    assert.equal(session.refreshToken, 'r1');
    assert.equal(session.deviceId, 'd1');
    assert.equal(session.certificationStatus, 'PENDING');
  });

  it('updateUser 合并摘要且 certificationStatus 留在会话顶层', function () {
    store.setSession({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: '1', nickname: '旧昵称' },
      certificationStatus: 'NOT_SUBMITTED'
    });

    store.updateUser({ nickname: '新昵称', certificationStatus: 'PENDING' });

    assert.equal(store.getUser().nickname, '新昵称');
    assert.equal(store.getSession().certificationStatus, 'PENDING');
    assert.equal(store.getUser().certificationStatus, undefined);
    assert.equal(store.getUser().id, '1');
  });

  it('clearSession 清空存储并推进 generation', function () {
    store.setSession({ accessToken: 'a1', refreshToken: 'r1' });
    const before = store.getGeneration();

    store.clearSession();

    assert.equal(store.getSession(), null);
    assert.equal(wxStub.storage.has(store.STORAGE_KEY), false);
    assert.equal(store.getGeneration(), before + 1);

    // 冷启动也读不回来
    store.__resetForTest();
    assert.equal(store.getSession(), null);
  });

  it('订阅者能收到写入与清空通知', function () {
    const seen = [];
    const unsubscribe = store.subscribe(function (session) {
      seen.push(session ? session.accessToken : null);
    });

    store.setSession({ accessToken: 'a1', refreshToken: 'r1' });
    store.clearSession();
    unsubscribe();
    store.setSession({ accessToken: 'a2', refreshToken: 'r2' });

    assert.deepEqual(seen, ['a1', null]);
  });
});
