// utils/item-view.js
// 商品展示层映射。金额与状态在页面里反复出现，集中在这里，
// 页面只负责把结果放进 data，不再各自拼字符串。
//
// 契约约定：金额是两位小数字符串（如 "12.34"），时间为 UTC ISO-8601；
// 这里只做展示转换，不改变数值本身，也不构造任何图片 URL。

const enums = require('../constants/enums.js');

// 金额展示：契约保证两位小数字符串；异常输入退化为占位符而不是 "¥undefined"。
function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '—';
  return '¥' + String(price);
}

// 原价只在存在且高于售价时才有展示意义。
function formatOriginalPrice(originalPrice, price) {
  if (originalPrice === null || originalPrice === undefined || originalPrice === '') return '';
  if (Number(originalPrice) <= Number(price)) return '';
  return '¥' + String(originalPrice);
}

// 时间只展示到日期，与认证页保持一致。
function formatDate(instant) {
  return instant ? String(instant).slice(0, 10) : '';
}

// 列表卡片：字段取自 ItemCard / MyItemSummary，两者字段是超集关系。
function buildCardView(item) {
  const source = item || {};
  return {
    id: source.id,
    title: source.title || '',
    priceText: formatPrice(source.price),
    originalPriceText: formatOriginalPrice(source.originalPrice, source.price),
    conditionLabel: source.condition ? enums.itemConditionLabel(source.condition) : '',
    status: source.status || '',
    statusLabel: source.status ? enums.itemStatusLabel(source.status) : '',
    statusTone: source.status ? enums.itemStatusTone(source.status) : 'muted',
    coverImageUrl: source.coverImageUrl || '',
    favoriteCount: source.favoriteCount || 0,
    viewCount: source.viewCount || 0,
    publishedAt: formatDate(source.publishedAt || source.createdAt),
    // 收藏列表里的商品可能已下架或删除，列表需要明确提示而不是静默展示。
    available: source.status === enums.ItemStatus.ON_SALE
  };
}

function buildCardViews(items) {
  return (items || []).map(buildCardView);
}

// 详情页底部按钮的文案。唯一来源是 allowedActions，这里只负责翻译。
const OWNER_ACTION_LABELS = {
  EDIT: '编辑',
  PUBLISH: '上架',
  OFF_SHELF: '下架',
  DELETE: '删除'
};

// 详情页视图。已下架/已售出等状态要给出明确说明，而不是让用户对着一堆按钮猜。
function buildDetailView(item) {
  const source = item || {};
  const seller = source.seller || {};
  const actions = source.allowedActions || [];
  return {
    id: source.id,
    title: source.title || '',
    description: source.description || '',
    priceText: formatPrice(source.price),
    originalPriceText: formatOriginalPrice(source.originalPrice, source.price),
    conditionLabel: source.condition ? enums.itemConditionLabel(source.condition) : '',
    status: source.status || '',
    statusLabel: source.status ? enums.itemStatusLabel(source.status) : '',
    statusTone: source.status ? enums.itemStatusTone(source.status) : 'muted',
    statusNotice: statusNotice(source.status, !!source.isOwner),
    sellerName: seller.nickname || '',
    favoriteCount: source.favoriteCount || 0,
    viewCount: source.viewCount || 0,
    publishedAt: formatDate(source.publishedAt || source.createdAt),
    images: (source.images || []).filter(function (image) {
      return image && image.url;
    }),
    version: source.version,
    isOwner: !!source.isOwner,
    canBuy: !!source.canBuy,
    canFavorite: actions.indexOf('FAVORITE') >= 0,
    ownerActions: actions
      .filter(function (action) {
        return !!OWNER_ACTION_LABELS[action];
      })
      .map(function (action) {
        return { action: action, label: OWNER_ACTION_LABELS[action] };
      })
  };
}

// 非在售状态下的提示文案；作者自己看到的是「你的商品」，措辞略不同。
function statusNotice(status, isOwner) {
  switch (status) {
    case enums.ItemStatus.DRAFT:
      return isOwner ? '草稿：仅你可见，上架后其他同学才能看到' : '该商品尚未上架';
    case enums.ItemStatus.RESERVED:
      return '该商品已被预订';
    case enums.ItemStatus.SOLD:
      return '该商品已售出';
    case enums.ItemStatus.OFF_SHELF:
      return '该商品已下架';
    case enums.ItemStatus.DELETED:
      return '该商品已删除';
    default:
      return '';
  }
}

module.exports = {
  formatPrice: formatPrice,
  formatOriginalPrice: formatOriginalPrice,
  formatDate: formatDate,
  buildCardView: buildCardView,
  buildCardViews: buildCardViews,
  buildDetailView: buildDetailView,
  statusNotice: statusNotice
};
