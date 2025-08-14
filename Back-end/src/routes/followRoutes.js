const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    isFollowing
} = require('../controllers/followController');

router.post('/', authMiddleware, followUser);
router.delete('/', authMiddleware, unfollowUser);
router.get('/followers/:userId', getFollowers);
router.get('/following/:userId', getFollowing);
router.get('/is-following/:userId', authMiddleware, isFollowing);

module.exports = router;
