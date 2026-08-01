const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

const MAX_SAVED_SEARCHES = 10;

async function myList(req, res) {
  const items = await prisma.savedSearch.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, items });
}

async function create(req, res) {
  const count = await prisma.savedSearch.count({ where: { userId: req.user.id } });
  if (count >= MAX_SAVED_SEARCHES) {
    throw new ApiError(400, 'وصلت للحد الأقصى (' + MAX_SAVED_SEARCHES + ') من عمليات البحث المحفوظة');
  }

  const { category, governorate, listingType, keyword } = req.body;
  if (!category && !governorate && !listingType && !keyword) {
    throw new ApiError(400, 'حدد معيار واحد على الأقل عشان نحفظ البحث');
  }

  const item = await prisma.savedSearch.create({
    data: {
      userId: req.user.id,
      category: category || undefined,
      governorate: governorate || undefined,
      listingType: listingType || undefined,
      keyword: (keyword || '').trim() || undefined,
    },
  });

  res.status(201).json({ success: true, item });
}

async function remove(req, res) {
  const existing = await prisma.savedSearch.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'البحث المحفوظ غير موجود');
  if (existing.userId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تحذف البحث ده');

  await prisma.savedSearch.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}

module.exports = { myList, create, remove };
