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
  checklist: true,
  certificateUrl: true,
  notes: true,
  createdAt: true,
};

// نفس بنود قائمة الفحص السريع اللي كانت متفق عليها في تصميم الشاشة الأصلي
const CHECKLIST_KEYS = ['working', 'battery', 'tripod', 'certificate_signed'];

function signIfAuthenticated(url) {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed || parsed.type !== 'authenticated') return url;
  return getSignedUrl(parsed, 3600);
}

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

  // خدمة توثيق حالة الجهاز متفعّلتش إلا لما الطرفين يتفقوا ويأكدوا نوع الصفقة الأول
  const deal = await prisma.deal.findUnique({
    where: { equipmentId_otherPartyId: { equipmentId: equipment.id, otherPartyId } },
  });
  if (!deal || deal.status !== 'confirmed') {
    throw new ApiError(403, 'لازم تتفقوا وتأكدوا نوع الصفقة (بيع/إيجار) الأول قبل ما تقدروا توثقوا حالة الجهاز');
  }

  const { type, photos, notes, checklist, certificateUrl } = req.body;
  if (!['checkout', 'checkin'].includes(type)) throw new ApiError(400, 'نوع التوثيق غير صحيح');
  if (!Array.isArray(photos) || photos.length === 0) throw new ApiError(400, 'ضيف صورة واحدة على الأقل لتوثيق حالة الجهاز');

  // صفقة البيع/الشراء مالهاش "استلام رجوع" — التسليم بيتم مرة واحدة بس، عكس الإيجار
  // اللي محتاج تسليم واستلام رجوع كل ما الجهاز يرجع
  if (deal.dealType === 'sale') {
    if (type === 'checkin') throw new ApiError(400, 'صفقات البيع والشراء مالهاش استلام رجوع للجهاز');
    const existingCount = await prisma.handoverRecord.count({
      where: { equipmentId: equipment.id, ownerId: equipment.ownerId, otherPartyId },
    });
    if (existingCount > 0) throw new ApiError(400, 'تم توثيق تسليم صفقة البيع/الشراء دي بالفعل');
  }

  const safeChecklist = Array.isArray(checklist) ? checklist.filter((k) => CHECKLIST_KEYS.includes(k)) : [];

  const record = await prisma.handoverRecord.create({
    data: {
      equipmentId: equipment.id,
      ownerId: equipment.ownerId,
      otherPartyId,
      createdById: req.user.id,
      type,
      photos,
      checklist: safeChecklist,
      certificateUrl: certificateUrl || undefined,
      notes: notes || undefined,
    },
    select: HANDOVER_SELECT,
  });

  const notifyUserId = req.user.id === equipment.ownerId ? otherPartyId : equipment.ownerId;
  // "تسليم" و"استلام" بيختلفوا حسب مين اللي بيستقبل الإشعار — لو صاحب الإعلان بيدّي الجهاز
  // (checkout) فده "تسليم" بالنسبله وهو ("استلام" بالنسبة للطرف التاني)، والعكس في الاسترجاع
  const notifyIsOwner = notifyUserId === equipment.ownerId;
  const eventLabel = type === 'checkout'
    ? (notifyIsOwner ? 'تسليم' : 'استلام')
    : (notifyIsOwner ? 'استلام' : 'تسليم');
  await prisma.notification.create({
    data: {
      userId: notifyUserId,
      title: 'تم توثيق ' + eventLabel + ' الجهاز',
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
    select: { id: true, ownerId: true, otherPartyId: true, photos: true, certificateUrl: true },
  });
  if (!record) throw new ApiError(404, 'السجل غير موجود');
  if (req.user.id !== record.ownerId && req.user.id !== record.otherPartyId) {
    throw new ApiError(403, 'مش مسموح لك تشوف الصور دي');
  }

  const urls = record.photos.map(signIfAuthenticated);
  const certificateUrl = record.certificateUrl ? signIfAuthenticated(record.certificateUrl) : null;

  res.json({ success: true, urls, certificateUrl });
}

module.exports = { createHandover, listHandovers, getSignedHandoverPhotos };
