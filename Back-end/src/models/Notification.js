const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },      // кому
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // кто
  type: { type: String, enum: ['comment', 'like', 'follow', 'like_comment'], required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },       // для превью
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }, // чтобы скроллить к комменту
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
