const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');

function isObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(String(id || ''));
}

/* ===== Список тредов (последние сообщения по собеседнику) ===== */
async function getThreads(req, res) {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);

    const pipeline = [
      { $match: { $or: [{ sender: me }, { peer: me }] } },
      {
        $addFields: {
          other: { $cond: [{ $eq: ['$sender', me] }, '$peer', '$sender'] },
          isIncomingUnread: {
            $cond: [
              { $and: [{ $ne: ['$sender', me] }, { $not: [{ $in: [me, '$readBy'] }] }] },
              1,
              0,
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$other',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: { $sum: '$isIncomingUnread' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'peer' } },
      { $unwind: '$peer' },
      {
        $project: {
          _id: 0,
          peer: {
            _id: '$peer._id',
            username: '$peer.username',
            fullName: '$peer.fullName',
            avatar: '$peer.avatar',
          },
          lastMessage: {
            _id: '$lastMessage._id',
            text: '$lastMessage.text',
            sender: '$lastMessage.sender',
            peer: '$lastMessage.peer',
            createdAt: '$lastMessage.createdAt',
            readBy: '$lastMessage.readBy',
          },
          unreadCount: 1,
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ];

    const rows = await Message.aggregate(pipeline);
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getConversations(req, res) { return getThreads(req, res); }
async function getInbox(req, res) { return getThreads(req, res); }

/* ===== Получить переписку с пользователем =====
   Поддерживает:
   - GET /api/messages/thread?peerId=...
   - GET /api/messages/history?peerId=...
   - GET /api/messages/thread/:peerId
   - GET /api/messages/history/:peerId
   - GET /api/messages/conversation/:peerId
   - GET /api/messages/:peerId (если это ObjectId)
   Ответ: { peer, messages }
*/
async function getThread(req, res) {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);
    const peerId = req.params.peerId || req.query.peerId;

    if (!isObjectId(peerId)) {
      return res.status(400).json({ message: 'Bad peerId' });
    }
    const peer = new mongoose.Types.ObjectId(peerId);

    const [peerUser, messages] = await Promise.all([
      User.findById(peer).select('_id username fullName avatar').lean(),
      Message.find({
        $or: [{ sender: me, peer }, { sender: peer, peer: me }],
      })
        .sort({ createdAt: 1 })
        .populate('sender', '_id username fullName avatar')
        .populate('peer', '_id username fullName avatar')
        .lean(),
    ]);

    if (!peerUser) return res.status(404).json({ message: 'User not found' });

    return res.json({ peer: peerUser, messages });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/* ===== Отправить сообщение =====
   POST /api/messages            { peerId|to, text }
   POST /api/messages/send       { peerId|to, text }
   POST /api/messages/send/:peerId   + body { text }
   → { message }
*/
async function sendMessage(req, res) {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);
    const peerId = req.body.peerId || req.body.to || req.params.peerId;
    const text = String(req.body.text ?? '');

    if (!isObjectId(peerId)) return res.status(400).json({ message: 'Bad peerId' });
    const peer = new mongoose.Types.ObjectId(peerId);

    const peerUser = await User.findById(peer).select('_id');
    if (!peerUser) return res.status(404).json({ message: 'User not found' });

    // создаём
    const created = await Message.create({ sender: me, peer, text, readBy: [me] });

    // отдаём ПЛОСКИЙ объект (без mongoose-документа) — убирает 500
    const message = await Message.findById(created._id)
      .populate('sender', '_id username fullName avatar')
      .populate('peer', '_id username fullName avatar')
      .lean();

    return res.status(201).json({ message });
  } catch (e) {
    console.error('[sendMessage]', e.stack || e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/* alias: POST /api/messages/send/:peerId */
async function sendMessageParam(req, res) {
  req.body = { ...(req.body || {}), peerId: req.params.peerId };
  return sendMessage(req, res);
}


/* ===== Прочтения ===== */
async function markThreadRead(req, res) {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);
    const peerId = req.params.peerId || req.query.peerId;

    if (!isObjectId(peerId)) {
      return res.status(400).json({ message: 'Bad peerId' });
    }
    const peer = new mongoose.Types.ObjectId(peerId);

    const result = await Message.updateMany(
      { sender: peer, peer: me, readBy: { $ne: me } },
      { $addToSet: { readBy: me } }
    );

    return res.json({ ok: true, matched: result.matchedCount, modified: result.modifiedCount });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function markMessageRead(req, res) {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);
    const { messageId } = req.params;

    if (!isObjectId(messageId)) {
      return res.status(400).json({ message: 'Bad messageId' });
    }

    const result = await Message.updateOne(
      { _id: new mongoose.Types.ObjectId(messageId), readBy: { $ne: me } },
      { $addToSet: { readBy: me } }
    );

    return res.json({ ok: true, matched: result.matchedCount, modified: result.modifiedCount });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getInbox,
  getThreads,
  getConversations,
  getThread,
  sendMessage,
  sendMessageParam,
  markThreadRead,
  markMessageRead,
};
