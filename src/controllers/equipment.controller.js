const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { notifySavedSearchMatches } = require('../utils/savedSearchMatch');

// ownershipDocUrl/serialNumberPhotoUrl مستندات إثبات ملكية شخصية — مش المفروض
// تظهر في أي رد عام (list/getOne)، لازم يبانوا بس للمالك نفسه أو للأدمن وقت المراجعة
const PUBLIC_EQUIPMENT_SELECT = {
  id: true,
  ownerId: true,
  title: true,
  category: true,
  listingType: true,
  description: true,
  pricePerDay: true,
  salePrice: true,
  governorate: true,
  available: true,
  images: true,
  serialNumber: true,
  moderationStatus: true,
  requestsCount: true,
  rating: true,
  createdAt: true,
  updatedAt: true,
};

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
      select: {
        ...PUBLIC_EQUIPMENT_SELECT,
        owner: { select: { id: true, fullName: true, phone: true, rating: true, verification: true } },
      },
    }),
    prisma.equipment.count({ where }),
  ]);

  res.json({ success: true, items, total, page: Number(page), pageSize: take });
}

async function getOne(req, res) {
  const item = await prisma.equipment.findUnique({
    where: { id: req.params.id },
    select: {
      ...PUBLIC_EQUIPMENT_SELECT,
      owner: { select: { id: true, fullName: true, phone: true, rating: true, verification: true, avatarUrl: true } },
    },
  });
  if (!item) throw new ApiError(404, 'الجهاز غير موجود');

  if (item.moderationStatus !== 'approved') {
    const requesterId = req.user && req.user.id;
    const isOwner = requesterId && requesterId === item.ownerId;
    // لو صاحب الإعلان اقترح اتفاق على الجهاز قبل ما الأدمن يوافق عليه، لازم الطرف
    // التاني يقدر يفتح رابط الإشعار ويشوف تفاصيل الجهاز ويأكد الاتفاق، مش يتفاجئ بـ 404
    const isDealParty = !isOwner && requesterId
      ? !!(await prisma.deal.findFirst({ where: { equipmentId: item.id, otherPartyId: requesterId } }))
      : false;
    if (!isOwner && !isDealParty) throw new ApiError(404, 'الجهاز غير موجود');
  }

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
      where: { serialNumber: { equals: serialNumber.trim(), mode: 'insensitive' }, category, moderationStatus: 'approved' },
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

  if (moderationStatus === 'approved') {
    notifySavedSearchMatches(item).catch(() => {});
  }

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

  const { category, serialNumber } = req.body;
  const nextCategory = category !== undefined ? category : existing.category;
  const nextSerialNumber = serialNumber !== undefined ? serialNumber : existing.serialNumber;

  if (nextSerialNumber && nextSerialNumber.trim()) {
    const stolenReport = await prisma.deviceReport.findFirst({
      where: {
        serialNumber: { equals: nextSerialNumber.trim(), mode: 'insensitive' },
        category: nextCategory,
        moderationStatus: 'approved',
      },
    });
    if (stolenReport) {
      throw new ApiError(409, 'الرقم التسلسلي ده متبلّغ عنه كجهاز ' + (stolenReport.status === 'stolen' ? 'مسروق' : 'مفقود') + '، مش هينفع تنشر إعلان بيه');
    }
  }

  const fields = ['title', 'category', 'listingType', 'description', 'pricePerDay', 'salePrice', 'governorate', 'images', 'available', 'serialNumber'];
  const data = {};
  for (const f of fields) if (req.body[f] !== undefined) data[f] = req.body[f];

  // أي تعديل على الإعلان لازم يترجع لمراجعة الأدمن تاني قبل ما يظهر للناس تاني —
  // عشان نضمن إن التعديل اتشاف والجهاز لسه مفيهوش بلاغات أو مشاكل قبل ما ينزل بالبيانات الجديدة
  const moderationStatus = nextCategory === 'accessories' ? 'approved' : 'pending';
  data.moderationStatus = moderationStatus;

  const item = await prisma.equipment.update({ where: { id: req.params.id }, data });

  res.json({
    success: true,
    item,
    pendingReview: moderationStatus === 'pending',
    message: moderationStatus === 'pending'
      ? 'تم حفظ التعديلات، وهيتم مراجعتها والتأكد منها قبل ما يظهر إعلانك تاني للمستخدمين'
      : 'تم حفظ التعديلات بنجاح',
  });
}

