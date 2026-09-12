// pages/publish/item-form.js
// 发布表单的校验与请求体组装。抽成纯函数模块以便直接单测——
// 页面只负责收集输入和展示提示。
//
// 规则来自总纲 §9.3，与后端重复校验一致：
//   标题 2～80；描述 10～2000；售价 > 0 且最多两位小数；
//   原价为空或 ≥ 售价；图片 1～9 张；分类必须是二级分类。

const itemApi = require('../../services/item-api.js');

const TITLE_MIN = 2;
const TITLE_MAX = 80;
const DESC_MIN = 10;
const DESC_MAX = 2000;
const IMAGE_MIN = 1;
const IMAGE_MAX = 9;

// 只接受非负、最多两位小数的数字写法，避免 "10.999" 这类被后端截断或拒绝的输入。
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

// 与 items.price 的 DECIMAL(10,2) 对齐：超过这个值数据库存不下，
// 与其让后端报错，不如在提交前就拦住。
const MONEY_MAX = 99999999.99;

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function exceedsMoneyMax(value) {
  if (isBlank(value)) return false;
  const text = String(value).trim();
  return MONEY_PATTERN.test(text) && Number(text) > MONEY_MAX;
}

function parseMoney(value) {
  if (isBlank(value)) return null;
  const text = String(value).trim();
  if (!MONEY_PATTERN.test(text)) return null;
  const num = Number(text);
  if (!isFinite(num) || num <= 0 || num > MONEY_MAX) return null;
  return num;
}

// 返回第一条错误提示；通过校验返回 null。
function validateItemForm(form) {
  const source = form || {};

  const title = String(source.title === undefined || source.title === null ? '' : source.title).trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return '标题长度需为 ' + TITLE_MIN + '-' + TITLE_MAX + ' 个字符';
  }

  const description = String(
    source.description === undefined || source.description === null ? '' : source.description
  ).trim();
  if (description.length < DESC_MIN || description.length > DESC_MAX) {
    return '描述长度需为 ' + DESC_MIN + '-' + DESC_MAX + ' 个字符';
  }

  const price = parseMoney(source.price);
  if (price === null) {
    if (exceedsMoneyMax(source.price)) return '金额不能超过 ' + MONEY_MAX;
    return '请填写大于 0 且最多两位小数的售价';
  }

  if (!isBlank(source.originalPrice) && parseMoney(source.originalPrice) === null) {
    if (exceedsMoneyMax(source.originalPrice)) return '金额不能超过 ' + MONEY_MAX;
    return '原价需为大于 0 且最多两位小数的数字';
  }
  const originalPrice = parseMoney(source.originalPrice);
  if (originalPrice !== null && originalPrice < price) {
    return '原价不能低于售价';
  }

  if (!source.condition) return '请选择商品成色';
  if (!source.categoryId) return '请选择商品分类';

  const images = source.imageFileIds || [];
  if (images.length < IMAGE_MIN || images.length > IMAGE_MAX) {
    return '请上传 ' + IMAGE_MIN + '-' + IMAGE_MAX + ' 张商品图片';
  }

  return null;
}

// 组装创建/修改请求体。编辑时附上 version（乐观锁）。
function buildPayload(form, version) {
  const source = form || {};
  const payload = {
    title: String(source.title || '').trim(),
    description: String(source.description || '').trim(),
    price: itemApi.normalizeMoney(source.price),
    condition: source.condition,
    categoryId: source.categoryId,
    imageFileIds: (source.imageFileIds || []).map(String)
  };
  if (!isBlank(source.originalPrice)) {
    payload.originalPrice = itemApi.normalizeMoney(source.originalPrice);
  } else {
    payload.originalPrice = null;
  }
  if (version !== undefined && version !== null) payload.version = version;
  return payload;
}

module.exports = {
  TITLE_MIN: TITLE_MIN,
  TITLE_MAX: TITLE_MAX,
  DESC_MIN: DESC_MIN,
  DESC_MAX: DESC_MAX,
  IMAGE_MIN: IMAGE_MIN,
  IMAGE_MAX: IMAGE_MAX,
  MONEY_MAX: MONEY_MAX,
  parseMoney: parseMoney,
  validateItemForm: validateItemForm,
  buildPayload: buildPayload
};
