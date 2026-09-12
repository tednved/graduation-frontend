// services/category-api.js
// 商品分类树。当前只有两级：一级带 children，二级不带 children。

const request = require('./request.js');

// 返回 { categories: [ 一级节点... ] }，一级节点内含 children 二级节点。
// 接口是公开的（security: []），不附带令牌，未登录也要能浏览分类。
function getTree() {
  return request.request({ method: 'GET', path: '/categories/tree', auth: false });
}

function flatten(nodes) {
  let out = [];
  (nodes || []).forEach(function (node) {
    out.push(node);
    if (node && node.children) out = out.concat(flatten(node.children));
  });
  return out;
}

module.exports = {
  getTree: getTree,
  flatten: flatten
};
