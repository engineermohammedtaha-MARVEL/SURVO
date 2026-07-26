const ApiError = require('../utils/apiError');

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    throw new ApiError(401, 'مش مصرح لك بالدخول هنا');
  }
  next();
}

module.exports = { requireAdmin };
