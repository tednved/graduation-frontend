// services/favorite-api.js
// 收藏接口（第八节 8.7）。收藏与取消都是幂等的，成功返回 204 无响应体，
// 请求层会把 204 归一化为 undefined，页面据此只关心「是否抛错」。

const request = require('./request.js');

function add(itemId) {
  return request.request({ method: 'PUT', path: '/items/' + itemId + '/favorite' });
}

function remove(itemId) {
  return request.request({ method: 'DELETE', path: '/items/' + itemId + '/favorite' });
}

// 返回 { favorited: boolean }
function status(itemId) {
  return request.request({ method: 'GET', path: '/items/' + itemId + '/favorite-status' });
}

// 我的收藏：商品卡片分页。
function listMine(params) {
  const source = params || {};
  return request.request({
    method: 'GET',
    path: '/users/me/favorites',
    query: {
      page: source.page === undefined || source.page === null ? 0 : source.page,
      size: source.size === undefined || source.size === null ? 20 : source.size
    }
  });
}

module.exports = {
  add: add,
  remove: remove,
  status: status,
  listMine: listMine
};
