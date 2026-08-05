const rateLimit = require('express-rate-limit');
const router = require('express').Router();
const { requireAdmin } = require('../middleware/adminAuth');
const {
  listPendingUsers, approveUser, rejectUser,
  listPendingVerifications, verifyUser, rejectVerification,
  listPendingDeviceReports, approveDeviceReport, rejectDeviceReport,
  listPendingEquipment, approveEquipment, rejectEquipment,
  listOpenSupportTickets, resolveSupportTicket,
  searchUsers, sendAdminMessage, listAdminConversations, getAdminConversationMessages,
  getSignedDocUrl,
} = require('../controllers/admin.controller');

// دفاع إضافي ضد محاولات القوة الغاشمة على مسارات الأدمن
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
router.get('/verifications/pending', listPendingVerifications);
router.post('/verifications/:id/approve', verifyUser);
router.post('/verifications/:id/reject', rejectVerification);
router.get('/device-reports/pending', listPendingDeviceReports);
router.post('/device-reports/:id/approve', approveDeviceReport);
router.post('/device-reports/:id/reject', rejectDeviceReport);
router.get('/equipment/pending', listPendingEquipment);
router.post('/equipment/:id/approve', approveEquipment);
router.post('/equipment/:id/reject', rejectEquipment);
router.get('/support-tickets/open', listOpenSupportTickets);
router.post('/support-tickets/:id/resolve', resolveSupportTicket);
router.get('/users/search', searchUsers);
router.post('/messages', sendAdminMessage);
router.get('/messages/conversations', listAdminConversations);
router.get('/messages/conversations/:id', getAdminConversationMessages);
router.get('/signed-url', getSignedDocUrl);

module.exports = router;
