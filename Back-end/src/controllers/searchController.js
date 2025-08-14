const User = require('../models/User')

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q || ""
    let users
    if (q.trim() === "") {
      // Если пустой запрос — вернуть просто первых 20 пользователей
      users = await User.find({}, 'username avatar fullName').limit(20)
    } else {
      users = await User.find(
        { username: { $regex: q, $options: 'i' } },
        'username avatar fullName'
      ).limit(20)
    }
    res.json(users)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}
