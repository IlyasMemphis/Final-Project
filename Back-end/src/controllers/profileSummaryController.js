const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');            // у тебя уже есть
const Follow = require('../models/Follow');        // см. модель выше

function isObjectId(v) { return /^[0-9a-fA-F]{24}$/.test(String(v||'')); }

async function resolveUser(idOrUsername, meId) {
  if (idOrUsername === 'me' && meId) {
    return User.findById(meId).lean();
  }
  if (isObjectId(idOrUsername)) {
    return User.findById(idOrUsername).lean();
  }
  return User.findOne({ username: idOrUsername }).lean();
}

async function getProfileSummary(req, res) {
  try {
    const idOrUsername = req.params.idOrUsername || 'me';
    const meId = req.user?._id || req.user?.id;

    const user = await resolveUser(idOrUsername, meId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const uid = new mongoose.Types.ObjectId(user._id);

    const [postsCount, followersCount, followingCount, posts] = await Promise.all([
      Post.countDocuments({ author: uid }),
      Follow.countDocuments({ following: uid }),
      Follow.countDocuments({ follower: uid }),
      Post.find({ author: uid })
        .sort({ createdAt: -1 })
        .select('_id image createdAt description') // всё, что нужно для грида
        .lean(),
    ]);

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar || '',
        bio: user.bio || '',
      },
      stats: {
        posts: postsCount,
        followers: followersCount,
        following: followingCount,
      },
      posts, // [{_id, image, createdAt, description}]
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getProfileSummary };
