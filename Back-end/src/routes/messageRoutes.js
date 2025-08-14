const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const ctrl = require('../controllers/messageController');

// ping
router.get('/_ping', (req, res) => res.send('ok'));

/* ===== Списки/инбокс ===== */
router.get('/', auth, ctrl.getInbox);
router.get('/threads', auth, ctrl.getThreads);
router.get('/conversations', auth, ctrl.getConversations);

/* ===== История переписки (алиасы под разные фронты) ===== */
// ?peerId=...
router.get('/thread', auth, ctrl.getThread);
router.get('/history', auth, ctrl.getThread);

// /.../:peerId
router.get('/thread/:peerId', auth, ctrl.getThread);
router.get('/history/:peerId', auth, ctrl.getThread);
router.get('/conversation/:peerId', auth, ctrl.getThread);

/* Поддержка /api/messages/<ObjectId> (если это 24-символьный ObjectId) */
router.get('/:peerId', auth, (req, res, next) => {
  const { peerId } = req.params;
  if (/^[0-9a-fA-F]{24}$/.test(peerId)) return ctrl.getThread(req, res);
  return next();
});

/* ===== Отправка сообщений (несколько форматов) ===== */
// body: { peerId, text }  или  { to, text }
router.post('/', auth, ctrl.sendMessage);

// alias: /send (body)
router.post('/send', auth, ctrl.sendMessage);

// alias: /send/:peerId (params)
router.post('/send/:peerId', auth, ctrl.sendMessageParam);

/* ===== Прочтения ===== */
router.patch('/thread/:peerId/read', auth, ctrl.markThreadRead);
router.patch('/mark-read', auth, ctrl.markThreadRead); // ?peerId=...
router.patch('/read/:messageId', auth, ctrl.markMessageRead);

module.exports = router;
