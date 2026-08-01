const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { myList, create, remove } = require('../controllers/savedSearches.controller');

router.get('/', requireAuth, myList);
router.post('/', requireAuth, create);
router.delete('/:id', requireAuth, remove);

module.exports = router;
