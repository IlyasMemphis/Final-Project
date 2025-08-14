const { Types } = require('mongoose');
const Notification = require('../models/Notification');

exports.list = async (req, res) => {
  try {
    const items = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('fromUser', 'username avatar _id')
      .populate({
        path: 'post',
        select: 'image author',
        populate: { path: 'author', select: 'username avatar _id' }
      })
      .populate({
        path: 'comment',
        select: 'text post',
        populate: { path: 'post', select: '_id' }
      });

    // нормализуем, чтобы фронту было удобно
    const data = items.map(n => ({
      _id: n._id,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt,
      fromUser: n.fromUser ? {
        _id: n.fromUser._id,
        username: n.fromUser.username,
        avatar: n.fromUser.avatar || null
      } : null,
      post: n.post ? {
        _id: n.post._id,
        image: n.post.image || '',
        author: n.post.author ? {
          _id: n.post.author._id,
          username: n.post.author.username,
          avatar: n.post.author.avatar || null
        } : null
      } : null,
      comment: n.comment ? {
        _id: n.comment._id,
        text: n.comment.text || '',
        post: n.comment.post || null
      } : null
    }));

    res.json(data);
  } catch (e) {
    console.error('notifications list error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markOneRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const notif = await Notification.findOne({ _id: id, user: req.user.id });
    if (!notif) return res.status(404).json({ message: 'Not found' });

    if (!notif.isRead) {
      notif.isRead = true;
      await notif.save();
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('markOneRead error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('markAllRead error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};
