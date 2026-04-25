const User = require('../models/User')

function isGoodUsername(value) {
  const username = String(value || '').trim();
  if (!username) return false;
  if (!/[a-zA-Z]/.test(username)) return false; // убираем 123123 и т.п.
  return true;
}

function hasRealAvatar(value) {
  const avatar = String(value || '').trim().toLowerCase();
  if (!avatar) return false;
  if (avatar.includes('default avatar')) return false;
  if (avatar.includes('placeholder')) return false;
  return true;
}

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q || ""
    let users = []
    if (q.trim() === "") {
      users = await User.find({}, 'username avatar fullName').limit(100)
    } else {
      users = await User.find(
        { username: { $regex: q, $options: 'i' } },
        'username avatar fullName'
      ).limit(100)
    }

    const filtered = users
      .filter((u) => isGoodUsername(u.username) && hasRealAvatar(u.avatar))
      .slice(0, 20);

    res.json(filtered)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}
