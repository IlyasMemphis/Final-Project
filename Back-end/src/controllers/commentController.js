// controllers/commentController.js
const { Types } = require('mongoose');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Post = require('../models/Post');

const toStr = (v) => String(v || '');
const getUid = (req) => req?.user?.id || req?.user?._id || req?.userId;

/**
 * Добавление комментария к посту
 * POST /api/comments/:postId
 * POST /api/comments/posts/:postId/comment
 */
exports.addComment = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = getUid(req);

    const raw = req.body?.text ?? req.body?.content ?? req.body?.comment ?? '';
    const text = String(raw).trim();

    if (!Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid postId' });
    }
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!text) return res.status(400).json({ message: 'Text is required' });

    const post = await Post.findById(postId).select('author');
    if (!post) return res.status(404).json({ message: 'Post not found' });

    let comment = await Comment.create({
      post: postId,
      user: userId,
      text,
      likes: [], // на всякий случай
    });

    comment = await comment.populate('user', 'username avatar _id');

    // уведомление автору поста о новом комментарии
    if (toStr(post.author) !== toStr(userId)) {
      try {
        await Notification.create({
          user: post.author,
          fromUser: userId,
          post: postId,
          comment: comment._id,
          type: 'comment',
        });
      } catch (e) {
        console.warn('Notification create failed:', e?.message);
      }
    }

    // отдаём нормализованный объект
    res.status(201).json({
      comment: {
        ...comment.toObject(),
        likesCount: 0,
        liked: false,
      },
    });
  } catch (error) {
    console.error('addComment error:', error);
    res.status(500).json({ message: 'Server error', error: error?.message });
  }
};

/**
 * Получение комментариев поста
 * (учитывает лайк текущего пользователя + считает likesCount)
 * GET /api/comments/:postId
 */
exports.getCommentForPost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const me = toStr(getUid(req));

    if (!Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid postId' });
    }

    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: -1 })
      .populate('user', 'username avatar _id')
      .lean();

    const prepared = comments.map((c) => {
      const likesArr = Array.isArray(c.likes) ? c.likes : [];
      const likesCount = Number.isFinite(c.likesCount)
        ? c.likesCount
        : likesArr.length;

      const liked = me
        ? likesArr.some((id) => toStr(id?._id || id) === me)
        : false;

      return {
        ...c,
        likesCount,
        liked,
      };
    });

    res.json(prepared);
  } catch (error) {
    console.error('getCommentForPost error:', error);
    res.status(500).json({ message: 'Server error', error: error?.message });
  }
};

/**
 * Лайк комментария (идемпотентно)
 * POST /api/comments/:commentId/like
 */
exports.likeComment = async (req, res) => {
  try {
    const userId = getUid(req);
    const commentId = req.params.commentId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid commentId' });
    }

    // Был ли лайк раньше (для нотификаций)
    const existed = await Comment.exists({ _id: commentId, likes: userId });

    const updated = await Comment.findOneAndUpdate(
      { _id: commentId },
      { $addToSet: { likes: userId } },
      { new: true }
    ).populate('user', 'username avatar _id');

    if (!updated) return res.status(404).json({ message: 'Comment not found' });

    // уведомляем автора комментария только при первом лайке
    if (!existed && toStr(updated.user?._id) !== toStr(userId)) {
      try {
        await Notification.create({
          user: updated.user._id, // адресат — автор комментария
          fromUser: userId,
          post: updated.post,
          comment: updated._id,
          type: 'comment_like',
        });
      } catch (e) {
        console.warn('Notification create failed:', e?.message);
      }
    }

    res.json({
      likes: Array.isArray(updated.likes) ? updated.likes.length : 0,
      liked: true,
      commentId: updated._id,
    });
  } catch (error) {
    console.error('likeComment error:', error);
    res.status(500).json({ message: 'Server error', error: error?.message });
  }
};

/**
 * Снятие лайка
 * DELETE /api/comments/:commentId/like
 */
exports.unlikeComment = async (req, res) => {
  try {
    const userId = getUid(req);
    const commentId = req.params.commentId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid commentId' });
    }

    const updated = await Comment.findOneAndUpdate(
      { _id: commentId },
      { $pull: { likes: userId } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Comment not found' });

    res.json({
      likes: Array.isArray(updated.likes) ? updated.likes.length : 0,
      liked: false,
      commentId: updated._id,
    });
  } catch (error) {
    console.error('unlikeComment error:', error);
    res.status(500).json({ message: 'Server error', error: error?.message });
  }
};
