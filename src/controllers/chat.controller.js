const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

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
  const { body } = req.body;
  if (!body || !body.trim()) throw new ApiError(400, 'اكتب رسالة');

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new ApiError(404, 'المحادثة غير موجودة');
  if (conversation.userAId !== req.user.id && conversation.userBId !== req.user.id) {
    throw new ApiError(403, 'مش مسموح لك ترسل في المحادثة دي');
  }

  const message = await prisma.message.create({
    data: { conversationId: req.params.id, senderId: req.user.id, body: body.trim() },
  });

  const recipientId = conversation.userAId === req.user.id ? conversation.userBId : conversation.userAId;
  await prisma.notification.create({
    data: { userId: recipientId, title: 'رسالة جديدة', body: body.trim().slice(0, 80), contactUserId: req.user.id },
  });

  res.status(201).json({ success: true, message });
}

module.exports = { listConversations, findExistingConversation, startOrGetConversation, getMessages, sendMessage };
