const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  list,
  getOne,
  create,
  update,
  remove,
  myEquipment,
  recordView,
} = require('../controllers/equipment.controller');
const {
  createHandover,
  listHandovers,
  getSignedHandoverPhotos,
} = require('../controllers/handover.controller');

router.get('/', list);
router.get('/mine', requireAuth, myEquipment);
router.get('/handovers/:handoverId/signed-photos', requireAuth, getSignedHandoverPhotos);
router.get('/:id/handovers', requireAuth, listHandovers);
router.post('/:id/handovers', requireAuth, createHandover);
router.get('/:id', getOne);
router.post('/', requireAuth, create);
router.post('/:id/view', optionalAuth, recordView);
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);

module.exports = router;
