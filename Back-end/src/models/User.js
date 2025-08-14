const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true },
    username: { type: String, required: true, unique: true, trim: true },
    avatar: { type: String, default: null },
    password: { type: String, required: true },

    // для восстановления пароля
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// хэш пароля (если уже есть — можешь удалить этот блок и оставить свой)
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(String(this.password), salt);
    next();
  } catch (e) {
    next(e);
  }
});

// сравнение паролей (если уже есть — оставь свой)
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(String(candidate), this.password);
};

module.exports = mongoose.model('User', UserSchema);
