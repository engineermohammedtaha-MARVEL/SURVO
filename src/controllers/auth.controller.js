const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { signToken } = require('../utils/jwt');

const ACCOUNT_TYPES = [
  'engineer',
  'specialist',
  'surveyor_academic',
  'surveyor_professional',
  'assistant',
  'office',
  'general',
];

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

async function register(req, res) {
  const { fullName, phone, email, password, accountType, governorate } = req.body;

  if (!fullName || !phone || !password || !accountType) {
    throw new ApiError(400, 'الاسم ورقم الموبايل وكلمة المرور ونوع الحساب مطلوبين');
  }
  if (!ACCOUNT_TYPES.includes(accountType)) {
    throw new ApiError(400, 'نوع الحساب غير صحيح');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'كلمة المرور لازم تكون 6 أحرف على الأقل');
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw new ApiError(409, 'رقم الموبايل ده مسجل قبل كده');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { fullName, phone, email, passwordHash, accountType, governorate },
  });

  const token = signToken({ id: user.id, accountType: user.accountType });
  res.status(201).json({ success: true, token, user: publicUser(user) });
}

async function login(req, res) {
  const { phone, password } = req.body;
  if (!phone || !password) {
    throw new ApiError(400, 'رقم الموبايل وكلمة المرور مطلوبين');
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new ApiError(401, 'رقم الموبايل أو كلمة المرور غلط');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new ApiError(401, 'رقم الموبايل أو كلمة المرور غلط');
  }

  const token = signToken({ id: user.id, accountType: user.accountType });
  res.json({ success: true, token, user: publicUser(user) });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  res.json({ success: true, user: publicUser(user) });
}

module.exports = { register, login, me, ACCOUNT_TYPES, publicUser };
