const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { parseCloudinaryUrl, getSignedUrl } = require('../utils/cloudinaryUpload');

const HANDOVER_SELECT = {
  id: true,
  equipmentId: true,
  ownerId: true,
  otherPartyId: true,
  createdById: true,
  type: true,
  photos: true,
  notes: true,
  createdAt: true,
};

// بيوثق حالة الجهاز وقت التسليم/الاستلام بين صاحب الإعلان والطرف التاني —
// المالك لازم يحدد otherPartyId، أما الطرف التاني فبيتحدد تلقائيًا (مالك الجهاز)
async function createHandover(req, res) {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!equipment) throw new ApiError(404, 'الجهاز غير موجود');

  const isOwner = req.user.id === equipment.ownerId;
  let otherPartyId;
  if (isOwner) {
    otherPartyId = String(req.body.otherPartyId || '');
    if (!otherPartyId) throw new ApiError(400, 'حدد الطرف التاني في عملية التسليم');
    if (otherPartyId === equipment.ownerId) throw new ApiError(400, 'مش هتقدر توثق تسليم لنفسك');
    const otherUser = await prisma.user.findUnique({ where: { id: otherPartyId }, select: { id: true } });
    if (!otherUser) throw new ApiError(404, 'المستخدم غير موجود');
  } else {
    otherPartyId = req.user.id;
  }

  const { type, photos, notes } = req.body;
  if (!['checkout', 'checkin'].includes(type)) throw new ApiError(400, 'نوع التوثيق غير صحيح');
  if (!Array.isArray(photos) || photos.length === 0) throw new ApiError(400, 'ضيف صورة واحدة على الأقل لتوثيق حالة الجهاز');

  const record = await prisma.handoverRecord.create({
    data: {
      equipmentId: equipment.id,
      ownerId: equipment.ownerId,
      otherPartyId,
      createdById: req.user.id,
      type,
      photos,
      notes: notes || undefined,
    },
    select: HANDOVER_SELECT,
  });

  const notifyUserId = req.user.id === equipment.ownerId ? otherPartyId : equipment.ownerId;
  await prisma.notification.create({
    data: {
      userId: notifyUserId,
      title: type === 'checkout' ? 'تم توثيق تسليم الجهاز' : 'تم توثيق استلام الجهاز',
      body: 'اضغط لمراجعة صور حالة الجهاز',
      targetType: 'equipment',
      targetId: equipment.id,
    },
  }).catch(() => {});

  res.status(201).json({ success: true, item: record });
}

// بيرجع سجل التوثيقات بين المالك وطرف معين لجهاز معين — يظهر بس للطرفين
async function listHandovers(req, res) {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!equipment) throw new ApiError(404, 'الجهاز غير موجود');

  const isOwner = req.user.id === equipment.ownerId;
  const otherPartyId = isOwner ? String(req.query.otherPartyId || '') : req.user.id;
  if (isOwner && !otherPartyId) throw new ApiError(400, 'حدد الطرف التاني');

  const items = await prisma.handoverRecord.findMany({
    where: { equipmentId: equipment.id, ownerId: equipment.ownerId, otherPartyId },
    orderBy: { createdAt: 'asc' },
    select: HANDOVER_SELECT,
  });

  res.json({ success: true, items });
}

// بيوقع لينكات صور التوثيق مؤقتًا — بس لصاحب الإعلان أو الطرف التاني في السجل ده
async function getSignedHandoverPhotos(req, res) {
  const record = await prisma.handoverRecord.findUnique({
    where: { id: req.params.handoverId },
    select: { id: true, ownerId: true, otherPartyId: true, photos: true },
  });
  if (!record) throw new ApiError(404, 'السجل غير موجود');
  if (req.user.id !== record.ownerId && req.user.id !== record.otherPartyId) {
    throw new ApiError(403, 'مش مسموح لك تشوف الصور دي');
  }

  const urls = record.photos.map((url) => {
    const parsed = parseCloudinaryUrl(url);
    if (!parsed || parsed.type !== 'authenticated') return url;
    return getSignedUrl(parsed, 3600);
  });

  res.json({ success: true, urls });
}

module.exports = { createHandover, listHandovers, getSignedHandoverPhotos };
