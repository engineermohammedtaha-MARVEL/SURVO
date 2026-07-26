const prisma = require('../config/db');

// نسبة الاستجابة = من إجمالي المحادثات اللي المستخدم طرف فيها، كام واحدة فيها رسالة واحدة بالأقل منه
async function computeResponseRate(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  if (!conversations.length) return null;

  const conversationIds = conversations.map((c) => c.id);
  const repliedCount = await prisma.message.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: conversationIds }, senderId: userId },
  });

  return Math.round((repliedCount.length / conversations.length) * 100);
}

module.exports = { computeResponseRate };
