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

module.exports = { listPendingUsers, approveUser, rejectUser };
