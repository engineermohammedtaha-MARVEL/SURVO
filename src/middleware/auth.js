const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');

/**
 * يتأكد إن المستخدم عامل تسجيل دخول (JWT صحيح) قبل الوصول للـ route.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'غير مصرح لك، سجل الدخول أولاً');
  }

  try {
    const payload = verifyToken(token);
    req.user = payload; // { id, accountType }
    next();
  } catch (err) {
    throw new ApiError(401, 'الجلسة منتهية أو غير صالحة');
  }
}

/**
 * مصادقة اختيارية: لو فيه توكن يتحقق منه، ولو مفيش يكمل عادي (req.user = null)
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (err) {
      req.user = null;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
