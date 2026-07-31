const rateLimit = require('express-rate-limit');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ApiError = require('../utils/apiError');
const { upload, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

// purpose بيحدد فين هيتخزن الملف وهل هو حساس (سند ملكية/رقم تسلسلي) لازم يبقى
// محمي (authenticated) ومحدش يشوفه غير الأدمن وقت المراجعة، ولا عادي (صور المعدات/الأفاتار)
// اللي المفروض تبقى عامة عشان تظهر في السوق
const SENSITIVE_PURPOSES = ['equipment-doc', 'report-doc'];
const ALLOWED_PURPOSES = ['equipment', 'equipment-doc', 'report-doc', 'avatar', 'chat', 'support', 'general'];

function safePurpose(value) {
  const purpose = String(value || 'general');
  return ALLOWED_PURPOSES.includes(purpose) ? purpose : 'general';
}

// رفع صور الأجهزة/البروفايل/المستندات وقت الاستخدام العادي — محتاج تسجيل دخول
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختار صورة عشان ترفعها');
  const purpose = safePurpose(req.body.purpose);
  const folder = 'survo/users/' + req.user.id + '/' + purpose;
  const options = SENSITIVE_PURPOSES.includes(purpose) ? { type: 'authenticated' } : {};
  const result = await uploadBufferToCloudinary(req.file.buffer, folder, options);
  res.status(201).json({ success: true, url: result.secure_url });
});

// رفع مستندات التسجيل (بطاقة، صورة شخصية...) — قبل ما يبقى للمستخدم حساب فعلي
// محمي بـ rate limit صارم بدل الـ JWT عشان مفيش توكن لسه وقت التسجيل.
// المستندات (غير الأفاتار) بترفع محمية من الأول، وبعد إنشاء الحساب بننقلها
// لمجلد خاص بالـ id بتاع المستخدم الجديد (شوف auth.controller.js -> register)
const registrationUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/registration', registrationUploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختار صورة عشان ترفعها');
  const isAvatar = req.body.purpose === 'avatar';
  const folder = isAvatar ? 'survo/registration-pending/avatars' : 'survo/registration-pending/docs';
  const options = isAvatar ? {} : { type: 'authenticated' };
  const result = await uploadBufferToCloudinary(req.file.buffer, folder, options);
  res.status(201).json({ success: true, url: result.secure_url });
});

module.exports = router;
