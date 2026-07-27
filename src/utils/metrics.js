const prisma = require('../config/db');

// نسبة الاستجابة = من المحادثات اللي حد تاني بدأ يكلّم المستخدم فيها فعلاً،
// كام واحدة فيها المستخدم رد بنفسه. المحادثات اللي هو نفسه بدأها ولسه محدش
// رد عليه فيها مش بتتحسب، عشان الرقم يعبّر عن استجابته الفعلية للناس مش عن نشاطه هو بس.
async function computeResponseRate(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  if (!conversations.length) return null;

  const conversationIds = conversations.map((c) => c.id);
  const senderGroups = await prisma.message.groupBy({
    by: ['conversationId', 'senderId'],
    where: { conversationId: { in: conversationIds } },
  });

  const sendersByConv = {};
  for (const g of senderGroups) {
    if (!sendersByConv[g.conversationId]) sendersByConv[g.conversationId] = new Set();
    sendersByConv[g.conversationId].add(g.senderId);
  }

  let engagedCount = 0;
  let repliedCount = 0;
  for (const convId of conversationIds) {
    const senders = sendersByConv[convId] || new Set();
    const othersEngaged = Array.from(senders).some((id) => id !== userId);
    if (!othersEngaged) continue;
    engagedCount++;
    if (senders.has(userId)) repliedCount++;
  }

  if (!engagedCount) return null;
  return Math.round((repliedCount / engagedCount) * 100);
}

module.exports = { computeResponseRate };
