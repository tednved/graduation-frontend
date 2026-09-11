// services/user-api.js
// 当前用户资料。服务端 campus 由后端按单校区自动绑定，前端不传校区。

const request = require('./request.js');

function getMe() {
  return request.request({ method: 'GET', path: '/users/me' });
}

// patch 只包含需要变更的字段：
//   nickname     非空字符串，长度 1～20
//   avatarFileId 数字 ID 字符串，显式 null 表示清空头像
//   phone        手机号字符串，显式 null 表示清空手机号
function updateMe(patch) {
  return request.request({ method: 'PATCH', path: '/users/me', data: patch });
}

module.exports = {
  getMe: getMe,
  updateMe: updateMe
};
