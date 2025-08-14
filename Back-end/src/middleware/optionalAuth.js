// middleware/optionalAuth.js
const jwt = require('jsonwebtoken');

module.exports = function optionalAuth(req, _res, next) {
  try {
    const raw = req.headers.authorization || req.headers.Authorization || '';
    let token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    token = String(token || '').trim();
    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = payload.id || payload._id || payload.userId;
    if (uid) {
      req.user = { id: uid, _id: uid, userId: uid };
      req.userId = uid;
    }
  } catch (_) {
    // просто идём дальше как гость
  }
  next();
};
