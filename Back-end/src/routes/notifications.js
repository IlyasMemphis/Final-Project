const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', auth, ctrl.list);                 // список
router.patch('/:id/read', auth, ctrl.markOneRead); // отметить одно
router.patch('/read-all', auth, ctrl.markAllRead); // отметить все

module.exports = router;
