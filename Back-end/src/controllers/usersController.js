const User = require('../models/User');

async function getUserById(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUserProfile(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getUserById, getUserProfile };
