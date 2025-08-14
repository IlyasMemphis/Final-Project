const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  try {
    const raw = req.headers.authorization || req.headers.Authorization || '';
    let token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    token = String(token || '').trim();
    if (!token) return res.status(401).json({ message: 'No token' });

    const payload = jwt.verify(token, process.env.JWT_SECRET); // важен тот же секрет, что и при логине
    const uid = payload.id || payload._id || payload.userId;
    if (!uid) return res.status(401).json({ message: 'Bad token payload' });

    // Положим идентификатор во все ожидаемые места — для совместимости со старыми контроллерами
    req.user = { id: uid, _id: uid, userId: uid };
    req.userId = uid;
    res.locals.userId = uid;

    next();
  } catch (e) {
    const msg = e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message: msg });
  }
};
