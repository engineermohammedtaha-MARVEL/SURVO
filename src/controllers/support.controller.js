const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

async function createTicket(req, res) {
  const { type, details, attachmentUrl } = req.body;
  if (!type || !details) throw new ApiError(400, 'نوع المشكلة والتفاصيل مطلوبين');

  const ticket = await prisma.supportTicket.create({
    data: { userId: req.user.id, type, details, attachmentUrl },
  });

  res.status(201).json({ success: true, ticket });
}

async function myTickets(req, res) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, tickets });
}

async function myNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const contactUserIds = [...new Set(notifications.map((n) => n.contactUserId).filter(Boolean))];
  const contactUsers = contactUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: contactUserIds } }, select: { id: true, fullName: true } })
    : [];
  const contactUserMap = Object.fromEntries(contactUsers.map((u) => [u.id, u]));

  const withContact = notifications.map((n) => ({
    ...n,
    contactUser: n.contactUserId ? contactUserMap[n.contactUserId] || null : null,
  }));

  res.json({ success: true, notifications: withContact });
}

async function markNotificationRead(req, res) {
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.userId !== req.user.id) throw new ApiError(404, 'الإشعار غير موجود');

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { readAt: new Date() },
  });
  res.json({ success: true, notification: updated });
}

module.exports = { createTicket, myTickets, myNotifications, markNotificationRead };
