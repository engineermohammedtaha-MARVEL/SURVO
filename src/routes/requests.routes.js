const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { list, create, myRequests, updateStatus } = require('../controllers/requests.controller');

router.get('/', list);
router.get('/mine', requireAuth, myRequests);
router.post('/', requireAuth, create);
router.patch('/:id/status', requireAuth, updateStatus);

module.exports = router;
