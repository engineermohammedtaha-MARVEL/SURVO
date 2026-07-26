const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ApiError = require('../utils/apiError');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, 'الصورة لازم تكون jpeg أو png أو webp'));
    }
    cb(null, true);
  },
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'survo', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختار صورة عشان ترفعها');

  const result = await uploadBufferToCloudinary(req.file.buffer);
  res.status(201).json({ success: true, url: result.secure_url });
});

module.exports = router;
