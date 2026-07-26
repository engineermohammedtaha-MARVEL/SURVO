const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

async function listForUser(req, res) {
  const reviews = await prisma.review.findMany({
    where: { toUserId: req.params.userId },
    orderBy: { createdAt: 'desc' },
    include: { fromUser: { select: { id: true, fullName: true, avatarUrl: true } } },
  });
  res.json({ success: true, reviews });
}

async function create(req, res) {
  const { toUserId, rating, comment } = req.body;

  if (!toUserId || !rating) throw new ApiError(400, 'toUserId والتقييم مطلوبين');
  if (toUserId === req.user.id) throw new ApiError(400, 'مينفعش تقيّم نفسك');
  const ratingNum = Number(rating);
  if (ratingNum < 1 || ratingNum > 5) throw new ApiError(400, 'التقييم لازم يكون من 1 لـ 5');

  const review = await prisma.review.create({
    data: { fromUserId: req.user.id, toUserId, rating: ratingNum, comment },
  });

  const agg = await prisma.review.aggregate({
    where: { toUserId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.user.update({
    where: { id: toUserId },
    data: { rating: agg._avg.rating || 0, ratingCount: agg._count.rating },
  });

  res.status(201).json({ success: true, review });
}

module.exports = { listForUser, create };
