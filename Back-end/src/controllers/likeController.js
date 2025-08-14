const mongoose = require('mongoose');
const Like = require('../models/Like');

const getUid = (req) => req.user?.id || req.user?._id || req.userId;

exports.toggleLike = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = getUid(req);

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Bad postId' });
    }
    if (!userId) return res.status(401).json({ message: 'No user' });

    const existing = await Like.findOne({ post: postId, user: userId });
    if (existing) {
      await existing.deleteOne();
      const count = await Like.countDocuments({ post: postId });
      return res.json({ liked: false, count });
    }

    await Like.create({ post: postId, user: userId });
    const count = await Like.countDocuments({ post: postId });
    return res.json({ liked: true, count });
  } catch (err) {
    // защита от гонки из-за уникального индекса
    if (err?.code === 11000) {
      const count = await Like.countDocuments({ post: req.params.postId });
      return res.json({ liked: true, count });
    }
    console.error('toggleLike error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getLikeInfo = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = getUid(req);

    const [count, likedDoc] = await Promise.all([
      Like.countDocuments({ post: postId }),
      userId ? Like.findOne({ post: postId, user: userId }).lean() : null,
    ]);

    return res.json({ count, liked: !!likedDoc });
  } catch (err) {
    console.error('getLikeInfo error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getLikesForPost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const likes = await Like.find({ post: postId })
      .populate('user', 'username avatar')
      .lean();
    return res.json(likes);
  } catch (err) {
    console.error('getLikesForPost error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
