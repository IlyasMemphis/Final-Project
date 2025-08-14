const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

/* ---------------- EMAIL ---------------- */
function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendResetEmail(to, resetUrl) {
  const transporter = buildTransporter();
  const from = process.env.FROM_EMAIL || 'ICHgram <no-reply@ichgram.local>';
  const subject = 'Reset your ICHgram password';
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.45">
      <h2>Reset your password</h2>
      <p>We received a request to reset your password. Click the button below:</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0a84ff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Set a new password</a></p>
      <p>Or open this link:<br><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="color:#666;font-size:12px">If you didn’t request this, you can ignore this email.</p>
    </div>
  `;

  if (!transporter) return false;

  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    console.error('sendMail failed:', err?.message || err);
    return false;
  }
}

/* ---------------- AUTH ---------------- */
exports.register = async (req, res) => {
  const { email, fullName, username, password } = req.body;
  if (!email || !fullName || !username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const user = new User({ email, fullName, username, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar || null,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Incorrect login or password. Try again' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect login or password. Try again' });

    const token = generateToken(user._id);
    res.status(200).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar || null,
        email: user.email,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCurrentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ------------- PASSWORD RESET ------------- */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const genericOk = { message: 'If an account exists, we sent a reset link to your email.' };

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json(genericOk);

    // Генерируем токен
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
    user.passwordResetToken = hashed;
    user.passwordResetExpires = new Date(Date.now() + ttlMin * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Ссылка на фронт
    const client = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${client.replace(/\/$/, '')}/reset-password/${rawToken}`;

    // Отправляем письмо
    const mailSent = await sendResetEmail(user.email, resetUrl);

    // Если письмо не ушло, только логируем devLink, но не отправляем клиенту
    if (!mailSent) {
      console.warn('[DEV] Reset password link:', resetUrl);
    }

    return res.json(genericOk);
  } catch (e) {
    console.error('forgotPassword error:', e);
    return res.json(genericOk);
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (!token || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();
    res.json({ message: 'Password has been reset successfully' });
  } catch (e) {
    console.error('resetPassword error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};
