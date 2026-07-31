const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { parseCloudinaryUrl, getSignedUrl } = require('../utils/cloudinaryUpload');

async function listConversations(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ userAId: req.user.id }, { userBId: req.user.id }],
      messages: { some: {} }, // مش هينفع تظهر في قائمة المحادثات إلا لو فيها رسالة حقيقية بالفعل
    },
    include: {
      userA: { select: { id: true, fullName: true, avatarUrl: true } },
      userB: { select: { id: true, fullName: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, conversations });
}

// بيدور على محادثة موجودة فعلاً من غير ما ينشئها — مجرد ما تفتح شات مع حد
// ماينفعش يعمل سطر محادثة فاضي يظهر في قائمة المحادثات
async function findExistingConversation(req, res) {
  const otherUserId = req.params.userId;
  const [userAId, userBId] = [req.user.id, otherUserId].sort();

  const conversation = await prisma.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });

  res.json({ success: true, conversation: conversation || null });
}

async function startOrGetConversation(req, res) {
  const { userId } = req.body;
  if (!userId) throw new ApiError(400, 'userId مطلوب');
  if (userId === req.user.id) throw new ApiError(400, 'مينفعش تعمل محادثة مع نفسك');

  const [userAId, userBId] = [req.user.id, userId].sort();

  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });

  res.json({ success: true, conversation });
}

async function getMessages(req, res) {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new ApiError(404, 'المحادثة غير موجودة');
  if (conversation.userAId !== req.user.id && conversation.userBId !== req.user.id) {
    throw new ApiError(403, 'مش مسموح لك تشوف المحادثة دي');
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, messages });
}

async function sendMessage(req, res) {
  const { body, attachmentUrl } = req.body;
  const text = (body || '').trim();
  if (!text && !attachmentUrl) throw new ApiError(400, 'اكتب رسالة أو أرفق صورة');

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new ApiError(404, 'المحادثة غير موجودة');
  if (conversation.userAId !== req.user.id && conversation.userBId !== req.user.id) {
    throw new ApiError(403, 'مش مسموح لك ترسل في المحادثة دي');
  }

  const message = await prisma.message.create({
    data: { conversationId: req.params.id, senderId: req.user.id, body: text, attachmentUrl: attachmentUrl || undefined },
  });

  const recipientId = conversation.userAId === req.user.id ? conversation.userBId : conversation.userAId;
  await prisma.notification.create({
    data: {
      userId: recipientId,
      title: 'رسالة جديدة',
      body: text ? text.slice(0, 80) : '📷 صورة',
      contactUserId: req.user.id,
    },
  });

  res.status(201).json({ success: true, message });
}

// مرفقات الشات بترفع authenticated (خاصة) — لازم توقيع جديد كل مرة قبل ما نعرضها،
// وبنتأكد إن الشخص اللي طالب التوقيع فعلاً طرف في نفس المحادثة اللي فيها الرسالة دي
async function getSignedAttachmentUrl(req, res) {
  const { messageId } = req.query;
  if (!messageId) throw new ApiError(400, 'messageId مطلوب');

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });
  if (!message || !message.attachmentUrl) throw new ApiError(404, 'مفيش مرفق');
  if (message.conversation.userAId !== req.user.id && message.conversation.userBId !== req.user.id) {
    throw new ApiError(403, 'مش مسموح لك تشوف المرفق ده');
  }

  const parsed = parseCloudinaryUrl(message.attachmentUrl);
  if (!parsed || parsed.type !== 'authenticated') {
    return res.json({ success: true, url: message.attachmentUrl });
  }

  // صلاحية طويلة نسبيًا (يوم كامل) عشان المحادثة تفضل شغالة وانت بترجع تفتحها
  // من غير ما نطلب توقيع جديد كل مرة، بس برضه مش رابط دائم زي ما كان قبل كده
  const signedUrl = getSignedUrl(parsed, 24 * 60 * 60);
  res.json({ success: true, url: signedUrl });
}

module.exports = { listConversations, findExistingConversation, startOrGetConversation, getMessages, sendMessage, getSignedAttachmentUrl };
