const rateLimit = require('express-rate-limit');
const router = require('express').Router();
const { requireAdmin } = require('../middleware/adminAuth');
const {
  listPendingUsers, approveUser, rejectUser,
  listPendingDeviceReports, approveDeviceReport, rejectDeviceReport,
} = require('../controllers/admin.controller');

// دفاع إضافي ضد محاولات تخمين ADMIN_SECRET
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(adminLimiter);
router.use(requireAdmin);
router.get('/users/pending', listPendingUsers);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/reject', rejectUser);
router.get('/device-reports/pending', listPendingDeviceReports);
router.post('/device-reports/:id/approve', approveDeviceReport);
router.post('/device-reports/:id/reject', rejectDeviceReport);

module.exports = router;
