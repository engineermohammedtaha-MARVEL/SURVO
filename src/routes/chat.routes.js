const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  listConversations,
  startOrGetConversation,
  getMessages,
  sendMessage,
} = require('../controllers/chat.controller');

router.use(requireAuth);
router.get('/conversations', listConversations);
router.post('/conversations', startOrGetConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);

module.exports = router;
