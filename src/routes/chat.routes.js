const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  listConversations,
  findExistingConversation,
  startOrGetConversation,
  getMessages,
  sendMessage,
} = require('../controllers/chat.controller');

router.use(requireAuth);
router.get('/conversations', listConversations);
router.get('/conversations/with/:userId', findExistingConversation);
router.post('/conversations', startOrGetConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);

module.exports = router;
