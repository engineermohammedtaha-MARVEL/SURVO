const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { listForUser, create } = require('../controllers/reviews.controller');

router.get('/user/:userId', listForUser);
router.post('/', requireAuth, create);

module.exports = router;
