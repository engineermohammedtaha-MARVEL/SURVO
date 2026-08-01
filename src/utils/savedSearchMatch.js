const prisma = require('../config/db');

// بيدور على أي بحث محفوظ بيتطابق مع إعلان جهاز اتوافق عليه لتوه، وبيبعت
// إشعار لصاحب كل بحث (غير صاحب الإعلان نفسه)
async function notifySavedSearchMatches(equipment) {
  const candidates = await prisma.savedSearch.findMany({
    where: {
      userId: { not: equipment.ownerId },
      AND: [
        { OR: [{ category: null }, { category: equipment.category }] },
        { OR: [{ governorate: null }, { governorate: equipment.governorate }] },
        { OR: [{ listingType: null }, { listingType: equipment.listingType }] },
      ],
    },
  });

  const title = (equipment.title || '').toLowerCase();
  const description = (equipment.description || '').toLowerCase();
  const matches = candidates.filter((s) => {
    if (!s.keyword) return true;
    const keyword = s.keyword.toLowerCase();
    return title.includes(keyword) || description.includes(keyword);
  });

  const uniqueUserIds = [...new Set(matches.map((s) => s.userId))];
  await Promise.all(
    uniqueUserIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          title: 'إعلان جديد يطابق بحثك المحفوظ',
          body: equipment.title || 'إعلان جهاز جديد',
          targetType: 'equipment',
          targetId: equipment.id,
        },
      })
    )
  ).catch(() => {});
}

module.exports = { notifySavedSearchMatches };
