const rateLimit = require('express-rate-limit');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ApiError = require('../utils/apiError');
const { upload, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

// رفع صور الأجهزة/البروفايل — محتاج تسجيل دخول
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختار صورة عشان ترفعها');
  const result = await uploadBufferToCloudinary(req.file.buffer, 'survo');
  res.status(201).json({ success: true, url: result.secure_url });
});

// رفع مستندات التسجيل (بطاقة، صورة شخصية...) — قبل ما يبقى للمستخدم حساب فعلي
// محمي بـ rate limit صارم بدل الـ JWT عشان مفيش توكن لسه وقت التسجيل
const registrationUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/registration', registrationUploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختار صورة عشان ترفعها');
  const result = await uploadBufferToCloudinary(req.file.buffer, 'survo/registration-docs');
  res.status(201).json({ success: true, url: result.secure_url });
});

module.exports = router;
