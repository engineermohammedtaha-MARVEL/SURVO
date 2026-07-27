const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { list, getOne, create, myRequests, updateStatus } = require('../controllers/requests.controller');

router.get('/', list);
router.get('/mine', requireAuth, myRequests);
router.get('/:id', getOne);
router.post('/', requireAuth, create);
router.patch('/:id/status', requireAuth, updateStatus);

module.exports = router;