// بتزود عداد المشاهدات — إلا لو الشخص اللي بيشوف هو صاحب الإعلان نفسه أو حساب
// أدمن (مشاهدة الأدمن وقت المراجعة مش اهتمام حقيقي من عميل، فمينفعش تتحسب)
async function recordView(req, res) {
  const existing = await prisma.equipment.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!existing) throw new ApiError(404, 'الجهاز غير موجود');

  const isOwner = req.user && req.user.id === existing.ownerId;
  const isAdmin = req.user && req.user.isAdmin;
  if (!isOwner && !isAdmin) {
    await prisma.equipment.update({ where: { id: req.params.id }, data: { viewsCount: { increment: 1 } } });
  }
  res.json({ success: true });
}

async function remove(req, res) {
  const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الجهاز غير موجود');
  if (existing.ownerId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تحذف الإعلان ده');

  await prisma.equipment.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}

// بيرجّع لكل جهاز أي إيجارات مؤكدة لسه الجهاز فيها عند الطرف التاني ومتسلّمش
// رجوع لصاحبه (آخر سجل توثيق ليها "تسليم" مش "استلام") — عشان المالك يعرف
// إن فيه جهاز لسه محتاج يستلمه ويوثّق رجوعه
async function attachPendingReturns(items, ownerId) {
  const equipmentIds = items.map((i) => i.id);
  if (!equipmentIds.length) return items;

  const rentDeals = await prisma.deal.findMany({
    where: { equipmentId: { in: equipmentIds }, dealType: 'rent', status: 'confirmed' },
    select: { equipmentId: true, otherPartyId: true, otherParty: { select: { id: true, fullName: true } } },
  });
  if (!rentDeals.length) return items.map((item) => ({ ...item, pendingReturns: [] }));

  const pendingByEquipment = {};
  await Promise.all(
    rentDeals.map(async (deal) => {
      const lastRecord = await prisma.handoverRecord.findFirst({
        where: { equipmentId: deal.equipmentId, ownerId, otherPartyId: deal.otherPartyId },
        orderBy: { createdAt: 'desc' },
        select: { type: true },
      });
      if (lastRecord && lastRecord.type === 'checkout') {
        if (!pendingByEquipment[deal.equipmentId]) pendingByEquipment[deal.equipmentId] = [];
        pendingByEquipment[deal.equipmentId].push({ otherPartyId: deal.otherPartyId, otherPartyName: deal.otherParty.fullName });
      }
    })
  );

  return items.map((item) => ({ ...item, pendingReturns: pendingByEquipment[item.id] || [] }));
}

async function myEquipment(req, res) {
  const items = await prisma.equipment.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  const withReturns = await attachPendingReturns(items, req.user.id);
  res.json({ success: true, items: withReturns });
}

// بيرجّع للمستأجر كل الأجهزة اللي عنده اتفاق إيجار مؤكد عليها لسه مفيش قفل
// نهائي للمعاملة — عشان حالة الإيجار تفضل ظاهرة له طول الوقت لحد ما يرجّع
// الجهاز وتتقفل المعاملة بأمان من الطرفين
async function myRentals(req, res) {
  const deals = await prisma.deal.findMany({
    where: { otherPartyId: req.user.id, dealType: 'rent', status: 'confirmed' },
    include: {
      equipment: { select: { id: true, title: true, category: true } },
      owner: { select: { id: true, fullName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const items = await Promise.all(
    deals.map(async (deal) => {
      const lastRecord = await prisma.handoverRecord.findFirst({
        where: { equipmentId: deal.equipmentId, ownerId: deal.ownerId, otherPartyId: deal.otherPartyId },
        orderBy: { createdAt: 'desc' },
        select: { type: true },
      });
      return {
        dealId: deal.id,
        equipment: deal.equipment,
        owner: deal.owner,
        currentlyHolding: !!lastRecord && lastRecord.type === 'checkout',
        returned: !!lastRecord && lastRecord.type === 'checkin',
        ownerEnded: deal.ownerEnded,
        otherPartyEnded: deal.otherPartyEnded,
      };
    })
  );

  res.json({ success: true, items });
}

module.exports = { list, getOne, create, update, remove, myEquipment, myRentals, recordView };
