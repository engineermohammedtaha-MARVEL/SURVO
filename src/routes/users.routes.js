const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  getPublicProfile,
  updateMe,
  addSpecialty,
  requestVerification,
} = require('../controllers/users.controller');

router.get('/:id', getPublicProfile);
router.patch('/me', requireAuth, updateMe);
router.post('/me/specialties', requireAuth, addSpecialty);
router.post('/me/verification', requireAuth, requestVerification);

module.exports = router;
