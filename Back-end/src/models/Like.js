const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

// один пользователь не может лайкнуть пост дважды
LikeSchema.index({ post: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Like', LikeSchema);
