const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

async function list(req, res) {
  const { category, governorate, status = 'open' } = req.query;
  const items = await prisma.rentalRequest.findMany({
    where: {
      ...(category && { category }),
      ...(governorate && { governorate }),
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
    include: { requester: { select: { id: true, fullName: true, phone: true, rating: true, verification: true } } },
  });
  res.json({ success: true, items });
}

async function create(req, res) {
  const { category, type, details, dateFrom, dateTo, governorate, budget, equipmentId } = req.body;

  if (!category || !type) {
    throw new ApiError(400, 'نوع الجهاز ونوع الطلب (إيجار/شراء) مطلوبين');
  }

  // الطلب دايمًا يبدأ من نفس يوم الإعلان، ومينفعش تاريخ قديم
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let parsedFrom = dateFrom ? new Date(dateFrom) : null;
  let parsedTo = dateTo ? new Date(dateTo) : null;

  if (type === 'rent') {
    if (parsedFrom && parsedFrom < today) {
      throw new ApiError(400, 'مينفعش تختار تاريخ قبل يوم نشر الطلب');
    }
    if (parsedTo && parsedFrom && parsedTo < parsedFrom) {
      throw new ApiError(400, 'تاريخ النهاية لازم يكون بعد تاريخ البداية');
    }
  }

  const item = await prisma.rentalRequest.create({
    data: {
      requesterId: req.user.id,
      equipmentId,
      category,
      type,
      details,
      dateFrom: parsedFrom,
      dateTo: parsedTo,
      governorate,
      budget,
    },
  });

  res.status(201).json({ success: true, item });
}

async function getOne(req, res) {
  const item = await prisma.rentalRequest.findUnique({
    where: { id: req.params.id },
    include: { requester: { select: { id: true, fullName: true, phone: true, verification: true, avatarUrl: true } } },
  });
  if (!item) throw new ApiError(404, 'الطلب غير موجود');
  res.json({ success: true, item });
}

async function myRequests(req, res) {
  const items = await prisma.rentalRequest.findMany({
    where: { requesterId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { requester: { select: { id: true, fullName: true, phone: true, rating: true, verification: true } } },
  });
  res.json({ success: true, items });
}

async function updateStatus(req, res) {
  const { status } = req.body;
  const existing = await prisma.rentalRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الطلب غير موجود');
  if (existing.requesterId !== req.user.id) throw new ApiError(403, 'مش مسموح لك');

  const item = await prisma.rentalRequest.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ success: true, item });
}

async function update(req, res) {
  const existing = await prisma.rentalRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الطلب غير موجود');
  if (existing.requesterId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تعدّل الطلب ده');

  const { category, type, details, dateFrom, dateTo, governorate, budget } = req.body;
  const nextType = type || existing.type;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let parsedFrom = dateFrom !== undefined ? (dateFrom ? new Date(dateFrom) : null) : existing.dateFrom;
  let parsedTo = dateTo !== undefined ? (dateTo ? new Date(dateTo) : null) : existing.dateTo;

  if (nextType === 'rent') {
    if (parsedFrom && parsedFrom < today) {
      throw new ApiError(400, 'مينفعش تختار تاريخ قبل النهاردة');
    }
    if (parsedTo && parsedFrom && parsedTo < parsedFrom) {
      throw new ApiError(400, 'تاريخ النهاية لازم يكون بعد تاريخ البداية');
    }
  } else {
    parsedFrom = null;
    parsedTo = null;
  }

  const item = await prisma.rentalRequest.update({
    where: { id: req.params.id },
    data: {
      category: category || existing.category,
      type: nextType,
      details: details !== undefined ? details : existing.details,
      dateFrom: parsedFrom,
      dateTo: parsedTo,
      governorate: governorate !== undefined ? governorate : existing.governorate,
      budget: budget !== undefined ? budget : existing.budget,
    },
  });

  res.json({ success: true, item });
}

async function remove(req, res) {
  const existing = await prisma.rentalRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الطلب غير موجود');
  if (existing.requesterId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تحذف الطلب ده');

  await prisma.rentalRequest.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}

module.exports = { list, getOne, create, myRequests, updateStatus, update, remove };
