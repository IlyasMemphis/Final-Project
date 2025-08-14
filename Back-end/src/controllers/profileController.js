const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, bio } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;

    if (req.file) {
      const mimeType = req.file.mimetype || req.file.mimeType || 'image/png';
      user.avatar = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
    }

    await user.save();

    res.json({
      message: 'Profile updated',
      user: user.toObject({ getters: true, versionKey: false }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
