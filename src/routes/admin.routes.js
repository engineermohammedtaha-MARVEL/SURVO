const router = require('express').Router();
const { requireAdmin } = require('../middleware/adminAuth');
const { listPendingUsers, approveUser, rejectUser } = require('../controllers/admin.controller');

router.use(requireAdmin);
router.get('/users/pending', listPendingUsers);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/reject', rejectUser);

module.exports = router;
