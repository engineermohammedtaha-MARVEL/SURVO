const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ApiError = require('../utils/apiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype] || path.extname(file.originalname) || '';
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new ApiError(400, 'الصورة لازم تكون jpeg أو png أو webp'));
    }
    cb(null, true);
  },
});

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) throw new ApiError(400, 'اختار صورة عشان ترفعها');
  res.status(201).json({ success: true, url: '/uploads/' + req.file.filename });
});

module.exports = router;
