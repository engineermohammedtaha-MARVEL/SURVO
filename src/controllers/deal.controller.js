const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

function dealTypeLabel(dealType) {
  return dealType === 'sale' ? 'بيع' : 'إيجار';
}

// بيقترح (أو يعيد اقتراح) اتفاق على نوع الصفقة بين المالك والطرف التاني — لازم
// يتأكد الطرفين قبل ما تتفعل خدمة توثيق حالة الجهاز بينهم
async function proposeDeal(req, res) {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!equipment) throw new ApiError(404, 'الجهاز غير موجود');

  const isOwner = req.user.id === equipment.ownerId;
  let otherPartyId;
  if (isOwner) {
    otherPartyId = String(req.body.otherPartyId || '');
    if (!otherPartyId) throw new ApiError(400, 'حدد الطرف التاني في الاتفاق');
    if (otherPartyId === equipment.ownerId) throw new ApiError(400, 'مش هتقدر تعمل اتفاق مع نفسك');
    const otherUser = await prisma.user.findUnique({ where: { id: otherPartyId }, select: { id: true } });
    if (!otherUser) throw new ApiError(404, 'المستخدم غير موجود');
  } else {
    otherPartyId = req.user.id;
  }

  const { dealType } = req.body;
  if (!['sale', 'rent'].includes(dealType)) throw new ApiError(400, 'نوع الصفقة غير صحيح');

  const existing = await prisma.deal.findUnique({
    where: { equipmentId_otherPartyId: { equipmentId: equipment.id, otherPartyId } },
  });
  if (existing && existing.status === 'confirmed') {
    throw new ApiError(400, 'فيه اتفاق مؤكد بالفعل بينكم على الجهاز ده');
  }

  const data = {
    equipmentId: equipment.id,
    ownerId: equipment.ownerId,
    otherPartyId,
    dealType,
    proposedById: req.user.id,
    ownerConfirmed: isOwner,
    otherPartyConfirmed: !isOwner,
    status: 'pending',
  };

  const deal = existing
    ? await prisma.deal.update({ where: { id: existing.id }, data })
    : await prisma.deal.create({ data });

  const counterpartyId = isOwner ? otherPartyId : equipment.ownerId;
  await prisma.notification.create({
    data: {
      userId: counterpartyId,
      title: 'فيه اقتراح اتفاق جديد',
      body: 'نوع الصفقة المقترحة: ' + dealTypeLabel(dealType) + ' — يحتاج تأكيدك',
      targetType: 'equipment',
      targetId: equipment.id,
    },
  }).catch(() => {});

  res.status(201).json({ success: true, item: deal });
}

async function confirmDeal(req, res) {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
  if (!deal) throw new ApiError(404, 'الاتفاق غير موجود');
  if (req.user.id !== deal.ownerId && req.user.id !== deal.otherPartyId) throw new ApiError(403, 'مش طرف في الاتفاق ده');
  if (deal.status === 'cancelled') throw new ApiError(400, 'الاتفاق ده اتلغى، لازم تقترحوا اتفاق جديد');
  if (deal.status === 'confirmed') return res.json({ success: true, item: deal });

  const isOwner = req.user.id === deal.ownerId;
  const alreadyConfirmed = isOwner ? deal.ownerConfirmed : deal.otherPartyConfirmed;
  if (alreadyConfirmed) return res.json({ success: true, item: deal });

  let updated = await prisma.deal.update({
    where: { id: deal.id },
    data: isOwner ? { ownerConfirmed: true } : { otherPartyConfirmed: true },
  });

  if (updated.ownerConfirmed && updated.otherPartyConfirmed) {
    updated = await prisma.deal.update({ where: { id: deal.id }, data: { status: 'confirmed' } });
    await Promise.all(
      [deal.ownerId, deal.otherPartyId].map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            title: 'تم تأكيد الاتفاق ✓',
            body: 'نوع الصفقة: ' + dealTypeLabel(deal.dealType) + ' — تقدروا دلوقتي توثقوا حالة الجهاز',
            targetType: 'equipment',
            targetId: deal.equipmentId,
          },
        })
      )
    ).catch(() => {});
  } else {
    const counterpartyId = isOwner ? deal.otherPartyId : deal.ownerId;
    await prisma.notification.create({
      data: {
        userId: counterpartyId,
        title: 'تم تأكيد الاتفاق من الطرف التاني',
        body: 'بانتظار تأكيدك — نوع الصفقة: ' + dealTypeLabel(deal.dealType),
        targetType: 'equipment',
        targetId: deal.equipmentId,
      },
    }).catch(() => {});
  }

  res.json({ success: true, item: updated });
}

async function cancelDeal(req, res) {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
  if (!deal) throw new ApiError(404, 'الاتفاق غير موجود');
  if (req.user.id !== deal.ownerId && req.user.id !== deal.otherPartyId) throw new ApiError(403, 'مش طرف في الاتفاق ده');
  if (deal.status === 'cancelled') return res.json({ success: true, item: deal });

  const updated = await prisma.deal.update({ where: { id: deal.id }, data: { status: 'cancelled' } });
  const counterpartyId = req.user.id === deal.ownerId ? deal.otherPartyId : deal.ownerId;
  await prisma.notification.create({
    data: {
      userId: counterpartyId,
      title: 'تم إلغاء اقتراح الاتفاق',
      targetType: 'equipment',
      targetId: deal.equipmentId,
    },
  }).catch(() => {});

  res.json({ success: true, item: updated });
}

async function getDeal(req, res) {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!equipment) throw new ApiError(404, 'الجهاز غير موجود');

  const isOwner = req.user.id === equipment.ownerId;
  const otherPartyId = isOwner ? String(req.query.otherPartyId || '') : req.user.id;
  if (isOwner && !otherPartyId) throw new ApiError(400, 'حدد الطرف التاني');

  const deal = await prisma.deal.findUnique({
    where: { equipmentId_otherPartyId: { equipmentId: equipment.id, otherPartyId } },
  });
  res.json({ success: true, item: deal || null });
}

module.exports = { proposeDeal, confirmDeal, cancelDeal, getDeal };
