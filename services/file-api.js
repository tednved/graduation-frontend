// services/file-api.js
// 本地文件上传。字段名固定为 file（见 OpenAPI 的 multipart 定义）。
// 本阶段只允许 ITEM_IMAGE 与 AVATAR；CERTIFICATION_EVIDENCE 不在 MVP 范围内。

const request = require('./request.js');
const FileBizType = require('../constants/enums.js').FileBizType;

// 上传成功后返回 FileObject：{ fileId, url, bizType, contentType, sizeBytes, createdAt }
function uploadImage(filePath, bizType) {
  return request.upload({
    path: '/files',
    query: { bizType: bizType },
    filePath: filePath,
    name: 'file'
  });
}

function uploadAvatar(filePath) {
  return uploadImage(filePath, FileBizType.AVATAR);
}

// 商品图片。上传只产生 UPLOADED 文件对象，真正与商品绑定发生在创建/修改商品时。
function uploadItemImage(filePath) {
  return uploadImage(filePath, FileBizType.ITEM_IMAGE);
}

module.exports = {
  uploadImage: uploadImage,
  uploadAvatar: uploadAvatar,
  uploadItemImage: uploadItemImage
};
