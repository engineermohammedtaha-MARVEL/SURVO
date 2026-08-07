const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

function dealTypeLabel(dealType) {
  return dealType === 'sale' ? 'بيع' : 'إيجار';
}

// بيقترح (أو يعيد اقتراح) اتفاق على نوع الصفقة بين المالك والطرف التاني — لازم
// يتأكد الطرفين قبل ما تتفعل خدمة توثيق حالة الجهاز بينهم
async function proposeDeal(req, res) {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true, title: true } });
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
    ownerEnded: false,
    otherPartyEnded: false,
    status: 'pending',
  };

  const deal = existing
    ? await prisma.deal.update({ where: { id: existing.id }, data })
    : await prisma.deal.create({ data });

  const counterpartyId = isOwner ? otherPartyId : equipment.ownerId;
  const proposer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } });
  await prisma.notification.create({
    data: {
      userId: counterpartyId,
      title: 'فيه اقتراح اتفاق جديد',
      body: (proposer ? proposer.fullName : 'مستخدم') + ' عرض عليك اتفاق على "' + equipment.title + '" — نوع الصفقة المقترحة: ' + dealTypeLabel(dealType) + ' — يحتاج تأكيدك',
      targetType: 'deal',
      targetId: deal.id,
    },
  }).catch(() => {});

  res.status(201).json({ success: true, item: deal });
}

async function confirmDeal(req, res) {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.dealId },
    include: { equipment: { select: { title: true } } },
  });
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
            body: '"' + deal.equipment.title + '" — نوع الصفقة: ' + dealTypeLabel(deal.dealType) + ' — تقدروا دلوقتي توثقوا حالة الجهاز',
            targetType: 'deal',
            targetId: deal.id,
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
        body: '"' + deal.equipment.title + '" — بانتظار تأكيدك — نوع الصفقة: ' + dealTypeLabel(deal.dealType),
        targetType: 'deal',
        targetId: deal.id,
      },
    }).catch(() => {});
  }

  res.json({ success: true, item: updated });
}

async function cancelDeal(req, res) {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.dealId },
    include: { equipment: { select: { title: true } } },
  });
  if (!deal) throw new ApiError(404, 'الاتفاق غير موجود');
  if (req.user.id !== deal.ownerId && req.user.id !== deal.otherPartyId) throw new ApiError(403, 'مش طرف في الاتفاق ده');
  if (deal.status === 'cancelled') return res.json({ success: true, item: deal });

  const updated = await prisma.deal.update({ where: { id: deal.id }, data: { status: 'cancelled' } });
  const counterpartyId = req.user.id === deal.ownerId ? deal.otherPartyId : deal.ownerId;
  await prisma.notification.create({
    data: {
      userId: counterpartyId,
      title: 'تم إلغاء اقتراح الاتفاق',
      body: '"' + deal.equipment.title + '"',
      targetType: 'deal',
      targetId: deal.id,
    },
  }).catch(() => {});

  res.json({ success: true, item: updated });
}

// بيقفل المعاملة بأمان بعد ما الجهاز يرجع (إيجار) أو يتسلم (بيع) — محتاج تأكيد الطرفين
// زي بالظبط اقتراح/تأكيد الاتفاق، عشان محدش يقدر يقفل المعاملة من غير رضا التاني
async function endDeal(req, res) {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.dealId },
    include: { equipment: { select: { title: true } } },
  });
  if (!deal) throw new ApiError(404, 'الاتفاق غير موجود');
  if (req.user.id !== deal.ownerId && req.user.id !== deal.otherPartyId) throw new ApiError(403, 'مش طرف في الاتفاق ده');
  if (deal.status === 'completed') return res.json({ success: true, item: deal });
  if (deal.status !== 'confirmed') throw new ApiError(400, 'المعاملة دي لسه مش متفق عليها، مفيش حاجة تتقفل');

  const lastRecord = await prisma.handoverRecord.findFirst({
    where: { equipmentId: deal.equipmentId, ownerId: deal.ownerId, otherPartyId: deal.otherPartyId },
    orderBy: { createdAt: 'desc' },
    select: { type: true },
  });
  if (!lastRecord) {
    throw new ApiError(400, 'لسه محدش وثّق تسليم الجهاز — وثقوا التسليم الأول قبل ما تقفلوا المعاملة');
  }
  if (deal.dealType === 'rent' && lastRecord.type === 'checkout') {
    throw new ApiError(400, 'الجهاز لسه عند الطرف التاني — لازم يترجع ويتوثق استلامه الأول قبل إنهاء المعاملة');
  }

  const isOwner = req.user.id === deal.ownerId;
  const alreadyEnded = isOwner ? deal.ownerEnded : deal.otherPartyEnded;
  if (alreadyEnded) return res.json({ success: true, item: deal });

  let updated = await prisma.deal.update({
    where: { id: deal.id },
    data: isOwner ? { ownerEnded: true } : { otherPartyEnded: true },
  });

  if (updated.ownerEnded && updated.otherPartyEnded) {
    updated = await prisma.deal.update({ where: { id: deal.id }, data: { status: 'completed' } });
    await Promise.all(
      [deal.ownerId, deal.otherPartyId].map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            title: 'تم إنهاء المعاملة بأمان ✅',
            body: '"' + deal.equipment.title + '" — الطرفين أكدوا إن المعاملة خلصت. لو عايزين تتفقوا تاني على نفس الجهاز، تقدروا تبدأوا اتفاق جديد.',
            targetType: 'deal',
            targetId: deal.id,
          },
        })
      )
    ).catch(() => {});
  } else {
    const counterpartyId = isOwner ? deal.otherPartyId : deal.ownerId;
    await prisma.notification.create({
      data: {
        userId: counterpartyId,
        title: 'الطرف التاني عايز يقفل المعاملة',
        body: '"' + deal.equipment.title + '" — أكد إنهاء المعاملة برضه عشان تتقفل بأمان للطرفين',
        targetType: 'deal',
        targetId: deal.id,
      },
    }).catch(() => {});
  }

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

// بيرجع اتفاق بالـ id بتاعه مباشرة — مستخدم من رابط الإشعار عشان نوصل المستخدم
// (مالك أو طرف تاني) لصفحة توثيق الجهاز بالظبط من غير ما يحتاج يدور عليها
async function getDealById(req, res) {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
  if (!deal) throw new ApiError(404, 'الاتفاق غير موجود');
  if (req.user.id !== deal.ownerId && req.user.id !== deal.otherPartyId) throw new ApiError(403, 'مش طرف في الاتفاق ده');
  res.json({ success: true, item: deal });
}

module.exports = { proposeDeal, confirmDeal, cancelDeal, endDeal, getDeal, getDealById };
