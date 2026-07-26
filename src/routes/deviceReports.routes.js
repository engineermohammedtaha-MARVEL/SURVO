const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { create, myReports, lookup } = require('../controllers/deviceReports.controller');

router.get('/lookup', optionalAuth, lookup);
router.post('/', requireAuth, create);
router.get('/mine', requireAuth, myReports);

module.exports = router;
