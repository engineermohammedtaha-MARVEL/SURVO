const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { parseCloudinaryUrl, getSignedUrl } = require('../utils/cloudinaryUpload');
const { notifySavedSearchMatches } = require('../utils/savedSearchMatch');

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

  await prisma.notification.create({
    data: {
      userId: updated.id,
      title: 'تم تفعيل حسابك ✓',
      body: 'اتوافق على حسابك من الإدارة، تقدر تسجّل دخولك وتستخدم التطبيق دلوقتي.',
    },
  });

  res.json({ success: true, user: { id: updated.id, accountStatus: updated.accountStatus } });
}

async function rejectUser(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');

  const reason = (req.body && req.body.reason || '').trim();

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { accountStatus: 'rejected' },
  });

  await prisma.notification.create({
    data: {
      userId: updated.id,
      title: 'تم رفض حسابك',
      body: 'حسابك اترفض من الإدارة' + (reason ? ': ' + reason : '. تواصل مع الدعم الفني لمزيد من التفاصيل.'),
    },
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

  await prisma.notification.create({
    data: {
      userId: report.reporterId,
      title: 'تم اعتماد بلاغك ✓',
      body: 'بلاغك عن الجهاز اترجع واتفعّل، ودلوقتي أي حد يستعلم عن الرقم التسلسلي ده هياخد تحذير.',
    },
  });

  res.json({ success: true, report: { id: updated.id, moderationStatus: updated.moderationStatus } });
}

async function rejectDeviceReport(req, res) {
  const report = await prisma.deviceReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw new ApiError(404, 'البلاغ غير موجود');

  const reason = (req.body && req.body.reason || '').trim();

  const updated = await prisma.deviceReport.update({
    where: { id: req.params.id },
    data: { moderationStatus: 'rejected' },
  });

  await prisma.notification.create({
    data: {
      userId: report.reporterId,
      title: 'تم رفض بلاغك',
      body: 'بلاغك عن الجهاز اترفض بعد المراجعة' + (reason ? ': ' + reason : '. تواصل مع الدعم الفني لمزيد من التفاصيل.'),
    },
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

  notifySavedSearchMatches(updated).catch(() => {});

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

async function listOpenSupportTickets(req, res) {
  const tickets = await prisma.supportTicket.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
  });
  res.json({ success: true, tickets });
}

async function resolveSupportTicket(req, res) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw new ApiError(404, 'التذكرة غير موجودة');

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { status: 'resolved' },
  });

  await prisma.notification.create({
    data: {
      userId: ticket.userId,
      title: 'تم الرد على تذكرة الدعم الفني',
      body: 'تم التعامل مع تذكرتك الخاصة بـ"' + ticket.type + '". لو محتاج مساعدة إضافية، ابعت تذكرة جديدة.',
    },
  });

  res.json({ success: true, ticket: { id: updated.id, status: updated.status } });
}

// حساب "الدعم الفني" الثابت اللي الأدمن بيبعت منه رسايل للمستخدمين — اتعمل مرة واحدة بسكريبت
// scripts/create-support-account.js
const SUPPORT_PHONE = '00000000000';

async function getSupportUserId() {
  const user = await prisma.user.findUnique({ where: { phone: SUPPORT_PHONE }, select: { id: true } });
  if (!user) throw new ApiError(500, 'حساب الدعم الفني مش موجود، شغّل scripts/create-support-account.js الأول');
  return user.id;
}

async function searchUsers(req, res) {
  const { q } = req.query;
  const term = (q || '').trim();
  if (!term) {
    res.json({ success: true, users: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      phone: { not: SUPPORT_PHONE },
      OR: [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true, fullName: true, phone: true, email: true, accountType: true, accountStatus: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ success: true, users });
}

async function sendAdminMessage(req, res) {
  const { userId, body } = req.body;
  if (!userId || !body || !body.trim()) throw new ApiError(400, 'المستخدم ونص الرسالة مطلوبين');

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new ApiError(404, 'المستخدم غير موجود');

  const supportUserId = await getSupportUserId();
  if (userId === supportUserId) throw new ApiError(400, 'مينفعش تبعت رسالة لحساب الدعم الفني نفسه');

  const [userAId, userBId] = [supportUserId, userId].sort();
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: supportUserId, body: body.trim() },
  });

  await prisma.notification.create({
    data: {
      userId,
      title: 'رسالة من الدعم الفني',
      body: body.trim().slice(0, 80),
      contactUserId: supportUserId,
    },
  });

  res.status(201).json({ success: true, message });
}

async function listAdminConversations(req, res) {
  const supportUserId = await getSupportUserId();
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: supportUserId }, { userBId: supportUserId }] },
    include: {
      userA: { select: { id: true, fullName: true, phone: true } },
      userB: { select: { id: true, fullName: true, phone: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, conversations, supportUserId });
}

async function getAdminConversationMessages(req, res) {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new ApiError(404, 'المحادثة غير موجودة');

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, messages });
}

// مستندات التوثيق الحساسة (بطاقة، سند ملكية، إلخ) بتترفع authenticated —
// الرابط المخزّن في الداتابيز مش شغال لوحده، لازم توقيع جديد في كل مرة الأدمن
// يحب يشوف المستند، وده بيخلي الرابط صالح لمدة قصيرة بس (5 دقايق) مش للأبد
async function getSignedDocUrl(req, res) {
  const { url } = req.query;
  if (!url) throw new ApiError(400, 'الرابط مطلوب');

  const parsed = parseCloudinaryUrl(url);
  if (!parsed || parsed.cloudName !== process.env.CLOUDINARY_CLOUD_NAME) {
    throw new ApiError(400, 'رابط غير صالح');
  }
  if (parsed.type !== 'authenticated') {
    // مش مستند حساس أصلًا (زي صور المعدات) — الرابط الأصلي شغال عادي
    return res.json({ success: true, url });
  }

  const signedUrl = getSignedUrl(parsed, 300);
  res.json({ success: true, url: signedUrl });
}

module.exports = {
  listPendingUsers, approveUser, rejectUser,
  listPendingDeviceReports, approveDeviceReport, rejectDeviceReport,
  listPendingEquipment, approveEquipment, rejectEquipment,
  listOpenSupportTickets, resolveSupportTicket,
  searchUsers, sendAdminMessage, listAdminConversations, getAdminConversationMessages,
  getSignedDocUrl,
};
