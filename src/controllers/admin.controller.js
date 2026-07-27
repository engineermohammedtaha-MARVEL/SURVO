const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

async function listPendingUsers(req, res) {
  const users = await prisma.user.findMany({
    where: { accountStatus: 'pending' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      accountType: true,
      governorate: true,
      bio: true,
      specialties: true,
      nationalIdUrl: true,
      personalPhotoUrl: true,
      qualificationUrl: true,
      unionCardUrl: true,
      commercialRecordUrl: true,
      createdAt: true,
    },
  });
  res.json({ success: true, users });
}

async function approveUser(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { accountStatus: 'approved' },
  });
  res.json({ success: true, user: { id: updated.id, accountStatus: updated.accountStatus } });
}

async function rejectUser(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { accountStatus: 'rejected' },
  });
  res.json({ success: true, user: { id: updated.id, accountStatus: updated.accountStatus } });
}

async function listPendingDeviceReports(req, res) {
  const reports = await prisma.deviceReport.findMany({
    where: { moderationStatus: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: { reporter: { select: { id: true, fullName: true, phone: true } } },
  });
  res.json({ success: true, reports });
}

async function approveDeviceReport(req, res) {
  const report = await prisma.deviceReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw new ApiError(404, 'البلاغ غير موجود');

  const updated = await prisma.deviceReport.update({
    where: { id: req.params.id },
    data: { moderationStatus: 'approved' },
  });
  res.json({ success: true, report: { id: updated.id, moderationStatus: updated.moderationStatus } });
}

async function rejectDeviceReport(req, res) {
  const report = await prisma.deviceReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw new ApiError(404, 'البلاغ غير موجود');

  const updated = await prisma.deviceReport.update({
    where: { id: req.params.id },
    data: { moderationStatus: 'rejected' },
  });
  res.json({ success: true, report: { id: updated.id, moderationStatus: updated.moderationStatus } });
}

async function listPendingEquipment(req, res) {
  const items = await prisma.equipment.findMany({
    where: { moderationStatus: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { id: true, fullName: true, phone: true } } },
  });
  res.json({ success: true, items });
}

async function approveEquipment(req, res) {
  const item = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!item) throw new ApiError(404, 'الجهاز غير موجود');

  const updated = await prisma.equipment.update({
    where: { id: req.params.id },
    data: { moderationStatus: 'approved' },
  });

  await prisma.notification.create({
    data: {
      userId: item.ownerId,
      title: 'تم نشر إعلانك ✓',
      body: 'إعلانك "' + item.title + '" اتراجع واتنشر دلوقتي على المنصة.',
    },
  });

  res.json({ success: true, item: { id: updated.id, moderationStatus: updated.moderationStatus } });
}

async function rejectEquipment(req, res) {
  const item = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!item) throw new ApiError(404, 'الجهاز غير موجود');

  const reason = (req.body && req.body.reason || '').trim();

  const updated = await prisma.equipment.update({
    where: { id: req.params.id },
    data: { moderationStatus: 'rejected' },
  });

  await prisma.notification.create({
    data: {
      userId: item.ownerId,
      title: 'تم رفض إعلانك',
      body: 'إعلانك "' + item.title + '" اترفض بعد المراجعة' + (reason ? ': ' + reason : '. تواصل مع الدعم الفني لمزيد من التفاصيل.'),
    },
  });

  res.json({ success: true, item: { id: updated.id, moderationStatus: updated.moderationStatus } });
}

module.exports = {
  listPendingUsers, approveUser, rejectUser,
  listPendingDeviceReports, approveDeviceReport, rejectDeviceReport,
  listPendingEquipment, approveEquipment, rejectEquipment,
};
