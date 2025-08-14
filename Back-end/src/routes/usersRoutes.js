const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getUserById, getUserProfile } = require('../controllers/usersController');

router.get('/profile/:id', auth, getUserProfile);
router.get('/:id', auth, getUserById);

module.exports = router;
