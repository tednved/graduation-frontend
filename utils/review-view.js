// utils/review-view.js
// 评价与信用摘要的展示层映射：星级、平均分、1～5 分分布。
//
// 信用摘要是公开数据（GET /users/{id}/credit），分布按契约是键为 "1"～"5" 的对象，
// 这里统一转成定长数组，页面只负责渲染，不再各自 Object.keys 一遍。

const mediaUrl = require('./media-url.js');
const itemView = require('./item-view.js');

const STARS = [5, 4, 3, 2, 1];

// 平均分是两位小数字符串；无评价时后端返回 "0.00"，展示成占位符更诚实。
function formatAverage(averageRating, reviewCount) {
  if (!reviewCount) return '—';
  if (averageRating === null || averageRating === undefined || averageRating === '') return '—';
  return String(averageRating);
}

function buildCreditView(credit) {
  const source = credit || {};
  const distribution = source.distribution || {};
  const reviewCount = Number(source.reviewCount) || 0;
  const buckets = STARS.map(function (star) {
    const count = Number(distribution[String(star)]) || 0;
    return {
      star: star,
      count: count,
      percent: reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0
    };
  });
  return {
    userId: source.userId === undefined || source.userId === null ? '' : String(source.userId),
    averageText: formatAverage(source.averageRating, reviewCount),
    reviewCount: reviewCount,
    empty: reviewCount === 0,
    distribution: buckets
  };
}

function buildReviewView(review) {
  const source = review || {};
  const reviewer = source.reviewer || {};
  const rating = Number(source.rating) || 0;
  return {
    id: source.id === undefined || source.id === null ? '' : String(source.id),
    orderId: source.orderId === undefined || source.orderId === null ? '' : String(source.orderId),
    rating: rating,
    ratingText: rating ? rating + ' 分' : '—',
    // 星星逐颗渲染；用对象而不是布尔数组，wx:key 才能取到稳定的 star 值。
    stars: [1, 2, 3, 4, 5].map(function (star) {
      return { star: star, on: star <= rating };
    }),
    reviewerName: reviewer.nickname || '匿名同学',
    reviewerAvatarUrl: mediaUrl.resolveMediaUrl(reviewer.avatarUrl),
    reviewerInitial: String(reviewer.nickname || '匿').slice(0, 1),
    content: source.content || '',
    createdDate: itemView.formatDate(source.createdAt)
  };
}

function buildReviewViews(reviews) {
  return (reviews || []).map(buildReviewView);
}

module.exports = {
  STARS: STARS,
  formatAverage: formatAverage,
  buildCreditView: buildCreditView,
  buildReviewView: buildReviewView,
  buildReviewViews: buildReviewViews
};
