const ApiError = require('../utils/apiError');

function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'المسار غير موجود'));
}

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'البيانات دي مسجلة قبل كده (تكرار)',
      field: err.meta && err.meta.target,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'حصل خطأ غير متوقع في السيرفر',
  });
}

module.exports = { notFoundHandler, errorHandler };
