const prisma = require('../config/db');

// نسبة الاستجابة = من المحادثات اللي حد تاني بدأ يكلّم المستخدم فيها فعلاً (يعني
// هو مش اللي بعت أول رسالة)، كام واحدة فيها المستخدم رد بنفسه بعد كده. بنحدد "مين بدأ"
// من ترتيب الرسايل الفعلي، مش بس مين اشترك في المحادثة — عشان لو المستخدم هو اللي بدأ
// وبعدين الطرف التاني رد، ده لسه بيعتبر استباق منه هو مش استجابة له.
async function computeResponseRate(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  if (!conversations.length) return null;

  const conversationIds = conversations.map((c) => c.id);

  const messagesInOrder = await prisma.message.findMany({
    where: { conversationId: { in: conversationIds } },
    orderBy: { createdAt: 'asc' },
    select: { conversationId: true, senderId: true },
  });

  const firstSenderByConv = {};
  const repliedConvSet = new Set();
  for (const m of messagesInOrder) {
    if (!(m.conversationId in firstSenderByConv)) firstSenderByConv[m.conversationId] = m.senderId;
    if (m.senderId === userId) repliedConvSet.add(m.conversationId);
  }

  let engagedCount = 0;
  let repliedCount = 0;
  for (const convId of conversationIds) {
    const firstSender = firstSenderByConv[convId];
    if (!firstSender || firstSender === userId) continue; // المستخدم نفسه اللي بدأ، أو مفيش رسايل خالص
    engagedCount++;
    if (repliedConvSet.has(convId)) repliedCount++;
  }

  if (!engagedCount) return null;
  return Math.round((repliedCount / engagedCount) * 100);
}

module.exports = { computeResponseRate };
