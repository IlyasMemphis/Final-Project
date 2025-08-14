const Follow = require('../models/Follow');
const User = require('../models/User');
const Notification = require('../models/Notification');


exports.followUser = async (req, res) => {
    try {
        const { userIdToFollow } = req.body;
        const followerId = req.user._id || req.user.id;

        if (!userIdToFollow) {
            return res.status(400).json({ message: 'userIdToFollow required' });
        }
        if (userIdToFollow === followerId.toString()) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        const existingFollow = await Follow.findOne({
            follower: followerId,
            following: userIdToFollow
        });
        if (existingFollow) {
            return res.status(400).json({ message: 'Already following' });
        }

        const newFollow = new Follow({
            follower: followerId,
            following: userIdToFollow
        });
        await newFollow.save();

        await Notification.create({
        user: userIdToFollow,     // Кому придёт уведомление
        fromUser: followerId,     // Кто подписался
        type: "follow"
        });

        res.status(200).json({ message: 'Followed successfully' });
    } catch (err) {
        console.error('Follow ERROR:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.unfollowUser = async (req, res) => {
    try {
        const { userIdToFollow } = req.body;
        const followerId = req.user._id || req.user.id;

        if (!userIdToFollow) {
            return res.status(400).json({ message: 'userIdToFollow required' });
        }

        await Follow.findOneAndDelete({
            follower: followerId,
            following: userIdToFollow
        });

        res.status(200).json({ message: 'Unfollowed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getFollowers = async (req, res) => {
    try {
        const followers = await Follow.find({ following: req.params.userId })
            .populate('follower', 'username');
        res.status(200).json(followers);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getFollowing = async (req, res) => {
    try {
        const following = await Follow.find({ follower: req.params.userId })
            .populate('following', 'username');
        res.status(200).json(following);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// 👇 ДОБАВЬ ЭТОТ КОД
exports.isFollowing = async (req, res) => {
    try {
        const followerId = req.user._id?.toString() || req.user.id;
        const userIdToCheck = req.params.userId;
        if (!userIdToCheck) return res.status(400).json({ isFollowing: false });
        const follow = await Follow.findOne({
            follower: followerId,
            following: userIdToCheck
        });
        res.json({ isFollowing: !!follow });
    } catch (e) {
        res.status(500).json({ isFollowing: false });
    }
};