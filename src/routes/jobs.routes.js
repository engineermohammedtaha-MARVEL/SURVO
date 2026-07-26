const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { list, getOne, create, remove, applyOrContact } = require('../controllers/jobs.controller');

router.get('/', list);
router.get('/:id', getOne);
router.post('/', requireAuth, create);
router.delete('/:id', requireAuth, remove);
router.post('/:id/contact', requireAuth, applyOrContact); // مراسلة/اتصال بصاحب الإعلان

module.exports = router;
