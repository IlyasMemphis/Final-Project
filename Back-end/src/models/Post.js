// models/Post.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PostSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true },
    image: { type: String, default: '' },

    // добавили массив лайков
    likes: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },

    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Post', PostSchema);
