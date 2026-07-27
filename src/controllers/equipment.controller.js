const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

async function list(req, res) {
  const { category, governorate, listingType, q, page = 1, pageSize = 20 } = req.query;

  const where = {
    available: true,
    moderationStatus: 'approved',
    ...(category && { category }),
    ...(governorate && { governorate }),
    ...(listingType && { listingType }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };

  const take = Math.min(Number(pageSize) || 20, 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { owner: { select: { id: true, fullName: true, rating: true, verification: true } } },
    }),
    prisma.equipment.count({ where }),
  ]);

  res.json({ success: true, items, total, page: Number(page), pageSize: take });
}

async function getOne(req, res) {
  const item = await prisma.equipment.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { id: true, fullName: true, phone: true, rating: true, verification: true, avatarUrl: true } } },
  });
  if (!item || item.moderationStatus !== 'approved') throw new ApiError(404, 'الجهاز غير موجود');
  res.json({ success: true, item });
}

async function create(req, res) {
  const {
    title, category, listingType, description, pricePerDay, salePrice, governorate, images,
    serialNumber, ownershipDocUrl, serialNumberPhotoUrl,
  } = req.body;

  if (!title || !category || !listingType) {
    throw new ApiError(400, 'اسم الجهاز والفئة ونوع الإعلان مطلوبين');
  }

  if (serialNumber && serialNumber.trim()) {
    const stolenReport = await prisma.deviceReport.findFirst({
      where: { serialNumber: serialNumber.trim(), moderationStatus: 'approved' },
    });
    if (stolenReport) {
      throw new ApiError(409, 'الرقم التسلسلي ده متبلّغ عنه كجهاز ' + (stolenReport.status === 'stolen' ? 'مسروق' : 'مفقود') + '، مش هينفع تنشر إعلان بيه');
    }
  }

  const moderationStatus = category === 'accessories' ? 'approved' : 'pending';

  const item = await prisma.equipment.create({
    data: {
      ownerId: req.user.id,
      title,
      category,
      listingType,
      description,
      pricePerDay,
      salePrice,
      governorate,
      images: images || [],
      serialNumber: serialNumber || undefined,
      ownershipDocUrl: ownershipDocUrl || undefined,
      serialNumberPhotoUrl: serialNumberPhotoUrl || undefined,
      moderationStatus,
    },
  });

  res.status(201).json({
    success: true,
    item,
    pendingReview: moderationStatus === 'pending',
    message: moderationStatus === 'pending'
      ? 'تم استلام إعلانك، وهيتم مراجعته والتأكد من بيانات الجهاز قبل النشر'
      : 'تم نشر إعلانك بنجاح',
  });
}

async function update(req, res) {
  const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الجهاز غير موجود');
  if (existing.ownerId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تعدل الإعلان ده');

  const fields = ['title', 'description', 'pricePerDay', 'salePrice', 'governorate', 'images', 'available'];
  const data = {};
  for (const f of fields) if (req.body[f] !== undefined) data[f] = req.body[f];

  const item = await prisma.equipment.update({ where: { id: req.params.id }, data });
  res.json({ success: true, item });
}

async function remove(req, res) {
  const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الجهاز غير موجود');
  if (existing.ownerId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تحذف الإعلان ده');

  await prisma.equipment.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}

async function myEquipment(req, res) {
  const items = await prisma.equipment.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, items });
}

module.exports = { list, getOne, create, update, remove, myEquipment };
