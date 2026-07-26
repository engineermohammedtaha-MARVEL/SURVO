const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { create, myReports, lookup } = require('../controllers/deviceReports.controller');

router.get('/lookup', lookup);
router.post('/', requireAuth, create);
router.get('/mine', requireAuth, myReports);

module.exports = router;
