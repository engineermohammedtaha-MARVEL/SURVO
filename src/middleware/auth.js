const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const prisma = require('../config/db');

// بيتأكد إن الحساب لسه موجود وموافق عليه وإن التوكن ده مش أقدم من آخر مرة اتغيرت فيها كلمة السر
// (بيرجع null لو أي حاجة من دول مش تمام، عشان requireAuth/optionalAuth يقرروا هما يعملوا إيه)
async function loadValidUser(payload) {
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, accountType: true, accountStatus: true, tokenVersion: true, isAdmin: true },
  });
  if (!user) return null;
  if (user.accountStatus !== 'approved') return null;
  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) return null;
  return { id: user.id, accountType: user.accountType, isAdmin: user.isAdmin };
}

/**
 * يتأكد إن المستخدم عامل تسجيل دخول (JWT صحيح) قبل الوصول للـ route.
 * بيتحقق كمان من الداتابيز إن الحساب لسه متفعّل وإن التوكن مبقاش قديم بعد تغيير كلمة السر أو رفض الحساب،
 * عشان لو حد سرق التوكن أو الأدمن أوقف الحساب، الجلسة تتقفل فورًا مش لما التوكن ينتهي طبيعيًا بعد 7 أيام.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'غير مصرح لك، سجل الدخول أولاً');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'الجلسة منتهية أو غير صالحة');
  }

  const user = await loadValidUser(payload);
  if (!user) {
    throw new ApiError(401, 'الجلسة منتهية أو غير صالحة، سجل الدخول تاني');
  }

  req.user = user; // { id, accountType }
  next();
}

/**
 * مصادقة اختيارية: لو فيه توكن صحيح ومازال ساري يتحقق منه، ولو مفيش أو مبقاش صالح يكمل عادي (req.user = null)
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = await loadValidUser(payload);
    } catch (err) {
      req.user = null;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, loadValidUser };
