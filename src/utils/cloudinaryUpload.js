const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const ApiError = require('./apiError');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// شامل صيغ الصور اللي بتطلع من كاميرات الموبايل الحديثة (زي HEIC) + PDF للمستندات الرسمية الممسوحة ضوئيًا
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'application/pdf',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, 'صيغة الملف غير مدعومة — لازم تكون صورة (jpeg/png/webp/heic) أو PDF'));
    }
    cb(null, true);
  },
});

// options.type === 'authenticated' بيرفع الملف بحيث محدش يقدر يوصله بالرابط المباشر
// غير لو معاه توقيع صالح (شوف getSignedUrl) — بنستخدمه لمستندات التوثيق الحساسة
function uploadBufferToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = { folder: folder || 'survo', resource_type: 'auto' };
    if (options.type) uploadOptions.type = options.type;
    if (options.publicId) uploadOptions.public_id = options.publicId;
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// بيفكّك رابط Cloudinary مخزّن عندنا لمكوّناته (لازمة عشان نولّد رابط موقّع جديد
// أو نحوّل نوع التسليم من upload لـ authenticated من غير ما نحتاج نرفع الملف تاني)
const CLOUDINARY_URL_RE = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/([^/]+)\/(upload|authenticated|private)\/(?:s--[^/]+--\/)?(?:[a-z]_[^/]+\/)*v(\d+)\/(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/;

function parseCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = CLOUDINARY_URL_RE.exec(url);
  if (!match) return null;
  return { cloudName: match[1], resourceType: match[2], type: match[3], version: match[4], publicId: match[5] };
}

// بيولّد رابط موقّع صالح لمدة محدودة (بالثواني) لملف اتوصف بـ type: authenticated —
// مش زي الرابط الأصلي وقت الرفع، ده بيتولّد فريش في كل مرة وممكن نخليه يخلص صلاحيته
function getSignedUrl(parsed, expiresInSeconds) {
  const options = {
    resource_type: parsed.resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    version: parsed.version,
  };
  if (expiresInSeconds) {
    options.expires_at = Math.floor(Date.now() / 1000) + expiresInSeconds;
  }
  return cloudinary.url(parsed.publicId, options);
}

// بيحوّل ملف مرفوع بنوع "upload" (عام) لنوع "authenticated" (محمي)، وبينقله كمان
// لمجلد جديد لو حبينا — من غير ما نحتاج نرفع بايتات الملف تاني. لو الملف
// authenticated خلاص، بيتنقل بس من غير ما يتغير نوعه (نفس شكل الرجوع دايمًا)
async function makeAuthenticatedAndMove(parsed, newPublicId) {
  if (parsed.type === 'authenticated') return renameAsset(parsed, newPublicId);
  const renamed = await cloudinary.uploader.rename(parsed.publicId, newPublicId || parsed.publicId, {
    to_type: 'authenticated',
    resource_type: parsed.resourceType,
  });
  return { cloudName: parsed.cloudName, resourceType: renamed.resource_type, type: renamed.type, version: String(renamed.version), publicId: renamed.public_id, secureUrl: renamed.secure_url };
}

// نفس الفكرة بس للملفات اللي اتاصلا اتاردت authenticated من الأول (مجرد نقل مكان)
async function renameAsset(parsed, newPublicId) {
  const renamed = await cloudinary.uploader.rename(parsed.publicId, newPublicId, {
    resource_type: parsed.resourceType,
    type: parsed.type,
  });
  return { cloudName: parsed.cloudName, resourceType: renamed.resource_type, type: renamed.type, version: String(renamed.version), publicId: renamed.public_id, secureUrl: renamed.secure_url };
}

module.exports = {
  cloudinary,
  upload,
  uploadBufferToCloudinary,
  parseCloudinaryUrl,
  getSignedUrl,
  makeAuthenticatedAndMove,
  renameAsset,
};
