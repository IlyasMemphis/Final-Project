const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  post:  { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  user:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text:  { type: String, trim: true, minlength: 1, maxlength: 1000, required: true },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
