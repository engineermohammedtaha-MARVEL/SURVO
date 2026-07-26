const crypto = require('crypto');
const ApiError = require('../utils/apiError');

function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || !process.env.ADMIN_SECRET || !safeEqual(secret, process.env.ADMIN_SECRET)) {
    throw new ApiError(401, 'مش مصرح لك بالدخول هنا');
  }
  next();
}

module.exports = { requireAdmin };
