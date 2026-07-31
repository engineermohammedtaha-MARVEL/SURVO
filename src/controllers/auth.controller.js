const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { signToken } = require('../utils/jwt');
const { sendResetPasswordEmail } = require('../utils/mailer');
const { computeResponseRate } = require('../utils/metrics');
const { parseCloudinaryUrl, makeAuthenticatedAndMove } = require('../utils/cloudinaryUpload');

const DOC_FIELDS = ['nationalIdUrl', 'personalPhotoUrl', 'qualificationUrl', 'unionCardUrl', 'commercialRecordUrl'];

// المستندات بترفع الأول في مجلد مؤقت عام (وقت التسجيل، قبل ما يكون للمستخدم id)
// وبعد ما الحساب يتعمل بنقلها هنا لمجلد خاص بالـ id بتاعه، ونتأكد إنها authenticated
// (محمية بتوقيع) — لو أي حاجة فشلت في النقل بنسيبها بمكانها الأصلي بدل ما نوقف التسجيل
async function organizeRegistrationDocs(userId, docs) {
  const updates = {};
  for (const field of DOC_FIELDS) {
    const url = docs[field];
    if (!url) continue;
    try {
      const parsed = parseCloudinaryUrl(url);
      if (!parsed) continue;
      const newPublicId = 'survo/users/' + userId + '/registration/' + field;
      const moved = await makeAuthenticatedAndMove(parsed, newPublicId);
      updates[field] = moved.secureUrl;
    } catch (err) {
      // نسيب القيمة الأصلية لو النقل فشل — أهم حاجة إن التسجيل نفسه ينجح
    }
  }
  return updates;
}

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
  const {
    fullName, phone, email, password, accountType, governorate, bio, specialties,
    nationalIdUrl, personalPhotoUrl, qualificationUrl, unionCardUrl, commercialRecordUrl, avatarUrl,
  } = req.body;

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
    data: {
      fullName,
      phone,
      email: email ? email.trim().toLowerCase() : undefined,
      passwordHash,
      accountType,
      governorate,
      bio: bio || undefined,
      specialties: specialties && specialties.length ? specialties : undefined,
      nationalIdUrl: nationalIdUrl || undefined,
      personalPhotoUrl: personalPhotoUrl || undefined,
      qualificationUrl: qualificationUrl || undefined,
      unionCardUrl: unionCardUrl || undefined,
      commercialRecordUrl: commercialRecordUrl || undefined,
      avatarUrl: avatarUrl || undefined,
      accountStatus: 'pending',
    },
  });

  const docUpdates = await organizeRegistrationDocs(user.id, {
    nationalIdUrl, personalPhotoUrl, qualificationUrl, unionCardUrl, commercialRecordUrl,
  });
  const finalUser = Object.keys(docUpdates).length
    ? await prisma.user.update({ where: { id: user.id }, data: docUpdates })
    : user;

  res.status(201).json({
    success: true,
    pendingApproval: true,
    message: 'تم إنشاء حسابك، وهيتم تفعيله بعد موافقة الإدارة',
    user: publicUser(finalUser),
  });
}

async function login(req, res) {
  const { phone, password } = req.body;
  if (!phone || !password) {
    throw new ApiError(400, 'رقم الموبايل أو الإيميل وكلمة المرور مطلوبين');
  }

  const identifier = phone.trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ phone: identifier }, { email: { equals: identifier, mode: 'insensitive' } }] },
  });
  if (!user) {
    throw new ApiError(401, 'رقم الموبايل أو كلمة المرور غلط');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new ApiError(401, 'رقم الموبايل أو كلمة المرور غلط');
  }

  if (user.accountStatus === 'pending') {
    throw new ApiError(403, 'حسابك لسه قيد المراجعة من الإدارة، هيتفعّل قريبًا');
  }
  if (user.accountStatus === 'rejected') {
    throw new ApiError(403, 'تم رفض حسابك من الإدارة، تواصل مع الدعم الفني لمزيد من التفاصيل');
  }

  const token = signToken({ id: user.id, accountType: user.accountType, tokenVersion: user.tokenVersion });
  res.json({ success: true, token, user: publicUser(user) });
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'اكتب البريد الإلكتروني');

  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });
  // نرجّع نفس الرد سواء الإيميل موجود أو لأ، عشان محدش يعرف إيميلات مسجلة ولا لأ
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetUrl = (process.env.FRONTEND_URL || 'https://engineermohammedtaha-marvel.github.io/SURVO-FRONTEND') + '/?resetToken=' + rawToken;
    await sendResetPasswordEmail(email, resetUrl);
  }

  res.json({ success: true, message: 'لو الإيميل ده مسجل عندنا، هيوصلك رابط إعادة تعيين كلمة المرور' });
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) throw new ApiError(400, 'التوكن وكلمة المرور مطلوبين');
  if (password.length < 6) throw new ApiError(400, 'كلمة المرور لازم تكون 6 أحرف على الأقل');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) throw new ApiError(400, 'الرابط غير صالح أو منتهي، اطلب رابط جديد');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null, tokenVersion: { increment: 1 } },
  });

  res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  const responseRate = await computeResponseRate(user.id);
  res.json({ success: true, user: { ...publicUser(user), responseRate } });
}

module.exports = { register, login, me, forgotPassword, resetPassword, ACCOUNT_TYPES, publicUser };
