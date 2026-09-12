const test = require('node:test');
const assert = require('node:assert/strict');

const mediaUrl = require('../utils/media-url.js');

test('站内媒体相对地址拼接为后端绝对地址', function () {
  assert.equal(mediaUrl.resolveMediaUrl('/media/6'), 'http://127.0.0.1:8080/media/6');
});

test('绝对地址和小程序临时地址保持不变', function () {
  assert.equal(mediaUrl.resolveMediaUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  assert.equal(mediaUrl.resolveMediaUrl('wxfile://tmp/a.png'), 'wxfile://tmp/a.png');
});

test('空地址安全退化为空字符串', function () {
  assert.equal(mediaUrl.resolveMediaUrl(null), '');
});
