const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  list,
  getOne,
  create,
  update,
  remove,
  myEquipment,
} = require('../controllers/equipment.controller');

router.get('/', list);
router.get('/mine', requireAuth, myEquipment);
router.get('/:id', getOne);
router.post('/', requireAuth, create);
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);

module.exports = router;
