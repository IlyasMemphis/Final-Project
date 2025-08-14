const jwt = require('jsonwebtoken')
const User = require('../models/User')

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    })
}

exports.register = async (req, res) => {
    const { email, fullName, username, password } = req.body;

    console.log("Register payload:", req.body);
    
    if (!email || !fullName || !username || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const user = new User({ email, fullName, username, password });
        await user.save();

        const token = generateToken(user._id);

        // Добавляем user info для фронта (без пароля!)
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
        console.error("Register error:", error);
        res.status(500).json({ message: 'Server error' });
    }
};


exports.login = async (req, res) => {
    const { email, password } = req.body

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Incorrect login or password. Try again' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Incorrect login or password. Try again' });

        const token = generateToken(user._id);

        // ВОТ ТУТ: возвращаем user info!
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
        res.status(500).json({ message: 'Server error' })
    }
}

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
