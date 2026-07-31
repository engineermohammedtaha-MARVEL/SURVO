const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const { loadValidUser } = require('./auth');

// دخول الأدمن دلوقتي بقى بحساب حقيقي (JWT + isAdmin في الداتابيز) بدل مفتاح سري
// واحد مشترك بين كل حد — بنعمل تحقق حي من الداتابيز في كل طلب عشان أي رجوع عن
// صلاحية الأدمن يتفعّل فورًا، مش لما التوكن ينتهي طبيعيًا
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'سجّل الدخول بحساب الأدمن أولاً');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'الجلسة منتهية أو غير صالحة، سجّل الدخول تاني');
  }

  const user = await loadValidUser(payload);
  if (!user || !user.isAdmin) {
    throw new ApiError(403, 'الحساب ده مش عنده صلاحيات أدمن');
  }

  req.user = user;
  next();
}

module.exports = { requireAdmin };
