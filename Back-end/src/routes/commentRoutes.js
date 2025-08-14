const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const commentController = require('../controllers/commentController');

// Добавить комментарий
router.post('/posts/:postId/comment', auth, commentController.addComment);
router.post('/:postId', auth, commentController.addComment);

// Получить комментарии поста (с опциональной авторизацией, чтобы вернуть liked)
router.get('/:postId', optionalAuth, commentController.getCommentForPost);

// Лайк/дизлайк комментария
router.post('/:commentId/like', auth, commentController.likeComment);
router.delete('/:commentId/like', auth, commentController.unlikeComment);

module.exports = router;
