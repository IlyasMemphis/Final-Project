const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // кто отправил
    peer:   { type: Schema.Types.ObjectId, ref: 'User', required: true }, // кому
    text:   { type: String, trim: true, default: '' },
    attachments: [
      {
        url: String,
        type: String, // image / file / etc.
      },
    ],
    // кто уже прочитал
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// индексы на пары пользователей и сортировку по времени
MessageSchema.index({ sender: 1, peer: 1, createdAt: -1 });
MessageSchema.index({ peer: 1, sender: 1, createdAt: -1 });
MessageSchema.index({ readBy: 1 });

module.exports = mongoose.model('Message', MessageSchema);
