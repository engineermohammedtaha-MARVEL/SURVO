const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  createTicket,
  myTickets,
  myNotifications,
  markNotificationRead,
} = require('../controllers/support.controller');

router.use(requireAuth);
router.post('/tickets', createTicket);
router.get('/tickets', myTickets);
router.get('/notifications', myNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

module.exports = router;
