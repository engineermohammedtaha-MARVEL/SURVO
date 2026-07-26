const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { publicUser } = require('./auth.controller');

async function getPublicProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      equipment: { where: { available: true }, take: 20 },
    },
  });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  res.json({ success: true, user: publicUser(user) });
}

async function updateMe(req, res) {
  const { fullName, bio, specialties, governorate, avatarUrl } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(bio !== undefined && { bio }),
      ...(specialties !== undefined && { specialties }),
      ...(governorate !== undefined && { governorate }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
  });

  res.json({ success: true, user: publicUser(user) });
}

async function addSpecialty(req, res) {
  const { specialty } = req.body;
  if (!specialty || !specialty.trim()) {
    throw new ApiError(400, 'اكتب التخصص');
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const specialties = Array.from(new Set([...(user.specialties || []), specialty.trim()]));
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { specialties },
  });
  res.json({ success: true, user: publicUser(updated) });
}

async function requestVerification(req, res) {
  const { unionCardUrl } = req.body;
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { unionCardUrl, verification: 'pending' },
  });
  res.json({ success: true, user: publicUser(updated) });
}

module.exports = { getPublicProfile, updateMe, addSpecialty, requestVerification };
