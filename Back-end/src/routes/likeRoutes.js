const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const likeController = require('../controllers/likeController');

router.post('/:postId', auth, likeController.toggleLike);
router.get('/:postId/info', auth, likeController.getLikeInfo);
router.get('/:postId', likeController.getLikesForPost);

module.exports = router;
